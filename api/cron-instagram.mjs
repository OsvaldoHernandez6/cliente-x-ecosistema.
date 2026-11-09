// Tarea programada (Vercel Cron): guarda stories activas, seguidores y demografía.
// Las métricas de stories solo se pueden consultar mientras la story está publicada (24 h).
import { loadConfig, send } from '../lib/config.mjs';
import { TOKEN } from '../lib/graph.mjs';
import { TZ, localDate, resolveIg, captureStories, saveFollowerSnapshot, demographics } from '../lib/ig.mjs';
import { redis, redisConfigured } from '../lib/redis.mjs';

const config = loadConfig();

export default async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers?.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'unauthorized' });
    if (!TOKEN) return send(res, 503, { error: 'not_configured', message: 'Falta META_ACCESS_TOKEN.' });
    if (!redisConfigured()) return send(res, 503, { error: 'no_storage', message: 'Falta conectar Upstash (Redis) al proyecto en Vercel.' });
    const tz = TZ(config);
    const ig = await resolveIg();
    const stories = await captureStories(ig.id, tz);
    await saveFollowerSnapshot(ig.followers_count, tz);
    const demo = await demographics(ig.id).catch(() => null);
    if (demo) await redis('SET', `ig:demo:${localDate(Date.now(), tz).slice(0, 7)}`, JSON.stringify(demo));
    return send(res, 200, { ok: true, account: ig.username, storiesSaved: stories, followers: ig.followers_count ?? null, at: new Date().toISOString() });
  } catch (e) {
    return send(res, 500, { error: 'cron_error', code: e.code ?? null, message: String(e?.message || e) });
  }
}
