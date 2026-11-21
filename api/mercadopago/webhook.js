import { createHmac, timingSafeEqual } from 'node:crypto';
import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';
import { sendMetaPurchase } from '../_lib/meta-capi.js';

const header = (request, name) => String(request.headers[name] || '');

function signatureIsValid(request) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  // Sem segredo, o endpoint só reconhece a chamada, mas não aceita atualizar pedidos.
  if (!secret) return false;
  const signature = header(request, 'x-signature');
  const requestId = header(request, 'x-request-id');
  const dataId = String(request.query?.['data.id'] || request.body?.data?.id || '').toLowerCase();
  const values = Object.fromEntries(signature.split(',').map(value => value.trim().split('=')));
  if (!values.ts || !values.v1 || !requestId || !dataId) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${values.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(values.v1, 'utf8'));
  } catch {
    return false;
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).end();
  const quota = rateLimit(request, 'webhook', { limit: 120, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Limite de notificações excedido.' });
  if (!signatureIsValid(request)) return response.status(401).json({ error: 'Assinatura de webhook inválida.' });
  const paymentId = request.query?.['data.id'] || request.body?.data?.id;
  if (!paymentId || !process.env.MP_ACCESS_TOKEN) return response.status(200).json({ received: true });
  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
    if (paymentResponse.ok) {
      const meta = await sendMetaPurchase(await paymentResponse.json());
      if (meta.sent) console.info('Meta Purchase accepted', { eventId: meta.eventId, eventsReceived: meta.eventsReceived, fbtraceId: meta.fbtraceId });
      else console.error('Meta Purchase rejected', { eventId: meta.eventId, status: meta.status, reason: meta.reason, error: meta.error, fbtraceId: meta.fbtraceId });
    } else console.error('Mercado Pago payment lookup failed', { paymentId, status: paymentResponse.status });
  } catch { /* Confirmação ao Mercado Pago não deve depender do Meta. */ }
  return response.status(200).json({ received: true });
}
