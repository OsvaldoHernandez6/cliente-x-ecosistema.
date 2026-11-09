# Tu ecosistema digital

Dashboard mensual por cliente con tres hojas: **Owned media** (sitio web · GA4), **Paid media** (Meta Ads) y **Social media** (Instagram).
Este repo es la plantilla: **un repo por cliente**, todo lo que cambia entre clientes vive en `config.json` y en las variables de entorno de Vercel.

| Hoja | Estado |
|---|---|
| Paid media (Meta Ads) | **Conectada** vía `api/meta.js` |
| Owned media (GA4) | Datos de ejemplo (siguiente etapa) |
| Social media (Instagram) | Datos de ejemplo (siguiente etapa) |

---

## 1. Publicar un cliente nuevo

1. **Crea el repo del cliente** en GitHub desde esta plantilla (botón *Use this template*), o sube estos archivos a un repo nuevo.
2. **Edita `config.json`**:
   - `client.name` y `client.logo` (ruta a una imagen dentro del repo, por ejemplo `assets/logo.svg`, o una URL).
   - `goals`: metas mensuales de ROAS, costo por compra y compras. Se usan en las barras de la portada.
   - `strategy`: resumen estratégico por mes (`"2026-10": {...}`). Si un mes no tiene entrada, se usa `default`.
   - `meta.purchaseActionType`: el evento de compra. Por defecto `omni_purchase`; si el cliente usa una conversión personalizada, pon su `action_type`.
   - `meta.winnerMinSpend`: inversión mínima para que un anuncio entre al ranking de ganadores.
3. **En Vercel**: *Add New → Project* → importa el repo → Framework preset: **Other** → Deploy.
4. **Variables de entorno** (Vercel → Project → Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `META_ACCESS_TOKEN` | Token del Usuario del sistema (permiso `ads_read`) |
   | `META_AD_ACCOUNT_ID` | ID de la cuenta publicitaria, por ejemplo `act_123456789` |
   | `META_API_VERSION` | Opcional. Por defecto `v26.0` |
   | `META_CACHE_SECONDS` | Opcional. Cada cuánto se vuelve a consultar a Meta, en segundos. Por defecto `3600` (1 hora) |

5. **Redeploy** (Deployments → ⋯ → Redeploy) para que tome las variables.
6. Abre el sitio, ve a la hoja **Paid media**: la franja superior debe decir *"Conectado a Meta Ads"*.

> ⚠️ El token **nunca** va en el código ni en `config.json`. Solo en Vercel.

## 2. Verificar la conexión

Abre en el navegador:

```
https://TU-PROYECTO.vercel.app/api/meta?since=2026-10-01&until=2026-10-31&csince=2026-09-01&cuntil=2026-09-30
```

- Si responde un JSON con `"source": "meta"`, está todo bien.
- `"error": "not_configured"` → faltan las variables de entorno o no hiciste redeploy.
- `"code": 190` → el token no es válido o fue revocado. Genera uno nuevo.
- `"code": 100` o `"code": 200` → el usuario del sistema no tiene asignada la cuenta publicitaria.

## 3. Cómo funciona

- `index.html` + `assets/` → página estática. Lee `config.json` y llama a `/api/meta`.
- `api/meta.js` → función de Vercel que consulta la API de Marketing de Meta con el token y devuelve totales, evolución diaria, campañas y anuncios ganadores ya calculados.
- Las respuestas se guardan en caché **1 hora** en Vercel (configurable con `META_CACHE_SECONDS`), así el dashboard carga rápido y no consume límites de la API.
- **"Este mes"** incluye el día de hoy. Meta actualiza sus datos con unos minutos u horas de retraso, y las conversiones pueden seguir sumándose durante la ventana de atribución.
- Si Meta no responde, el dashboard muestra datos de ejemplo y un aviso con el motivo.

### Definiciones

- **Compras / Ingresos**: evento definido en `meta.purchaseActionType`, con la configuración de atribución de cada conjunto de anuncios (la misma de Ads Manager).
- **ROAS** = ingresos ÷ inversión · **Costo por compra** = inversión ÷ compras · **Valor por conversión** = ingresos ÷ compras.
- **CTR (enlace)** = clics en el enlace ÷ impresiones.
- **Alcance y frecuencia** del período se piden a Meta para el período completo (no se suman días).
- **Etapa del funnel** de cada campaña según su objetivo: Reconocimiento (awareness), Consideración (tráfico, interacción) y Conversión (ventas, leads).
- **Comparación**: mes completo contra el mes anterior completo; mes en curso contra los mismos días del mes anterior; o contra el mismo período del año anterior.

## 4. Mantener los clientes al día

Cada repo de cliente es una copia de esta plantilla. Cuando la plantilla mejore, copia a cada cliente los archivos `assets/` y `api/` (no toques `config.json`).

## 5. Pruebas locales (opcional)

```bash
npm i -g vercel
cp .env.example .env.local   # y completa los valores
vercel dev
```
