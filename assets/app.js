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
  intShort: (n) => (n == null || isNaN(n) ? '—' : n >= 1e6 ? nf(1).format(n / 1e6) + 'M' : n >= 1e4 ? nf(0).format(n / 1e3) + 'K' : nf(0).format(n)),
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
const state = {
  theme: LS.get('theme', (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'),
  fs: LS.get('fs', 16),
  tab: 'owned',
  range: 'ant', rFrom: 1, rTo: 1, cmp: 'prev',
  metric: 'revenue', sortKey: 'spend', stageF: 'all', camp: null,
  srcMetric: 'ses', segDim: 'edad', act: 'com', fmt: 'reels',
  paid: null, paidNote: null, loading: false, animate: true
};

/* ============================================================
   Íconos
   ============================================================ */
const svg = (d, size = 16, sw = 1.75, fill = 'none') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${fill === 'none' ? 'currentColor' : 'none'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  mega: svg('<path d="M3 11v2a1 1 0 0 0 1 1h2l6 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"/>'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>'),
  play: svg('<path d="M8 5.5v13l11-6.5z"/>', 26, 0, 'currentColor'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', 36, 1.5),
  carousel: svg('<rect x="6" y="3" width="15" height="15" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2h12"/>', 40, 1.5),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14, 3),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 26, 2),
  down: svg('<path d="M12 4v16M6 14l6 6 6-6"/>', 14, 2.5),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>', 14, 2)
};

/* ============================================================
   Piezas reutilizables
   ============================================================ */
function sparkPoints(vals, w = 100, h = 28) {
  const xs = vals.map((v) => (v == null || isNaN(v) ? null : v));
  const valid = xs.filter((v) => v != null);
  if (valid.length < 2) return '';
  const lo = Math.min(...valid), hi = Math.max(...valid), r = hi - lo || 1;
  let last = valid[0];
  return xs.map((v, i) => { if (v != null) last = v; return (i * w / (xs.length - 1)).toFixed(1) + ',' + (h - 3 - ((last - lo) / r) * (h - 6)).toFixed(1); }).join(' ');
}

const deltaPill = (d) => `<span class="delta num ${d.cls}">${d.arrow} ${esc(d.txt)}</span>`;

function staticTile([label, value, dtxt, prev, g], i, sparkSeed) {
  const cls = g === 1 ? 'pos' : g === -1 ? 'neg' : 'neu';
  const arrow = dtxt.charAt(0) === '+' ? '▲' : '▼';
  const pts = [];
  for (let k = 0; k < 20; k++) pts.push(Math.sin(k / 2.6 + (sparkSeed ?? i)) * 6 + Math.sin(k * 1.4 + i) * 2 + (arrow === '▲' ? k * 0.35 : -k * 0.35));
  return `<div class="tile rise" style="animation-delay:${(i * 0.04).toFixed(2)}s">
    <span class="lab">${esc(label)}</span>
    <span class="val num">${esc(value)}</span>
    <span class="cmp"><span class="delta num ${cls}">${arrow} ${esc(dtxt)}</span><span class="muted">vs ${esc(prev)}</span></span>
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${sparkPoints(pts)}" fill="none" stroke="var(--prev)" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
  </div>`;
}

const sectionHead = (eyebrow, title, right = '') => `<div class="row" style="align-items:flex-end;justify-content:space-between;gap:1em">
  <div><div class="eyebrow">${esc(eyebrow)}</div><h2 class="h2">${title}</h2></div>${right}</div>`;

const seg = (label, items, act, cur, soft = true) => `<div class="seg ${soft ? 'soft' : ''}" role="group" aria-label="${esc(label)}">${items.map(([v, l]) => `<button type="button" class="btn" data-act="${act}" data-v="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div>`;

const barRow = (label, value, w, fill, labelCols = '9em', valCols = '4.5em', bold = false) => `<div style="display:grid;grid-template-columns:${labelCols} minmax(0,1fr) ${valCols};gap:0.75em;align-items:center;font-size:0.875em">
  <span style="${bold ? 'font-weight:600' : 'color:var(--muted)'}">${esc(label)}</span>
  <div class="track" style="height:20px;border-radius:6px"><div class="fill grow" style="width:${w};background:${fill}"></div></div>
  <span class="num" style="text-align:right;font-weight:500">${esc(value)}</span></div>`;

const banner = (kind, text) => `<div class="banner ${kind}"><span class="dot"></span><span>${text}</span></div>`;

/* ============================================================
   Cabecera, período y hojas
   ============================================================ */
function viewHeader() {
  const c = CONFIG.client || {};
  const logo = c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.name)}">` : 'LOGO';
  const sizes = [[14, 'A−', 'Texto pequeño', '13px'], [16, 'A', 'Texto normal', '15px'], [18, 'A+', 'Texto grande', '18px']];
  return `<header class="header">
    <div style="display:flex;align-items:center;gap:0.875em">
      <div class="logo">${logo}</div>
      <div><div style="font-size:1.0625em;font-weight:600">${esc(c.name)}</div><div class="small muted">Reporte mensual</div></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:0.75em">
      <div class="seg" role="group" aria-label="Tema">
        <button type="button" class="btn" data-act="theme" data-v="light" aria-pressed="${state.theme === 'light'}">${IC.sun}Claro</button>
        <button type="button" class="btn" data-act="theme" data-v="dark" aria-pressed="${state.theme === 'dark'}">${IC.moon}Oscuro</button>
      </div>
      <div class="seg" role="group" aria-label="Tamaño de texto">
        ${sizes.map(([v, l, a, f]) => `<button type="button" class="btn" data-act="fs" data-v="${v}" aria-label="${a}" aria-pressed="${state.fs === v}" style="min-width:44px;justify-content:center;font-weight:600;font-size:${f}">${l}</button>`).join('')}
      </div>
    </div>
  </header>`;
}

