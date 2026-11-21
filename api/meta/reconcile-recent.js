import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';
import { sendMetaPurchase } from '../_lib/meta-capi.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'meta-reconcile-recent', { limit: 2, windowMs: 3_600_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Limite de conciliação atingido.' });
  if (!process.env.MP_ACCESS_TOKEN || !process.env.META_PIXEL_ID || !process.env.META_ACCESS_TOKEN) return response.status(503).json({ error: 'Integrações indisponíveis.' });

  try {
    const end = new Date();
    const begin = new Date(end.getTime() - 48 * 60 * 60 * 1000);
    const query = new URLSearchParams({ range: 'date_created', begin_date: begin.toISOString(), end_date: end.toISOString(), sort: 'date_created', criteria: 'desc', limit: '50' });
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?${query}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
    const data = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok) return response.status(502).json({ error: 'Não foi possível consultar as vendas.' });

    const approved = (data.results || []).filter(payment => payment.status === 'approved' && /^NB-/.test(String(payment.external_reference || '')) && /^toyadent-/.test(String(payment.metadata?.product_id || '')));
    const results = [];
    for (const payment of approved) {
      const meta = await sendMetaPurchase(payment);
      results.push({ payment: `••••${String(payment.id).slice(-4)}`, amount: payment.transaction_amount, accepted: Boolean(meta.sent), eventsReceived: meta.eventsReceived || 0, status: meta.status || 0, error: meta.error?.message || meta.reason || null, fbtraceId: meta.fbtraceId || '' });
    }
    return response.status(200).json({ found: approved.length, accepted: results.filter(item => item.accepted).length, results });
  } catch {
    return response.status(502).json({ error: 'Não foi possível conciliar as vendas.' });
  }
}
