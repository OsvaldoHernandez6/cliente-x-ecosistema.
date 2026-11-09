// Upstash Redis vía REST (sin dependencias). Acepta las variables que crea la
// integración de Vercel (KV_REST_API_*) o las de Upstash directo (UPSTASH_REDIS_REST_*).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redisConfigured = () => Boolean(URL_ && TOKEN_);

export async function redis(...cmd) {
  if (!redisConfigured()) return null;
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN_}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result ?? null;
}

export async function pipeline(cmds) {
  if (!redisConfigured() || !cmds.length) return [];
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN_}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? j.map((x) => x?.result ?? null) : [];
}

// HGETALL devuelve [campo, valor, campo, valor...]
export function hashToObject(arr) {
  const o = {};
  if (Array.isArray(arr)) for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}
