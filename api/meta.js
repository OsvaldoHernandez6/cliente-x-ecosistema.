// Función serverless de Vercel: consulta la API de Marketing de Meta y entrega
// al dashboard los datos de Paid media ya calculados.
// El token NUNCA va en el repo: se lee de la variable de entorno META_ACCESS_TOKEN.

import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));

const API_VERSION = process.env.META_API_VERSION || 'v26.0';
const CACHE_SECONDS = Math.max(60, Number(process.env.META_CACHE_SECONDS) || 3600);
const TOKEN = process.env.META_ACCESS_TOKEN;
const RAW_ACCOUNT = process.env.META_AD_ACCOUNT_ID || config.meta?.adAccountId || '';
const ACCOUNT = RAW_ACCOUNT.startsWith('act_') ? RAW_ACCOUNT : (RAW_ACCOUNT ? 'act_' + RAW_ACCOUNT : '');

const PURCHASE_TYPES = [config.meta?.purchaseActionType, 'omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']
  .filter((v, i, a) => v && a.indexOf(v) === i);

const METRIC_FIELDS = ['spend', 'impressions', 'reach', 'inline_link_clicks', 'actions', 'action_values'];

class MetaError extends Error {
  constructor(e) {
    super(e?.message || 'Error de la API de Meta');
    this.code = e?.code;
    this.subcode = e?.error_subcode;
    this.type = e?.type;
  }
}

async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  url.searchParams.set('access_token', TOKEN);
  let next = url.toString();
  const rows = [];
  let guard = 0;
  while (next && guard++ < 50) {
    const r = await fetch(next);
    const j = await r.json().catch(() => ({ error: { message: 'Respuesta no válida de Meta (HTTP ' + r.status + ')' } }));
    if (j.error) throw new MetaError(j.error);
    if (!Array.isArray(j.data)) return j;
    rows.push(...j.data);
    next = j.paging?.next || null;
  }
  return rows;
}

