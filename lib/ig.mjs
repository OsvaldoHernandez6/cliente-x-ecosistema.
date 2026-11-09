// Lógica compartida de Instagram (API de Instagram con inicio de sesión de Facebook).
import { graphOne, graphPaged, pool, MetaError } from './graph.mjs';
import { redis, pipeline, hashToObject, redisConfigured } from './redis.mjs';

export const TZ = (cfg) => cfg?.timezone || 'America/Santiago';

// Fecha local (AAAA-MM-DD) de un timestamp, en la zona horaria del cliente.
export const localDate = (ts, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));

const IG_FIELDS = 'id,username,followers_count,media_count,profile_picture_url';

// Encuentra la cuenta de Instagram: por ID directo, por página de Facebook o, si no, la primera página del usuario del sistema que tenga Instagram.
export async function resolveIg() {
  if (process.env.META_IG_USER_ID) return graphOne(process.env.META_IG_USER_ID, { fields: IG_FIELDS });
  if (process.env.META_PAGE_ID) {
    const p = await graphOne(process.env.META_PAGE_ID, { fields: `instagram_business_account{${IG_FIELDS}}` });
    if (p.instagram_business_account) return p.instagram_business_account;
    throw new MetaError({ message: 'La página indicada en META_PAGE_ID no tiene una cuenta de Instagram profesional vinculada.' });
  }
  const pages = await graphPaged('me/accounts', { fields: `name,instagram_business_account{${IG_FIELDS}}`, limit: 50 });
  const withIg = pages.find((p) => p.instagram_business_account);
  if (withIg) return withIg.instagram_business_account;
  throw new MetaError({ message: 'No se encontró ninguna cuenta de Instagram profesional asignada al usuario del sistema. Asigna la página y la cuenta de Instagram, o define META_PAGE_ID.' });
}

export function mediaKind(m) {
  if (m.media_product_type === 'STORY') return 'sto';
  if (m.media_product_type === 'REELS' || m.media_type === 'VIDEO') return 'reels';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'car';
  return 'img';
}

function parseInsights(data) {
  const o = {};
  for (const row of data || []) {
    const v = row.total_value?.value ?? row.values?.[0]?.value;
    if (typeof v === 'number') o[row.name] = v;
  }
  return o;
}

// Pide métricas probando listas de mayor a menor; si una métrica no aplica al tipo, cae a la siguiente lista.
async function insightsWithFallback(id, lists, extra = {}) {
  for (const metrics of lists) {
    try {
      const j = await graphOne(`${id}/insights`, { metric: metrics.join(','), ...extra });
      return parseInsights(j.data);
    } catch (e) {
      if (e.code === 190) throw e;
    }
  }
  return {};
}

