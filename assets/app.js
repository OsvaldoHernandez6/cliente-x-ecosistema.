import { samplePaid, sampleGa, sampleSocial } from './sample-data.js';

/* ============================================================
   Utilidades
   ============================================================ */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('eco:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('eco:' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
};

let CONFIG = { client: { name: 'Cliente', logo: '' }, currency: 'CLP', locale: 'es-CL', meta: {}, goals: {}, strategy: {} };

const nf = (d) => new Intl.NumberFormat(CONFIG.locale || 'es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
const F = {
  int: (n) => (n == null || isNaN(n) ? '—' : nf(0).format(Math.round(n))),
  dec: (n, d = 2) => (n == null || isNaN(n) ? '—' : nf(d).format(n)),
  money: (n) => {
    if (n == null || isNaN(n)) return '—';
    const cur = CONFIG.currency || 'CLP';
    if (cur === 'CLP') return '$' + nf(0).format(Math.round(n));
    return new Intl.NumberFormat(CONFIG.locale || 'es-CL', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
  },
  moneyShort: (n) => (n == null || isNaN(n) ? '—' : n >= 1e6 ? '$' + nf(1).format(n / 1e6) + 'M' : n >= 1e3 ? '$' + nf(0).format(n / 1e3) + 'K' : '$' + nf(0).format(n)),
  intShort: (n) => (n == null || isNaN(n) ? '—' : n >= 1e6 ? nf(1).format(n / 1e6) + 'M' : n >= 1e5 ? nf(0).format(n / 1e3) + 'K' : n >= 1e4 ? nf(1).format(n / 1e3) + 'K' : nf(0).format(n)),
  pct: (n, d = 2) => (n == null || isNaN(n) ? '—' : nf(d).format(n) + '%'),
  x: (n, d = 2) => (n == null || isNaN(n) ? '—' : nf(d).format(n) + 'x')
};

function delta(cur, prev, good) {
  if (cur == null || prev == null || !prev || isNaN(cur)) return { txt: '—', cls: 'neu', arrow: '' };
  const d = (cur - prev) / Math.abs(prev);
  const flat = Math.abs(d) < 0.0005;
  const cls = flat || good === 0 ? 'neu' : (d >= 0) === (good > 0) ? 'pos' : 'neg';
  return { txt: (d >= 0 ? '+' : '−') + F.dec(Math.abs(d * 100), 1) + '%', cls, arrow: flat ? '' : d >= 0 ? '▲' : '▼' };
}

/* ============================================================
   Fechas y período
   ============================================================ */
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const firstOf = (y, m) => new Date(y, m, 1);
const lastOf = (y, m) => new Date(y, m + 1, 0);
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayLabel = (s) => { const d = parse(s); return d.getDate() + ' ' + MES[d.getMonth()]; };

function spanLabel(a, b, wholeMonths) {
  if (wholeMonths) {
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return MESL[a.getMonth()] + ' ' + a.getFullYear();
    return MES[a.getMonth()] + (a.getFullYear() !== b.getFullYear() ? ' ' + a.getFullYear() : '') + ' – ' + MES[b.getMonth()] + ' ' + b.getFullYear();
  }
  const sameM = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return a.getDate() + (sameM ? '' : ' ' + MES[a.getMonth()]) + ' – ' + b.getDate() + ' ' + MES[b.getMonth()] + ' ' + b.getFullYear();
}

function computeRange(st, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  let since, until, months = 0;
  if (st.range === 'mes') {
    since = firstOf(y, m);
    until = new Date(y, m, now.getDate());
  } else if (st.range === 'ant') {
    since = firstOf(y, m - 1); until = lastOf(y, m - 1); months = 1;
  } else {
    since = firstOf(y, m - st.rFrom); until = lastOf(y, m - st.rTo); months = st.rFrom - st.rTo + 1;
  }
  let csince, cuntil;
  if (st.cmp === 'yoy') {
    csince = new Date(since.getFullYear() - 1, since.getMonth(), since.getDate());
    const lu = lastOf(until.getFullYear() - 1, until.getMonth());
    cuntil = months ? lu : new Date(until.getFullYear() - 1, until.getMonth(), Math.min(until.getDate(), lu.getDate()));
  } else if (months) {
    csince = firstOf(since.getFullYear(), since.getMonth() - months);
    cuntil = lastOf(until.getFullYear(), until.getMonth() - months);
  } else {
    csince = firstOf(since.getFullYear(), since.getMonth() - 1);
    const lp = lastOf(since.getFullYear(), since.getMonth() - 1).getDate();
    cuntil = new Date(since.getFullYear(), since.getMonth() - 1, Math.min(until.getDate(), lp));
  }
  const days = Math.round((until - since) / 864e5) + 1;
  return {
    since: iso(since), until: iso(until), csince: iso(csince), cuntil: iso(cuntil), days,
    monthsLen: months || days / 30.4,
    label: spanLabel(since, until, !!months) + (months > 1 ? ' · ' + months + ' meses' : ''),
    clabel: spanLabel(csince, cuntil, !!months),
    monthKey: iso(until).slice(0, 7),
    partial: !months
  };
}

function monthOptions(now = new Date()) {
  const out = [];
  for (let off = 6; off >= 1; off--) {
    const d = firstOf(now.getFullYear(), now.getMonth() - off);
    out.push({ off, label: MES[d.getMonth()].replace(/^./, (c) => c.toUpperCase()) + ' ' + d.getFullYear() });
  }
  return out;
}


/* ============================================================
   Estado
   ============================================================ */
const ZOOMS = [0.9, 1, 1.12];
const state = {
  theme: LS.get('theme2', (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'),
  zoom: LS.get('zoom', 1),
  tab: 'owned', periodOpen: false,
  range: 'ant', rFrom: 1, rTo: 1, cmp: 'prev',
  act: 4, campSel: null,
  paid: null, paidNote: null, paidLoading: false,
  owned: null, ownedNote: null, ownedLoading: false,
  social: null, socialNote: null, socialLoading: false,
  animate: true
};

/* ============================================================
   Íconos y piezas visuales
   ============================================================ */
const svg = (d, size = 16, sw = 1.75, fill = 'none') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${fill === 'none' ? 'currentColor' : 'none'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  cal: svg('<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>', 15),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>', 12, 2.25),
  play: svg('<path d="M8 5.5v13l11-6.5z"/>', 20, 0, 'currentColor'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>', 13, 2),
  img: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', 26, 1.5)
};
const em = (t) => `<em class="acc">${t}</em>`;
const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());
const sum = (xs) => xs.reduce((a, b) => a + (Number(b) || 0), 0);
const avg = (xs) => { const v = xs.filter((x) => x != null && !isNaN(x)); return v.length ? sum(v) / v.length : null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function sparkPts(vals, w, h, pad = 3) {
  const v = vals.map((x) => (x == null || isNaN(x) ? null : Number(x)));
  const ok = v.filter((x) => x != null);
  if (ok.length < 2) return null;
  let lo = Math.min(...ok), hi = Math.max(...ok);
  const mean = Math.abs(ok.reduce((a, b) => a + b, 0) / ok.length) || 1;
  if ((hi - lo) / mean < 0.02) { lo -= mean; hi += mean; }
  const r = hi - lo || 1;
  const pts = [];
  v.forEach((x, i) => { if (x != null) pts.push(`${((i * w) / (v.length - 1)).toFixed(1)},${(h - pad - ((x - lo) / r) * (h - 2 * pad)).toFixed(1)}`); });
  return { line: pts.join(' '), area: `0,${h} ${pts.join(' ')} ${w},${h}` };
}
function sparkSvg(vals, { w = 120, h = 34, stroke = 'var(--faint)', fill = 'rgba(127,127,127,0.08)', sw = 1.75, style = '' } = {}) {
  const p = sparkPts(vals, w, h);
  if (!p) return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" style="${style}"></svg>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" style="${style}"><polygon points="${p.area}" fill="${fill}"/><polyline points="${p.line}" fill="none" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/></svg>`;
}

const deltaChip = (dl, extra = '') => `<span class="delta num ${dl.cls}">${dl.arrow} ${esc(dl.txt)}${extra}</span>`;
// good: 1 sube es bueno, -1 baja es bueno, 0 neutro
function kpi(label, value, dl, vals, prevTxt) {
  const tone = dl.cls === 'pos' ? 'var(--pos)' : dl.cls === 'neg' ? 'var(--neg)' : 'var(--faint)';
  const soft = dl.cls === 'pos' ? 'var(--posSoft)' : dl.cls === 'neg' ? 'var(--negSoft)' : 'rgba(127,127,127,0.08)';
  return `<div class="kpi rise" title="${esc(prevTxt ? 'Período de comparación: ' + prevTxt : '')}"><div class="in"><span class="lbl">${esc(label)}</span><span class="v num">${value}</span>${deltaChip(dl)}</div>${sparkSvg(vals, { w: 100, h: 40, stroke: tone, fill: soft })}</div>`;
}
const head = (eyebrow, title, right = '') => `<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px"><div><div class="lbl">${eyebrow}</div><h3 class="serif">${title}</h3></div>${right}</div>`;
const insight = (text, tone = '', label = 'Lectura') => text ? `<div class="insight ${tone}"><span class="lbl">${label}</span>${text}</div>` : '';
const card = (span, inner, extra = '') => `<section class="card rise" style="grid-column:span ${span};${extra}">${inner}</section>`;
const legendDot = (color, label, shape = 'sq') => `<span style="display:flex;align-items:center;gap:6px"><span style="width:${shape === 'line' ? 18 : 10}px;height:${shape === 'line' ? 3 : 10}px;border-radius:${shape === 'dot' ? 999 : 3}px;background:${color}"></span>${label}</span>`;

function ring(p, size, r, sw, color, inner) {
  const C = 2 * Math.PI * r, c = size / 2;
  return `<div style="position:relative;width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true" style="width:${size}px;height:${size}px;transform:rotate(-90deg)"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${sw}"/><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(clamp(p, 0, 1) * C).toFixed(1)} ${C.toFixed(1)}"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">${inner}</div></div>`;
}
function donut(parts, size, r, sw, inner) {
  const C = 2 * Math.PI * r, c = size / 2, tot = sum(parts.map((p) => p[1])) || 1;
  let acc = 0, segs = '';
  for (const [, v, color] of parts) {
    const f = v / tot;
    if (f > 0) segs += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${Math.max(0.5, f * C - (parts.length > 1 ? 3 : 0)).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-acc * C).toFixed(1)}"/>`;
    acc += f;
  }
  return `<div style="position:relative;width:${size}px;height:${size}px;align-self:center"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true" style="width:${size}px;height:${size}px;transform:rotate(-90deg)"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${sw}"/>${segs}</svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">${inner}</div></div>`;
}
// Número grande del héroe: separa el sufijo (x, M, K, %) para escribirlo en serif.
function heroNum(txt) {
  const m = String(txt).match(/^(.*?)([A-Za-z%]+)$/);
  return m ? `${esc(m[1])}<span class="serif suffix">${esc(m[2])}</span>` : esc(txt);
}
function hero(span, { label, right, value, sentence, badge, spark }) {
  return `<section class="hero rise" style="grid-column:span ${span}">
    ${spark ? sparkSvg(spark, { w: 400, h: 160, stroke: 'currentColor', fill: 'rgba(0,0,0,0.06)', sw: 2, style: 'position:absolute;left:0;right:0;bottom:0;width:100%;height:150px;opacity:.55' }) : ''}
    <div style="display:flex;justify-content:space-between;gap:12px;position:relative"><span class="mono" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase">${label}</span><span class="mono" style="font-size:11px;text-transform:uppercase">${right || ''}</span></div>
    <div style="position:relative"><div class="num bignum">${heroNum(value)}</div><div class="serif sentence">${sentence || ''}</div></div>
    ${badge ? `<span class="badge num">${badge}</span>` : ''}
  </section>`;
}
const badgeTxt = (dl, r) => (dl.txt === '—' ? '' : `${dl.arrow} ${dl.txt} vs ${esc(cmpShort(r))}`);
function cmpShort(r) {
  const a = parse(r.csince), b = parse(r.cuntil);
  if (!r.partial && a.getMonth() === b.getMonth()) return MESL[a.getMonth()] + (state.cmp === 'yoy' ? ' ' + a.getFullYear() : '');
  return state.cmp === 'yoy' ? 'el año anterior' : 'el período anterior';
}
const monthName = (r) => (r.partial || parse(r.since).getMonth() !== parse(r.until).getMonth() ? 'el período' : MESL[parse(r.until).getMonth()]);
const monthCap = (r) => cap(monthName(r));
const nextMonth = (r) => MESL[(parse(r.until).getMonth() + 1) % 12];

/* ============================================================
   Cabecera y portada
   ============================================================ */
const TABS = [['owned', '01', 'Owned media', 'GA4'], ['paid', '02', 'Paid media', 'Meta'], ['social', '03', 'Social media', 'Instagram']];
const isLive = (id) => (id === 'paid' ? state.paid?.source === 'meta' : id === 'owned' ? state.owned?.source === 'ga4' : state.social?.source === 'instagram');

function viewHeader(r) {
  const name = CONFIG.client?.name || 'Cliente';
  const logo = CONFIG.client?.logo;
  const initials = name.replace(/\[|\]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('') || '·';
  const opts = monthOptions();
  const sel = (act, cur, list) => `<select class="select ${state.range === 'custom' ? 'on' : ''}" data-change="${act}" aria-label="${act === 'from' ? 'Desde' : 'Hasta'}">${list.map((o) => `<option value="${o.off}" ${o.off === cur ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  const chip = (act, v, label, on) => `<button type="button" class="chip" data-act="${act}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
  return `<header class="topbar">
    <div class="brand">
      <div class="mark serif">${logo ? `<img src="${esc(logo)}" alt="">` : esc(initials)}</div>
      <div style="display:flex;flex-direction:column;line-height:1.2"><span style="font-size:15px;font-weight:600">${esc(name)}</span><span class="lbl" style="font-size:10px">Reporte mensual</span></div>
    </div>
    <nav class="tabs" aria-label="Canales del ecosistema">${TABS.map(([id, n, label]) => `<button type="button" class="tab" data-act="tab" data-v="${id}" aria-pressed="${state.tab === id}"><span class="n">${n}</span>${label}<span class="dot ${isLive(id) ? 'live' : ''}"></span></button>`).join('')}</nav>
    <div class="tools">
      <button type="button" class="pill" data-act="period" aria-expanded="${state.periodOpen}">${IC.cal}<span>${esc(cap(r.label))}</span><span class="muted" style="font-size:12px">vs ${esc(r.clabel)}</span>${IC.down}</button>
      <button type="button" class="iconbtn" data-act="theme" aria-label="${state.theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}">${state.theme === 'dark' ? IC.sun : IC.moon}</button>
      <button type="button" class="iconbtn serif" data-act="zoom" aria-label="Cambiar tamaño de texto" style="font-size:18px">Aa<span class="mono" style="font-size:9px;margin-left:1px">${ZOOMS.indexOf(state.zoom) + 1}</span></button>
      ${state.periodOpen ? `<div class="popover" role="dialog" aria-label="Período">
        <span class="lbl">Período</span>
        <div class="row">${chip('range', 'mes', 'Este mes', state.range === 'mes')}${chip('range', 'ant', 'Mes anterior', state.range === 'ant')}</div>
        <div class="row" style="font-size:13px"><span class="muted">Desde</span>${sel('from', state.rFrom, opts)}<span class="muted">hasta</span>${sel('to', state.rTo, opts.filter((o) => o.off <= state.rFrom))}</div>
        <span class="lbl" style="margin-top:4px">Comparar con</span>
        <div class="seg" role="group" aria-label="Comparar con"><button type="button" data-act="cmp" data-v="prev" aria-pressed="${state.cmp === 'prev'}">Período anterior</button><button type="button" data-act="cmp" data-v="yoy" aria-pressed="${state.cmp === 'yoy'}">Año anterior</button></div>
        <div class="muted" style="font-size:12px">${esc(cap(r.label))} contra ${esc(r.clabel)}${r.partial ? ' · mes en curso, comparado con los mismos días' : ''}</div>
      </div>` : ''}
    </div>
  </header>`;
}

function coverCards(r) {
  const P = state.paid, O = state.owned, S = state.social;
  const cards = [];
  {
    const T = O?.totals?.cur || {}, Pv = O?.totals?.prev || {};
    const ecom = O?.mode === 'ecommerce';
    const cur = ecom ? T.purchaseRevenue : T.sessions, prev = ecom ? Pv.purchaseRevenue : Pv.sessions;
    cards.push(['owned', '01 · Owned', 'GA4', ecom ? 'Ventas en el sitio' : 'Visitas al sitio', O ? (ecom ? F.moneyShort(cur) : F.int(cur)) : '—', delta(cur, prev, 1), (O?.daily || []).map((d) => (ecom ? d.purchaseRevenue : d.sessions))]);
  }
  {
    const T = P?.totals?.cur || {}, Pv = P?.totals?.prev || {};
    cards.push(['paid', '02 · Paid', 'Meta', 'ROAS', P ? F.x(T.roas) : '—', delta(T.roas, Pv.roas, 1), (P?.daily?.cur || []).map((d) => d.roas)]);
  }
  {
    const T = S?.totals?.cur || {}, Pv = S?.totals?.prev || {};
    cards.push(['social', '03 · Social', 'Instagram', 'Alcance', S ? F.intShort(T.reach) : '—', delta(T.reach, Pv.reach, 1), (S?.reachDaily || []).map((d) => d.value)]);
  }
  return cards.map(([id, lbl, src, mlabel, val, dl, vals]) => {
    const on = state.tab === id;
    return `<button type="button" class="chcard" data-act="tab" data-v="${id}" aria-pressed="${on}">
      <span class="lbl">${lbl}</span>
      <div style="display:flex;justify-content:space-between;gap:6px;font-size:12px;color:var(--muted)"><span class="ellipsis">${mlabel}</span><span style="flex:none;font-size:11px" title="${isLive(id) ? 'Conectado a ' + src : 'Datos de ejemplo'}">${src}${isLive(id) ? '' : '*'}</span></div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><span class="num" style="font-size:30px;font-weight:300;letter-spacing:-.03em;line-height:1">${val}</span><span class="num" style="font-size:12px;font-weight:600;color:${dl.cls === 'pos' ? 'var(--pos)' : dl.cls === 'neg' ? 'var(--neg)' : 'var(--muted)'}">${dl.arrow} ${esc(dl.txt)}</span></div>
      ${sparkSvg(vals, { w: 120, h: 34, stroke: on ? 'var(--accent)' : 'var(--faint)', fill: on ? 'var(--accentSoft)' : 'rgba(127,127,127,0.08)' })}
    </button>`;
  }).join('');
}

function viewCover(r) {
  return `<section class="cover" aria-labelledby="eco">
    <div>
      <div class="lbl acc">Reporte digital · ${esc(cap(r.label))}</div>
      <h1 id="eco" class="serif">Tu ecosistema ${em('digital')}</h1>
      <p style="margin:18px 0 0;font-size:16px;color:var(--muted);max-width:46ch">Cómo funcionaron tus medios propios, pagados y sociales en ${esc(monthName(r))}, y qué haremos ${r.partial ? 'a continuación' : 'en ' + esc(nextMonth(r))}.</p>
    </div>
    <div class="chcards">${coverCards(r)}</div>
  </section>`;
}

function sheetIntro(n, title, italic, desc, live, liveTxt, note) {
  const cls = live ? 'live' : note && note.kind !== 'not_configured' ? 'warn' : '';
  const txt = live ? liveTxt : note && note.kind !== 'not_configured' ? 'Sin conexión · datos de ejemplo' : 'Datos de ejemplo';
  return `<section class="intro">
    <div style="display:flex;align-items:flex-end;gap:20px"><span class="big" aria-hidden="true">${n}</span><div><h2 class="serif">${title} ${em(italic)}</h2><div style="margin-top:6px;font-size:14px;color:var(--muted)">${desc}</div></div></div>
    <span class="status ${cls}" title="${esc(note?.message || '')}"><span class="d"></span>${txt}</span>
  </section>`;
}

/* ============================================================
   02 · Paid media (Meta Ads)
   ============================================================ */
const STAGES = [['rec', 'Reconocimiento', 'var(--coral)'], ['cons', 'Consideración', 'var(--blue)'], ['conv', 'Conversión', 'var(--accent)']];
const STAGE_COLOR = { rec: 'var(--coral)', cons: 'var(--blue)', conv: 'var(--accent)' };
const BUBBLE_COLORS = ['var(--accent)', 'var(--blue)', 'var(--violet)', 'var(--coral)', 'var(--sand)', 'var(--faint)'];

function paidStrategy(r) {
  const s = { ...(CONFIG.strategy?.default || {}), ...(CONFIG.strategy?.[r.monthKey] || {}) };
  if (!s.businessObjective && !s.summary) return '';
  const stage = s.funnelStage || 'conv';
  const steps = STAGES.map(([id, label]) => `<div style="flex:1;display:flex;flex-direction:column;gap:6px"><div style="height:6px;border-radius:3px;background:${id === stage ? 'var(--accent)' : 'var(--surface2)'}"></div><span style="font-size:12px;${id === stage ? 'font-weight:600' : 'color:var(--muted)'}">${label}</span></div>`).join('');
  const digital = Array.isArray(s.digitalObjectives) && s.digitalObjectives.length ? s.digitalObjectives : null;
  return `<section class="card rise" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr);gap:28px">
    <div style="display:flex;flex-direction:column;gap:8px"><span class="lbl">Objetivo del negocio</span><div class="serif" style="font-size:24px;line-height:1.2">${esc(s.businessObjective || '—')}</div></div>
    <div style="display:flex;flex-direction:column;gap:10px"><span class="lbl">${digital ? 'Objetivos digitales' : 'Etapa del embudo'}</span>
      ${digital ? `<ul style="margin:0;padding-left:18px;font-size:14px;display:flex;flex-direction:column;gap:4px">${digital.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div style="display:flex;gap:6px;margin-top:${digital ? 4 : 8}px">${steps}</div></div>
    <div style="display:flex;flex-direction:column;gap:8px;padding-left:28px;border-left:1px solid var(--border)"><span class="lbl acc">Lectura estratégica</span><div style="font-size:15px;line-height:1.55">${esc(s.summary || '')}</div></div>
  </section>`;
}

function paidGoals(T, r) {
  const g = CONFIG.goals || {};
  const scale = r.partial ? r.days / new Date(parse(r.until).getFullYear(), parse(r.until).getMonth() + 1, 0).getDate() : r.monthsLen;
  const list = [];
  if (g.roas) list.push(['ROAS', F.x(T.roas), F.x(g.roas, 1), T.roas != null ? T.roas / g.roas : 0]);
  if (g.purchasesPerMonth) { const goal = Math.round(g.purchasesPerMonth * scale); list.push(['Compras', F.int(T.purchases), F.int(goal), goal ? (T.purchases || 0) / goal : 0]); }
  if (g.cpa) list.push(['Costo/compra', F.money(T.cpa), F.money(g.cpa), T.cpa ? g.cpa / T.cpa : 0]);
  if (!list.length) return `<div class="empty">Define metas en config.json (goals) para ver el avance.</div>`;
  const done = list.filter((x) => x[3] >= 1).length;
  return { done, total: list.length, html: list.map(([label, val, goal, p]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:10px">
      ${ring(p, 108, 44, 8, p >= 1 ? 'var(--accent)' : 'var(--faint)', `<span class="num" style="font-size:24px;font-weight:300">${Math.round(p * 100)}%</span><span class="lbl" style="font-size:9px">de la meta</span>`)}
      <div style="text-align:center"><div style="font-size:13px;font-weight:500">${label}</div><div class="num" style="font-size:12px;color:var(--muted)">${val} · meta ${goal}</div></div>
    </div>`).join('') };
}

let paidChart = null;
function paidDaily(d, r) {
  const days = d.daily?.cur || [];
  if (days.length < 2) return '';
  const n = days.length;
  const max = Math.max(...days.map((x) => Math.max(x.spend || 0, x.revenue || 0))) * 1.08 || 1;
  const Y = (v) => 300 - ((v || 0) / max) * 280;
  const X = (i) => ((i + 0.5) * 1000) / n;
  const bw = Math.max(1.5, (1000 / n) * 0.5);
  const bars = days.map((x, i) => `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Y(x.spend).toFixed(1)}" width="${bw.toFixed(1)}" height="${(300 - Y(x.spend)).toFixed(1)}" rx="${Math.min(3, bw / 2).toFixed(1)}" fill="var(--faint)" fill-opacity="0.5"/>`).join('');
  const rp = days.map((x, i) => `${X(i).toFixed(1)},${Y(x.revenue).toFixed(1)}`).join(' ');
  const pk = days.reduce((b, x, i) => ((x.revenue || 0) > (days[b].revenue || 0) ? i : b), 0);
  const notes = (CONFIG.paid?.[r.monthKey]?.annotations || []).map(([date, text]) => [days.findIndex((x) => x.date === date), text]).filter(([i]) => i >= 0).slice(0, 3);
  const noteHtml = notes.map(([i, text], k) => {
    const left = X(i) / 10, flip = left > 60;
    return `<div style="position:absolute;top:${k * 40}px;left:${left.toFixed(2)}%;transform:${flip ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)'};padding:6px 10px;border-radius:10px;background:var(--text);color:var(--bg);font-size:12px;font-weight:500;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis"><span class="mono" style="opacity:.6">${esc(dayLabel(days[i].date).toUpperCase())}</span> · ${esc(text)}</div>`;
  }).join('');
  const noteLines = notes.map(([i]) => `<line x1="${X(i).toFixed(1)}" y1="20" x2="${X(i).toFixed(1)}" y2="300" stroke="var(--text)" stroke-dasharray="3 5" stroke-opacity="0.4"/>`).join('');
  const hits = days.map((x, i) => `<rect data-day="${i}" x="${(i * 1000) / n}" y="0" width="${1000 / n}" height="320" fill="transparent"/>`).join('');
  const ticks = [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round(((n - 1) * 3) / 4), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  paidChart = { days, n, X, Y };
  return card(12, head('Día a día', `Lo que invertimos ${em('y lo que volvió')}`, `<div style="display:flex;gap:18px;font-size:13px;color:var(--muted)">${legendDot('var(--faint)', 'Inversión')}${legendDot('var(--accent)', 'Ingresos', 'line')}</div>`) + `
    <div style="display:flex;gap:28px;align-items:stretch;flex-wrap:wrap">
      <div style="flex:1 1 560px;min-width:0;position:relative" id="paid-chart">
        <svg viewBox="0 0 1000 320" preserveAspectRatio="none" role="img" aria-label="Inversión e ingresos por día" style="width:100%;height:320px;display:block">
          <line x1="0" y1="20" x2="1000" y2="20" stroke="var(--grid)"/><line x1="0" y1="113" x2="1000" y2="113" stroke="var(--grid)"/><line x1="0" y1="206" x2="1000" y2="206" stroke="var(--grid)"/><line x1="0" y1="300" x2="1000" y2="300" stroke="var(--border)"/>
          ${bars}<polygon points="${X(0).toFixed(1)},300 ${rp} ${X(n - 1).toFixed(1)},300" fill="var(--accentSoft)"/>
          <polyline points="${rp}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          ${noteLines}<line id="paid-cursor" x1="-10" y1="20" x2="-10" y2="300" stroke="var(--accent)" stroke-opacity="0.5" vector-effect="non-scaling-stroke"/>
          <g id="paid-hit">${hits}</g>
        </svg>
        <div style="position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:999px;background:var(--bg);border:3px solid var(--accent);box-sizing:border-box;pointer-events:none;left:${(X(pk) / 10).toFixed(2)}%;top:${((Y(days[pk].revenue) / 320) * 100).toFixed(2)}%"></div>
        ${noteHtml}<div id="paid-tip"></div>
        <div class="mono num" style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--muted)">${ticks.map((i) => `<span>${esc(dayLabel(days[i].date).toUpperCase())}</span>`).join('')}</div>
      </div>
      <div style="flex:0 0 200px;display:flex;flex-direction:column;justify-content:center;gap:22px;padding-left:28px;border-left:1px solid var(--border)">
        <div><div class="lbl">Mejor día</div><div class="num" style="font-size:30px;font-weight:300">${F.moneyShort(days[pk].revenue)}</div><div style="font-size:12px;color:var(--muted)">${esc(dayLabel(days[pk].date))} · ROAS ${F.x(days[pk].roas, 1)}</div></div>
        <div><div class="lbl">Inversión / día</div><div class="num" style="font-size:30px;font-weight:300">${F.moneyShort(sum(days.map((x) => x.spend)) / n)}</div></div>
        <div><div class="lbl">Ingresos / día</div><div class="num acc" style="font-size:30px;font-weight:300">${F.moneyShort(sum(days.map((x) => x.revenue)) / n)}</div></div>
      </div>
    </div>`);
}
function showTip(i) {
  const c = paidChart, box = document.getElementById('paid-tip');
  if (!c || !box || !c.days[i]) return;
  const x = c.days[i], left = c.X(i) / 10;
  box.className = 'tip';
  box.style.left = left + '%';
  box.style.top = '30px';
  box.style.transform = left > 60 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
  box.innerHTML = `<div class="mono" style="opacity:.7;margin-bottom:4px">${esc(dayLabel(x.date).toUpperCase())}</div>
    <div style="display:grid;grid-template-columns:auto auto;gap:2px 14px"><span>Inversión</span><b class="num" style="text-align:right">${F.money(x.spend)}</b><span>Ingresos</span><b class="num" style="text-align:right">${F.money(x.revenue)}</b><span>ROAS</span><b class="num" style="text-align:right">${F.x(x.roas)}</b><span>Compras</span><b class="num" style="text-align:right">${F.int(x.purchases)}</b></div>`;
  const cur = document.getElementById('paid-cursor');
  if (cur) { cur.setAttribute('x1', c.X(i)); cur.setAttribute('x2', c.X(i)); }
}
function hideTip() {
  const box = document.getElementById('paid-tip');
  if (box) { box.className = ''; box.innerHTML = ''; }
  const cur = document.getElementById('paid-cursor');
  if (cur) { cur.setAttribute('x1', -10); cur.setAttribute('x2', -10); }
}

function paidBubbles(d) {
  const camps = (d.campaigns || []).filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 8);
  if (!camps.length) return card(7, head('Mapa de campañas', `¿Qué escalar y ${em('qué revisar')}?`) + '<div class="empty">Sin campañas con inversión en el período.</div>');
  const goal = CONFIG.goals?.roas || 4;
  const maxS = Math.max(...camps.map((c) => c.spend)) * 1.12;
  const maxR = Math.max(goal * 1.8, ...camps.map((c) => (c.roas || 0) * 1.15));
  const maxP = Math.max(1, ...camps.map((c) => c.purchases || 0));
  const bx = (v) => 50 + (v / maxS) * 560, by = (v) => 320 - (clamp(v || 0, 0, maxR) / maxR) * 290;
  const gy = by(goal);
  const short = (s) => { const t = String(s).split(/\s[–-]\s|\s\|\s/)[0]; return t.length > 22 ? t.slice(0, 21) + '…' : t; };
  const circles = camps.map((c) => ({ cx: bx(c.spend), cy: by(c.roas), rad: 9 + Math.sqrt((c.purchases || 0) / maxP) * 26 }));
  const boxes = [];
  const hitsAny = (b, self) => boxes.some((o) => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1) || circles.some((o, k) => k !== self && b.x1 < o.cx + o.rad && b.x2 > o.cx - o.rad && b.y1 < o.cy + o.rad && b.y2 > o.cy - o.rad) || b.x1 < 52 || b.x2 > 640;
  const bub = camps.map((c, i) => {
    const { cx, cy, rad } = circles[i];
    const name = short(c.name);
    const color = c.active === false ? 'var(--faint)' : BUBBLE_COLORS[i % BUBBLE_COLORS.length];
    const meta = c.purchases ? `${F.x(c.roas, 1)} · ${F.int(c.purchases)} compras` : 'sin compras directas';
    const lw = Math.max(name.length * 7.4, meta.length * 6.7);
    const cands = [['R', cx + rad + 8, cy], ['L', cx - rad - 8, cy], ['R', cx + rad * 0.6, cy - rad - 16], ['R', cx + rad * 0.6, cy + rad + 14], ['L', cx - rad * 0.6, cy - rad - 16], ['L', cx - rad * 0.6, cy + rad + 14]];
    let pick = null;
    for (const [side, x, y] of cands) { const b = { x1: side === 'R' ? x : x - lw, x2: side === 'R' ? x + lw : x, y1: y - 14, y2: y + 17 }; if (!hitsAny(b, i)) { pick = [side, x, y, b]; break; } }
    if (!pick) { const side = cx > 440 ? 'L' : 'R', x = side === 'R' ? cx + rad + 8 : cx - rad - 8; pick = [side, x, cy, { x1: x, x2: x, y1: cy, y2: cy }]; }
    boxes.push(pick[3]);
    const left = pick[0] === 'L', tx = pick[1], ty = pick[2];
    const sel = state.campSel === c.id;
    return `<g data-act="campSel" data-v="${esc(c.id)}" style="cursor:pointer"><title>${esc(c.name)}</title><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="${color}" fill-opacity="${sel || !state.campSel ? 0.9 : 0.35}" stroke="${sel ? 'var(--text)' : 'var(--surface)'}" stroke-width="2"/>
      <text x="${tx.toFixed(1)}" y="${(ty - 2).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}" font-size="13" font-family="Geist, sans-serif" fill="var(--text)" font-weight="600">${esc(name)}</text>
      <text x="${tx.toFixed(1)}" y="${(ty + 13).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}" font-size="11" font-family="Geist Mono, monospace" fill="var(--muted)">${esc(meta)}</text></g>`;
  }).join('');
  const q = (x, y, t, a, col) => `<text x="${x}" y="${y}" text-anchor="${a}" font-size="10" font-family="Geist Mono, monospace" fill="${col}" letter-spacing="1">${t}</text>`;
  const totS = sum(camps.map((c) => c.spend)) || 1;
  const best = camps.filter((c) => c.spend >= totS * 0.08 && c.roas).sort((a, b) => b.roas - a.roas)[0];
  const below = camps.filter((c) => c.spend >= totS * 0.08 && (c.roas || 0) < goal && c.stageId === 'conv');
  let text = best ? `${esc(short(best.name))} rinde <strong>${F.x(best.roas, 1)}</strong> con ${F.dec((best.spend / totS) * 100, 0)}% de la inversión${best.roas >= goal * 1.25 ? ': es la candidata a escalar' : ''}.` : '';
  if (below.length) text += ` ${below.map((c) => esc(short(c.name))).join(', ')} ${below.length > 1 ? 'quedan' : 'queda'} bajo la meta.`;
  return card(7, head('Mapa de campañas', `¿Qué escalar y ${em('qué revisar')}?`, '<span class="lbl">Tamaño = compras</span>') + `
    <svg viewBox="0 0 640 360" role="img" aria-label="Campañas según inversión y ROAS" style="width:100%;height:auto;display:block;overflow:visible">
      <rect x="50" y="20" width="560" height="${Math.max(0, gy - 20).toFixed(1)}" fill="var(--accentSoft)" rx="8"/>
      <line x1="50" y1="${gy.toFixed(1)}" x2="610" y2="${gy.toFixed(1)}" stroke="var(--accent)" stroke-dasharray="6 5" stroke-width="1.5"/>
      <text x="56" y="${(gy + 15).toFixed(1)}" text-anchor="start" font-size="11" font-family="Geist Mono, monospace" fill="var(--accent)">META ROAS ${esc(F.x(goal, 1))}</text>
      <line x1="50" y1="320" x2="610" y2="320" stroke="var(--border)"/><line x1="50" y1="20" x2="50" y2="320" stroke="var(--border)"/>
      ${q(60, 38, 'OPORTUNIDAD · SUBIR INVERSIÓN', 'start', 'var(--muted)')}${q(600, 38, 'ESCALAR', 'end', 'var(--accent)')}${q(60, 312, 'REVISAR', 'start', 'var(--muted)')}${q(600, 312, 'OPTIMIZAR', 'end', 'var(--neg)')}
      ${bub}
      <text x="330" y="352" text-anchor="middle" font-size="11" font-family="Geist Mono, monospace" fill="var(--muted)">INVERSIÓN →</text>
      <text x="20" y="170" text-anchor="middle" font-size="11" font-family="Geist Mono, monospace" fill="var(--muted)" transform="rotate(-90 20 170)">ROAS →</text>
    </svg>` + insight(text));
}

const DOW = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
function paidCalendar(d) {
  const days = (d.daily?.cur || []).slice(-62);
  if (days.length < 7) return card(5, head('Calendario', `ROAS ${em('por día')}`) + '<div class="empty">Se necesitan al menos 7 días para el calendario.</div>');
  const vals = days.map((x) => (x.spend > 0 ? x.roas : null));
  const ok = vals.filter((v) => v != null);
  const lo = Math.min(...ok), hi = Math.max(...ok);
  const first = (parse(days[0].date).getDay() + 6) % 7;
  let cells = '<div></div>'.repeat(first);
  days.forEach((x, i) => {
    const v = vals[i];
    if (v == null) { cells += `<div class="num" style="aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--surface2);color:var(--faint)"><span class="mono" style="font-size:9px">${parse(x.date).getDate()}</span>—</div>`; return; }
    const pct = Math.round(8 + 87 * ((v - lo) / (hi - lo || 1)));
    cells += `<div class="num" title="${esc(dayLabel(x.date))}: ROAS ${esc(F.x(v))} · ${esc(F.money(x.revenue))}" style="aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:color-mix(in srgb, var(--accent) ${pct}%, var(--surface2));color:${pct > 55 ? 'var(--onAccent)' : 'var(--text)'}"><span class="mono" style="font-size:9px;opacity:.7">${parse(x.date).getDate()}</span><span style="font-size:13px;font-weight:600">${F.dec(v, 1)}</span></div>`;
  });
  // Lectura por día de la semana (ingresos / inversión agregados)
  const wd = Array.from({ length: 7 }, () => ({ s: 0, r: 0 }));
  for (const x of d.daily.cur) { const k = parse(x.date).getDay(); wd[k].s += x.spend || 0; wd[k].r += x.revenue || 0; }
  const all = sum(wd.map((w) => w.r)) / (sum(wd.map((w) => w.s)) || 1);
  const ranked = wd.map((w, k) => [k, w.s ? w.r / w.s : null]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
  let text = '';
  if (ranked.length >= 5 && all) {
    const [b, w] = [ranked[0], ranked[ranked.length - 1]];
    const up = ((b[1] - all) / all) * 100, dn = ((all - w[1]) / all) * 100;
    text = up < 3 && dn < 3 ? 'El rendimiento es parejo durante la semana: ningún día se aleja más de 3% del promedio.' : `Los ${DOW[b[0]]} rinden <strong>${F.dec(up, 0)}% más</strong> que el promedio; los ${DOW[w[0]]}, ${F.dec(dn, 0)}% menos.`;
  }
  return card(5, head('Calendario', `ROAS ${em('por día')}`) + `
    <div class="mono" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;font-size:10px;color:var(--muted);text-align:center"><span>LU</span><span>MA</span><span>MI</span><span>JU</span><span>VI</span><span>SÁ</span><span>DO</span></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${cells}</div>` + insight(text, 'pos'));
}

function paidCampaignTable(d) {
  const camps = (d.campaigns || []).filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend);
  if (!camps.length) return '';
  const totS = sum(camps.map((c) => c.spend)) || 1;
  const goal = CONFIG.goals?.roas;
  const rows = camps.map((c) => {
    const dl = delta(c.roas, c.prevRoas, 1);
    const sel = state.campSel === c.id;
    return `<button type="button" data-act="campSel" data-v="${esc(c.id)}" aria-pressed="${sel}" style="all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;grid-template-columns:minmax(0,2.4fr) 1.1fr 1fr 0.8fr 1.1fr 1fr;gap:12px;align-items:center;padding:14px 12px;border-radius:14px;${sel ? 'background:var(--accentSoft);' : ''}border-bottom:1px solid var(--border);font-size:14px">
      <span style="display:flex;align-items:center;gap:10px;min-width:0"><span style="width:8px;height:8px;border-radius:999px;flex:none;background:${c.active === false ? 'var(--faint)' : 'var(--pos)'}" title="${esc(c.status || '')}"></span><span class="ellipsis" style="font-weight:500">${esc(c.name)}</span></span>
      <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)"><span style="width:8px;height:8px;border-radius:2px;background:${STAGE_COLOR[c.stageId] || 'var(--faint)'}"></span>${esc(c.stage || '—')}</span>
      <span class="num" style="text-align:right">${F.moneyShort(c.spend)}<span class="muted" style="font-size:11px"> · ${F.dec((c.spend / totS) * 100, 0)}%</span></span>
      <span class="num" style="text-align:right">${F.int(c.purchases)}</span>
      <span class="num" style="text-align:right;display:flex;justify-content:flex-end;align-items:center;gap:6px"><b style="font-weight:600;color:${goal && c.roas != null ? (c.roas >= goal ? 'var(--pos)' : 'var(--neg)') : 'inherit'}">${F.x(c.roas, 1)}</b>${dl.txt !== '—' ? `<span class="delta ${dl.cls}" style="font-size:11px">${dl.arrow}${esc(dl.txt)}</span>` : ''}</span>
      <span class="num" style="text-align:right">${F.money(c.cpa)}</span>
    </button>`;
  }).join('');
  const c = camps.find((x) => x.id === state.campSel);
  const detail = c ? `<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;padding:18px;border-radius:18px;background:var(--surface2)">${[['Ingresos', F.money(c.revenue)], ['Impresiones', F.int(c.impressions)], ['Clics en el enlace', F.int(c.linkClicks)], ['CTR', F.pct(c.ctr)], ['CPM', F.money(c.cpm)], ['Valor por compra', F.money(c.aov)]].map(([l, v]) => `<div><div class="lbl" style="font-size:10px">${l}</div><div class="num" style="font-size:20px;font-weight:300">${v}</div></div>`).join('')}</div>` : '';
  return card(12, head('Campañas', `El detalle ${em('campaña a campaña')}`, '<span class="lbl">Toca una campaña para ver más</span>') + `
    <div>
      <div class="lbl" style="display:grid;grid-template-columns:minmax(0,2.4fr) 1.1fr 1fr 0.8fr 1.1fr 1fr;gap:12px;padding:0 12px 8px"><span>Campaña</span><span>Etapa</span><span style="text-align:right">Inversión</span><span style="text-align:right">Compras</span><span style="text-align:right">ROAS</span><span style="text-align:right">Costo/compra</span></div>
      ${rows}
    </div>${detail}`);
}

function paidRiver(d, T) {
  const ga = state.owned?.source === 'ga4' ? (state.owned.channels || []).find((c) => c.name === 'Paid Social') : null;
  const steps = [[T.impressions, 'impresiones'], [T.linkClicks, 'clics en el enlace']];
  if (ga && ga.sessions) steps.push([ga.sessions, 'visitas al sitio (GA4)']);
  steps.push([T.purchases, 'compras']);
  if (!T.impressions) return '';
  const n = steps.length;
  const hs = steps.map(([v], i) => (i === 0 ? 180 : clamp(30 + 150 * Math.pow((v || 0) / (steps[0][0] || 1), 0.22), 24, 170)));
  const rx = steps.map((_, i) => (i * 1100) / n);
  const links = steps.slice(0, -1).map((_, i) => `<polygon points="${rx[i] + 14},${100 - hs[i] / 2} ${rx[i + 1]},${100 - hs[i + 1] / 2} ${rx[i + 1]},${100 + hs[i + 1] / 2} ${rx[i] + 14},${100 + hs[i] / 2}" fill="var(--accentSoft)"/>`).join('');
  const bars = steps.map((_, i) => `<rect x="${rx[i]}" y="${100 - hs[i] / 2}" width="14" height="${hs[i]}" rx="7" fill="var(--accent)" fill-opacity="${(1 - i * 0.15).toFixed(2)}"/>`).join('');
  const labels = steps.map(([v, l]) => `<div style="display:flex;flex-direction:column;justify-content:center;padding-left:36px"><span class="num" style="font-size:34px;font-weight:300;letter-spacing:-.03em;line-height:1">${v >= 1e6 ? F.intShort(v) : F.int(v)}</span><span style="font-size:13px;color:var(--muted)">${l}</span></div>`).join('');
  const rates = steps.slice(1).map(([v, l], i) => { const p = steps[i][0] ? ((v || 0) / steps[i][0]) * 100 : null; return [p, l, i]; });
  const conv = rates.slice(1);
  const worst = conv.length >= 2 ? conv.reduce((a, b) => ((b[0] ?? 999) < (a[0] ?? 999) ? b : a)) : null;
  const txt = (p, l, i) => (i === 0 ? 'hizo clic en el anuncio' : l.startsWith('visitas') ? 'de los clics llegó al sitio' : steps[i][1].startsWith('visitas') ? 'de las visitas compró' : 'de los clics terminó en compra');
  const rateHtml = rates.map(([p, l, i]) => { const hl = worst && worst[2] === i; return `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;background:${hl ? 'var(--negSoft)' : 'var(--surface2)'}"><span class="num" style="font-size:24px;font-weight:300;color:${hl ? 'var(--neg)' : 'var(--text)'}">${F.pct(p, p != null && p < 10 ? 2 : 0)}</span><span style="font-size:13px;color:var(--muted)">${txt(p, l, i)}</span>${hl ? '<span class="lbl" style="margin-left:auto;color:var(--neg)">Mayor fuga</span>' : ''}</div>`; }).join('');
  return card(12, head('Del anuncio a la compra', `El recorrido ${em('completo')}`, ga ? '' : '<span class="lbl">Conecta GA4 para sumar las visitas</span>') + `
    <div style="position:relative"><svg viewBox="0 0 1100 200" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:200px;display:block">${links}${bars}</svg>
    <div style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));pointer-events:none">${labels}</div></div>
    <div style="display:grid;grid-template-columns:repeat(${rates.length},minmax(0,1fr));gap:12px">${rateHtml}</div>`);
}

function paidPodium(d) {
  const ads = (d.ads || []).slice(0, 3);
  const minSpend = CONFIG.meta?.winnerMinSpend;
  if (!ads.length) return `<section class="rise" style="display:flex;flex-direction:column;gap:18px">${head('Creatividades', `El podio ${em('del período')}`)}<div class="empty">Ningún anuncio superó la inversión mínima${minSpend ? ' de ' + F.money(minSpend) : ''} en el período.</div></section>`;
  const mx = { p: Math.max(...ads.map((a) => a.purchases || 0)) || 1, s: Math.max(...ads.map((a) => a.spend || 0)) || 1, c: Math.max(...ads.map((a) => a.ctr || 0)) || 1 };
  const pods = ads.map((a, i) => {
    const hl = i === 0;
    const bars = [['Compras', F.int(a.purchases), (a.purchases || 0) / mx.p], ['Inversión', F.moneyShort(a.spend), (a.spend || 0) / mx.s], ['CTR', F.pct(a.ctr), (a.ctr || 0) / mx.c]]
      .map(([l, v, w]) => `<div style="display:grid;grid-template-columns:5.5em minmax(0,1fr) 4.5em;gap:8px;align-items:center;font-size:12px"><span class="muted">${l}</span><div class="track" style="height:6px"><div style="width:${(w * 100).toFixed(0)}%;background:${hl ? 'var(--accent)' : 'var(--faint)'}"></div></div><span class="num" style="text-align:right;font-weight:600">${v}</span></div>`).join('');
    const media = a.thumb ? `<img src="${esc(a.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : '';
    const tag = a.link ? 'a' : 'div';
    return `<article class="rise" style="background:var(--surface);border:${hl ? '1.5px solid var(--accent)' : '1px solid var(--border)'};border-radius:28px;overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow)">
      <${tag} ${a.link ? `href="${esc(a.link)}" target="_blank" rel="noopener" aria-label="Ver anuncio: ${esc(a.name)}"` : ''} style="position:relative;aspect-ratio:4/3;background:var(--surface2);display:flex;align-items:center;justify-content:center;color:var(--muted);text-decoration:none">
        ${media}
        <span class="num" style="position:absolute;left:18px;bottom:0;font-size:120px;font-weight:200;line-height:.9;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:1.5px ${hl ? 'var(--accent)' : 'var(--faint)'};${a.thumb ? 'opacity:0' : ''}">0${i + 1}</span>
        ${a.isVideo ? `<div style="position:relative;width:56px;height:56px;border-radius:999px;background:var(--accent);color:var(--onAccent);display:flex;align-items:center;justify-content:center">${IC.play}</div>` : a.thumb ? '' : IC.img}
        <span class="mono" style="position:absolute;top:16px;right:16px;padding:5px 10px;border-radius:999px;background:var(--bg);color:var(--text);font-size:11px">${esc(a.format || 'Anuncio')}</span>
        ${a.thumb ? `<span class="mono" style="position:absolute;top:16px;left:16px;padding:5px 10px;border-radius:999px;background:var(--text);color:var(--bg);font-size:11px">0${i + 1}</span>` : ''}
      </${tag}>
      <div style="padding:22px;display:flex;flex-direction:column;gap:14px">
        <div style="font-size:16px;font-weight:500;line-height:1.3">${esc(a.name)}</div>
        <div style="display:flex;align-items:baseline;gap:8px"><span class="num" style="font-size:46px;font-weight:200;letter-spacing:-.04em;line-height:1;color:${hl ? 'var(--accent)' : 'var(--text)'}">${F.x(a.roas, 1)}</span><span class="lbl">ROAS</span>${a.sharePurchases ? `<span class="muted" style="margin-left:auto;font-size:12px">${F.dec(a.sharePurchases * 100, 0)}% de las compras</span>` : ''}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${bars}</div>
      </div>
    </article>`;
  }).join('');
  return `<section style="display:flex;flex-direction:column;gap:18px">${head('Creatividades', `El podio ${em('del período')}`, `<span class="lbl">Ranking por ROAS${minSpend ? ' · mín. ' + esc(F.money(minSpend)) : ''}</span>`)}
    <div style="display:grid;grid-template-columns:repeat(${ads.length},minmax(0,1fr));gap:16px" class="podium">${pods}</div></section>`;
}

function viewPaid(r) {
  const d = state.paid;
  if (!d) return `<div class="empty">Cargando Meta Ads…</div>`;
  const T = d.totals.cur || {}, P = d.totals.prev || {};
  const dl = (k, g) => delta(T[k], P[k], g);
  const daily = d.daily?.cur || [];
  const goals = paidGoals(T, r);
  const stageSpend = STAGES.map(([id, label, color]) => [label, sum((d.campaigns || []).filter((c) => c.stageId === id).map((c) => c.spend)), color]).filter((x) => x[1] > 0);
  const totStage = sum(stageSpend.map((x) => x[1])) || 1;
  const bento = `<div class="grid12">
    ${hero(5, { label: 'ROAS del período', right: CONFIG.goals?.roas ? 'META ' + F.x(CONFIG.goals.roas, 1) : '', value: F.x(T.roas), sentence: T.roas != null ? `Por cada $1 invertido, volvieron <em>$${esc(F.dec(T.roas, 2))}</em> en ventas.` : 'Sin ventas atribuidas en el período.', badge: badgeTxt(dl('roas', 1), r), spark: daily.map((x) => (x.spend > 0 ? x.roas : null)) })}
    <section class="card rise" style="grid-column:span 4;padding:26px">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">Metas del período</span>${goals.total ? `<span style="padding:4px 10px;border-radius:999px;background:${goals.done === goals.total ? 'var(--posSoft)' : 'var(--surface2)'};color:${goals.done === goals.total ? 'var(--pos)' : 'var(--muted)'};font-size:12px;font-weight:600">${goals.done} de ${goals.total} cumplidas</span>` : ''}</div>
      <div style="display:grid;grid-template-columns:repeat(${goals.total || 1},minmax(0,1fr));gap:6px;flex:1;align-items:center">${goals.html || goals}</div>
    </section>
    <section class="card rise" style="grid-column:span 3;padding:26px">
      <span class="lbl">¿Dónde se invirtió?</span>
      ${donut(stageSpend, 150, 58, 18, `<span class="num" style="font-size:22px;font-weight:300">${F.moneyShort(T.spend)}</span><span class="lbl" style="font-size:9px">inversión</span>`)}
      <div style="display:flex;flex-direction:column;gap:6px">${stageSpend.map(([l, v, c]) => `<div style="display:flex;align-items:center;gap:8px;font-size:13px"><span style="width:10px;height:10px;border-radius:3px;background:${c}"></span><span style="flex:1;color:var(--muted)">${l}</span><span class="num" style="font-weight:600">${Math.round((v / totStage) * 100)}%</span></div>`).join('') || '<span class="muted" style="font-size:13px">Sin inversión</span>'}</div>
    </section>
  </div>`;
  const kp = `<section class="kpis">${[
    kpi('Inversión', F.moneyShort(T.spend), dl('spend', 0), daily.map((x) => x.spend), F.money(P.spend)),
    kpi('Compras', F.int(T.purchases), dl('purchases', 1), daily.map((x) => x.purchases), F.int(P.purchases)),
    kpi('Ingresos', F.moneyShort(T.revenue), dl('revenue', 1), daily.map((x) => x.revenue), F.money(P.revenue)),
    kpi('Costo por compra', F.money(T.cpa), dl('cpa', -1), daily.map((x) => x.cpa), F.money(P.cpa)),
    kpi('CTR (enlace)', F.pct(T.ctr), dl('ctr', 1), daily.map((x) => x.ctr), F.pct(P.ctr)),
    kpi('Frecuencia', F.dec(T.frequency, 2), dl('frequency', -1), daily.map((x) => x.frequency), F.dec(P.frequency, 2))
  ].join('')}</section>`;
  const extra = `<section class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">${[['Impresiones', F.int(T.impressions), dl('impressions', 1)], ['Alcance', F.int(T.reach), dl('reach', 1)], ['Valor por compra', F.money(T.aov), dl('aov', 1)], ['CPM', F.money(T.cpm), dl('cpm', -1)]].map(([l, v, x]) => `<div class="kpi rise" style="flex-direction:row;align-items:center;justify-content:space-between;padding:16px 18px"><span class="lbl">${l}</span><span style="display:flex;align-items:center;gap:10px"><span class="num" style="font-size:20px;font-weight:300">${v}</span>${deltaChip(x)}</span></div>`).join('')}</section>`;
  return paidStrategy(r) + bento + kp + extra + `<div class="grid12">${paidDaily(d, r)}</div>` + `<div class="grid12">${paidBubbles(d)}${paidCalendar(d)}</div>` + `<div class="grid12">${paidCampaignTable(d)}</div>` + `<div class="grid12">${paidRiver(d, T)}</div>` + paidPodium(d);
}

/* ============================================================
   01 · Owned media (Google Analytics 4)
   ============================================================ */
const CHANNEL_ES = { 'Organic Search': 'Búsqueda orgánica', Direct: 'Directo', 'Paid Social': 'Social pagado', 'Organic Social': 'Social orgánico', 'Paid Search': 'Búsqueda pagada', Email: 'Email', Referral: 'Referidos', Unassigned: 'Sin asignar', Display: 'Display', 'Organic Video': 'Video orgánico', 'Paid Video': 'Video pagado', 'Cross-network': 'Multired', 'Organic Shopping': 'Shopping orgánico', 'Paid Shopping': 'Shopping pagado', Affiliates: 'Afiliados', SMS: 'SMS', 'Mobile Push Notifications': 'Notificaciones push', 'Paid Other': 'Otros pagados', 'AI Assistant': 'Asistentes de IA' };
const DEVICE_ES = { mobile: 'Móvil', desktop: 'Escritorio', tablet: 'Tablet', 'smart tv': 'Smart TV' };
const REGION_ES = { 'Santiago Metropolitan Region': 'Región Metropolitana', 'Valparaiso': 'Valparaíso', 'Biobio': 'Biobío', 'Bio Bio': 'Biobío', 'Araucania': 'Araucanía', 'Los Rios': 'Los Ríos', 'Nuble': 'Ñuble', 'Tarapaca': 'Tarapacá', 'Aysen': 'Aysén', 'Magallanes and Chilean Antarctica': 'Magallanes', "O'Higgins": "O'Higgins", 'Maule': 'Maule', 'Coquimbo': 'Coquimbo', 'Antofagasta': 'Antofagasta', 'Atacama': 'Atacama', 'Los Lagos': 'Los Lagos', 'Arica y Parinacota': 'Arica y Parinacota' };
const minSec = (sec) => (sec == null || isNaN(sec) ? '—' : (sec >= 60 ? Math.floor(sec / 60) + ' min ' : '') + Math.round(sec % 60) + ' s');
const mmss = (sec) => (sec == null ? '—' : Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0'));

function gaMetrics(t = {}, ecom) {
  const conv = ecom ? t.ecommercePurchases : t.keyEvents;
  return {
    users: t.totalUsers, sessions: t.sessions, conv, revenue: t.purchaseRevenue,
    newShare: t.totalUsers ? (t.newUsers / t.totalUsers) * 100 : null,
    eng: t.sessions ? t.userEngagementDuration / t.sessions : null,
    engRate: t.engagementRate != null ? t.engagementRate * 100 : null,
    convRate: t.sessions ? (conv / t.sessions) * 100 : null
  };
}

function viewOwned(r) {
  const d = state.owned;
  if (!d) return `<div class="empty">Cargando Google Analytics…</div>`;
  const ecom = d.mode === 'ecommerce';
  const cL = ecom ? 'Compras' : 'Conversiones', cl = cL.toLowerCase();
  const c = gaMetrics(d.totals?.cur, ecom), p = gaMetrics(d.totals?.prev, ecom);
  const daily = d.daily || [];
  const dm = daily.map((x) => gaMetrics(x, ecom));
  const oc = { ...(CONFIG.owned?.default || {}), ...(CONFIG.owned?.[r.monthKey] || {}) };

  // Héroe
  const dRev = delta(ecom ? c.revenue : c.sessions, ecom ? p.revenue : p.sessions, 1);
  const dConv = delta(c.conv, p.conv, 1);
  const heroSentence = oc.summary ? esc(oc.summary)
    : ecom ? `${F.int(c.conv)} compras de ${F.int(c.sessions)} visitas${dConv.txt !== '—' ? `: ${dConv.txt.replace('+', '')} ${dConv.txt.startsWith('+') ? 'más' : 'menos'} compras que en ${esc(cmpShort(r))}` : ''}.`
    : `${F.int(c.conv)} ${cl} y ${F.int(c.users)} usuarios.`;
  // Dispositivos
  const devs = (d.segments?.disp || []).filter((x) => x.sessions > 0).sort((a, b) => b.sessions - a.sessions);
  const dS = sum(devs.map((x) => x.sessions)) || 1, dC = sum(devs.map((x) => x.conv)) || 0;
  const devColors = ['var(--blue)', 'var(--accent)', 'var(--sand)'];
  const devBar = (key, tot) => `<div style="display:flex;height:30px;gap:3px;border-radius:9px;overflow:hidden">${devs.slice(0, 3).map((x, i) => { const f = (x[key] / tot) * 100; return f < 0.5 ? '' : `<div title="${esc(DEVICE_ES[x.name] || x.name)} ${F.dec(f, 0)}%" style="flex:${f.toFixed(1)} 1 0;min-width:0;background:${devColors[i]};color:${i === 1 ? 'var(--onAccent)' : 'var(--ink)'};font-size:12px;font-weight:600;display:flex;align-items:center;padding:0 ${f >= 8 ? 10 : 4}px;white-space:nowrap;overflow:hidden">${f >= 28 ? esc(DEVICE_ES[x.name] || x.name) + ' ' : ''}${f >= 6 ? F.dec(f, 0) + '%' : ''}</div>`; }).join('')}</div>`;
  const mob = devs.find((x) => x.name === 'mobile'), desk = devs.find((x) => x.name === 'desktop');
  let devTxt = '';
  if (mob && desk && mob.sessions && desk.sessions) {
    const rm = mob.conv / mob.sessions, rd = desk.conv / desk.sessions;
    devTxt = rd > rm && rm > 0 ? `En escritorio se ${ecom ? 'compra' : 'convierte'} <strong style="color:var(--text)">${F.dec(rd / rm, 1)} veces más</strong> por visita (${F.pct(rd * 100, 1)} vs ${F.pct(rm * 100, 1)}).` : rm >= rd && rd > 0 ? `En móvil se ${ecom ? 'compra' : 'convierte'} ${F.dec(rm / rd, 1)} veces más por visita que en escritorio.` : '';
  }
  const bento = `<div class="grid12">
    ${hero(5, { label: ecom ? 'Ventas en el sitio' : 'Visitas al sitio', right: 'GA4 · ' + esc(monthName(r)), value: ecom ? F.moneyShort(c.revenue) : F.intShort(c.sessions), sentence: heroSentence, badge: badgeTxt(dRev, r), spark: dm.map((x) => (ecom ? x.revenue : x.sessions)) })}
    <section class="card rise" style="grid-column:span 3;padding:26px;align-items:center;justify-content:space-between">
      <span class="lbl" style="align-self:flex-start">Tasa de conversión</span>
      ${ring((c.convRate || 0) / Math.max(8, (c.convRate || 0) * 1.4), 150, 62, 10, 'var(--accent)', `<span class="num" style="font-size:32px;font-weight:300">${F.pct(c.convRate)}</span><span class="lbl" style="font-size:9px">de las visitas</span>`)}
      ${(() => { const x = delta(c.convRate, p.convRate, 1); return `<span class="num" style="font-size:12px;font-weight:600;color:${x.cls === 'pos' ? 'var(--pos)' : x.cls === 'neg' ? 'var(--neg)' : 'var(--muted)'}">${x.arrow} ${esc(x.txt)} · antes ${F.pct(p.convRate)}</span>`; })()}
    </section>
    <section class="card rise" style="grid-column:span 4;padding:26px">
      <span class="lbl">¿Desde dónde ${ecom ? 'compran' : 'convierten'}?</span>
      ${devs.length ? `<div style="display:flex;flex-direction:column;gap:14px">
        <div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Visitas</span><span class="mono muted">${F.int(dS)}</span></div>${devBar('sessions', dS)}</div>
        ${dC ? `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>${cL}</span><span class="mono muted">${F.int(dC)}</span></div>${devBar('conv', dC)}</div>` : ''}
      </div><div style="font-size:13px;color:var(--muted);margin-top:auto">${devTxt}</div>` : '<div class="empty">Sin datos de dispositivos.</div>'}
    </section>
  </div>`;

  const kp = `<section class="kpis">${[
    kpi('Usuarios', F.int(c.users), delta(c.users, p.users, 1), dm.map((x) => x.users), F.int(p.users)),
    kpi('Sesiones', F.int(c.sessions), delta(c.sessions, p.sessions, 1), dm.map((x) => x.sessions), F.int(p.sessions)),
    kpi('Usuarios nuevos', F.pct(c.newShare, 0), delta(c.newShare, p.newShare, 0), dm.map((x) => x.newShare), F.pct(p.newShare, 0)),
    kpi('Tiempo de interacción', minSec(c.eng), delta(c.eng, p.eng, 1), dm.map((x) => x.eng), minSec(p.eng)),
    kpi('Tasa de interacción', F.pct(c.engRate, 0), delta(c.engRate, p.engRate, 1), dm.map((x) => x.engRate), F.pct(p.engRate, 0)),
    kpi(cL, F.int(c.conv), dConv, dm.map((x) => x.conv), F.int(p.conv))
  ].join('')}</section>`;

  // Embudo
  const fu = d.funnel || {};
  const steps = [['Sesiones', c.sessions || 0], ['Vieron un producto', fu.view_item || 0], ['Agregaron al carro', fu.add_to_cart || 0], ['Iniciaron el pago', fu.begin_checkout || 0], ['Compraron', fu.purchase || 0]].filter((x, i) => i === 0 || x[1] > 0);
  const BENCH = { 'Vieron un producto': 35, 'Agregaron al carro': 15, 'Iniciaron el pago': 45, Compraron: 45 };
  let funnel;
  if (steps.length >= 3) {
    const rates = steps.map((s, i) => (i ? (s[1] / (steps[i - 1][1] || 1)) * 100 : null));
    const gaps = rates.map((rt, i) => (i ? rt - (BENCH[steps[i][0]] || 30) : 999));
    const leak = gaps.indexOf(Math.min(...gaps));
    const rows = steps.map(([l, n], i) => {
      const w = Math.max(4, Math.sqrt(n / (steps[0][1] || 1)) * 100);
      const isLeak = i === leak;
      const conn = i ? `<div style="display:flex;align-items:center;gap:10px;padding-left:190px;font-size:12px;color:${isLeak ? 'var(--neg)' : rates[i] >= (BENCH[l] || 30) ? 'var(--pos)' : 'var(--muted)'}"><span style="width:1px;height:18px;background:currentColor;opacity:.4"></span><span class="num" style="font-weight:600;font-size:13px">${F.dec(rates[i], 0)}%</span><span>avanza</span><span class="mono" style="opacity:.7">· REF. ${BENCH[l] || 30}%</span>${isLeak ? '<span class="lbl" style="color:var(--neg);margin-left:4px">Mayor fuga</span>' : ''}</div>` : '';
      return conn + `<div style="display:grid;grid-template-columns:180px minmax(0,1fr) 80px;gap:12px;align-items:center"><span style="font-size:14px;font-weight:500">${l}</span><div style="height:40px;border-radius:12px;background:var(--surface2);overflow:hidden"><div style="height:100%;border-radius:12px;width:${w.toFixed(1)}%;background:${isLeak ? 'var(--neg)' : 'var(--accent)'};opacity:${(1 - i * 0.12).toFixed(2)}"></div></div><span class="num" style="text-align:right;font-size:18px;font-weight:300">${F.int(n)}</span></div>`;
    }).join('');
    const lk = steps[leak];
    const leakTxt = lk ? `Solo <strong>${F.dec(rates[leak], 0)}%</strong> de quienes ${{ 'Vieron un producto': 'visitan el sitio ve un producto', 'Agregaron al carro': 'ven un producto lo agrega al carro', 'Iniciaron el pago': 'agregan al carro inicia el pago', Compraron: 'inician el pago termina comprando' }[lk[0]] || 'avanzan'}. ${lk[0] === 'Compraron' ? 'Revisar costos de despacho y medios de pago en el checkout.' : lk[0] === 'Agregaron al carro' ? 'Revisar precio, fotos y beneficios visibles en la ficha de producto.' : ''}` : '';
    funnel = card(7, head('Embudo de compra', `¿Dónde se ${em('cae')} la gente?`) + `<div style="display:flex;flex-direction:column;gap:8px">${rows}</div>` + insight(leakTxt, 'neg'));
  } else {
    funnel = card(7, head('Embudo de compra', `¿Dónde se ${em('cae')} la gente?`) + '<div class="empty">El sitio no envía los eventos de comercio electrónico (view_item, add_to_cart, begin_checkout) a GA4, así que no se puede armar el embudo.</div>');
  }

  // Fuentes: % visitas → % conversiones
  const chs = (d.channels || []).filter((x) => x.sessions > 0).sort((a, b) => b.sessions - a.sessions).slice(0, 7);
  const ts = sum(chs.map((x) => x.sessions)) || 1, tc = sum(chs.map((x) => x.conv));
  const scaleMax = Math.max(10, ...chs.map((x) => Math.max((x.sessions / ts) * 100, tc ? (x.conv / tc) * 100 : 0))) * 1.08;
  const chRows = chs.map((x) => {
    const a = (x.sessions / ts) * 100, b = tc ? (x.conv / tc) * 100 : 0;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const col = b >= a ? 'var(--pos)' : 'var(--neg)';
    const X = (v) => (v / scaleMax) * 100;
    return `<div style="display:grid;grid-template-columns:140px minmax(0,1fr) 96px;gap:12px;align-items:center" title="${esc(F.int(x.sessions))} visitas · ${esc(F.int(x.conv))} ${cl}">
      <span class="ellipsis" style="font-size:13px;font-weight:500">${esc(CHANNEL_ES[x.name] || x.name)}</span>
      <div style="position:relative;height:24px"><div style="position:absolute;top:11px;left:0;right:0;height:2px;background:var(--surface2)"></div>
        <div style="position:absolute;top:10px;height:4px;border-radius:2px;background:${col};opacity:.5;left:${X(lo).toFixed(1)}%;width:${X(hi - lo).toFixed(1)}%"></div>
        <div style="position:absolute;top:4px;width:16px;height:16px;margin-left:-8px;border-radius:999px;background:var(--faint);left:${X(a).toFixed(1)}%"></div>
        ${tc ? `<div style="position:absolute;top:4px;width:16px;height:16px;margin-left:-8px;border-radius:999px;background:${col};border:2px solid var(--surface);box-sizing:border-box;left:${X(b).toFixed(1)}%"></div>` : ''}</div>
      <span class="num mono" style="font-size:12px;text-align:right"><span class="muted">${F.dec(a, 0)}%</span>${tc ? ` → <span style="color:${col};font-weight:500">${F.dec(b, 0)}%</span>` : ''}</span></div>`;
  }).join('');
  let chTxt = '';
  if (chs.length && tc) {
    const share = chs.map((x) => [x, (x.sessions / ts) * 100, (x.conv / tc) * 100]);
    const worst = share.filter((s) => s[1] >= 10).sort((a, b) => (a[2] - a[1]) - (b[2] - b[1]))[0];
    const best = share.filter((s) => s[2] >= 5).sort((a, b) => b[2] / (b[1] || 1) - a[2] / (a[1] || 1))[0];
    const nm = (s) => esc(CHANNEL_ES[s[0].name] || s[0].name);
    if (worst && worst[2] < worst[1]) chTxt += `${nm(worst)} trae <strong>${F.dec(worst[1], 0)}%</strong> de las visitas pero ${F.dec(worst[2], 0)}% de las ${cl}. `;
    if (best && best !== worst && best[2] > best[1]) chTxt += `${nm(best)} hace lo contrario: ${F.dec(best[1], 0)}% de las visitas, ${F.dec(best[2], 0)}% de las ${cl}.`;
  }
  const channels = card(5, head('Fuentes de tráfico', `Quién trae visitas ${em('y quién vende')}`) + `<div style="display:flex;gap:16px;font-size:12px;color:var(--muted)">${legendDot('var(--faint)', '% de las visitas', 'dot')}${tc ? legendDot('var(--pos)', '% de las ' + cl, 'dot') : ''}</div><div style="display:flex;flex-direction:column;gap:10px">${chRows || '<div class="empty">Sin datos de fuentes.</div>'}</div>` + insight(chTxt));

  // Productos y páginas
  const items = (d.items || []).slice(0, 6);
  const maxRev = Math.max(1, ...items.map((x) => x.revenue || 0)), totRev = c.revenue || sum(items.map((x) => x.revenue)) || 1;
  const prodRows = items.map((x, i) => `<div style="display:grid;grid-template-columns:28px minmax(0,1fr) 90px;gap:12px;align-items:center"><span class="mono muted" style="font-size:12px">0${i + 1}</span>
    <div style="display:flex;flex-direction:column;gap:6px;min-width:0"><div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><span class="ellipsis" style="font-weight:500">${esc(x.name)}</span><span class="mono muted" style="font-size:12px;flex:none">${F.int(x.qty)} u.</span></div><div class="track"><div style="width:${((x.revenue / maxRev) * 100).toFixed(1)}%;background:${i === 0 ? 'var(--accent)' : 'var(--blue)'}"></div></div></div>
    <span class="num" style="text-align:right;font-size:18px;font-weight:300">${F.moneyShort(x.revenue)}</span></div>`).join('');
  const products = items.length ? card(6, head('Productos', `¿Qué ${em('compran')}?`) + `<div style="display:flex;flex-direction:column;gap:14px">${prodRows}</div>` + insight(`${esc(items[0].name)} explica <strong>${F.dec((items[0].revenue / totRev) * 100, 0)}%</strong> de las ventas: es el producto ancla para anuncios y packs.`)) : '';
  const pages = (d.pages || []).slice(0, 7);
  const pageRows = pages.map((x) => { const e = Math.round((x.engagementRate || 0) * 100); return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 70px 120px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px" title="Tiempo medio ${esc(mmss(x.engagementSec))}"><span class="mono ellipsis" style="font-size:12px">${esc(x.path === '/' ? '/ (inicio)' : x.path)}</span><span class="num" style="text-align:right">${F.int(x.views)}</span><div style="display:flex;align-items:center;gap:8px"><div class="track" style="flex:1;height:6px"><div style="width:${e}%;background:${e >= 60 ? 'var(--pos)' : 'var(--coral)'}"></div></div><span class="num" style="font-size:12px;width:32px;text-align:right">${e}%</span></div></div>`; }).join('');
  const pagesCard = pages.length ? card(products ? 6 : 12, head('Páginas', `Lo más ${em('visitado')}`) + `<div class="lbl" style="display:grid;grid-template-columns:minmax(0,1fr) 70px 120px;gap:12px"><span>Página</span><span style="text-align:right">Vistas</span><span>Interacción</span></div><div>${pageRows}</div>`) : '';

  // Regiones (compacto)
  const regs = (d.segments?.region || []).filter((x) => x.name && x.name !== '(not set)').sort((a, b) => b.users - a.users).slice(0, 5);
  const tu = sum(regs.map((x) => x.users)) || 1;
  const regCard = regs.length > 1 ? card(12, head('Regiones', `¿Desde ${em('dónde')} nos visitan?`, (d.segments?.edad || []).filter((x) => x.name && x.name !== '(not set)' && x.name !== 'unknown').length ? '' : '<span class="lbl" title="GA4 entrega edad solo con Google Signals activado">Edad: requiere Google Signals</span>') + `<div style="display:grid;grid-template-columns:repeat(${regs.length},minmax(0,1fr));gap:12px">${regs.map((x, i) => `<div style="padding:16px;border-radius:18px;background:${i === 0 ? 'var(--accentSoft)' : 'var(--surface2)'};display:flex;flex-direction:column;gap:4px"><span class="ellipsis" style="font-size:13px;font-weight:500">${esc(REGION_ES[x.name] || x.name)}</span><span class="num" style="font-size:28px;font-weight:300">${F.dec((x.users / tu) * 100, 0)}%</span><span class="muted" style="font-size:12px">${F.int(x.sessions)} visitas · conv. ${F.pct(x.sessions ? (x.conv / x.sessions) * 100 : 0, 1)}</span></div>`).join('')}</div>`) : '';

  // Conclusiones
  const concl = (oc.conclusions || []).filter((x) => Array.isArray(x) && x[1]);
  const conclHtml = concl.length ? `<section style="display:flex;flex-direction:column;gap:18px">${head('Conclusiones', `Qué aprendimos ${em('y qué haremos')}`)}<div style="display:grid;grid-template-columns:repeat(${Math.min(3, concl.length)},minmax(0,1fr));gap:16px">${concl.map(([prio, learn, act], i) => {
    const hi = /alta/i.test(prio || '');
    return `<article class="card rise" style="padding:24px;gap:14px;border-radius:24px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="mono" style="font-size:28px;color:var(--faint)">0${i + 1}</span>${prio ? `<span class="lbl" style="padding:4px 10px;border-radius:999px;${hi ? 'color:var(--neg);background:var(--negSoft)' : 'color:var(--text);background:var(--surface2)'}">Prioridad ${esc(String(prio).toLowerCase())}</span>` : ''}</div><div class="serif" style="font-size:24px;line-height:1.15">${esc(learn)}</div>${act ? `<div style="margin-top:auto;padding-top:14px;border-top:1px dashed var(--border);font-size:14px"><span class="lbl acc" style="display:block;margin-bottom:4px">Haremos</span>${esc(act)}</div>` : ''}</article>`;
  }).join('')}</div></section>` : '';

  const note = ecom ? 'GA4 cuenta solo las compras de visitas que llegaron al sitio. Meta informa más porque también atribuye compras de quien vio un anuncio y compró después por otro camino.' : 'El sitio no registra compras en GA4: las conversiones corresponden a los eventos clave configurados en la propiedad.';
  return bento + kp + `<div class="grid12">${funnel}${channels}</div>` + (products || pagesCard ? `<div class="grid12">${products}${pagesCard}</div>` : '') + (regCard ? `<div class="grid12">${regCard}</div>` : '') + conclHtml + `<p class="muted" style="font-size:12px;margin:0">${note}</p>`;
}

/* ============================================================
   03 · Social media (Instagram)
   ============================================================ */
const KIND_LABEL = { reels: 'Reels', car: 'Carruseles', img: 'Imagen', sto: 'Stories' };
const KIND_ONE = { reels: 'Reel', car: 'Carrusel', img: 'Imagen', sto: 'Story' };
const ACTIONS_IG = [['Alcance', 'reach', 'alcance'], ['Me gusta', 'likes', '“me gusta”'], ['Comentarios', 'comments', 'comentarios'], ['Compartidos', 'shares', 'compartidos'], ['Guardados', 'saved', 'guardados'], ['Visualizaciones', 'views', 'visualizaciones']];
const shortCaption = (p) => { const c = (p.caption || '').replace(/\s+/g, ' ').trim(); return c ? (c.length > 64 ? c.slice(0, 62) + '…' : c) : KIND_ONE[p.kind] + ' del ' + dayLabel(p.date); };
const COUNTRY = (() => { try { const dn = new Intl.DisplayNames(['es'], { type: 'region' }); return (c) => { try { return dn.of(c) || c; } catch { return c; } }; } catch { return (c) => c; } })();
const kShort = (x) => (x == null ? '—' : x >= 1000 ? F.dec(x / 1000, 1) + 'K' : F.int(x));

function viewSocial(r) {
  const d = state.social;
  if (!d) return `<div class="empty">Cargando Instagram…</div>`;
  const T = d.totals?.cur || {}, P = d.totals?.prev || {};
  const posts = (d.posts?.cur || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const prevPosts = d.posts?.prev || [];
  const stories = d.stories?.cur || [];
  const sc = { ...(CONFIG.social?.default || {}), ...(CONFIG.social?.[r.monthKey] || {}) };
  const user = d.account?.username ? '@' + d.account.username : '';
  const rate = (t) => (t.reach ? ((t.total_interactions || 0) / t.reach) * 100 : null);
  const dReach = delta(T.reach, P.reach, 1);
  const engDl = delta(T.accounts_engaged, P.accounts_engaged, 1);

  // Héroe
  let sentence = sc.summary ? esc(sc.summary) : '';
  if (!sentence && dReach.txt !== '—') {
    const up = dReach.cls === 'pos';
    sentence = `Llegamos a ${dReach.txt.replace(/[+−]/, '')} ${up ? 'más' : 'menos'} personas${engDl.cls === 'neg' && up ? ', pero conversamos menos' : engDl.cls === 'pos' ? ' y conversamos más' : ''}.`;
  }
  const fol = d.followers || {};
  const folSeries = (fol.series || []).map((x) => x.value);
  const viewsMax = Math.max(T.views || 0, P.views || 0) || 1;
  const vd = delta(T.views, P.views, 1);
  const bento = `<div class="grid12">
    ${hero(5, { label: 'Alcance del período', right: esc(user), value: F.intShort(T.reach), sentence, badge: badgeTxt(dReach, r), spark: (d.reachDaily || []).map((x) => x.value) })}
    <section class="card rise" style="grid-column:span 4;padding:26px;gap:8px;overflow:hidden">
      <span class="lbl">Comunidad</span>
      <div class="num" style="font-size:64px;font-weight:200;letter-spacing:-.05em;line-height:1">${F.int(fol.current ?? d.account?.followers)}</div>
      <div style="font-size:14px;color:var(--muted)">seguidores en Instagram${fol.delta != null ? ` · <span style="color:${fol.delta >= 0 ? 'var(--pos)' : 'var(--neg)'};font-weight:600">${fol.delta >= 0 ? '+' : '−'}${F.int(Math.abs(fol.delta))}</span> en el período` : ''}</div>
      ${folSeries.length >= 2 ? sparkSvg(folSeries, { w: 300, h: 70, stroke: 'var(--accent)', fill: 'var(--accentSoft)', sw: 2, style: 'width:calc(100% + 52px);height:90px;margin:auto -26px -26px;display:block' }) : `<div class="muted" style="margin-top:auto;font-size:12px">${fol.trackedSince ? 'Registro diario de seguidores desde ' + esc(dayLabel(fol.trackedSince)) + '.' : 'La evolución de seguidores se registra día a día desde que se conecta.'}</div>`}
    </section>
    <section class="card rise" style="grid-column:span 3;padding:26px;gap:14px">
      <span class="lbl">Visualizaciones</span>
      <div class="num" style="font-size:44px;font-weight:200;letter-spacing:-.04em;line-height:1">${F.int(T.views)}</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:auto">
        <div><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px"><span>${esc(monthCap(r))}</span><span class="mono">${kShort(T.views)}</span></div><div style="height:10px;border-radius:5px;background:var(--accent);width:${(((T.views || 0) / viewsMax) * 100).toFixed(0)}%"></div></div>
        <div><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px"><span>${esc(cap(cmpShort(r)))}</span><span class="mono">${kShort(P.views)}</span></div><div style="height:10px;border-radius:5px;background:var(--faint);width:${(((P.views || 0) / viewsMax) * 100).toFixed(0)}%"></div></div>
      </div>
      <span class="num" style="font-size:12px;font-weight:600;color:${vd.cls === 'pos' ? 'var(--pos)' : vd.cls === 'neg' ? 'var(--neg)' : 'var(--muted)'}">${vd.arrow} ${esc(vd.txt)}</span>
    </section>
  </div>`;

  const kp = `<section class="kpis">${[
    kpi('Interacciones', F.int(T.total_interactions), delta(T.total_interactions, P.total_interactions, 1), posts.map((x) => x.interactions), F.int(P.total_interactions)),
    kpi('Cuentas que interactuaron', F.int(T.accounts_engaged), engDl, posts.map((x) => x.interactions), F.int(P.accounts_engaged)),
    kpi('Tasa de interacción', F.pct(rate(T)), delta(rate(T), rate(P), 1), posts.map((x) => (x.reach ? (x.interactions / x.reach) * 100 : null)), F.pct(rate(P))),
    kpi('Clics en el perfil', F.int(T.profile_links_taps), delta(T.profile_links_taps, P.profile_links_taps, 1), [], F.int(P.profile_links_taps)),
    kpi('Guardados', F.int(T.saves ?? sum(posts.map((x) => x.saved))), delta(T.saves, P.saves, 1), posts.map((x) => x.saved), F.int(P.saves)),
    kpi('Compartidos', F.int(T.shares ?? sum(posts.map((x) => x.shares))), delta(T.shares, P.shares, 1), posts.map((x) => x.shares), F.int(P.shares))
  ].join('')}</section>`;

  // Mejores publicaciones
  const withReach = posts.filter((p) => p.reach);
  const avgReach = avg(withReach.map((p) => p.reach)) || 0;
  const totReach = sum(withReach.map((p) => p.reach));
  const bestR = withReach.slice().sort((a, b) => b.reach - a.reach)[0];
  const cands = withReach.filter((p) => p.reach >= avgReach * 0.3 && p.id !== bestR?.id);
  const bestE = (cands.length ? cands : []).slice().sort((a, b) => b.interactions / b.reach - a.interactions / a.reach)[0];
  const postCard = (p, kicker, tone, main, mainLabel, stats, why) => {
    const col = `var(--${tone})`;
    const media = p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : '';
    const icon = p.kind === 'reels' ? `<div style="position:relative;width:56px;height:56px;border-radius:999px;background:var(--accent);color:var(--onAccent);display:flex;align-items:center;justify-content:center">${IC.play}</div>` : p.thumb ? '' : `<span class="muted">${IC.img}</span>`;
    const tag = p.permalink ? 'a' : 'div';
    return `<article class="rise" style="background:var(--surface);border:1px solid var(--border);border-radius:28px;overflow:hidden;display:grid;grid-template-columns:220px minmax(0,1fr);box-shadow:var(--shadow)">
      <${tag} ${p.permalink ? `href="${esc(p.permalink)}" target="_blank" rel="noopener" aria-label="Ver publicación en Instagram"` : ''} style="position:relative;background:var(--surface2);display:flex;align-items:center;justify-content:center;min-height:300px">${media}${icon}<span class="mono" style="position:absolute;top:14px;left:14px;padding:4px 9px;border-radius:999px;background:var(--bg);color:var(--text);font-size:10px">${esc(KIND_ONE[p.kind] || 'Post')} · ${esc(dayLabel(p.date))}</span></${tag}>
      <div style="padding:24px;display:flex;flex-direction:column;gap:14px;justify-content:center;min-width:0">
        <div><div class="lbl" style="color:${col}">${kicker}</div><div class="serif" style="font-size:26px;line-height:1.1;margin-top:6px">${esc(shortCaption(p))}</div></div>
        <div><div class="num" style="font-size:52px;font-weight:200;letter-spacing:-.05em;line-height:1;color:${col}">${main}</div><div style="font-size:12px;color:var(--muted)">${mainLabel}</div></div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${stats.map(([l, v]) => `<div><div class="lbl" style="font-size:10px">${l}</div><div class="num" style="font-size:20px;font-weight:300">${v}</div></div>`).join('')}</div>
        <div style="font-size:13px;padding:10px 12px;border-radius:12px;background:var(--surface2)">${why}</div>
      </div></article>`;
  };
  const bestHtml = [
    bestR && postCard(bestR, 'Mejor post por alcance', 'accent', F.int(bestR.reach), 'cuentas alcanzadas' + (totReach && withReach.length > 1 ? ` · ${F.dec((bestR.reach / totReach) * 100, 0)}% del alcance de las publicaciones` : ''), [['Visualizaciones', F.int(bestR.views)], ['Compartidos', F.int(bestR.shares)], ['Guardados', F.int(bestR.saved)]], avgReach && withReach.length > 1 ? `Alcanzó ${F.dec(bestR.reach / avgReach, 1)} veces el promedio de las publicaciones del período.` : 'Única publicación con alcance medido en el período.'),
    bestE && postCard(bestE, 'Mejor post por interacción', 'pos', F.pct((bestE.interactions / bestE.reach) * 100, 1), `tasa de interacción · ${F.int(bestE.interactions)} interacciones`, [['Guardados', F.int(bestE.saved)], ['Comentarios', F.int(bestE.comments)], ['Alcance', F.int(bestE.reach)]], bestE.saved >= bestE.comments ? `Se guardó ${F.int(bestE.saved)} veces: contenido al que la gente quiere volver.` : `Generó ${F.int(bestE.comments)} comentarios: abrió conversación con la comunidad.`)
  ].filter(Boolean);
  const best = `<section style="display:flex;flex-direction:column;gap:18px">${head('Contenido', `Las publicaciones ${em('que destacaron')}`, `<span class="lbl">${F.int(posts.length)} publicaciones en el feed${stories.length ? ' · ' + F.int(stories.length) + ' stories' : ''}</span>`)}
    ${bestHtml.length ? `<div style="display:grid;grid-template-columns:repeat(${bestHtml.length},minmax(0,1fr));gap:16px" class="bestposts">${bestHtml.join('')}</div>` : `<div class="empty">No hubo publicaciones en el feed en el período${prevPosts.length ? ` (en ${esc(cmpShort(r))} hubo ${prevPosts.length})` : ''}. Las métricas de cuenta de arriba sí incluyen el alcance de publicaciones anteriores, reels y stories.</div>`}</section>`;

  // Formato × acción
  const byKind = { reels: [], car: [], img: [], sto: stories };
  for (const p of posts) (byKind[p.kind] || byKind.img).push(p);
  const kinds = ['reels', 'car', 'img', 'sto'].filter((k) => byKind[k].length);
  let matrix = '';
  if (kinds.length) {
    const vals = kinds.map((k) => ACTIONS_IG.map(([, key]) => {
      if (k === 'sto' && (key === 'likes' || key === 'saved')) return null;
      return avg(byKind[k].map((x) => x[k === 'sto' && key === 'comments' ? 'replies' : key]));
    }));
    const colMax = ACTIONS_IG.map((_, j) => Math.max(1, ...vals.map((v) => v[j] || 0)));
    const sel = Number.isInteger(Number(state.act)) ? clamp(Number(state.act), 0, ACTIONS_IG.length - 1) : 4;
    let grid = '<span></span>' + ACTIONS_IG.map(([l], j) => `<button type="button" data-act="act" data-v="${j}" aria-pressed="${j === sel}" class="mono" style="all:unset;box-sizing:border-box;cursor:pointer;min-height:40px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;text-align:center;${j === sel ? 'background:var(--text);color:var(--bg)' : 'color:var(--muted)'}">${l}</button>`).join('');
    kinds.forEach((k, i) => {
      const n = byKind[k].length;
      grid += `<span style="display:flex;flex-direction:column;justify-content:center"><span style="font-size:14px;font-weight:600">${KIND_LABEL[k]}</span><span class="mono muted" style="font-size:10px">${n} ${k === 'img' || k === 'sto' ? (n === 1 ? 'publicada' : 'publicadas') : n === 1 ? 'publicado' : 'publicados'}</span></span>`;
      vals[i].forEach((x, j) => {
        if (x == null) { grid += `<div style="min-height:58px;border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:12px;${j === sel ? '' : 'opacity:.6'}">—</div>`; return; }
        const pct = Math.round(8 + 82 * (x / colMax[j]));
        grid += `<div class="num" style="min-height:58px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:500;background:color-mix(in srgb, var(--accent) ${pct}%, var(--surface2));color:${pct > 55 ? 'var(--onAccent)' : 'var(--text)'};${j === sel ? 'box-shadow:0 0 0 2px var(--text) inset' : 'opacity:.5'}">${kShort(x)}</div>`;
      });
    });
    const rows = kinds.map((k, i) => [KIND_LABEL[k], vals[i][sel]]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
    const what = ACTIONS_IG[sel][2];
    let txt = '';
    if (rows.length === 1) txt = `${rows[0][0]} promedió <strong>${kShort(rows[0][1])}</strong> ${what} por publicación.`;
    else if (rows.length > 1) { const ratio = rows[1][1] ? rows[0][1] / rows[1][1] : null; txt = `Para lograr <strong>${what}</strong>, ${rows[0][0].toLowerCase()} rinden ${ratio && ratio >= 1.05 ? F.dec(ratio, 1) + ' veces más que ' + rows[1][0].toLowerCase() : 'parecido a ' + rows[1][0].toLowerCase()} (${kShort(rows[0][1])} por publicación).`; }
    matrix = card(12, head('Formato × acción', `¿Qué formato genera ${em('qué acción')}?`, '<span class="lbl">Promedio por publicación · toca una acción</span>') + `<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:150px repeat(6,minmax(84px,1fr));gap:6px;min-width:680px">${grid}</div></div>` + insight(txt));
  }

  // Conversación y stories
  const topics = (sc.commentTopics || []).filter((x) => Array.isArray(x) && x[0]);
  const tMax = Math.max(1, ...topics.map((x) => x[1] || 0));
  const topicsCard = topics.length ? card(6, head('Conversación', `¿De qué ${em('nos hablan')}?`, '<span class="lbl">Temas en comentarios y mensajes</span>') + `<div style="display:flex;flex-direction:column;gap:12px">${topics.map(([l, v, tag]) => `<div style="display:grid;grid-template-columns:150px minmax(0,1fr) 44px;gap:10px;align-items:center;font-size:13px"><span class="ellipsis" style="${tag ? 'font-weight:600' : ''}">${esc(l)}</span><div class="track"><div style="width:${((v / tMax) * 100).toFixed(0)}%;background:${tag === 'neg' ? 'var(--neg)' : tag === 'hl' ? 'var(--accent)' : 'var(--blue)'}"></div></div><span class="num" style="text-align:right">${F.int(v)}%</span></div>`).join('')}</div>` + insight(sc.topicsNote ? esc(sc.topicsNote) : '')) : '';
  let storiesCard = '';
  if (stories.length) {
    const dayMap = {};
    for (const s of stories) (dayMap[s.date] = dayMap[s.date] || []).push(s);
    const pos = [];
    for (const list of Object.values(dayMap)) { list.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))); list.slice(0, 6).forEach((s, i) => { (pos[i] = pos[i] || []).push(s.reach || 0); }); }
    const curve = pos.filter((x) => x.length >= 2).map((x) => avg(x));
    const last = curve.length >= 2 && curve[0] ? Math.round((curve[curve.length - 1] / curve[0]) * 100) : null;
    storiesCard = card(topics.length ? 6 : 12, head('Stories', `La conversación ${em('diaria')}`) + `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${[['Publicadas', F.int(stories.length)], ['Alcance promedio', F.int(avg(stories.map((x) => x.reach)))], ['Respuestas', F.int(sum(stories.map((x) => x.replies)))]].map(([l, v]) => `<div style="padding:14px;border-radius:16px;background:var(--surface2)"><div class="lbl" style="font-size:10px">${l}</div><div class="num" style="font-size:26px;font-weight:300">${v}</div></div>`).join('')}</div>
      ${curve.length >= 2 ? `<div style="display:flex;align-items:flex-end;gap:8px;height:120px">${curve.map((v, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span class="num" style="font-size:11px">${Math.round((v / curve[0]) * 100)}%</span><div style="width:100%;border-radius:8px 8px 3px 3px;background:var(--accent);opacity:${(1 - i * 0.12).toFixed(2)};height:${((v / curve[0]) * 100).toFixed(0)}%"></div><span class="mono muted" style="font-size:10px">${i + 1}ª</span></div>`).join('')}</div>` : ''}` + insight(last != null ? `De quienes ven la primera story del día, ${last}% llega a la ${curve.length}ª. Secuencias cortas y con encuestas sostienen la atención.` : ''));
  } else {
    storiesCard = card(topics.length ? 6 : 12, head('Stories', `La conversación ${em('diaria')}`) + `<div class="empty">${d.stories?.tracking ? 'Todavía no hay stories registradas en este período. Se guardan desde que se activó el registro diario.' : 'Para medir stories hay que conectar Upstash (Vercel → Storage): Instagram solo entrega sus métricas mientras están publicadas.'}</div>`);
  }

  // Demografía
  const demo = d.demographics || {};
  const ageOrder = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
  const ag = (demo.age || []).filter((x) => x[0] !== 'U').sort((a, b) => ageOrder.indexOf(a[0]) - ageOrder.indexOf(b[0]));
  const at = sum(ag.map((x) => x[1])) || 1;
  const ages = ag.map(([l, v]) => [l.replace('-', '–'), (v / at) * 100]);
  const aMax = Math.max(1, ...ages.map((x) => x[1]));
  const gen = (demo.gender || []).filter((x) => x[0] !== 'U');
  const gt = sum(gen.map((x) => x[1])) || 1;
  const cs = (demo.country || []).slice().sort((a, b) => b[1] - a[1]);
  const ct = sum(cs.map((x) => x[1])) || 1;
  const countries = cs.slice(0, 5).map(([c, v]) => [COUNTRY(c), (v / ct) * 100]);
  if (cs.length > 5) countries.push(['Otros', (sum(cs.slice(5).map((x) => x[1])) / ct) * 100]);
  let demoTxt = sc.demoInsight ? esc(sc.demoInsight) : '';
  if (!demoTxt && ages.length) { const top = ages.slice().sort((a, b) => b[1] - a[1])[0]; demoTxt = `${top[1] >= 40 && top[1] < 50 ? 'Casi la mitad' : top[1] >= 50 && top[1] < 60 ? 'Más de la mitad' : F.dec(top[1], 0) + '%'} de la comunidad tiene <em>entre ${esc(top[0].replace('–', ' y '))} años</em>${countries[0] ? `, y ${F.dec(countries[0][1], 0)}% está en ${esc(countries[0][0])}` : ''}.`; }
  const demoCard = ages.length || countries.length ? card(12, head('Comunidad', `¿Quiénes ${em('nos siguen')}?`) + `
    <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:32px;align-items:stretch" class="demo">
      <div style="display:flex;flex-direction:column;gap:12px"><span class="lbl">Edad</span><div style="display:grid;grid-template-columns:repeat(${ages.length || 1},minmax(0,1fr));gap:10px;height:200px;align-items:end">${ages.map(([l, v]) => { const top = v === aMax; return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%"><span class="num" style="font-size:13px;font-weight:600;${top ? 'color:var(--accent)' : ''}">${F.dec(v, 0)}%</span><div style="width:100%;border-radius:10px 10px 4px 4px;height:${((v / aMax) * 100).toFixed(1)}%;min-height:3px;background:${top ? 'var(--accent)' : 'var(--blue)'};opacity:${top ? 1 : 0.55}"></div><span class="mono muted" style="font-size:11px">${esc(l)}</span></div>`; }).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:12px"><span class="lbl">Países</span>${countries.map(([n, v], i) => `<div style="display:grid;grid-template-columns:120px minmax(0,1fr) 48px;gap:10px;align-items:center;font-size:13px"><span class="ellipsis" style="${i === 0 ? 'font-weight:600' : 'color:var(--muted)'}">${esc(n)}</span><div class="track"><div style="width:${Math.max(1.5, (v / (countries[0][1] || 1)) * 100).toFixed(1)}%;background:${i === 0 ? 'var(--accent)' : 'var(--faint)'}"></div></div><span class="num" style="text-align:right">${F.dec(v, v < 1 ? 1 : 0)}%</span></div>`).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:14px"><span class="lbl">Género</span>
        ${gen.length ? `<div style="display:flex;height:44px;gap:3px;border-radius:12px;overflow:hidden">${gen.map(([g, v]) => { const f = (v / gt) * 100; return `<div style="flex:${f.toFixed(1)} 1 0;min-width:0;background:${g === 'M' ? 'var(--blue)' : 'var(--coral)'};color:var(--ink);display:flex;align-items:center;padding:0 12px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden">${g === 'F' ? 'Mujeres' : g === 'M' ? 'Hombres' : 'Otro'} ${F.dec(f, 0)}%</div>`; }).join('')}</div>` : '<span class="muted" style="font-size:13px">Sin datos</span>'}
        ${demoTxt ? `<div style="margin-top:auto;padding:18px;border-radius:18px;background:var(--accentSoft)"><div class="lbl acc">Hallazgo</div><div class="serif" style="font-size:24px;line-height:1.15;margin-top:6px">${demoTxt}</div></div>` : ''}
      </div>
    </div>`) : card(12, head('Comunidad', `¿Quiénes ${em('nos siguen')}?`) + '<div class="empty">Instagram entrega la demografía solo a cuentas con 100 seguidores o más.</div>');

  // Conclusiones y recomendaciones
  const concl = (sc.conclusions || []).filter((x) => Array.isArray(x) && x[0]);
  const conclHtml = concl.length ? `<section style="display:flex;flex-direction:column;gap:18px">${head('Conclusiones', `Lo que nos dejó ${em(esc(monthName(r)))}`)}<div style="display:grid;grid-template-columns:repeat(${Math.min(3, concl.length)},minmax(0,1fr));gap:16px">${concl.map(([t, dsc], i) => `<article class="card rise" style="padding:24px;gap:12px;border-radius:24px"><span class="mono" style="font-size:28px;color:var(--faint)">0${i + 1}</span><div class="serif" style="font-size:24px;line-height:1.15">${esc(t)}</div><div class="muted" style="font-size:14px">${esc(dsc || '')}</div></article>`).join('')}</div></section>` : '';
  const recos = (sc.recos || []).filter((x) => Array.isArray(x) && x[2]);
  const mix = (sc.mix || []).filter((x) => Array.isArray(x) && x[1] > 0);
  const mixColors = ['var(--accent)', 'var(--blue)', 'var(--coral)', 'var(--violet)'];
  const recoHtml = recos.length ? `<section class="rise" style="background:var(--panel);border:1px solid var(--border);border-radius:32px;padding:36px;display:flex;flex-direction:column;gap:24px">
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px"><div><div class="lbl">Recomendaciones${r.partial ? '' : ' · ' + esc(nextMonth(r))}</div><h3 class="serif" style="margin:6px 0 0;font-size:44px;line-height:1">Qué ${em('publicar')} el próximo mes</h3></div>
      ${mix.length ? `<div style="width:min(380px,100%);display:flex;flex-direction:column;gap:6px"><span class="lbl" style="font-size:10px">Mix sugerido del feed</span><div style="display:flex;height:30px;gap:3px;border-radius:9px;overflow:hidden;font-size:12px;font-weight:600">${mix.map(([l, v], i) => `<div style="flex:${v} 1 0;min-width:0;background:${mixColors[i % 4]};color:${i === 0 ? 'var(--onAccent)' : 'var(--ink)'};display:flex;align-items:center;padding:0 10px;white-space:nowrap;overflow:hidden">${esc(l)} ${F.int(v)}%</div>`).join('')}</div></div>` : ''}</div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(4, recos.length)},minmax(0,1fr));gap:12px">${recos.map(([f, fr, t, dsc, g]) => `<article style="padding:22px;border-radius:22px;background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="padding:4px 10px;border-radius:999px;background:var(--accent);color:var(--onAccent);font-size:12px;font-weight:600">${esc(f)}</span><span class="mono muted" style="font-size:11px">${esc(fr || '')}</span></div><div class="serif" style="font-size:26px;line-height:1.1">${esc(t)}</div><div class="muted" style="font-size:13px">${esc(dsc || '')}</div>${g ? `<div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--border);font-size:12px"><span class="mono muted">OBJETIVO · </span><strong style="font-weight:600">${esc(g)}</strong></div>` : ''}</article>`).join('')}</div>
  </section>` : '';

  const approx = T.approxReach ? '<p class="muted" style="font-size:12px;margin:0">El alcance de períodos de más de 30 días es aproximado: Instagram no entrega personas únicas para rangos largos, así que se suma por tramos.</p>' : '';
  return bento + kp + best + (matrix ? `<div class="grid12">${matrix}</div>` : '') + `<div class="grid12">${topicsCard}${storiesCard}</div>` + `<div class="grid12">${demoCard}</div>` + conclHtml + recoHtml + approx;
}

/* ============================================================
   Vista principal
   ============================================================ */
const PALETTES = { niebla: 't-niebla', lino: 't-lino', marfil: 't-marfil' };
const themeClass = () => (state.theme === 'dark' ? 't-grafito' : PALETTES[String(CONFIG.palette || 'niebla').toLowerCase()] || 't-niebla');

function view() {
  const r = computeRange(state);
  const t = state.tab;
  const intro = t === 'paid' ? sheetIntro('02', 'Paid', 'media', 'Inversión publicitaria en Meta Ads y su retorno', state.paid?.source === 'meta', 'Meta Ads conectado' + (state.paid?.account?.name ? ' · ' + esc(state.paid.account.name) : ''), state.paidNote)
    : t === 'social' ? sheetIntro('03', 'Social', 'media', 'Comunidad y contenido orgánico en Instagram', state.social?.source === 'instagram', 'Instagram conectado' + (state.social?.account?.username ? ' · @' + esc(state.social.account.username) : ''), state.socialNote)
    : sheetIntro('01', 'Owned', 'media', 'Tu sitio web: visitas, comportamiento y ventas', state.owned?.source === 'ga4', 'Google Analytics 4 conectado', state.ownedNote);
  const loading = t === 'paid' ? state.paidLoading : t === 'social' ? state.socialLoading : state.ownedLoading;
  const body = t === 'paid' ? viewPaid(r) : t === 'social' ? viewSocial(r) : viewOwned(r);
  const src = t === 'paid' ? 'Fuente: Meta Ads · Atribución ' + esc(CONFIG.meta?.attributionLabel || 'según la configuración de la cuenta') : t === 'social' ? 'Fuente: Instagram (API de Meta)' : 'Fuente: Google Analytics 4';
  return `<div class="root ${themeClass()} ${state.animate ? 'animate' : ''}">
    <div class="wrap" style="zoom:${state.zoom}">
      ${viewHeader(r)}
      ${viewCover(r)}
      ${intro}
      <div class="sheet ${loading ? 'loading' : ''}" style="display:flex;flex-direction:column;gap:28px" aria-busy="${!!loading}">${body}</div>
      <footer style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;padding-top:14px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)"><span>${src}</span><span>Tu ecosistema digital · ${esc(CONFIG.client?.name || '')}</span></footer>
    </div>
  </div>`;
}

let animTimer = null;
function render() {
  const app = typeof document !== 'undefined' && document.getElementById('app');
  if (!app) return;
  const y = window.scrollY;
  app.innerHTML = view();
  window.scrollTo(0, y);
  const bg = getComputedStyle(app.firstElementChild).getPropertyValue('--bg').trim();
  if (bg) { document.documentElement.style.background = bg; document.body.style.background = bg; }
  if (state.animate) {
    state.animate = false;
    clearTimeout(animTimer);
    animTimer = setTimeout(() => document.querySelector('.root')?.classList.remove('animate'), 1200);
  }
}

/* ============================================================
   Datos
   ============================================================ */
function makeLoader(key, url, sample, liveSource) {
  const cache = new Map();
  let req = 0;
  return async function load() {
    const r = computeRange(state);
    const k = [r.since, r.until, r.csince, r.cuntil].join('|');
    if (cache.has(k)) { const c = cache.get(k); state[key] = c.data; state[key + 'Note'] = c.note; render(); return; }
    const my = ++req;
    state[key + 'Loading'] = true; render();
    let data, note = null;
    try {
      const res = await fetch(`${url}?since=${r.since}&until=${r.until}&csince=${r.csince}&cuntil=${r.cuntil}`);
      const j = await res.json().catch(() => ({ error: 'bad_json', message: 'Respuesta no válida del servidor' }));
      if (!res.ok || j.error) throw Object.assign(new Error(j.message || 'Error ' + res.status), { kind: j.error });
      data = j;
    } catch (e) {
      data = sample(r);
      note = { kind: e.kind || 'network', message: e.message };
    }
    if (my !== req) return;
    if (data.source === liveSource || note?.kind === 'not_configured') cache.set(k, { data, note });
    state[key] = data; state[key + 'Note'] = note; state[key + 'Loading'] = false;
    render();
  };
}
const loadPaid = makeLoader('paid', '/api/meta', samplePaid, 'meta');
const loadOwned = makeLoader('owned', '/api/ga4', sampleGa, 'ga4');
const loadSocial = makeLoader('social', '/api/instagram', sampleSocial, 'instagram');
const reloadData = () => { loadOwned(); loadPaid(); loadSocial(); };

/* ============================================================
   Eventos
   ============================================================ */
const ACTIONS = {
  theme: () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; LS.set('theme2', state.theme); render(); },
  zoom: () => { state.zoom = ZOOMS[(ZOOMS.indexOf(state.zoom) + 1) % ZOOMS.length]; LS.set('zoom', state.zoom); render(); },
  tab: (v) => { if (state.tab === v) return; state.tab = v; state.animate = true; state.periodOpen = false; render(); document.querySelector('.intro')?.scrollIntoView({ block: 'start' }); },
  period: () => { state.periodOpen = !state.periodOpen; render(); },
  range: (v) => { state.range = v; reloadData(); },
  from: (v) => { state.rFrom = Number(v); state.rTo = Math.min(state.rTo, state.rFrom); state.range = 'custom'; reloadData(); },
  to: (v) => { state.rTo = Number(v); state.rFrom = Math.max(state.rFrom, state.rTo); state.range = 'custom'; reloadData(); },
  cmp: (v) => { state.cmp = v; reloadData(); },
  act: (v) => { state.act = Number(v); render(); },
  campSel: (v) => { state.campSel = state.campSel === v ? null : v; render(); }
};

if (typeof document !== 'undefined') {
  if (!ZOOMS.includes(state.zoom)) state.zoom = 1;
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && ACTIONS[el.dataset.act]) { e.preventDefault(); ACTIONS[el.dataset.act](el.dataset.v); return; }
    if (state.periodOpen && !e.target.closest('.popover')) { state.periodOpen = false; render(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && ACTIONS[el.dataset.change]) ACTIONS[el.dataset.change](el.value);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.periodOpen) { state.periodOpen = false; render(); } });
  document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-day]'); if (el) showTip(Number(el.dataset.day)); });
  document.addEventListener('mouseout', (e) => { const hit = document.getElementById('paid-hit'); if (hit && hit.contains(e.target) && !hit.contains(e.relatedTarget)) hideTip(); });

  (async () => {
    try { const r = await fetch('/config.json', { cache: 'no-cache' }); if (r.ok) CONFIG = { ...CONFIG, ...(await r.json()) }; } catch { /* usa valores por defecto */ }
    document.title = 'Tu ecosistema digital · ' + (CONFIG.client?.name || '');
    render();
    reloadData();
  })();
}

export { view, state, computeRange, CONFIG, render };
