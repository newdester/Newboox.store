import { rateLimit, sendRateHeaders } from './_lib/rate-limit.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'payment-status', { limit: 30, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas consultas. Aguarde alguns instantes.' });
  const paymentId = String(request.query?.paymentId || '');
  if (!/^\d+$/.test(paymentId)) return response.status(400).json({ error: 'Pagamento inválido.' });
  if (!process.env.MP_ACCESS_TOKEN) return response.status(503).json({ error: 'Pagamento indisponível.' });
  try {
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
    const payment = await mpResponse.json();
    if (!mpResponse.ok || !String(payment.external_reference || '').startsWith('NB-')) return response.status(404).json({ error: 'Pagamento não encontrado.' });
    return response.status(200).json({ paymentId: payment.id, status: payment.status, statusDetail: payment.status_detail, amount: payment.transaction_amount, pix: payment.point_of_interaction?.transaction_data || null });
  } catch { return response.status(502).json({ error: 'Não foi possível consultar o pagamento.' }); }
}
