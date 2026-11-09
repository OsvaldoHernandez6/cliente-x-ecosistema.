// Datos de ejemplo. Se muestran mientras una fuente no está conectada.

const dayList = (since, until) => {
  const out = [];
  const d = new Date(since + 'T12:00:00');
  const end = new Date(until + 'T12:00:00');
  while (d <= end && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

function metricsOf(spend, impressions, reach, linkClicks, purchases, revenue) {
  const div = (a, b) => (b ? a / b : null);
  return {
    spend, impressions, reach, linkClicks, purchases, revenue,
    roas: div(revenue, spend), cpa: div(spend, purchases), aov: div(revenue, purchases),
    ctr: impressions ? (linkClicks / impressions) * 100 : null,
    cpm: div(spend * 1000, impressions), cpc: div(spend, linkClicks), frequency: reach ? impressions / reach : null
  };
}

function series(days, scale, phase) {
  return days.map((date, i) => {
    const spend = (150000 + 30000 * Math.sin(i / 3 + phase) + (i > days.length - 7 ? 40000 : 0)) * scale;
    const roas = 4.1 + 0.6 * Math.sin(i / 4 + 1 + phase);
    const revenue = spend * roas;
    const aov = 68400 * (1 + 0.05 * Math.sin(i / 2.5));
    const purchases = revenue / aov;
    const impressions = spend / 2.526 * (1 + 0.06 * Math.sin(i / 5));
    const reach = impressions / (1.5 + 0.2 * Math.sin(i / 6));
    const linkClicks = impressions * (0.017 - 0.0014 * (i / Math.max(1, days.length)) + 0.0005 * Math.sin(i / 2));
    return { date, ...metricsOf(spend, impressions, reach, linkClicks, purchases, revenue) };
  });
}

export function samplePaid(r) {
  const k = r.monthsLen || r.days / 30.4;
  const cur = metricsOf(4850000 * k, 1920000 * k, 486000 * Math.sqrt(k), 31115 * k, Math.round(312 * k), 21340000 * k);
  const prev = metricsOf(4330000 * k, 1778000 * k, 472000 * Math.sqrt(k), 30048 * k, Math.round(264 * k), 17430000 * k);
  const camps = [
    ['Prospecting – Advantage+ Shopping', 'conv', true, 1950000, 128, 8320000, 760000, 11780, 3.9],
    ['Remarketing – Visitantes 30 días', 'conv', true, 1150000, 112, 8060000, 290000, 7105, 6.14],
    ['Catálogo – Productos vistos (DPA)', 'conv', true, 820000, 58, 3900000, 330000, 6600, 4.63],
    ['Tráfico – Ofertas y contenido', 'cons', true, 530000, 14, 1060000, 340000, 4250, 2.18],
    ['Alcance – Teaser Cyber', 'rec', false, 400000, 0, 0, 200000, 1380, null]
  ].map(([name, stageId, active, spend, purchases, revenue, imp, clicks, prevRoas], i) => ({
    id: 'c' + i, name, stageId, stage: { rec: 'Reconocimiento', cons: 'Consideración', conv: 'Conversión' }[stageId],
    status: active ? 'Activa' : 'Pausada', active,
    ...metricsOf(spend * k, imp * k, null, clicks * k, Math.round(purchases * k), revenue * k), prevRoas
  }));
  const ads = [
    { id: 'a1', name: 'Video UGC – Reseña de cliente', format: 'Video', isVideo: true, spend: 1120000 * k, purchases: Math.round(94 * k), roas: 6.8, ctr: 2.84, thumb: null, link: null, sharePurchases: 0.3 },
    { id: 'a2', name: 'Carrusel – Top ventas del mes', format: 'Carrusel · 5', isVideo: false, spend: 890000 * k, purchases: Math.round(71 * k), roas: 5.9, ctr: 2.1, thumb: null, link: null, sharePurchases: 0.23 },
    { id: 'a3', name: 'Imagen – Despacho gratis', format: 'Imagen', isVideo: false, spend: 640000 * k, purchases: Math.round(48 * k), roas: 5.1, ctr: 1.74, thumb: null, link: null, sharePurchases: 0.15 }
  ];
  return {
    source: 'sample',
    generatedAt: null,
    account: { name: null, currency: 'CLP' },
    period: { since: r.since, until: r.until, csince: r.csince, cuntil: r.cuntil },
    totals: { cur, prev },
    daily: { cur: series(dayList(r.since, r.until), 1, 0), prev: series(dayList(r.csince, r.cuntil), 0.89, 1.3) },
    campaigns: camps,
    ads
  };
}

// Google Analytics 4 de ejemplo, con la misma forma que entrega /api/ga4.
export function sampleGa(r) {
  const k = r.monthsLen || r.days / 30.4;
  const tot = (f) => ({ totalUsers: 1638 * k * f, newUsers: 1452 * k * f, sessions: 2244 * k * f, engagementRate: 0.53 - (1 - f) * 0.1, userEngagementDuration: 94455 * k * f, ecommercePurchases: Math.round(109 * k * f), purchaseRevenue: 4203523 * k * f, keyEvents: Math.round(109 * k * f) });
  const days = dayList(r.since, r.until);
  const n = days.length || 1;
  const daily = days.map((date, i) => {
    const w = 1 + 0.25 * Math.sin(i / 2.7) + 0.1 * Math.sin(i * 1.3) + 0.006 * i;
    const ses = (2244 * k / n) * w;
    return { date, totalUsers: ses * 0.73, newUsers: ses * 0.65, sessions: ses, engagementRate: 0.53, userEngagementDuration: ses * 42, ecommercePurchases: (109 * k / n) * w * (1 + 0.2 * Math.sin(i / 4)), purchaseRevenue: (4203523 * k / n) * w * (1 + 0.2 * Math.sin(i / 4)), keyEvents: (109 * k / n) * w };
  });
  const sc = (x) => Math.round(x * k);
  return {
    source: 'sample', mode: 'ecommerce',
    period: { since: r.since, until: r.until, csince: r.csince, cuntil: r.cuntil },
    totals: { cur: tot(1), prev: tot(0.77) },
    funnel: { view_item: sc(1504), add_to_cart: sc(338), begin_checkout: sc(307), purchase: sc(109) },
    channels: [['Paid Social', 795, 4, 150000], ['Organic Search', 683, 47, 1800000], ['Direct', 281, 8, 310000], ['Email', 210, 30, 1160000], ['Organic Social', 177, 4, 140000], ['Unassigned', 81, 16, 640000]].map(([name, s, c, rev]) => ({ name, sessions: sc(s), conv: sc(c), revenue: rev * k })),
    segments: {
      edad: [],
      disp: [{ name: 'mobile', users: sc(1300), sessions: sc(1774), conv: sc(58) }, { name: 'desktop', users: sc(330), sessions: sc(468), conv: sc(50) }, { name: 'tablet', users: sc(8), sessions: sc(10), conv: 0 }],
      region: [{ name: 'Santiago Metropolitan Region', users: sc(1300), sessions: sc(1805), conv: sc(90) }, { name: 'Valparaíso', users: sc(120), sessions: sc(160), conv: sc(8) }, { name: 'Biobío', users: sc(70), sessions: sc(90), conv: sc(4) }]
    },
    pages: [['/collections/cafe-y-packs', 1396, 52, 0.67], ['/', 1051, 38, 0.73], ['/products/blend-good-morning-baby', 225, 71, 0.85], ['/products/etiopia-yirgacheffe', 143, 40, 0.55], ['/cart', 140, 30, 0.93], ['/products/nitrobusta-100-robusta', 114, 36, 0.53]].map(([path, v, e, er]) => ({ path, views: sc(v), engagementSec: e, engagementRate: er })),
    daily,
    items: [['Blend Good Morning Baby', 57, 1350430], ['Colombia Huila', 17, 484829], ['Perú Cajamarca', 17, 480830], ['Nitrobusta', 17, 323530], ['Blend Classic', 15, 300850]].map(([name, q, rev]) => ({ name, qty: sc(q), revenue: rev * k }))
  };
}

// Instagram de ejemplo, con la misma forma que entrega /api/instagram.
export function sampleSocial(r) {
  const k = r.monthsLen || r.days / 30.4;
  const days = dayList(r.since, r.until);
  const post = (id, kind, caption, di, reach, views, likes, comments, shares, saved, watch) => ({
    id, kind, caption, timestamp: (days[Math.min(di, days.length - 1)] || r.since) + 'T15:00:00+0000', date: days[Math.min(di, days.length - 1)] || r.since,
    permalink: null, thumb: null, reach, views, likes, comments, shares, saved, replies: null, interactions: likes + comments + shares + saved, avgWatchMs: watch ?? null
  });
  const cur = [
    post('s1', 'reels', 'Cómo preparar un V60 en 3 pasos', 3, 6420, 11800, 48, 6, 9, 6, 8200),
    post('s2', 'car', 'Guía de tuestes: ¿cuál es el tuyo?', 8, 1540, 2600, 35, 11, 6, 22),
    post('s3', 'reels', 'Detrás del tueste de octubre', 12, 2900, 5100, 30, 4, 5, 3, 6100),
    post('s4', 'img', 'Nuevo origen: Perú Cajamarca', 16, 980, 1500, 22, 3, 1, 2),
    post('s5', 'car', 'Packs para regalar', 21, 1200, 2000, 18, 2, 2, 9),
    post('s6', 'img', 'Despacho gratis sobre $30.000', 26, 870, 1300, 15, 1, 0, 1)
  ];
  const tot = (f) => ({ reach: 16763 * k * f, views: 109702 * k * f, accounts_engaged: 133 * k * f, total_interactions: 207 * k * f, profile_links_taps: 307 * k * f, likes: 168 * k * f, comments: 27 * k * f, shares: 23 * k * f, saves: 43 * k * f, replies: 0, approxReach: k > 1 });
  return {
    source: 'sample',
    account: { id: null, username: 'tu_cuenta', followers: 20200, mediaCount: 0, picture: null },
    period: { since: r.since, until: r.until, csince: r.csince, cuntil: r.cuntil },
    totals: { cur: tot(1), prev: tot(0.74) },
    posts: { cur, prev: cur.slice(0, 5) },
    stories: { cur: [], prev: [], tracking: false },
    followers: { current: 20200, delta: 180, series: days.map((date, i) => ({ date, value: Math.round(20020 + i * 6 + 8 * Math.sin(i / 3)) })), trackedSince: r.since },
    demographics: { age: [['18-24', 260], ['25-34', 5350], ['35-44', 9490], ['45-54', 3720], ['55-64', 970], ['65+', 420]], gender: [['M', 11100], ['F', 9100]], country: [['CL', 17995], ['AR', 271], ['ES', 238], ['US', 163], ['MX', 159], ['CO', 135], ['VE', 106], ['PE', 90]] },
    reachDaily: days.map((date, i) => ({ date, value: Math.round((16763 * k / (days.length || 1)) * (1 + 0.5 * Math.sin(i / 2.2) + 0.2 * Math.sin(i * 1.7))) }))
  };
}
