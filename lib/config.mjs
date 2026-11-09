import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Lee config.json sin que un problema con el archivo tumbe la función.
export function loadConfig() {
  const candidates = [join(process.cwd(), 'config.json')];
  try { candidates.push(new URL('../config.json', import.meta.url)); } catch { /* sin import.meta */ }
  for (const c of candidates) {
    try { return JSON.parse(readFileSync(c, 'utf8')); } catch { /* probar el siguiente */ }
  }
  return {};
}

export function send(res, status, body, cache) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

export function queryOf(req) {
  return req.query || Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
}
