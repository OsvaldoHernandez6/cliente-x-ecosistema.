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

export const sampleGa = {
  tiles: [
    ['Usuarios', '42.300', '+9,1%', '38.770', 1],
    ['Sesiones', '61.400', '+7,4%', '57.170', 1],
    ['Usuarios nuevos', '71%', '+2,9%', '69%', 1],
    ['Tiempo medio de interacción', '1 min 12 s', '+5,9%', '1 min 08 s', 1],
    ['Tasa de interacción', '58%', '+1,8%', '57%', 1],
    ['Compras', '505', '+11,2%', '454', 1],
    ['Ingresos', '$34.540.000', '+13,0%', '$30.570.000', 1],
    ['Tasa de conversión', '0,82%', '+3,8%', '0,79%', 1]
  ],
  funnel: [['Sesiones', 61400], ['Vieron un producto', 24600], ['Agregaron al carro', 4900], ['Iniciaron el pago', 2100], ['Compraron', 505]],
  funnelBench: [35, 15, 45, 45],
  sources: [['Paid Social (Meta)', 24000, 240, true], ['Búsqueda orgánica', 15200, 128], ['Directo', 11000, 84], ['Búsqueda pagada', 6300, 38], ['Email', 2900, 12], ['Referidos', 2000, 3]],
  segments: {
    edad: [['18–24', 16, 0.5], ['25–34', 34, 1.1], ['35–44', 27, 0.9], ['45–54', 14, 0.7], ['55+', 9, 0.4]],
    region: [['Metropolitana', 58, 0.95], ['Valparaíso', 11, 0.8], ['Biobío', 9, 0.7], ['Maule', 5, 0.6], ['Otras regiones', 17, 0.5]],
    disp: [['Móvil', 78, 0.6], ['Escritorio', 19, 1.5], ['Tablet', 3, 0.7]]
  },
  segTexts: {
    edad: '25–34 años es el segmento más valioso: 34% de los usuarios y la conversión más alta (1,1%).',
    region: 'Fuera de la Región Metropolitana se convierte menos. El costo y el plazo de despacho son la hipótesis principal.',
    disp: '78% navega desde el celular, pero en escritorio se compra 2,5 veces más. La experiencia móvil es la prioridad.'
  },
  convAvg: 0.82,
  pages: [['/ (inicio)', 18400, '0:42', 47], ['/cyber-ofertas', 14200, '1:18', 66], ['/producto/zapatilla-urbana', 9600, '1:34', 63], ['/categoria/hombre', 7300, '1:05', 54], ['/producto/poleron-basico', 6100, '1:21', 61], ['/carro', 5200, '0:58', 71]],
  products: [['Zapatillas', 132, 11200000], ['Polerones', 98, 5900000], ['Jeans', 76, 5300000], ['Chaquetas', 44, 4900000], ['Accesorios', 61, 2100000]],
  conclusions: [
    ['Alta', '3 de cada 4 personas que inicia el pago no termina la compra.', 'Mostrar el costo de despacho antes del pago, sumar pago en un clic y recuperar carros abandonados por email.'],
    ['Alta', 'Móvil es 78% del tráfico, pero convierte 2,5 veces menos que escritorio.', 'Auditar la velocidad en móvil (Core Web Vitals) y simplificar los formularios del checkout.'],
    ['Media', '/cyber-ofertas retiene mucho mejor que la home: 66% de interacción contra 47%.', 'Usar landings temáticas como destino de los anuncios en vez de la página de inicio.'],
    ['Media', 'Meta trae 39% de las visitas y 48% de las compras del sitio.', 'Mantener la inversión en Meta y reforzar la búsqueda orgánica, la segunda fuente de ventas.']
  ]
};

