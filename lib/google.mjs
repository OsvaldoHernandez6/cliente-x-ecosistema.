// Autenticación de cuenta de servicio de Google (JWT firmado, sin dependencias) y llamadas a la API de datos de GA4.
import { createSign } from 'node:crypto';

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      const txt = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const j = JSON.parse(txt);
      return { email: j.client_email, key: j.private_key };
    } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido. Pega el contenido completo del archivo .json de la cuenta de servicio.'); }
  }
  if (process.env.GA4_CLIENT_EMAIL && process.env.GA4_PRIVATE_KEY) {
    return { email: process.env.GA4_CLIENT_EMAIL, key: process.env.GA4_PRIVATE_KEY.replace(/\\n/g, '\n') };
  }
  return null;
}

export const gaConfigured = () => Boolean(process.env.GA4_PROPERTY_ID && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || (process.env.GA4_CLIENT_EMAIL && process.env.GA4_PRIVATE_KEY)));

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

let cached = null;
async function accessToken() {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const c = credentials();
  if (!c?.email || !c?.key) throw new Error('Faltan las credenciales de la cuenta de servicio de Google.');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: c.email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(c.key);
  const jwt = `${head}.${claims}.${b64url(sig)}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error('Google rechazó la cuenta de servicio: ' + (j.error_description || j.error || 'HTTP ' + r.status));
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

export class GaError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

// Ejecuta hasta 5 reportes por llamada.
export async function batchRunReports(propertyId, requests) {
  const token = await accessToken();
  const out = [];
  for (let i = 0; i < requests.length; i += 5) {
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: requests.slice(i, i + 5) })
    });
    const j = await r.json().catch(() => ({}));
    if (j.error) throw new GaError(j.error.message || 'Error de Google Analytics', j.error.code);
    out.push(...(j.reports || []));
  }
  return out;
}

// Convierte un reporte en filas { dimension: valor, metrica: número }.
export function rowsOf(report = {}) {
  const dims = (report.dimensionHeaders || []).map((h) => h.name);
  const mets = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((row) => {
    const o = {};
    dims.forEach((d, i) => { o[d] = row.dimensionValues?.[i]?.value; });
    mets.forEach((m, i) => { o[m] = Number(row.metricValues?.[i]?.value) || 0; });
    return o;
  });
}
