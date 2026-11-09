// Cliente mínimo de la Graph API de Meta.
export const API_VERSION = process.env.META_API_VERSION || 'v26.0';
export const TOKEN = process.env.META_ACCESS_TOKEN;

export class MetaError extends Error {
  constructor(e) {
    super(e?.message || 'Error de la API de Meta');
    this.code = e?.code;
    this.subcode = e?.error_subcode;
  }
}

function buildUrl(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  url.searchParams.set('access_token', TOKEN);
  return url.toString();
}

async function getJson(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({ error: { message: 'Respuesta no válida de Meta (HTTP ' + r.status + ')' } }));
  if (j.error) throw new MetaError(j.error);
  return j;
}

// Una sola página (o un objeto).
export const graphOne = (path, params) => getJson(buildUrl(path, params));

// Recorre páginas mientras keepGoing(lastPageRows) sea verdadero.
export async function graphPaged(path, params, keepGoing = () => true, maxPages = 20) {
  let next = buildUrl(path, params);
  const rows = [];
  for (let i = 0; next && i < maxPages; i++) {
    const j = await getJson(next);
    const data = Array.isArray(j.data) ? j.data : [];
    rows.push(...data);
    if (!keepGoing(data)) break;
    next = j.paging?.next || null;
  }
  return rows;
}

// Ejecuta tareas con concurrencia limitada.
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  });
  await Promise.all(workers);
  return out;
}
