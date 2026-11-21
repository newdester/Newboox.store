import { randomUUID } from 'node:crypto';
import { rateLimit, sendRateHeaders } from './_lib/rate-limit.js';

const cancellable = new Set(['pending', 'in_process', 'authorized']);

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'cancel-payment', { limit: 8, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
  if (!process.env.MP_ACCESS_TOKEN) return response.status(503).json({ error: 'Pagamento indisponível.' });

  const paymentId = String(request.body?.paymentId || '');
  if (!/^\d+$/.test(paymentId)) return response.status(400).json({ error: 'Pagamento inválido.' });

  try {
    const endpoint = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`;
    const lookup = await fetch(endpoint, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
    const payment = await lookup.json().catch(() => ({}));
    if (!lookup.ok || !String(payment.external_reference || '').startsWith('NB-')) {
      return response.status(404).json({ error: 'Pagamento não encontrado.' });
    }
    if (payment.payment_method_id !== 'pix') return response.status(422).json({ error: 'Somente o Pix pendente pode ser cancelado por esta ação.' });
    if (!cancellable.has(payment.status)) return response.status(200).json({ paymentId: payment.id, status: payment.status, cancelled: payment.status === 'cancelled' });

    const cancelled = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID()
      },
      body: JSON.stringify({ status: 'cancelled' })
    });
    const result = await cancelled.json().catch(() => ({}));
    if (!cancelled.ok) return response.status(422).json({ error: result.message || 'Não foi possível cancelar o Pix pendente.' });
    return response.status(200).json({ paymentId: result.id, status: result.status, cancelled: result.status === 'cancelled' });
  } catch {
    return response.status(502).json({ error: 'Não foi possível comunicar com o Mercado Pago.' });
  }
}
