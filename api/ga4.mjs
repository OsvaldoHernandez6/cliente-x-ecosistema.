// Función de Vercel: datos de Google Analytics 4 para la hoja Owned media.
import { send, queryOf } from '../lib/config.mjs';
import { gaConfigured, batchRunReports, rowsOf } from '../lib/google.mjs';

const CACHE_SECONDS = Math.max(60, Number(process.env.META_CACHE_SECONDS) || 3600);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const SEG_METRICS = [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'ecommercePurchases' }, { name: 'keyEvents' }];
const byDesc = (name) => [{ metric: { metricName: name }, desc: true }];

async function run(req, res) {
  if (!gaConfigured()) return send(res, 503, { error: 'not_configured', message: 'Falta configurar GA4_PROPERTY_ID y GOOGLE_SERVICE_ACCOUNT_JSON en Vercel.' });
  const { since, until, csince, cuntil } = queryOf(req);
  if (![since, until, csince, cuntil].every(isDate)) return send(res, 400, { error: 'bad_request', message: 'Parámetros since, until, csince y cuntil requeridos (AAAA-MM-DD).' });
  const pid = String(process.env.GA4_PROPERTY_ID).replace(/^properties\//, '').trim();
  const cur = { startDate: since, endDate: until, name: 'cur' };
  const prev = { startDate: csince, endDate: cuntil, name: 'prev' };
  try {
    const reports = await batchRunReports(pid, [
      { dateRanges: [cur, prev], metrics: ['totalUsers', 'newUsers', 'sessions', 'engagementRate', 'userEngagementDuration', 'ecommercePurchases', 'purchaseRevenue', 'keyEvents'].map((name) => ({ name })) },
      { dateRanges: [cur], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'] } } } },
      { dateRanges: [cur], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'ecommercePurchases' }, { name: 'keyEvents' }, { name: 'purchaseRevenue' }], orderBys: byDesc('sessions'), limit: 12 },
      { dateRanges: [cur], dimensions: [{ name: 'userAgeBracket' }], metrics: SEG_METRICS, orderBys: byDesc('totalUsers'), limit: 10 },
      { dateRanges: [cur], dimensions: [{ name: 'deviceCategory' }], metrics: SEG_METRICS, orderBys: byDesc('totalUsers'), limit: 5 },
      { dateRanges: [cur], dimensions: [{ name: 'region' }], metrics: SEG_METRICS, orderBys: byDesc('totalUsers'), limit: 8 },
      { dateRanges: [cur], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }, { name: 'activeUsers' }, { name: 'engagementRate' }], orderBys: byDesc('screenPageViews'), limit: 8 },
      { dateRanges: [cur], dimensions: [{ name: 'itemName' }], metrics: [{ name: 'itemsPurchased' }, { name: 'itemRevenue' }], orderBys: byDesc('itemRevenue'), limit: 6 }
    ]);
    const [rTot, rFun, rCh, rAge, rDev, rReg, rPages, rItems] = reports.map(rowsOf);
    const pick = (name) => rTot.find((r) => r.dateRange === name) || {};
    const totals = { cur: pick('cur'), prev: pick('prev') };
    for (const k of ['cur', 'prev']) delete totals[k].dateRange;
    const ecommerce = (totals.cur.ecommercePurchases || 0) > 0 || rFun.some((r) => r.eventName === 'purchase' && r.eventCount > 0);
    const seg = (rows, dim) => rows.map((r) => ({ name: r[dim], users: r.totalUsers, sessions: r.sessions, conv: ecommerce ? r.ecommercePurchases : r.keyEvents }));
    return send(res, 200, {
      source: 'ga4',
      generatedAt: new Date().toISOString(),
      property: pid,
      period: { since, until, csince, cuntil },
      mode: ecommerce ? 'ecommerce' : 'keyEvents',
      totals,
      funnel: Object.fromEntries(rFun.map((r) => [r.eventName, r.eventCount])),
      channels: rCh.map((r) => ({ name: r.sessionDefaultChannelGroup, sessions: r.sessions, conv: ecommerce ? r.ecommercePurchases : r.keyEvents, revenue: r.purchaseRevenue })),
      segments: { edad: seg(rAge, 'userAgeBracket'), disp: seg(rDev, 'deviceCategory'), region: seg(rReg, 'region') },
      pages: rPages.map((r) => ({ path: r.pagePath, views: r.screenPageViews, engagementSec: r.activeUsers ? r.userEngagementDuration / r.activeUsers : null, engagementRate: r.engagementRate })),
      items: rItems.map((r) => ({ name: r.itemName, qty: r.itemsPurchased, revenue: r.itemRevenue })).filter((x) => x.name && x.name !== '(not set)')
    }, `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 4}`);
  } catch (e) {
    const status = e.status === 403 ? 403 : e.status === 429 ? 429 : 502;
    return send(res, status, { error: 'ga_error', code: e.status ?? null, message: e.message });
  }
}

export default async function handler(req, res) {
  try { return await run(req, res); } catch (e) { return send(res, 500, { error: 'server_error', message: String(e?.message || e) }); }
}