export const sampleSocial = {
  followers: 18420, followersDelta: 640,
  tiles: [
    ['Alcance', '212.000', '+18,4%', '179.000', 1],
    ['Interacciones', '9.870', '+12,1%', '8.805', 1],
    ['Tasa de interacción', '4,66%', '−5,3%', '4,92%', -1],
    ['Visitas al perfil', '5.300', '+9,5%', '4.840', 1],
    ['Clics al sitio', '1.120', '+22,0%', '918', 1],
    ['Publicaciones', '22', '+10,0%', '20', 0]
  ],
  best: [
    { isVideo: true, badge: 'Mayor alcance', tone: 'accent', fmt: 'Reel · 0:18', kicker: 'Mejor post por alcance', title: 'Cómo combinar zapatillas urbanas en 3 looks', date: '14 de octubre',
      main: '48.300', mainLabel: 'personas alcanzadas · 23% del alcance del mes', stats: [['Reproducciones', '71.200'], ['Compartidos', '310'], ['Interacción', '2,1%']],
      why: '78% del alcance vino de personas que no nos siguen: el algoritmo de Reels lo empujó porque la gente lo vio completo y lo compartió.' },
    { isVideo: false, badge: 'Mayor interacción', tone: 'pos', fmt: 'Carrusel · 8', kicker: 'Mejor post por interacción', title: 'Guía de tallas: encuentra tu número', date: '22 de octubre',
      main: '9,8%', mainLabel: 'tasa de interacción · 1.240 interacciones', stats: [['Guardados', '410'], ['Comentarios', '96'], ['Alcance', '12.650']],
      why: 'Contenido útil: la gente lo guarda para consultarlo antes de comprar. Los comentarios son preguntas concretas de talla.' }
  ],
  ages: [['13–17', 3], ['18–24', 21], ['25–34', 38], ['35–44', 24], ['45–54', 9], ['55+', 5]],
  gender: [['Mujeres', 61], ['Hombres', 39]],
  countries: [['Chile', 82], ['Argentina', 5], ['Perú', 4], ['México', 3], ['España', 2], ['Otros', 4]],
  actions: [['alc', 'Alcance', 'alcance'], ['lik', 'Me gusta', 'más "me gusta"'], ['com', 'Comentarios', 'más comentarios'], ['sha', 'Compartidos', 'más compartidos'], ['sav', 'Guardados', 'más guardados'], ['cli', 'Clics al sitio', 'más clics al sitio']],
  formats: [
    { fmt: 'Reels', n: '6 publicados', v: [21500, 610, 48, 95, 70, 22] },
    { fmt: 'Carruseles', n: '8 publicados', v: [9800, 520, 31, 40, 145, 18] },
    { fmt: 'Imagen', n: '8 publicadas', v: [6200, 310, 12, 14, 25, 9] },
    { fmt: 'Stories', n: '64 publicadas', v: [2100, 40, 6, 3, null, 11] }
  ],
  actionInsights: [
    'Los reels alcanzan 2,2 veces más que un carrusel: son el formato para llegar a gente nueva.',
    'Reels y carruseles generan "me gusta" parecidos; la imagen fija queda bastante atrás.',
    'Los reels nos ayudaron a generar más comentarios: 48 por publicación, 1,5 veces más que los carruseles.',
    'Los reels se comparten 2,4 veces más que los carruseles: el contenido de looks y estilo circula entre amigos.',
    'Los carruseles son el formato que más se guarda, el doble que los reels: contenido útil al que la gente quiere volver.',
    'Reels y carruseles llevan tráfico parecido por publicación, pero las stories con enlace suman más clics en total por volumen (≈700).'
  ],
  deep: {
    reels: { label: 'Reels', title: 'Reels: el motor del alcance', kpis: [['Publicados', '6'], ['Reproducciones promedio', '32.400'], ['Tiempo medio de visualización', '8,4 s'], ['Alcance de no seguidores', '78%']],
      top: [['Cómo combinar zapatillas urbanas en 3 looks', '14 oct', '48.300 alcance'], ['Unboxing de un pedido Cyber', '27 oct', '29.100 alcance'], ['Detrás de cámara: sesión de fotos', '6 oct', '18.700 alcance']],
      ins: 'Los reels con una persona hablando a cámara en los primeros 2 segundos retienen más. Con 8,4 s de visualización media, conviene ir al grano: reels de 15 a 20 segundos.' },
    car: { label: 'Carruseles', title: 'Carruseles: el formato que se guarda', kpis: [['Publicados', '8'], ['Alcance promedio', '9.800'], ['Guardados promedio', '145'], ['Tasa de interacción', '7,4%']],
      top: [['Guía de tallas: encuentra tu número', '22 oct', '410 guardados'], ['5 básicos para la primavera', '9 oct', '260 guardados'], ['Jean recto vs slim: ¿cuál te queda?', '17 oct', '190 guardados']],
      ins: 'Los carruseles educativos (guías, comparativas) duplican los guardados de los carruseles que solo muestran producto. La primera lámina debe prometer algo útil.' },
    sto: { label: 'Stories', title: 'Stories: la conversación diaria', kpis: [['Publicadas', '64'], ['Alcance promedio', '2.100'], ['Llegan a la última', '62%'], ['Clics al enlace', '704']],
      top: [['Encuesta: ¿qué color lanzamos?', '12 oct', '410 votos'], ['Cuenta regresiva Cyber', '28 oct', '2.900 alcance'], ['Preguntas frecuentes de despacho', '19 oct', '160 respuestas']],
      ins: 'Las secuencias de más de 5 stories pierden 4 de cada 10 personas. Las encuestas y preguntas sostienen la atención y nos dan información directa de la comunidad.', retention: [2400, 2050, 1840, 1690, 1570, 1490] },
    img: { label: 'Imágenes', title: 'Imagen fija: para anuncios puntuales', kpis: [['Publicadas', '8'], ['Alcance promedio', '6.200'], ['Tasa de interacción', '5,7%'], ['Clics promedio', '9']],
      top: [['Lanzamiento colección primavera', '2 oct', '11.400 alcance'], ['Aviso de horario Cyber', '29 oct', '8.200 alcance'], ['Producto destacado: chaqueta liviana', '20 oct', '6.900 alcance']],
      ins: 'La imagen fija rinde menos en todas las acciones. Conviene reservarla para anuncios concretos (lanzamientos, avisos) y llevar el resto a reels y carruseles.' }
  },
  interactions: [['Me gusta', 6640, 'var(--prev)'], ['Guardados', 1650, 'var(--c2)'], ['Compartidos', 1020, 'var(--accent)'], ['Comentarios', 560, 'var(--c4)']],
  topics: [['Precio y stock', 42], ['Elogios al producto', 27], ['Tallas', 18, 'hl'], ['Despacho', 9], ['Reclamos', 4, 'neg']],
  conclusions: [
    ['La comunidad valora lo útil, no solo el producto.', 'La guía de tallas fue el post con más interacción y guardados del mes.'],
    ['Los reels son nuestra puerta a gente nueva.', '78% de su alcance viene de personas que todavía no nos siguen.'],
    ['Crecimos en alcance, no en cercanía.', 'La tasa de interacción bajó a 4,7% porque llegamos a más gente nueva que aún no conecta con la marca.'],
    ['Hay dudas antes de comprar.', 'Precio, stock y tallas dominan los comentarios: la comunidad pide información para decidir.']
  ],
  recos: [
    ['Reels', '2 por semana', 'Serie "3 formas de usarlo"', 'Un producto, tres looks. Persona a cámara desde el segundo 1, entre 15 y 20 segundos.', 'Alcance y compartidos'],
    ['Carrusel', '1 por semana', 'Guías prácticas', 'Tallas, cuidado de prendas y comparativas. Primera lámina con una promesa útil y clara.', 'Guardados'],
    ['Stories', 'Diario', 'Encuestas y preguntas', 'Elegir colores, resolver dudas de despacho y stock. Máximo 5 stories por secuencia.', 'Comunidad y clics'],
    ['Reels', '1 por semana', 'Clientes reales (UGC)', 'Reseñas en video de clientes, reutilizables como anuncio: el video UGC fue el mejor anuncio en Meta.', 'Confianza y conversión']
  ],
  mix: [['Reels', 45], ['Carruseles', 35], ['Imagen', 20]]
};