function viewEco(r) {
  const opts = monthOptions();
  const sel = (act, val) => `<select class="select ${state.range === 'custom' ? 'on' : ''}" data-change="${act}" aria-label="${act === 'from' ? 'Desde' : 'Hasta'}">${opts.map((o) => `<option value="${o.off}" ${o.off === val ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
  return `<section class="eco" aria-labelledby="eco">
    <div style="flex:1 1 460px;min-width:0">
      <div class="kicker" style="color:var(--accent);letter-spacing:0.14em">Reporte digital · ${esc(r.label)}</div>
      <h1 id="eco">Tu ecosistema digital</h1>
      <p class="muted" style="margin:0.75em 0 0;font-size:1.0625em;max-width:52ch">Cómo funcionaron tus medios propios, pagados y sociales en el período, y qué haremos a continuación.</p>
    </div>
    <div class="period">
      <div class="line"><span class="lab">Período</span>
        <button type="button" class="pill btn" data-act="range" data-v="mes" aria-pressed="${state.range === 'mes'}">Este mes</button>
        <button type="button" class="pill btn" data-act="range" data-v="ant" aria-pressed="${state.range === 'ant'}">Mes anterior</button>
      </div>
      <div class="line"><span class="lab">Personalizar</span>
        <label class="small muted" style="display:flex;align-items:center;gap:0.4em">Desde ${sel('from', state.rFrom)}</label>
        <label class="small muted" style="display:flex;align-items:center;gap:0.4em">Hasta ${sel('to', state.rTo)}</label>
        <span class="xs muted">Hasta 6 meses atrás</span>
      </div>
      <div class="line"><span class="lab">Comparar</span>
        ${seg('Comparar con', [['prev', 'Período anterior'], ['yoy', 'Año anterior']], 'cmp', state.cmp)}
        <span class="small muted num">${esc(r.clabel)}</span>
      </div>
    </div>
  </section>`;
}

function viewTabs() {
  const tabs = [
    ['owned', '01', 'Owned media', 'Sitio web · Google Analytics 4', 'Visitas, comportamiento y ventas en tu sitio', IC.globe],
    ['paid', '02', 'Paid media', 'Meta Ads', 'Inversión publicitaria y su retorno', IC.mega],
    ['social', '03', 'Social media', 'Instagram orgánico', 'Comunidad, contenido e interacción', IC.heart]
  ];
  return `<nav class="sheettabs" aria-label="Canales del ecosistema">${tabs.map(([id, n, t, sub, desc, ic]) => `
    <button type="button" class="sheettab" data-act="tab" data-v="${id}" aria-pressed="${state.tab === id}">
      <span style="display:flex;align-items:center;justify-content:space-between"><span class="n num">${n}</span><span class="ic">${ic}</span></span>
      <span class="t">${t}</span><span class="small" style="font-weight:600">${sub}</span><span class="small muted">${desc}</span>
    </button>`).join('')}</nav>`;
}

/* ============================================================
   Paid media (Meta Ads)
   ============================================================ */
const PM = [
  { key: 'spend', grp: 'biz', label: 'Inversión', f: F.money, s: F.moneyShort, good: 0, zero: true },
  { key: 'purchases', grp: 'biz', label: 'Compras', f: F.int, s: F.int, good: 1, zero: true },
  { key: 'revenue', grp: 'biz', label: 'Ingresos', f: F.money, s: F.moneyShort, good: 1, zero: true },
  { key: 'roas', grp: 'biz', label: 'ROAS', f: (n) => F.x(n), s: (n) => F.x(n, 1), good: 1 },
  { key: 'cpa', grp: 'biz', label: 'Costo por compra', f: F.money, s: F.moneyShort, good: -1 },
  { key: 'aov', grp: 'biz', label: 'Valor por conversión', f: F.money, s: F.moneyShort, good: 1 },
  { key: 'impressions', grp: 'att', label: 'Impresiones', f: F.int, s: F.intShort, good: 1, zero: true },
  { key: 'reach', grp: 'att', label: 'Alcance', f: F.int, s: F.intShort, good: 1, zero: true },
  { key: 'frequency', grp: 'att', label: 'Frecuencia', f: (n) => F.dec(n, 2), s: (n) => F.dec(n, 1), good: -1 },
  { key: 'ctr', grp: 'att', label: 'CTR (enlace)', f: (n) => F.pct(n, 2), s: (n) => F.pct(n, 1), good: 1 }
];

function paidBanner(d) {
  if (state.loading) return banner('', 'Actualizando datos de Meta…');
  const n = state.paidNote;
  if (d.source === 'meta') {
    const t = d.generatedAt ? new Date(d.generatedAt).toLocaleString(CONFIG.locale || 'es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '';
    return banner('live', `Conectado a Meta Ads${d.account?.name ? ' · ' + esc(d.account.name) : ''}${t ? ' · datos de ' + esc(t) : ''}`);
  }
  if (!n) return banner('', 'Mostrando datos de ejemplo.');
  if (n.kind === 'not_configured') return banner('', '<strong>Datos de ejemplo.</strong> Para ver datos reales, agrega <code>META_ACCESS_TOKEN</code> y <code>META_AD_ACCOUNT_ID</code> en las variables de entorno de Vercel.');
  if (n.kind === 'meta_error') return banner('warn', '<strong>Meta respondió con un error:</strong> ' + esc(n.message) + ' · Se muestran datos de ejemplo.');
  return banner('', '<strong>Datos de ejemplo.</strong> No se pudo contactar el servidor del dashboard.');
}

function paidHero(d, r) {
  const t = d.totals.cur;
  const st = { ...(CONFIG.strategy?.default || {}), ...(CONFIG.strategy?.[r.monthKey] || {}) };
  const g = CONFIG.goals || {};
  const goals = [];
  if (g.roas) goals.push({ label: 'ROAS', val: t.roas, goal: g.roas, f: (n) => F.x(n), dir: 1 });
  if (g.purchasesPerMonth) goals.push({ label: 'Compras', val: t.purchases, goal: Math.round(g.purchasesPerMonth * r.monthsLen), f: F.int, dir: 1 });
  if (g.cpa) goals.push({ label: 'Costo por compra', val: t.cpa, goal: g.cpa, f: F.money, dir: -1 });
  const met = goals.filter((x) => x.val != null && (x.dir > 0 ? x.val >= x.goal : x.val <= x.goal)).length;
  const note = (x) => {
    if (x.val == null) return 'Sin datos';
    if (x.label === 'ROAS') { const p = (x.val / x.goal - 1) * 100; return (p >= 0 ? '+' : '−') + F.dec(Math.abs(p), 0) + '% ' + (p >= 0 ? 'sobre' : 'bajo') + ' la meta'; }
    if (x.label === 'Compras') { const df = x.val - x.goal; return df >= 0 ? F.int(df) + ' sobre la meta' : 'Faltaron ' + F.int(-df); }
    const df = x.goal - x.val; return df >= 0 ? F.money(df) + ' bajo la meta' : F.money(-df) + ' sobre la meta';
  };
  const funnel = [['rec', 'Reconocimiento'], ['cons', 'Consideración'], ['conv', 'Conversión']];
  const headline = t.roas != null
    ? `Por cada $1 invertido, volvieron <span style="color:var(--heroAccent)">$${F.dec(t.roas, 2)}</span> en ventas.`
    : 'Resumen del período';
  return `<section class="hero rise" aria-labelledby="ph">
    <div style="flex:1 1 520px;min-width:0;display:flex;flex-direction:column;gap:1.25em">
      <div class="kicker">Resumen estratégico · ${esc(r.label)}</div>
      <h1 id="ph" style="max-width:16ch;font-size:2.75em">${headline}</h1>
      <p>${esc(st.summary || '')}</p>
      <div style="display:flex;flex-wrap:wrap;gap:0.75em">
        <div class="box" style="flex:1 1 240px"><div class="kicker" style="font-size:0.6875em">Objetivo de negocio</div><div style="margin-top:0.35em;font-weight:500">${esc(st.businessObjective || '—')}</div></div>
        <div class="box" style="flex:1 1 240px"><div class="kicker" style="font-size:0.6875em">Etapa del funnel</div>
          <div style="display:flex;gap:4px;margin-top:0.6em">${funnel.map(([id, l]) => `<div style="flex:1;display:flex;flex-direction:column;gap:0.4em"><div style="height:6px;border-radius:3px;background:${id === st.funnelStage ? 'var(--heroAccent)' : 'var(--heroTrack)'}"></div><div style="font-size:0.75em;${id === st.funnelStage ? 'font-weight:600;color:var(--heroText)' : 'color:var(--heroMuted)'}">${l}</div></div>`).join('')}</div>
        </div>
      </div>
    </div>
    ${goals.length ? `<div style="flex:1 1 340px;min-width:0;padding:1.5em;border-radius:18px;background:var(--heroTrack);display:flex;flex-direction:column;gap:1.25em">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75em">
        <div class="kicker" style="font-size:0.6875em">Objetivos digitales</div>
        <span class="badge" style="background:${met === goals.length ? 'var(--heroGood)' : 'var(--heroAccent)'};color:#1F1D19">${met === goals.length ? IC.check : ''}${met} de ${goals.length} cumplidas</span>
      </div>
      ${goals.map((x, i) => {
        const max = x.goal * 1.5;
        const w = x.val == null ? 0 : Math.min(100, (x.val / max) * 100);
        return `<div style="display:flex;flex-direction:column;gap:0.45em">
          <div style="display:flex;align-items:baseline;justify-content:space-between"><span style="font-size:0.875em;font-weight:500">${x.label}</span><span class="num" style="font-size:1.25em;font-weight:500">${x.f(x.val)}</span></div>
          <div style="position:relative;height:10px;border-radius:5px;background:var(--heroTrack)">
            <div class="grow" style="position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--heroGood);width:${w.toFixed(1)}%;animation-delay:${(0.3 + 0.15 * i).toFixed(2)}s"></div>
            <div style="position:absolute;top:-4px;bottom:-4px;width:2px;border-radius:1px;background:var(--heroText);left:66.7%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.75em;color:var(--heroMuted)"><span>Meta ${x.f(x.goal)}</span><span>${note(x)}</span></div>
        </div>`;
      }).join('')}
    </div>` : ''}
  </section>`;
}

function paidTiles(d) {
  const tile = (m, i) => {
    const cur = d.totals.cur[m.key], prev = d.totals.prev[m.key];
    const dl = delta(cur, prev, m.good);
    const on = state.metric === m.key;
    return `<button type="button" class="tile btn rise" data-act="metric" data-v="${m.key}" aria-pressed="${on}" style="animation-delay:${(i * 0.04).toFixed(2)}s">
      <span class="lab">${m.label}<span style="width:8px;height:8px;border-radius:999px;background:${on ? 'var(--accent)' : 'transparent'}"></span></span>
      <span class="val num">${m.f(cur)}</span>
      <span class="cmp">${deltaPill(dl)}<span class="muted">vs ${m.f(prev)}</span></span>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${sparkPoints(d.daily.cur.map((x) => x[m.key]))}" fill="none" stroke="${on ? 'var(--accent)' : 'var(--prev)'}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    </button>`;
  };
  return `<section aria-labelledby="kpis" style="display:flex;flex-direction:column;gap:1.25em">
    <div class="row" style="justify-content:space-between;align-items:baseline;gap:0.5em"><h2 id="kpis" class="section-label">Resultado de negocio</h2><span class="small muted">Toca una métrica para ver su evolución</span></div>
    <div class="tiles biz">${PM.filter((m) => m.grp === 'biz').map(tile).join('')}</div>
    <h2 class="section-label" style="margin-top:1.25em">Alcance y atención</h2>
    <div class="tiles wide">${PM.filter((m) => m.grp === 'att').map((m, i) => tile(m, i + 6)).join('')}</div>
  </section>`;
}

let chartCtx = null;
function paidChart(d, r) {
  const m = PM.find((x) => x.key === state.metric) || PM[2];
  const curRows = d.daily.cur, prevRows = d.daily.prev;
  const N = curRows.length;
  const c = curRows.map((x) => x[m.key]);
  const p = c.map((_, i) => (prevRows[i] ? prevRows[i][m.key] : null));
  const dl = delta(d.totals.cur[m.key], d.totals.prev[m.key], m.good);
  if (N < 2) {
    chartCtx = null;
    return `<section class="card">${sectionHead('Evolución diaria', esc(m.label))}<p class="muted">Se necesitan al menos 2 días de datos para mostrar la evolución.</p></section>`;
  }
  const vals = c.concat(p).filter((v) => v != null && !isNaN(v));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padv = (hi - lo) * 0.15 || hi * 0.1 || 1;
  lo = m.zero ? 0 : Math.max(0, lo - padv);
  hi = hi + padv;
  const Y = (v) => 250 - ((v - lo) / (hi - lo)) * 230;
  const X = (i) => (i * 800) / (N - 1);
  const pts = (arr) => { let last = null; return arr.map((v, i) => { if (v != null && !isNaN(v)) last = v; return last == null ? null : X(i).toFixed(1) + ',' + Y(last).toFixed(1); }).filter(Boolean).join(' '); };
  const curPts = pts(c);
  chartCtx = { m, c, p, N, Y, curDates: curRows.map((x) => x.date), prevDates: p.map((_, i) => prevRows[i]?.date) };
  const ticks = [hi, (hi + lo) / 2, lo].map((v, i) => `<span style="position:absolute;right:0;transform:translateY(-50%);top:${(([20, 135, 250][i]) / 260 * 100).toFixed(2)}%">${m.s(v)}</span>`).join('');
  const labIdx = [0, Math.round((N - 1) * 0.25), Math.round((N - 1) * 0.5), Math.round((N - 1) * 0.75), N - 1];
  return `<section class="card" aria-labelledby="ten">
    <div class="row" style="align-items:flex-end;justify-content:space-between;gap:1em">
      <div><div class="eyebrow">Evolución diaria</div>
        <h2 id="ten" class="h2">${esc(m.label)} <span class="num" style="color:var(--accent)">${m.f(d.totals.cur[m.key])}</span> <span style="font-size:0.55em;vertical-align:middle">${deltaPill(dl)}</span></h2></div>
      <div style="display:flex;gap:1.25em" class="small muted">
        <span style="display:flex;align-items:center;gap:0.45em"><span style="width:18px;height:3px;border-radius:2px;background:var(--accent)"></span>${esc(r.label)}</span>
        <span style="display:flex;align-items:center;gap:0.45em"><svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="var(--prev)" stroke-width="2" stroke-dasharray="4 3"/></svg>${esc(r.clabel)}</span>
      </div>
    </div>
    <div style="display:flex;gap:0.75em">
      <div class="num xs muted" style="position:relative;width:4.5em;flex:none;height:260px">${ticks}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:0.5em">
        <div style="position:relative;height:260px" id="chart-box">
          <svg viewBox="0 0 800 260" preserveAspectRatio="none" role="img" aria-label="${esc(m.label)} por día comparado con el período anterior" style="position:absolute;inset:0;width:100%;height:100%">
            <line x1="0" y1="20" x2="800" y2="20" stroke="var(--grid)" vector-effect="non-scaling-stroke"/>
            <line x1="0" y1="135" x2="800" y2="135" stroke="var(--grid)" vector-effect="non-scaling-stroke"/>
            <line x1="0" y1="250" x2="800" y2="250" stroke="var(--border)" vector-effect="non-scaling-stroke"/>
            <polygon points="0,250 ${curPts} 800,250" fill="var(--accentSoft)"/>
            <polyline points="${pts(p)}" fill="none" stroke="var(--prev)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
            <polyline points="${curPts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
          </svg>
          <div id="chart-tip"></div>
          <div id="chart-hit" style="position:absolute;inset:0;display:flex">${c.map((_, i) => `<div data-day="${i}" style="flex:1;height:100%"></div>`).join('')}</div>
        </div>
        <div class="num xs muted" style="display:flex;justify-content:space-between">${labIdx.map((i) => `<span>${dayLabel(curRows[i].date)}</span>`).join('')}</div>
      </div>
    </div>
  </section>`;
}

function showTip(i) {
  const box = document.getElementById('chart-tip');
  if (!box || !chartCtx || i >= chartCtx.N) return;
  const { m, c, p, N, Y, curDates, prevDates } = chartCtx;
  const hx = (i / (N - 1)) * 100;
  const cv = c[i], pv = p[i];
  const diff = cv != null && pv ? (cv - pv) / pv : null;
  const dot = (v, size, color, ring) => (v == null ? '' : `<div style="position:absolute;width:${size}px;height:${size}px;margin:-${size / 2}px 0 0 -${size / 2}px;border-radius:999px;background:${color};${ring ? 'border:3px solid var(--surface);' : ''}left:${hx}%;top:${(Y(v) / 260 * 100).toFixed(2)}%"></div>`);
  box.innerHTML = `<div style="position:absolute;top:0;bottom:10px;width:1px;background:var(--muted);opacity:0.4;left:${hx}%"></div>
    ${dot(pv, 10, 'var(--prev)')}${dot(cv, 14, 'var(--accent)', true)}
    <div style="position:absolute;top:0;z-index:2;min-width:200px;padding:0.8em 0.95em;border-radius:12px;background:var(--text);color:var(--bg);box-shadow:0 12px 32px rgba(0,0,0,0.2);font-size:0.8125em;pointer-events:none;left:${hx}%;transform:${hx > 70 ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)'}">
      <div style="font-weight:600;margin-bottom:0.35em">${esc(m.label)}</div>
      <div style="display:flex;justify-content:space-between;gap:1em"><span style="opacity:0.75">${dayLabel(curDates[i])}</span><span class="num" style="font-weight:600">${m.f(cv)}</span></div>
      <div style="display:flex;justify-content:space-between;gap:1em"><span style="opacity:0.75">${prevDates[i] ? dayLabel(prevDates[i]) : 'Anterior'}</span><span class="num">${m.f(pv)}</span></div>
      ${diff != null ? `<div class="num" style="margin-top:0.35em;font-weight:600">${diff >= 0 ? '▲ +' : '▼ −'}${F.dec(Math.abs(diff * 100), 1)}% vs anterior</div>` : ''}
    </div>`;
}
const hideTip = () => { const b = document.getElementById('chart-tip'); if (b) b.innerHTML = ''; };

function paidCampaigns(d) {
  const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
  const all = d.campaigns || [];
  if (!all.length) return `<section class="card">${sectionHead('Campañas de la cuenta', '¿Dónde rinde cada peso?')}<p class="muted">No hay campañas con inversión en este período.</p></section>`;
  const TI = all.reduce((a, x) => a + x.spend, 0);
  const TG = all.reduce((a, x) => a + (x.revenue || 0), 0);
  const top = all.slice(0, 5);
  const rest = all.slice(5);
  const colorOf = Object.fromEntries(top.map((x, i) => [x.id, COLORS[i]]));
  const segsData = top.map((x) => ({ id: x.id, name: x.name, spend: x.spend, revenue: x.revenue || 0, color: colorOf[x.id] }));
  if (rest.length) segsData.push({ id: '__rest', name: 'Otras (' + rest.length + ')', spend: rest.reduce((a, x) => a + x.spend, 0), revenue: rest.reduce((a, x) => a + (x.revenue || 0), 0), color: 'var(--prev)' });
  const sel = state.camp;
  const dim = (id) => sel && sel !== id;
  const segBar = (key) => segsData.filter((s) => s[key] > 0).map((s) => `<div title="${esc(s.name)}" style="flex:${s[key]} 1 0;height:100%;background:${s.color};opacity:${dim(s.id) ? 0.22 : 1};transition:opacity .2s ease"></div>`).join('');
  const withRev = all.filter((x) => x.revenue > 0 && x.spend > 0);
  const ins = sel ? all.find((x) => x.id === sel) : withRev.sort((a, b) => (b.revenue / TG) / (b.spend / TI) - (a.revenue / TG) / (a.spend / TI))[0];
  const eff = ins && TG ? (ins.revenue / TG) / (ins.spend / TI) : null;
  const filtered = all.filter((x) => state.stageF === 'all' || x.stageId === state.stageF);
  const sv = (x) => (x[state.sortKey] ?? -Infinity);
  const rows = filtered.slice().sort((a, b) => sv(b) - sv(a));
  const sum = (k) => filtered.reduce((a, x) => a + (x[k] || 0), 0);
  const tS = sum('spend'), tP = sum('purchases'), tR = sum('revenue'), tI = sum('impressions'), tC = sum('linkClicks');
  const goalRoas = CONFIG.goals?.roas || 0;
  const th = (k, l) => `<button type="button" class="thbtn btn rt" data-act="sort" data-v="${k}" aria-pressed="${state.sortKey === k}">${l} ${state.sortKey === k ? '↓' : ''}</button>`;
  return `<section class="card" aria-labelledby="camp">
    ${sectionHead('Campañas de la cuenta', '¿Dónde rinde cada peso?', seg('Filtrar por etapa del funnel', [['all', 'Todas'], ['rec', 'Reconocimiento'], ['cons', 'Consideración'], ['conv', 'Conversión']], 'stageF', state.stageF))}
    <div class="row" style="align-items:stretch">
      <div style="flex:1 1 520px;min-width:0;display:flex;flex-direction:column;gap:1em">
        <div><div class="small" style="display:flex;justify-content:space-between;font-weight:500;margin-bottom:0.4em"><span>Inversión</span><span class="num muted">${F.money(TI)}</span></div><div class="grow" style="display:flex;height:34px;gap:3px;border-radius:10px;overflow:hidden">${segBar('spend')}</div></div>
        <div><div class="small" style="display:flex;justify-content:space-between;font-weight:500;margin-bottom:0.4em"><span>Ingresos atribuidos</span><span class="num muted">${F.money(TG)}</span></div><div class="grow" style="display:flex;height:34px;gap:3px;border-radius:10px;overflow:hidden">${segBar('revenue') || '<div style="flex:1;background:var(--surface2)"></div>'}</div></div>
        <div style="display:flex;flex-wrap:wrap;gap:0.4em 1.1em">${segsData.map((s) => s.id === '__rest' ? `<span class="small muted" style="display:flex;align-items:center;gap:0.45em"><span style="width:10px;height:10px;border-radius:3px;background:${s.color}"></span>${esc(s.name)}</span>` : `<button type="button" class="btn" data-act="camp" data-v="${esc(s.id)}" aria-pressed="${sel === s.id}" style="all:unset;cursor:pointer;min-height:32px;display:flex;align-items:center;gap:0.45em;font-size:0.8125em;${dim(s.id) ? 'color:var(--muted);opacity:0.6' : 'font-weight:500'}"><span style="width:10px;height:10px;border-radius:3px;background:${s.color}"></span><span class="ellipsis" style="max-width:22ch">${esc(s.name)}</span></button>`).join('')}</div>
      </div>
      ${ins ? `<div class="insight" style="flex:1 1 280px;min-width:0;justify-content:center;background:var(--surface2)">
        <div class="kicker" style="color:var(--muted)">${sel ? 'Campaña seleccionada' : 'La más eficiente'}</div>
        <div style="font-size:1.0625em;font-weight:500;line-height:1.35">${esc(ins.name)}</div>
        <div style="display:flex;align-items:flex-end;gap:1.1em">
          <div><div class="num muted" style="font-size:1.875em;font-weight:300">${F.dec((ins.spend / TI) * 100, 0)}%</div><div class="xs muted">de la inversión</div></div>
          <span class="muted" style="margin-bottom:1.4em">${IC.arrow}</span>
          <div><div class="num" style="font-size:1.875em;font-weight:300;color:${eff >= 1 ? 'var(--pos)' : 'var(--neg)'}">${TG ? F.dec(((ins.revenue || 0) / TG) * 100, 0) : 0}%</div><div class="xs muted">de los ingresos</div></div>
        </div>
        <div class="small muted">${ins.revenue ? 'Rinde ' + F.dec(eff, 1) + ' veces lo que pesa en el presupuesto.' : 'Esta campaña no registra ventas directas.'}</div>
      </div>` : ''}
    </div>
    <div class="ctable"><div class="inner">
      <div class="r h"><span>Campaña</span><span>Etapa</span>${th('spend', 'Inversión').replace(' rt"', '"')}${th('purchases', 'Compras')}${th('revenue', 'Ingresos')}${th('roas', 'ROAS')}<span class="rt">Costo/compra</span><span class="rt">CTR</span><span class="rt">Δ ROAS</span></div>
      ${rows.map((x) => {
        const color = colorOf[x.id] || 'var(--prev)';
        const dr = x.roas != null && x.prevRoas ? delta(x.roas, x.prevRoas, 1) : { txt: '—', cls: 'neu', arrow: '' };
        return `<div class="r ${sel === x.id ? 'sel' : dim(x.id) ? 'dim' : ''}">
          <button type="button" class="namebtn btn" data-act="camp" data-v="${esc(x.id)}" aria-pressed="${sel === x.id}">
            <span style="width:12px;height:12px;flex:none;border-radius:4px;background:${color}"></span>
            <span style="display:block;min-width:0"><span class="ellipsis" style="font-weight:500" title="${esc(x.name)}">${esc(x.name)}</span><span class="xs muted" style="display:flex;align-items:center;gap:0.35em"><span style="width:6px;height:6px;border-radius:999px;background:${x.active ? 'var(--pos)' : 'var(--muted)'}"></span>${esc(x.status)}</span></span>
          </button>
          <span style="justify-self:start;padding:0.2em 0.6em;border-radius:999px;background:var(--surface2);font-size:0.8125em;font-weight:500">${esc(x.stage)}</span>
          <div style="display:flex;flex-direction:column;gap:0.3em"><span class="num" style="font-weight:500">${F.money(x.spend)}</span><div class="track" style="height:6px"><div class="fill" style="width:${((x.spend / TI) * 100).toFixed(1)}%;background:${color}"></div></div></div>
          <span class="num rt">${x.purchases ? F.int(x.purchases) : '—'}</span>
          <span class="num rt">${x.revenue ? F.money(x.revenue) : '—'}</span>
          <span class="num rt" style="font-weight:600;color:${!x.purchases ? 'var(--muted)' : goalRoas && x.roas < goalRoas ? 'var(--neg)' : 'var(--pos)'}">${x.purchases ? F.x(x.roas) : '—'}</span>
          <span class="num rt">${x.purchases ? F.money(x.cpa) : '—'}</span>
          <span class="num rt">${F.pct(x.ctr)}</span>
          <span class="num rt" style="font-weight:500;color:${dr.cls === 'pos' ? 'var(--pos)' : dr.cls === 'neg' ? 'var(--neg)' : 'var(--muted)'}">${esc(dr.txt)}</span>
        </div>`;
      }).join('')}
      <div class="r tot"><span>${state.stageF === 'all' ? 'Total cuenta' : 'Total filtrado'}</span><span></span><span class="num">${F.money(tS)}</span><span class="num rt">${tP ? F.int(tP) : '—'}</span><span class="num rt">${tR ? F.money(tR) : '—'}</span><span class="num rt">${tP ? F.x(tR / tS) : '—'}</span><span class="num rt">${tP ? F.money(tS / tP) : '—'}</span><span class="num rt">${tI ? F.pct((tC / tI) * 100) : '—'}</span><span></span></div>
    </div></div>
    <div class="xs muted">Toca una campaña para destacarla. Las campañas de reconocimiento no buscan compras: se miden por alcance y CPM.${goalRoas ? ' ROAS en verde: sobre la meta de ' + F.x(goalRoas, 1) + '.' : ''}</div>
  </section>`;
}

function paidWinners(d) {
  const ads = d.ads || [];
  const min = CONFIG.meta?.winnerMinSpend;
  const head = sectionHead('Creatividades', 'Anuncios ganadores', `<span class="small muted">Ranking por ROAS${min ? ' · mínimo ' + F.money(min) + ' invertidos' : ''}</span>`);
  if (!ads.length) return `<section style="display:flex;flex-direction:column;gap:1.25em">${head}<div class="card"><p class="muted" style="margin:0">Ningún anuncio alcanzó la inversión mínima con compras en este período.</p></div></section>`;
  const avg = d.totals.cur.roas;
  const visual = (a, big) => `<div class="creative" style="${big ? 'flex:1 1 240px;min-height:340px' : 'flex:1;min-height:210px'}">
    ${a.thumb ? `<img src="${esc(a.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
    ${a.isVideo ? `<div class="play">${IC.play}</div>` : a.thumb ? '' : IC.image}
    ${a.thumb ? '' : `<span class="small">${a.isVideo ? 'Video del anuncio' : 'Imagen del anuncio'}</span>`}
    <span class="tag num" style="left:1em;background:${big ? 'var(--accent)' : 'var(--text)'};color:${big ? 'var(--onAccent)' : 'var(--bg)'}">#${big ? 1 : a.rank}</span>
    <span class="tag" style="right:1em;background:var(--surface);color:var(--text)">${esc(a.format)}</span>
  </div>`;
  const link = (a) => (a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener" class="small" style="display:inline-flex;align-items:center;gap:0.35em;color:var(--accent);font-weight:500">Ver anuncio ${IC.ext}</a>` : '');
  const [first, ...others] = ads;
  return `<section aria-labelledby="gan" style="display:flex;flex-direction:column;gap:1.25em">
    ${head}
    <div class="row" style="gap:1.25em">
      <article class="rise" style="flex:2 1 520px;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:24px;overflow:hidden;display:flex;flex-wrap:wrap">
        ${visual(first, true)}
        <div style="flex:1 1 260px;padding:1.75em;display:flex;flex-direction:column;justify-content:center;gap:1.25em">
          <div><div class="kicker" style="color:var(--accent)">Anuncio del período</div><div style="margin-top:0.3em;font-size:1.25em;font-weight:500;line-height:1.3">${esc(first.name)}</div></div>
          <div><div class="num" style="font-size:3em;font-weight:300;line-height:1;letter-spacing:-0.03em;color:var(--pos)">${F.x(first.roas, 1)}</div>
            <div class="small muted">ROAS${avg ? ' · ' + F.dec(Math.abs((first.roas / avg - 1) * 100), 0) + '% ' + (first.roas >= avg ? 'sobre' : 'bajo') + ' el promedio de la cuenta' : ''}</div></div>
          ${first.sharePurchases != null ? `<div><div class="small" style="display:flex;justify-content:space-between"><span class="muted">Participación en las compras</span><span class="num" style="font-weight:600">${F.dec(first.sharePurchases * 100, 0)}%</span></div><div class="track" style="height:8px;margin-top:0.4em"><div class="fill grow" style="width:${(first.sharePurchases * 100).toFixed(1)}%;background:var(--accent)"></div></div></div>` : ''}
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.75em">
            <div><div class="xs muted">Compras</div><div class="num" style="font-size:1.25em">${F.int(first.purchases)}</div></div>
            <div><div class="xs muted">Inversión</div><div class="num" style="font-size:1.25em">${F.moneyShort(first.spend)}</div></div>
            <div><div class="xs muted">CTR</div><div class="num" style="font-size:1.25em">${F.pct(first.ctr)}</div></div>
          </div>
          ${link(first)}
        </div>
      </article>
      ${others.map((a, i) => `<article class="tile rise" style="flex:1 1 240px;min-width:0;padding:0;overflow:hidden;border-radius:24px;animation-delay:${0.1 * (i + 1)}s">
        ${visual({ ...a, rank: i + 2 }, false)}
        <div style="padding:1.25em 1.375em 1.375em;display:flex;flex-direction:column;gap:0.75em">
          <div style="font-weight:500">${esc(a.name)}</div>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.5em">
            <div><div class="xs muted">ROAS</div><div class="num" style="font-size:1.125em;color:var(--pos);font-weight:500">${F.x(a.roas, 1)}</div></div>
            <div><div class="xs muted">Compras</div><div class="num" style="font-size:1.125em">${F.int(a.purchases)}</div></div>
            <div><div class="xs muted">Inversión</div><div class="num" style="font-size:1.125em">${F.moneyShort(a.spend)}</div></div>
          </div>
          ${link(a)}
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

function viewPaid(r) {
  const d = state.paid || samplePaid(r);
  return `<div class="stack ${state.loading ? 'loading-veil' : ''}">
    ${paidBanner(d)}
    ${paidHero(d, r)}
    ${paidTiles(d)}
    ${paidChart(d, r)}
    ${paidCampaigns(d)}
    ${paidWinners(d)}
  </div>`;
}

/* ============================================================
   Owned media (GA4) — datos de ejemplo hasta conectar
   ============================================================ */
function viewOwned() {
  const g = sampleGa;
  let leak = 1, worst = Infinity;
  for (let i = 1; i < g.funnel.length; i++) { const sc = (g.funnel[i][1] / g.funnel[i - 1][1] * 100) / g.funnelBench[i - 1]; if (sc < worst) { worst = sc; leak = i; } }
  const top = g.funnel[0][1];
  const funnel = g.funnel.map(([label, n], i) => {
    const r = i ? (n / g.funnel[i - 1][1]) * 100 : 0;
    const isLeak = i === leak;
    const drop = i ? `<div class="small" style="display:flex;align-items:center;gap:0.5em;color:${isLeak ? 'var(--neg)' : r >= g.funnelBench[i - 1] ? 'var(--pos)' : 'var(--muted)'}">${IC.down}<span class="num" style="font-weight:600">${F.dec(r, 0)}%</span><span>avanza</span><span style="opacity:0.75">· esperado ${g.funnelBench[i - 1]}%</span>${isLeak ? '<span class="badge" style="background:var(--neg);color:var(--onAccent);text-transform:uppercase;letter-spacing:0.05em">Mayor fuga</span>' : ''}</div>` : '';
    return `<div style="display:flex;flex-direction:column;gap:0.35em">${drop}
      <div style="display:grid;grid-template-columns:10em minmax(0,1fr) 5em;gap:0.75em;align-items:center"><span class="small" style="font-weight:500">${label}</span>
      <div class="track" style="height:34px;border-radius:9px"><div class="fill grow" style="width:${Math.max(3, Math.sqrt(n / top) * 100).toFixed(1)}%;background:var(--accent);opacity:${isLeak ? 1 : (1 - i * 0.13).toFixed(2)};animation-delay:${0.1 * i}s"></div></div>
      <span class="num" style="text-align:right;font-weight:500">${F.int(n)}</span></div></div>`;
  }).join('');
  const sm = state.srcMetric;
  const sv = (s) => (sm === 'ses' ? s[1] : sm === 'comp' ? s[2] : (s[2] / s[1]) * 100);
  const totS = g.sources.reduce((a, s) => a + s[1], 0), totC = g.sources.reduce((a, s) => a + s[2], 0);
  const smax = Math.max(...g.sources.map(sv));
  const srcRows = g.sources.slice().sort((a, b) => sv(b) - sv(a)).map((s) => `<div style="display:flex;flex-direction:column;gap:0.3em">
    <div class="small" style="display:flex;justify-content:space-between"><span style="${s[3] ? 'font-weight:600' : 'color:var(--muted)'}">${s[0]}</span><span class="num" style="font-weight:500">${sm === 'ses' ? F.int(s[1]) + ' · ' + F.dec((s[1] / totS) * 100, 0) + '%' : sm === 'comp' ? F.int(s[2]) + ' · ' + F.dec((s[2] / totC) * 100, 0) + '%' : F.pct(sv(s))}</span></div>
    <div class="track"><div class="fill" style="width:${((sv(s) / smax) * 100).toFixed(1)}%;background:${s[3] ? 'var(--accent)' : 'var(--prev)'}"></div></div></div>`).join('');
  const srcNote = { ses: 'Meta es la principal puerta de entrada: 39% de las visitas.', comp: 'Meta trae casi la mitad de las compras del sitio (48%). La búsqueda orgánica es la segunda fuente.', conv: 'El tráfico de Meta es también el que mejor convierte (1,00%). Email y referidos convierten poco.' }[sm];
  const segList = g.segments[state.segDim];
  const segMax = Math.max(...segList.map((x) => x[1]));
  const segRows = segList.map(([l, sh, cv]) => `<div style="display:grid;grid-template-columns:9em minmax(0,1fr) 4em 6.5em;gap:0.75em;align-items:center;font-size:0.875em">
    <span style="font-weight:500">${l}</span><div class="track" style="height:22px;border-radius:6px"><div class="fill" style="width:${((sh / segMax) * 100).toFixed(1)}%;background:var(--accent);opacity:${(0.45 + 0.55 * sh / segMax).toFixed(2)}"></div></div>
    <span class="num" style="text-align:right;font-weight:500">${sh}%</span><span class="delta num ${cv >= g.convAvg ? 'pos' : 'neg'}" style="justify-self:end">${F.pct(cv)}</span></div>`).join('');
  const prio = (p) => p === 'Alta' ? 'background:color-mix(in srgb,var(--neg) 12%,transparent);color:var(--neg)' : 'background:var(--surface2);color:var(--text)';
  return `<div class="stack">
    ${banner('', '<strong>Datos de ejemplo.</strong> La conexión con Google Analytics 4 es la siguiente etapa.')}
    <section class="hero rise" aria-labelledby="gah">
      <div style="flex:1 1 520px;min-width:0;display:flex;flex-direction:column;gap:1.1em">
        <div class="kicker">Owned media · Google Analytics 4</div>
        <h1 id="gah">El sitio vendió <span style="color:var(--heroAccent)">$34,5M</span>, pero 3 de cada 4 personas abandonaron en el pago.</h1>
        <p>Meta trajo el 39% de las visitas y el 48% de las compras. La experiencia en móvil y el checkout son las dos palancas para crecer.</p>
      </div>
      <div style="flex:1 1 320px;min-width:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.6em">
        ${[['Sesiones', '61.400', '▲ 7,4%'], ['Compras', '505', '▲ 11,2%'], ['Conversión', '0,82%', '▲ 3,8%']].map(([l, v, dd]) => `<div class="box"><div class="xs" style="color:var(--heroMuted)">${l}</div><div class="num" style="font-size:1.5em;font-weight:300">${v}</div><div class="num xs" style="color:var(--heroGood)">${dd}</div></div>`).join('')}
      </div>
    </section>
    <section class="tiles wide" aria-label="Métricas clave del sitio">${g.tiles.map((t, i) => staticTile(t, i)).join('')}</section>
    <div class="row">
      <section class="card" style="flex:3 1 560px" aria-labelledby="fun">${sectionHead('Embudo de compra', '¿Dónde se cae la gente?').replace('<h2 class="h2">', '<h2 id="fun" class="h2">')}${funnel}<div class="xs muted">Largo de las barras proporcional a la raíz del volumen, para que todas las etapas sean visibles.</div></section>
      <section class="card" style="flex:2 1 400px">${sectionHead('Fuentes de tráfico', '¿De dónde llegan?', seg('Métrica de las fuentes', [['ses', 'Sesiones'], ['comp', 'Compras'], ['conv', 'Conversión']], 'srcMetric', sm))}${srcRows}<div class="small muted">${srcNote}</div></section>
    </div>
    <section class="card">
      ${sectionHead('Segmentos de personas', '¿Quiénes visitan y quiénes compran?', seg('Dimensión', [['edad', 'Edad'], ['region', 'Región'], ['disp', 'Dispositivo']], 'segDim', state.segDim))}
      <div class="row" style="align-items:center">
        <div style="flex:2 1 480px;min-width:0;display:flex;flex-direction:column;gap:0.6em">
          <div style="display:grid;grid-template-columns:9em minmax(0,1fr) 4em 6.5em;gap:0.75em" class="xs muted"><span></span><span>USUARIOS</span><span></span><span style="text-align:right">CONVERSIÓN</span></div>
          ${segRows}
          <div class="xs muted">Conversión promedio del sitio: ${F.pct(g.convAvg)}. Verde sobre el promedio, rojo bajo el promedio.</div>
        </div>
        <div class="insight" style="flex:1 1 260px"><div class="kicker">Hallazgo</div><div style="font-size:1.0625em;font-weight:500;line-height:1.45">${g.segTexts[state.segDim]}</div></div>
      </div>
    </section>
    <div class="row">
      <section class="card" style="flex:3 1 560px"><h2 class="h2" style="font-size:1.25em">Páginas con más visitas</h2>
        <div style="overflow-x:auto"><div style="min-width:520px">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) 5.5em 6em 6.5em;gap:0.75em;padding:0 0.5em 0.5em;border-bottom:1px solid var(--border)" class="xs muted"><span>PÁGINA</span><span style="text-align:right">VISTAS</span><span style="text-align:right">TIEMPO</span><span style="text-align:right">INTERACCIÓN</span></div>
          ${g.pages.map(([p, v, t, e]) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 5.5em 6em 6.5em;gap:0.75em;align-items:center;font-size:0.875em;padding:0.65em 0.5em;border-bottom:1px solid var(--border)"><span class="ellipsis num">${p}</span><span class="num" style="text-align:right;font-weight:500">${F.int(v)}</span><span class="num" style="text-align:right">${t}</span><span class="num" style="text-align:right;font-weight:600;color:${e >= 55 ? 'var(--pos)' : 'var(--neg)'}">${e}%</span></div>`).join('')}
        </div></div></section>
      <section class="card" style="flex:2 1 380px"><h2 class="h2" style="font-size:1.25em">¿Qué compran?</h2>
        ${g.products.map(([n, u, i]) => `<div style="display:flex;flex-direction:column;gap:0.3em"><div class="small" style="display:flex;justify-content:space-between"><span style="font-weight:500">${n}</span><span class="num"><strong style="font-weight:600">${F.moneyShort(i)}</strong> <span class="muted">· ${u} u.</span></span></div><div class="track"><div class="fill grow" style="width:${((i / g.products[0][2]) * 100).toFixed(1)}%;background:var(--c2)"></div></div></div>`).join('')}
        <div class="small muted" style="margin-top:auto;padding:0.875em 1em;border-radius:12px;background:var(--surface2)">GA4 registra 505 compras en total y 240 desde Meta. Meta informa más porque también cuenta a quien vio un anuncio y compró después por otro camino.</div>
      </section>
    </div>
    <section style="display:flex;flex-direction:column;gap:1.25em">${sectionHead('Conclusiones del sitio', 'Qué aprendimos y qué haremos')}
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${g.conclusions.map(([p, l, a], i) => `<article class="tile rise" style="padding:1.75em;border-radius:24px;gap:0.875em;animation-delay:${0.06 * i}s"><span class="badge" style="align-self:flex-start;${prio(p)}">Prioridad ${p.toLowerCase()}</span><div><div class="kicker" style="font-size:0.6875em">Aprendimos</div><div style="margin-top:0.25em;font-weight:500;font-size:1.0625em;line-height:1.4">${l}</div></div><div style="margin-top:auto;padding-top:0.875em;border-top:1px solid var(--border)"><div class="kicker" style="font-size:0.6875em;color:var(--pos)">Haremos</div><div style="margin-top:0.25em;font-size:0.9375em">${a}</div></div></article>`).join('')}</div>
    </section>
  </div>`;
}

/* ============================================================
   Social media (Instagram) — datos de ejemplo hasta conectar
   ============================================================ */
function viewSocial() {
  const s = sampleSocial;
  const fol = []; for (let i = 0; i < 20; i++) fol.push(26 - i * 1.1 - 2 * Math.sin(i / 1.7));
  const folPts = fol.map((v, i) => (i * 100 / 19).toFixed(1) + ',' + v.toFixed(1)).join(' ');
  const best = s.best.map((b) => `<article class="rise" style="flex:1 1 520px;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:24px;overflow:hidden;display:flex;flex-wrap:wrap">
    <div class="creative" style="flex:1 1 200px;min-height:300px">${b.isVideo ? `<div class="play">${IC.play}</div>` : IC.carousel}<span class="small">${b.isVideo ? 'Reel del post' : 'Carrusel del post'}</span>
      <span class="tag" style="left:1em;background:var(--${b.tone});color:var(--onAccent)">${b.badge}</span><span class="tag" style="right:1em;background:var(--surface);color:var(--text)">${b.fmt}</span></div>
    <div style="flex:1 1 260px;padding:1.75em;display:flex;flex-direction:column;justify-content:center;gap:1em">
      <div><div class="kicker" style="color:var(--${b.tone})">${b.kicker}</div><div style="margin-top:0.3em;font-size:1.1875em;font-weight:500;line-height:1.3">${b.title}</div><div class="small muted">Publicado el ${b.date}</div></div>
      <div><div class="num" style="font-size:2.75em;font-weight:300;line-height:1;letter-spacing:-0.03em;color:var(--${b.tone})">${b.main}</div><div class="small muted">${b.mainLabel}</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.6em">${b.stats.map(([l, v]) => `<div><div class="xs muted">${l}</div><div class="num" style="font-size:1.125em">${v}</div></div>`).join('')}</div>
      <div class="small" style="padding:0.8em 0.9em;border-radius:12px;background:var(--surface2)">${b.why}</div>
    </div></article>`).join('');
  const aIdx = Math.max(0, s.actions.findIndex((a) => a[0] === state.act));
  const colMax = s.actions.map((_, j) => Math.max(...s.formats.map((r) => r.v[j] || 0)));
  const colAvg = s.actions.map((_, j) => { const xs = s.formats.map((r) => r.v[j]).filter((x) => x !== null); return xs.reduce((a, b) => a + b, 0) / xs.length; });
  const nfK = (x) => (x >= 1000 ? F.dec(x / 1000, 1) + 'K' : String(x));
  const matrix = `<div style="overflow-x:auto"><div style="min-width:760px;display:grid;grid-template-columns:8.5em repeat(6,minmax(0,1fr));gap:6px">
    <span></span>${s.actions.map(([id, l], j) => `<button type="button" class="pill btn" data-act="act" data-v="${id}" aria-pressed="${j === aIdx}" style="border-radius:10px;min-height:44px;font-size:0.8125em;font-weight:600">${l}</button>`).join('')}
    ${s.formats.map((r) => `<span style="display:flex;flex-direction:column;justify-content:center;font-weight:600;font-size:0.875em">${r.fmt}<span class="xs muted" style="font-weight:400">${r.n}</span></span>${r.v.map((x, j) => {
      if (x === null) return `<div class="num" style="min-height:56px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--surface2);color:var(--muted);${j === aIdx ? '' : 'opacity:0.6'}"><span>—</span><span class="xs">no aplica</span></div>`;
      const mix = Math.round(8 + 80 * (x / colMax[j]));
      return `<div class="num" style="min-height:56px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .2s ease;background:color-mix(in srgb,var(--accent) ${mix}%,var(--surface));color:${mix > 50 ? 'var(--onAccent)' : 'var(--text)'};${j === aIdx ? 'box-shadow:0 0 0 2px var(--accent) inset' : 'opacity:0.45'}"><span style="font-weight:600">${nfK(x)}</span><span style="font-size:0.6875em;opacity:0.85">${F.dec(x / colAvg[j], 1)}x prom.</span></div>`;
    }).join('')}`).join('')}
  </div></div>`;
  const rank = s.formats.filter((r) => r.v[aIdx] !== null).sort((a, b) => b.v[aIdx] - a.v[aIdx]).map((r, i) => `<div style="display:grid;grid-template-columns:6em minmax(0,1fr) 4.5em;gap:0.6em;align-items:center;font-size:0.8125em"><span style="font-weight:500">${r.fmt}</span><div class="track" style="height:12px;background:var(--surface)"><div class="fill" style="width:${((r.v[aIdx] / colMax[aIdx]) * 100).toFixed(1)}%;background:var(--accent);opacity:${(1 - i * 0.2).toFixed(2)}"></div></div><span class="num" style="text-align:right;font-weight:600">${nfK(r.v[aIdx])}</span></div>`).join('');
  const D = s.deep[state.fmt] || s.deep.reels;
  const ret = D.retention ? `<div style="display:flex;flex-direction:column;gap:0.5em"><h3 class="h3">Retención en una secuencia de stories</h3>
    <div style="display:flex;align-items:flex-end;gap:8px;height:140px">${D.retention.map((v, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:0.3em;height:100%"><span class="num xs" style="font-weight:600">${Math.round((v / D.retention[0]) * 100)}%</span><div style="width:100%;border-radius:8px 8px 0 0;background:var(--accent);height:${((v / D.retention[0]) * 100).toFixed(1)}%;opacity:${(1 - i * 0.1).toFixed(2)}"></div></div>`).join('')}</div>
    <div class="num xs muted" style="display:flex;gap:8px">${D.retention.map((_, i) => `<span style="flex:1;text-align:center">${i + 1}ª</span>`).join('')}</div></div>` : '';
  const totInt = s.interactions.reduce((a, x) => a + x[1], 0);
  return `<div class="stack">
    ${banner('', '<strong>Datos de ejemplo.</strong> La conexión con Instagram es una etapa siguiente.')}
    <section class="hero rise" aria-labelledby="soh">
      <div style="flex:1 1 520px;min-width:0;display:flex;flex-direction:column;gap:1.1em">
        <div class="kicker">Social media · Instagram</div>
        <h1 id="soh">Los reels nos llevaron <span style="color:var(--heroAccent)">lejos</span>; los carruseles nos <span style="color:var(--heroGood)">acercaron</span>.</h1>
        <p>El alcance creció 18% gracias a los reels, que llegaron sobre todo a gente que aún no nos sigue. Los carruseles útiles, como la guía de tallas, generaron la conversación y los guardados.</p>
      </div>
      <div style="flex:1 1 300px;min-width:0;padding:1.5em;border-radius:18px;background:var(--heroTrack);display:flex;flex-direction:column;gap:0.35em">
        <div class="xs" style="color:var(--heroMuted)">Comunidad</div>
        <div class="num" style="font-size:3em;font-weight:300;line-height:1;letter-spacing:-0.03em">${F.int(s.followers)}</div>
        <div class="small" style="color:var(--heroMuted)">seguidores · <span class="num" style="color:var(--heroGood);font-weight:600">+${F.int(s.followersDelta)} este mes</span></div>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:44px;margin-top:0.5em"><polyline points="${folPts}" fill="none" stroke="var(--heroGood)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
      </div>
    </section>
    <section class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))" aria-label="Métricas clave de social media">${s.tiles.map((t, i) => staticTile(t, i)).join('')}</section>
    <div class="row">${best}</div>
    <section class="card">${sectionHead('Demografía de la comunidad', '¿Quiénes nos siguen?')}
      <div class="row">
        <div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:0.6em"><h3 class="h3">Edad</h3>
          ${s.ages.map(([l, p]) => barRow(l, p + '%', ((p / 38) * 100).toFixed(1) + '%', p === 38 ? 'var(--accent)' : 'var(--prev)', '4em', '3em')).join('')}
          <div class="grow" style="display:flex;height:28px;gap:3px;border-radius:8px;overflow:hidden;margin-top:0.5em">${s.gender.map(([l, p], i) => `<div style="flex:${p} 1 0;background:${i ? 'var(--c2)' : 'var(--c4)'};color:var(--onAccent);font-size:0.8125em;font-weight:600;display:flex;align-items:center;padding:0 0.75em">${l} ${p}%</div>`).join('')}</div>
        </div>
        <div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:0.6em"><h3 class="h3">Países</h3>
          ${s.countries.map(([l, p], i) => barRow(l, p + '%', Math.max(2, (p / 82) * 100).toFixed(1) + '%', i ? 'var(--prev)' : 'var(--accent)', '6.5em', '3em', !i)).join('')}
        </div>
        <div class="insight" style="flex:1 1 260px;justify-content:center"><div class="kicker">Hallazgo</div><div style="font-size:1.0625em;font-weight:500;line-height:1.45">La comunidad es joven-adulta y chilena: el tramo 25–34 años es también el que más compra en el sitio. Le hablamos a la persona correcta.</div></div>
      </div>
    </section>
    <section class="card">${sectionHead('Formato × acción', '¿Qué formato generó qué acción?', '<span class="small muted">Promedio por publicación · toca una acción</span>')}
      ${matrix}
      <div class="insight row" style="gap:1.25em;align-items:center;flex-direction:row">
        <div style="flex:1 1 320px;min-width:0"><div class="kicker">Para lograr ${s.actions[aIdx][2]}</div><div style="margin-top:0.3em;font-size:1.125em;font-weight:500;line-height:1.45">${s.actionInsights[aIdx]}</div></div>
        <div style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:0.45em">${rank}</div>
      </div>
    </section>
    <section class="card">${sectionHead('Profundiza por formato', D.title, seg('Formato', Object.entries(s.deep).map(([k, v]) => [k, v.label]), 'fmt', state.fmt))}
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1em">${D.kpis.map(([l, v]) => `<div style="padding:1.25em 1.375em;border-radius:14px;background:var(--surface2)"><div class="small muted">${l}</div><div class="num" style="font-size:1.5em;font-weight:300">${v}</div></div>`).join('')}</div>
      <div class="row">
        <div style="flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:0.5em"><h3 class="h3">Mejores del período</h3>
          ${D.top.map(([n, dt, v], i) => `<div style="display:grid;grid-template-columns:2em minmax(0,1fr) auto;gap:0.75em;align-items:center;padding:0.75em 0.5em;border-bottom:1px solid var(--border);font-size:0.875em"><span class="num" style="width:1.75em;height:1.75em;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-weight:600">${i + 1}</span><span style="min-width:0"><span class="ellipsis" style="font-weight:500">${n}</span><span class="xs muted">${dt}</span></span><span class="num" style="font-weight:600">${v}</span></div>`).join('')}
        </div>
        <div style="flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:1em">${ret}<div class="insight"><div class="kicker">Lectura</div><div style="font-weight:500;line-height:1.5">${D.ins}</div></div></div>
      </div>
    </section>
    <section class="card">${sectionHead('Interacciones del contenido', '¿Cómo interactúa la comunidad?')}
      <div class="row">
        <div style="flex:1 1 440px;min-width:0;display:flex;flex-direction:column;gap:0.875em">
          <div class="small" style="font-weight:600">${F.int(totInt)} interacciones</div>
          <div class="grow" style="display:flex;height:40px;gap:3px;border-radius:10px;overflow:hidden">${s.interactions.map(([, v, c]) => { const p = (v / totInt) * 100; return `<div style="flex:${v} 1 0;background:${c};display:flex;align-items:center;justify-content:center;color:var(--onAccent);font-size:0.8125em;font-weight:600">${p >= 9 ? F.dec(p, 0) + '%' : ''}</div>`; }).join('')}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.6em">${s.interactions.map(([l, v, c]) => `<div style="display:flex;gap:0.5em"><span style="width:10px;height:10px;margin-top:0.4em;border-radius:3px;flex:none;background:${c}"></span><span><span class="small muted" style="display:block">${l}</span><span class="num" style="font-weight:600">${F.int(v)} <span class="small muted" style="font-weight:400">${F.dec((v / totInt) * 100, 0)}%</span></span></span></div>`).join('')}</div>
          <div style="display:flex;align-items:center;gap:1em;padding:1em 1.125em;border-radius:14px;background:var(--surface2)"><div class="num" style="font-size:2em;font-weight:300;color:var(--pos)">33%</div><div class="small">son <strong>interacciones de valor</strong> (comentarios, compartidos y guardados), contra 28% en el período anterior. La comunidad no solo mira: participa.</div></div>
        </div>
        <div style="flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:0.6em">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.5em"><h3 class="h3">¿De qué hablan en los comentarios?</h3><span class="xs muted">Clasificación manual</span></div>
          ${s.topics.map(([l, p, k]) => barRow(l, p + '%', ((p / 42) * 100).toFixed(1) + '%', k === 'hl' ? 'var(--accent)' : k === 'neg' ? 'var(--neg)' : 'var(--prev)', '11em', '3em')).join('')}
          <div class="small muted">18% pregunta por tallas: confirma que la guía de tallas responde una necesidad real de la comunidad.</div>
        </div>
      </div>
    </section>
    <section style="display:flex;flex-direction:column;gap:1.25em">${sectionHead('Conclusiones cualitativas', 'Lo que nos dijo la comunidad')}
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${s.conclusions.map(([t, d], i) => `<article class="tile rise" style="padding:1.75em;border-radius:24px;gap:0.6em;animation-delay:${0.06 * i}s"><span class="num" style="font-size:2em;font-weight:300;color:var(--accent);line-height:1">0${i + 1}</span><div style="font-weight:500;font-size:1.0625em;line-height:1.4">${t}</div><div class="small muted">${d}</div></article>`).join('')}</div>
    </section>
    <section class="hero" style="flex-direction:column;align-items:stretch;gap:1.5em" aria-labelledby="recs">
      <div class="row" style="justify-content:space-between;align-items:flex-end;gap:1em">
        <div><div class="kicker">Recomendaciones de contenido</div><h2 id="recs" class="h2" style="font-size:1.85em;font-weight:300">Qué publicar el próximo mes</h2></div>
        <div style="flex:0 1 380px;min-width:260px;display:flex;flex-direction:column;gap:0.4em"><div class="xs" style="color:var(--heroMuted)">Mix sugerido para el feed · stories todos los días</div>
          <div style="display:flex;height:30px;gap:3px;border-radius:8px;overflow:hidden">${s.mix.map(([l, p], i) => `<div style="flex:${p} 1 0;background:${['var(--heroAccent)', 'var(--heroGood)', 'var(--heroMuted)'][i]};color:#1F1D19;font-size:0.75em;font-weight:600;display:flex;align-items:center;padding:0 0.6em">${l} ${p}%</div>`).join('')}</div></div>
      </div>
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1em">${s.recos.map(([f, fr, t, d, g]) => `<article style="padding:1.375em;border-radius:18px;background:var(--heroTrack);display:flex;flex-direction:column;gap:0.6em">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5em"><span class="badge" style="background:var(--heroText);color:#1F1D19">${f}</span><span class="xs num" style="color:var(--heroMuted)">${fr}</span></div>
        <div style="font-size:1.125em;font-weight:500;line-height:1.3">${t}</div><div class="small" style="color:var(--heroMuted)">${d}</div>
        <div class="small" style="margin-top:auto;padding-top:0.6em;border-top:1px solid var(--heroTrack)"><span style="color:var(--heroMuted)">Objetivo:</span> <strong style="color:var(--heroGood);font-weight:600">${g}</strong></div></article>`).join('')}</div>
    </section>
  </div>`;
}

/* ============================================================
   Vista completa
   ============================================================ */
function view() {
  const r = computeRange(state);
  const body = state.tab === 'paid' ? viewPaid(r) : state.tab === 'social' ? viewSocial() : viewOwned();
  const src = state.tab === 'paid' ? 'Fuente: Meta Ads · Atribución ' + esc(CONFIG.meta?.attributionLabel || 'según configuración de la cuenta')
    : state.tab === 'social' ? 'Fuente: Instagram (API de Meta) · Datos de ejemplo' : 'Fuente: Google Analytics 4 · Datos de ejemplo';
  return `<div class="root ${state.theme === 'dark' ? 'dark' : 'light'} ${state.animate ? 'animate' : ''}" style="font-size:${state.fs}px">
    <div class="wrap">
      ${viewHeader()}
      ${viewEco(r)}
      <div>${viewTabs()}<div class="sheet">${body}</div></div>
      <footer class="xs muted" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.5em;padding-top:0.75em;border-top:1px solid var(--border)"><span>${src}</span><span>Tu ecosistema digital</span></footer>
    </div>
  </div>`;
}

let animTimer = null;
function render() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = view();
  document.documentElement.style.background = state.theme === 'dark' ? '#12110F' : '#F3F1E9';
  if (state.animate) {
    state.animate = false;
    clearTimeout(animTimer);
    animTimer = setTimeout(() => document.querySelector('.root')?.classList.remove('animate'), 1500);
  }
}

