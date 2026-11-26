import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';
import { sendMetaFunnelEvent } from '../_lib/meta-capi.js';
import { recordFunnelEvent } from '../_lib/funnel-store.js';

const origins = () => {
  const values = new Set(['https://newboox.store', 'https://www.newboox.store']);
  try { if (process.env.PUBLIC_BASE_URL) values.add(new URL(process.env.PUBLIC_BASE_URL).origin); } catch {}
  return values;
};

const isLocalOrigin = origin => process.env.VERCEL_ENV !== 'production'
  && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const allowedPaths = {
  ViewContent: ['/', '/game'],
  AddToCart: ['/', '/game'],
  InitiateCheckout: ['/checkout'],
  AddPaymentInfo: ['/checkout']
};

function customData(value = {}) {
  const data = {};
  const ids = Array.isArray(value.content_ids) ? value.content_ids : [];
  if (ids.length) data.content_ids = ids.slice(0, 5).map(item => String(item).slice(0, 80));
  if (value.content_name) data.content_name = String(value.content_name).slice(0, 120);
  if (value.content_type === 'product') data.content_type = 'product';
  const currency = String(value.currency || 'BRL').toUpperCase();
  data.currency = /^[A-Z]{3}$/.test(currency) ? currency : 'BRL';
  const amount = Number(value.value);
  if (Number.isFinite(amount) && amount >= 0 && amount <= 100_000) data.value = Math.round(amount * 100) / 100;
  const count = Number(value.num_items);
  if (Number.isInteger(count) && count > 0 && count <= 100) data.num_items = count;
  const contents = Array.isArray(value.contents) ? value.contents : [];
  if (contents.length) data.contents = contents.slice(0, 5).map(item => ({
    id: String(item?.id || '').slice(0, 80),
    quantity: Math.min(100, Math.max(1, Number.parseInt(item?.quantity, 10) || 1)),
    ...(Number.isFinite(Number(item?.item_price)) ? { item_price: Math.round(Number(item.item_price) * 100) / 100 } : {})
  })).filter(item => item.id);
  return data;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'meta-funnel-event', { limit: 120, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas tentativas.' });

  const origin = String(request.headers.origin || '');
  if (!origins().has(origin) && !isLocalOrigin(origin)) return response.status(403).json({ error: 'Origem inválida.' });
  const eventName = String(request.body?.eventName || '');
  if (!Object.hasOwn(allowedPaths, eventName)) return response.status(400).json({ error: 'Evento não permitido.' });
  const eventId = String(request.body?.eventId || '');
  if (!/^evt_[A-Za-z0-9-]{20,80}$/.test(eventId)) return response.status(400).json({ error: 'Identificador de evento inválido.' });

  let sourceUrl;
  try { sourceUrl = new URL(String(request.body?.eventSourceUrl || '')); } catch {}
  if (!sourceUrl || !allowedPaths[eventName].includes(sourceUrl.pathname) || sourceUrl.search || sourceUrl.hash || (!origins().has(sourceUrl.origin) && !isLocalOrigin(sourceUrl.origin))) {
    return response.status(400).json({ error: 'Página de origem inválida para este evento.' });
  }

  const details = customData(request.body?.parameters);
  const clientIp = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || '').split(',')[0].trim();
  const result = await sendMetaFunnelEvent({
    eventName, eventId, eventSourceUrl: `${sourceUrl.origin}${sourceUrl.pathname}`,
    customData: details, fbp: request.body?.fbp, fbc: request.body?.fbc,
    clientIp, userAgent: request.headers['user-agent']
  });
  const analytics = await recordFunnelEvent({
    eventName, eventId, eventTime: Date.now(), path: sourceUrl.pathname,
    value: details.value || 0, currency: details.currency || 'BRL',
    fbp: Boolean(request.body?.fbp), fbc: Boolean(request.body?.fbc), metaAccepted: result.sent
  });
  if (analytics.configured && !analytics.stored && !analytics.duplicate) console.error('Funnel analytics storage failed', { eventName, eventId, reason: analytics.reason });
  if (!result.sent) {
    console.error('Meta funnel event rejected', { eventName, eventId, status: result.status, reason: result.reason, error: result.error, fbtraceId: result.fbtraceId });
    return response.status(502).json({ received: false, analyticsStored: analytics.stored, error: 'A Meta não confirmou o evento.' });
  }
  console.info('Meta funnel event accepted', { eventName, eventId, eventsReceived: result.eventsReceived, fbtraceId: result.fbtraceId });
  return response.status(200).json({ received: true, analyticsStored: analytics.stored, eventId, eventsReceived: result.eventsReceived });
}
