// Función de Vercel: datos de Instagram orgánico para la hoja Social media.
import { loadConfig, send, queryOf } from '../lib/config.mjs';
import { TOKEN } from '../lib/graph.mjs';
import { TZ, localDate, resolveIg, postsInRange, accountTotals, demographics, captureStories, storedStories, saveFollowerSnapshot, followerSnapshots, reachDaily } from '../lib/ig.mjs';
import { redisConfigured } from '../lib/redis.mjs';

const config = loadConfig();
const CACHE_SECONDS = Math.max(60, Number(process.env.META_CACHE_SECONDS) || 3600);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function followerChange(snaps, since, until, current, today) {
  const dates = Object.keys(snaps).sort();
  const at = (d) => { let v = null; for (const k of dates) { if (k <= d) v = Number(snaps[k]); else break; } return v; };
  const dayBefore = new Date(since + 'T12:00:00Z'); dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const start = at(dayBefore.toISOString().slice(0, 10));
  const end = until >= today ? current : at(until);
  const series = dates.filter((d) => d >= since && d <= until).map((d) => ({ date: d, value: Number(snaps[d]) }));
  if (until >= today && typeof current === 'number') series.push({ date: today, value: current });
  return { delta: start != null && end != null ? end - start : null, series, trackedSince: dates[0] || null };
}

async function run(req, res) {
  if (!TOKEN) return send(res, 503, { error: 'not_configured', message: 'Falta configurar META_ACCESS_TOKEN en Vercel.' });
  const { since, until, csince, cuntil } = queryOf(req);
  if (![since, until, csince, cuntil].every(isDate)) return send(res, 400, { error: 'bad_request', message: 'Parámetros since, until, csince y cuntil requeridos (AAAA-MM-DD).' });
  const tz = TZ(config);
  const today = localDate(Date.now(), tz);
  try {
    const ig = await resolveIg();
    // Aprovechamos cada visita para guardar stories activas y el conteo de seguidores.
    await Promise.all([captureStories(ig.id, tz).catch(() => 0), saveFollowerSnapshot(ig.followers_count, tz).catch(() => {})]);
    const [postsCur, postsPrev, totCur, totPrev, demo, stCur, stPrev, snaps, reachSeries] = await Promise.all([
      postsInRange(ig.id, since, until, tz),
      postsInRange(ig.id, csince, cuntil, tz),
      accountTotals(ig.id, since, until),
      accountTotals(ig.id, csince, cuntil),
      demographics(ig.id).catch(() => ({})),
      storedStories(since, until),
      storedStories(csince, cuntil),
      followerSnapshots().catch(() => ({})),
      reachDaily(ig.id, since, until).catch(() => [])
    ]);
    const fol = followerChange(snaps, since, until, ig.followers_count, today);
    return send(res, 200, {
      source: 'instagram',
      generatedAt: new Date().toISOString(),
      account: { id: ig.id, username: ig.username, followers: ig.followers_count ?? null, mediaCount: ig.media_count ?? null, picture: ig.profile_picture_url || null },
      period: { since, until, csince, cuntil },
      totals: { cur: totCur, prev: totPrev },
      posts: { cur: postsCur, prev: postsPrev },
      stories: { cur: stCur, prev: stPrev, tracking: redisConfigured() },
      followers: { current: ig.followers_count ?? null, ...fol },
      demographics: demo,
      reachDaily: reachSeries
    }, `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 4}`);
  } catch (e) {
    const status = e.code === 190 ? 401 : [4, 17, 32, 613].includes(e.code) ? 429 : 502;
    return send(res, status, { error: 'meta_error', code: e.code ?? null, message: e.message });
  }
}

export default async function handler(req, res) {
  try { return await run(req, res); } catch (e) { return send(res, 500, { error: 'server_error', message: String(e?.message || e) }); }
}