/* ============================================================
   Datos de Meta
   ============================================================ */
const paidCache = new Map();
let paidReq = 0;
async function loadPaid() {
  const r = computeRange(state);
  const key = [r.since, r.until, r.csince, r.cuntil].join('|');
  if (paidCache.has(key)) { const c = paidCache.get(key); state.paid = c.data; state.paidNote = c.note; render(); return; }
  const my = ++paidReq;
  state.loading = true; render();
  let data, note = null;
  try {
    const res = await fetch(`/api/meta?since=${r.since}&until=${r.until}&csince=${r.csince}&cuntil=${r.cuntil}`);
    const j = await res.json().catch(() => ({ error: 'bad_json', message: 'Respuesta no válida del servidor' }));
    if (!res.ok || j.error) throw Object.assign(new Error(j.message || 'Error ' + res.status), { kind: j.error });
    data = j;
  } catch (e) {
    data = samplePaid(r);
    note = { kind: e.kind || 'network', message: e.message };
  }
  if (my !== paidReq) return;
  if (data.source === 'meta' || note?.kind === 'not_configured') paidCache.set(key, { data, note });
  state.paid = data; state.paidNote = note; state.loading = false;
  if (state.tab === 'paid') state.animate = true;
  render();
}

/* ============================================================
   Eventos
   ============================================================ */
