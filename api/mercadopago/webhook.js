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
  if (!paymentId) return response.status(200).json({ received: true });
  if (!process.env.MP_ACCESS_TOKEN) return response.status(503).json({ error: 'Consulta de pagamento temporariamente indisponível.' });
  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(7000)
    });
    if (!paymentResponse.ok) {
      console.error('Mercado Pago payment lookup failed', { paymentId, status: paymentResponse.status });
      return response.status(503).json({ error: 'Consulta de pagamento temporariamente indisponível.' });
    }
    const payment = await paymentResponse.json();
    if (payment.status !== 'approved') return response.status(200).json({ received: true });

    const meta = await sendMetaPurchase(payment);
    if (!meta.sent) {
      console.error('Meta Purchase rejected; webhook will be retried', { eventId: meta.eventId, status: meta.status, reason: meta.reason, error: meta.error, fbtraceId: meta.fbtraceId });
      return response.status(503).json({ error: 'Registro da conversão temporariamente indisponível.' });
    }
    console.info('Meta Purchase accepted', { eventId: meta.eventId, eventsReceived: meta.eventsReceived, fbtraceId: meta.fbtraceId });
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Mercado Pago webhook processing failed; webhook will be retried', { paymentId, reason: error.message });
    return response.status(503).json({ error: 'Processamento temporariamente indisponível.' });
  }
}
