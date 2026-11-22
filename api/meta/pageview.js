import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';
import { sendMetaPageView } from '../_lib/meta-capi.js';

const allowedOrigins = () => {
  const origins = new Set(['https://newboox.store', 'https://www.newboox.store']);
  try { if (process.env.PUBLIC_BASE_URL) origins.add(new URL(process.env.PUBLIC_BASE_URL).origin); } catch {}
  return origins;
};

const isLocalOrigin = origin => process.env.VERCEL_ENV !== 'production'
  && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'meta-pageview', { limit: 120, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas tentativas.' });

  const origin = String(request.headers.origin || '');
  if (!allowedOrigins().has(origin) && !isLocalOrigin(origin)) {
    return response.status(403).json({ error: 'Origem inválida.' });
  }

  const eventId = String(request.body?.eventId || '');
  if (!/^pv_[A-Za-z0-9-]{20,80}$/.test(eventId)) {
    return response.status(400).json({ error: 'Identificador de evento inválido.' });
  }

  let sourceUrl;
  try { sourceUrl = new URL(String(request.body?.eventSourceUrl || '')); } catch {}
  if (!sourceUrl || sourceUrl.pathname !== '/' || sourceUrl.search || sourceUrl.hash
    || !allowedOrigins().has(sourceUrl.origin)) {
    return response.status(400).json({ error: 'O PageView só é aceito na página principal.' });
  }

  const clientIp = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || '').split(',')[0].trim();
  const result = await sendMetaPageView({
    eventId,
    eventSourceUrl: `${sourceUrl.origin}/`,
    fbp: request.body?.fbp,
    fbc: request.body?.fbc,
    clientIp,
    userAgent: request.headers['user-agent']
  });
  if (!result.sent) {
    console.error('Meta PageView rejected', { eventId: result.eventId, status: result.status, reason: result.reason, error: result.error, fbtraceId: result.fbtraceId });
    return response.status(502).json({ received: false, error: 'Não foi possível registrar o PageView.' });
  }
  console.info('Meta PageView accepted', { eventId: result.eventId, eventsReceived: result.eventsReceived, fbtraceId: result.fbtraceId });
  return response.status(200).json({ received: true, eventId: result.eventId, eventsReceived: result.eventsReceived });
}