const ACTIONS = {
  theme: (v) => { state.theme = v; LS.set('theme', v); render(); },
  fs: (v) => { state.fs = Number(v); LS.set('fs', state.fs); render(); },
  tab: (v) => { state.tab = v; state.animate = true; render(); },
  range: (v) => { state.range = v; loadPaid(); },
  from: (v) => { state.rFrom = Number(v); state.rTo = Math.min(state.rTo, state.rFrom); state.range = 'custom'; loadPaid(); },
  to: (v) => { state.rTo = Number(v); state.rFrom = Math.max(state.rFrom, state.rTo); state.range = 'custom'; loadPaid(); },
  cmp: (v) => { state.cmp = v; loadPaid(); },
  metric: (v) => { state.metric = v; render(); },
  sort: (v) => { state.sortKey = v; render(); },
  stageF: (v) => { state.stageF = v; render(); },
  camp: (v) => { state.camp = state.camp === v ? null : v; render(); },
  srcMetric: (v) => { state.srcMetric = v; render(); },
  segDim: (v) => { state.segDim = v; render(); },
  act: (v) => { state.act = v; render(); },
  fmt: (v) => { state.fmt = v; render(); }
};

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el.dataset.v);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && ACTIONS[el.dataset.change]) ACTIONS[el.dataset.change](el.value);
  });
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-day]');
    if (el) showTip(Number(el.dataset.day));
  });
  document.addEventListener('mouseout', (e) => {
    const hit = document.getElementById('chart-hit');
    if (hit && hit.contains(e.target) && !hit.contains(e.relatedTarget)) hideTip();
  });

  (async () => {
    try { const r = await fetch('/config.json', { cache: 'no-cache' }); if (r.ok) CONFIG = { ...CONFIG, ...(await r.json()) }; } catch { /* usa valores por defecto */ }
    document.title = 'Tu ecosistema digital · ' + (CONFIG.client?.name || '');
    render();
    loadPaid();
  })();
}

export { view, state, computeRange, CONFIG };