const POST_METRICS = {
  reels: [['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time'], ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions'], ['reach', 'likes', 'comments', 'shares', 'saved']],
  car: [['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions'], ['reach', 'likes', 'comments', 'shares', 'saved'], ['reach']],
  img: [['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions'], ['reach', 'likes', 'comments', 'shares', 'saved'], ['reach']],
  sto: [['reach', 'views', 'replies', 'shares', 'total_interactions'], ['reach', 'replies'], ['reach']]
};

export function normalizePost(m, ins, tz) {
  const kind = mediaKind(m);
  const likes = ins.likes ?? m.like_count ?? 0;
  const comments = ins.comments ?? m.comments_count ?? 0;
  const shares = ins.shares ?? 0;
  const saved = ins.saved ?? 0;
  return {
    id: m.id, kind, caption: (m.caption || '').slice(0, 160), timestamp: m.timestamp, date: localDate(m.timestamp, tz),
    permalink: m.permalink || null, thumb: m.thumbnail_url || (m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM' ? m.media_url : null) || null,
    reach: ins.reach ?? null, views: ins.views ?? null, likes, comments, shares, saved,
    replies: ins.replies ?? null,
    interactions: ins.total_interactions ?? likes + comments + shares + saved,
    avgWatchMs: ins.ig_reels_avg_watch_time ?? null
  };
}

export async function postsInRange(igId, sinceDate, untilDate, tz, max = 80) {
  const sinceTs = new Date(sinceDate + 'T00:00:00Z').getTime() - 864e5; // margen por zona horaria
  const media = await graphPaged(`${igId}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count', limit: 50 },
    (page) => page.length && new Date(page[page.length - 1].timestamp).getTime() >= sinceTs);
  const inRange = media.filter((m) => { const d = localDate(m.timestamp, tz); return d >= sinceDate && d <= untilDate; }).slice(0, max);
  const ins = await pool(inRange, 6, (m) => insightsWithFallback(m.id, POST_METRICS[mediaKind(m)] || POST_METRICS.img));
  return inRange.map((m, i) => normalizePost(m, ins[i], tz));
}

const toUnix = (d, end) => Math.floor(new Date(d + (end ? 'T23:59:59Z' : 'T00:00:00Z')).getTime() / 1000);
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const ACCOUNT_METRICS = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'profile_links_taps', 'likes', 'comments', 'shares', 'saves', 'replies'];

// Totales de cuenta. Se piden en tramos de hasta 30 días y se suman (el alcance de rangos largos queda aproximado).
export async function accountTotals(igId, since, until) {
  // Primero intenta el rango completo; si Instagram lo rechaza, divide en tramos de 30 días.
  try {
    const j = await graphOne(`${igId}/insights`, { metric: ACCOUNT_METRICS.join(','), period: 'day', metric_type: 'total_value', since: String(toUnix(since)), until: String(toUnix(until, true)) });
    const whole = parseInsights(j.data);
    if (Object.keys(whole).length) return { ...whole, approxReach: false };
  } catch (err) { if (err.code === 190) throw err; }
  const chunks = [];
  for (let s = since; s <= until; s = addDays(s, 30)) { const e = addDays(s, 29); chunks.push([s, e < until ? e : until]); }
  const totals = {};
  for (const [s, e] of chunks) {
    let part = {};
    try {
      const j = await graphOne(`${igId}/insights`, { metric: ACCOUNT_METRICS.join(','), period: 'day', metric_type: 'total_value', since: String(toUnix(s)), until: String(toUnix(e, true)) });
      part = parseInsights(j.data);
    } catch (err) {
      if (err.code === 190) throw err;
      const each = await pool(ACCOUNT_METRICS, 4, async (m) => {
        try { const j = await graphOne(`${igId}/insights`, { metric: m, period: 'day', metric_type: 'total_value', since: String(toUnix(s)), until: String(toUnix(e, true)) }); return parseInsights(j.data); } catch { return {}; }
      });
      part = Object.assign({}, ...each);
    }
    for (const [k, v] of Object.entries(part)) totals[k] = (totals[k] || 0) + v;
  }
  return { ...totals, approxReach: chunks.length > 1 };
}

export async function demographics(igId) {
  const out = {};
  for (const b of ['age', 'gender', 'country']) {
    for (const timeframe of ['this_month', undefined]) {
      try {
        const j = await graphOne(`${igId}/insights`, { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: b, timeframe });
        const res = j.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        out[b] = res.map((r) => [r.dimension_values?.[0], r.value]).filter((x) => x[0] != null);
        break;
      } catch (e) { if (e.code === 190) throw e; }
    }
  }
  return out;
}

// ---------- Historial en Redis ----------
export const monthsBetween = (since, until) => {
  const out = [];
  let [y, m] = since.slice(0, 7).split('-').map(Number);
  const [ey, em] = until.slice(0, 7).split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
};

// Guarda las stories activas y sus métricas (se pueden consultar solo mientras están publicadas).
export async function captureStories(igId, tz) {
  if (!redisConfigured()) return 0;
  const stories = await graphPaged(`${igId}/stories`, { fields: 'id,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url', limit: 50 }).catch(() => []);
  if (!stories.length) return 0;
  const ins = await pool(stories, 6, (s) => insightsWithFallback(s.id, POST_METRICS.sto));
  const cmds = stories.map((s, i) => {
    const p = normalizePost({ ...s, media_product_type: 'STORY' }, ins[i], tz);
    return ['HSET', `ig:stories:${p.date.slice(0, 7)}`, p.id, JSON.stringify({ ...p, updatedAt: new Date().toISOString() })];
  });
  await pipeline(cmds);
  return stories.length;
}

export async function storedStories(since, until) {
  if (!redisConfigured()) return null;
  const res = await pipeline(monthsBetween(since, until).map((k) => ['HGETALL', `ig:stories:${k}`]));
  const all = res.flatMap((arr) => Object.values(hashToObject(arr)).map((v) => { try { return JSON.parse(v); } catch { return null; } })).filter(Boolean);
  return all.filter((s) => s.date >= since && s.date <= until);
}

export async function saveFollowerSnapshot(count, tz) {
  if (!redisConfigured() || typeof count !== 'number') return;
  await redis('HSET', 'ig:followers', localDate(Date.now(), tz), String(count));
}

export async function followerSnapshots() {
  if (!redisConfigured()) return {};
  return hashToObject(await redis('HGETALL', 'ig:followers'));
}

// Alcance diario (serie) para gráficos; se pide en tramos de 30 días.
export async function reachDaily(igId, since, until) {
  const out = [];
  for (let s = since; s <= until; s = addDays(s, 30)) {
    const e = addDays(s, 29) < until ? addDays(s, 29) : until;
    try {
      const j = await graphOne(`${igId}/insights`, { metric: 'reach', period: 'day', since: String(toUnix(s)), until: String(toUnix(e, true)) });
      for (const v of j.data?.[0]?.values || []) out.push({ date: (v.end_time || '').slice(0, 10), value: v.value });
    } catch (err) { if (err.code === 190) throw err; }
  }
  return out;
}