function pickAction(list) {
  if (!Array.isArray(list)) return 0;
  for (const t of PURCHASE_TYPES) {
    const a = list.find((x) => x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}

// Convierte una fila de Insights en métricas listas para mostrar.
export function computeMetrics(row = {}) {
  const spend = Number(row.spend) || 0;
  const impressions = Number(row.impressions) || 0;
  const reach = row.reach !== undefined ? Number(row.reach) || 0 : null;
  const linkClicks = Number(row.inline_link_clicks) || 0;
  const purchases = pickAction(row.actions);
  const revenue = pickAction(row.action_values);
  const div = (a, b) => (b ? a / b : null);
  return {
    spend, impressions, reach, linkClicks, purchases, revenue,
    roas: div(revenue, spend),
    cpa: div(spend, purchases),
    aov: div(revenue, purchases),
    ctr: impressions ? (linkClicks / impressions) * 100 : null,
    cpm: div(spend * 1000, impressions),
    cpc: div(spend, linkClicks),
    frequency: reach ? impressions / reach : null
  };
}

function stageFromObjective(obj = '') {
  const o = obj.toUpperCase();
  if (['OUTCOME_AWARENESS', 'BRAND_AWARENESS', 'REACH', 'VIDEO_VIEWS'].includes(o)) return { id: 'rec', label: 'Reconocimiento' };
  if (['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'LINK_CLICKS', 'POST_ENGAGEMENT', 'PAGE_LIKES', 'MESSAGES', 'EVENT_RESPONSES'].includes(o)) return { id: 'cons', label: 'Consideración' };
  return { id: 'conv', label: 'Conversión' };
}

function adFormat(creative = {}) {
  const spec = creative.object_story_spec || {};
  const children = spec.link_data?.child_attachments;
  if (Array.isArray(children) && children.length > 1) return 'Carrusel · ' + children.length;
  if (creative.video_id || creative.object_type === 'VIDEO' || spec.video_data || creative.asset_feed_spec?.videos?.length) return 'Video';
  return 'Imagen';
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function handler(req, res) {
  const send = (status, body, cache) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cache || 'no-store');
    res.status(status).send(JSON.stringify(body));
  };

  if (!TOKEN || !ACCOUNT) {
    return send(503, { error: 'not_configured', message: 'Falta configurar META_ACCESS_TOKEN y META_AD_ACCOUNT_ID en Vercel.' });
  }

  const q = req.query || {};
  const { since, until, csince, cuntil } = q;
  if (![since, until, csince, cuntil].every(isDate)) {
    return send(400, { error: 'bad_request', message: 'Parámetros since, until, csince y cuntil requeridos (AAAA-MM-DD).' });
  }

  const unified = config.meta?.useUnifiedAttribution !== false;
  const base = { fields: METRIC_FIELDS.join(','), use_unified_attribution_setting: unified ? 'true' : undefined, limit: 500 };
  const tr = (s, u) => ({ since: s, until: u });

  try {
    const insights = (params) => graph(`${ACCOUNT}/insights`, { ...base, ...params });

    const [
      totCur, totPrev, dayCur, dayPrev, campCur, campPrev, campMeta, adsCur, account
    ] = await Promise.all([
      insights({ level: 'account', time_range: tr(since, until) }),
      insights({ level: 'account', time_range: tr(csince, cuntil) }),
      insights({ level: 'account', time_range: tr(since, until), time_increment: 1 }),
      insights({ level: 'account', time_range: tr(csince, cuntil), time_increment: 1 }),
      insights({ level: 'campaign', time_range: tr(since, until), fields: ['campaign_id', 'campaign_name', 'objective', ...METRIC_FIELDS].join(',') }),
      insights({ level: 'campaign', time_range: tr(csince, cuntil), fields: ['campaign_id', ...METRIC_FIELDS].join(',') }),
      graph(`${ACCOUNT}/campaigns`, { fields: 'id,name,effective_status,objective', limit: 500 }).catch(() => []),
      insights({ level: 'ad', time_range: tr(since, until), fields: ['ad_id', 'ad_name', 'campaign_name', ...METRIC_FIELDS].join(',') }),
      graph(ACCOUNT, { fields: 'currency,timezone_name,name' }).catch(() => ({}))
    ]);

    const totals = { cur: computeMetrics(totCur[0]), prev: computeMetrics(totPrev[0]) };
    const daily = {
      cur: dayCur.map((r) => ({ date: r.date_start, ...computeMetrics(r) })).sort((a, b) => a.date.localeCompare(b.date)),
      prev: dayPrev.map((r) => ({ date: r.date_start, ...computeMetrics(r) })).sort((a, b) => a.date.localeCompare(b.date))
    };

    const prevById = Object.fromEntries(campPrev.map((r) => [r.campaign_id, computeMetrics(r)]));
    const metaById = Object.fromEntries((Array.isArray(campMeta) ? campMeta : []).map((c) => [c.id, c]));
    const campaigns = campCur.map((r) => {
      const m = computeMetrics(r);
      const meta = metaById[r.campaign_id] || {};
      const stage = stageFromObjective(r.objective || meta.objective);
      const p = prevById[r.campaign_id];
      return {
        id: r.campaign_id,
        name: r.campaign_name,
        objective: r.objective || meta.objective || '',
        stage: stage.label,
        stageId: stage.id,
        status: meta.effective_status === 'ACTIVE' ? 'Activa' : meta.effective_status ? 'Pausada' : '—',
        active: meta.effective_status === 'ACTIVE',
        ...m,
        prevRoas: p?.roas ?? null
      };
    }).filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend);

    const minSpend = Number(config.meta?.winnerMinSpend) || 0;
    const ranked = adsCur.map((r) => ({ id: r.ad_id, name: r.ad_name, campaign: r.campaign_name, ...computeMetrics(r) }))
      .filter((a) => a.spend >= minSpend && a.purchases > 0 && a.roas)
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 3);

    let creatives = {};
    if (ranked.length) {
      creatives = await graph('', {
        ids: ranked.map((a) => a.id).join(','),
        fields: 'creative.thumbnail_width(720).thumbnail_height(720){thumbnail_url,image_url,object_type,video_id,instagram_permalink_url,effective_object_story_id,object_story_spec,asset_feed_spec}'
      }).catch(() => ({}));
    }
    const ads = ranked.map((a) => {
      const c = creatives?.[a.id]?.creative || {};
      return {
        ...a,
        format: adFormat(c),
        isVideo: adFormat(c) === 'Video',
        thumb: c.image_url || c.thumbnail_url || null,
        link: c.instagram_permalink_url || (c.effective_object_story_id ? `https://www.facebook.com/${c.effective_object_story_id}` : null),
        sharePurchases: totals.cur.purchases ? a.purchases / totals.cur.purchases : null
      };
    });

    return send(200, {
      source: 'meta',
      generatedAt: new Date().toISOString(),
      account: { name: account.name || null, currency: account.currency || config.currency || 'CLP', timezone: account.timezone_name || null },
      period: { since, until, csince, cuntil },
      totals, daily, campaigns, ads
    }, `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 4}`);
  } catch (e) {
    const status = e.code === 190 ? 401 : e.code === 17 || e.code === 4 || e.code === 613 ? 429 : 502;
    return send(status, { error: 'meta_error', code: e.code ?? null, message: e.message });
  }
}
