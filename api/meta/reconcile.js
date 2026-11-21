import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';
import { sendMetaPurchase } from '../_lib/meta-capi.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'meta-reconcile', { limit: 5, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
  if (!process.env.MP_ACCESS_TOKEN || !process.env.META_PIXEL_ID || !process.env.META_ACCESS_TOKEN) {
    return response.status(503).json({ error: 'Integrações indisponíveis.' });
  }

  const paymentId = String(request.body?.paymentId || '');
  const externalReference = String(request.body?.externalReference || '');
  if (!/^\d+$/.test(paymentId) || !/^NB-[A-Za-z0-9-]+$/.test(externalReference)) {
    return response.status(400).json({ error: 'Identificadores inválidos.' });
  }

  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const payment = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok || String(payment.external_reference || '') !== externalReference) {
      return response.status(404).json({ error: 'Pagamento não encontrado.' });
    }
    if (payment.status !== 'approved') return response.status(422).json({ error: 'Somente pagamentos aprovados podem ser conciliados.' });

    const meta = await sendMetaPurchase(payment);
    if (!meta.sent) return response.status(502).json({ error: 'A Meta recusou o evento.', diagnostic: { status: meta.status, eventsReceived: meta.eventsReceived, error: meta.error, fbtraceId: meta.fbtraceId } });
    return response.status(200).json({ reconciled: true, eventId: meta.eventId, eventsReceived: meta.eventsReceived, fbtraceId: meta.fbtraceId });
  } catch {
    return response.status(502).json({ error: 'Não foi possível conciliar a compra.' });
  }
}
