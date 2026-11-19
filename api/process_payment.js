import { randomUUID } from 'node:crypto';
import { rateLimit, sendRateHeaders } from './_lib/rate-limit.js';
import { sendMetaPurchase } from './_lib/meta-capi.js';
import { paymentAmount, quantityFrom, storeProduct } from './_lib/catalog.js';
const baseUrl = () => String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'payment', { limit: 5, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.' });
  if (!process.env.MP_ACCESS_TOKEN || !process.env.MP_PUBLIC_KEY) return response.status(503).json({ error: 'Pagamento ainda não configurado.' });

  const { formData = {}, quantity: requestedQuantity, customer = {} } = request.body || {};
  const quantity = quantityFrom(requestedQuantity);
  const product = storeProduct();
  const email = String(formData.payer?.email || '').trim();
  if (!formData.payment_method_id || !/^\S+@\S+\.\S+$/.test(email)) return response.status(422).json({ error: 'Dados de pagamento incompletos.' });
  const allowedPaymentTypes = new Set(['credit_card', 'bank_transfer']);
  if (formData.payment_type_id && !allowedPaymentTypes.has(formData.payment_type_id)) {
    return response.status(422).json({ error: 'Este meio de pagamento não está disponível para esta compra.' });
  }

  const paymentType = formData.payment_type_id || (formData.payment_method_id === 'pix' ? 'bank_transfer' : 'credit_card');
  const orderId = `NB-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const payload = {
    transaction_amount: paymentAmount(product, quantity, paymentType),
    token: formData.token,
    description: `${product.title} × ${quantity}`,
    installments: paymentType === 'credit_card' ? Math.min(12, Math.max(1, Number(formData.installments) || 1)) : 1,
    payment_method_id: formData.payment_method_id,
    issuer_id: formData.issuer_id,
    payer: { ...formData.payer, email },
    external_reference: orderId,
    metadata: {
      product_id: product.id,
      quantity,
      customer_name: String(customer.name || '').slice(0, 120),
      customer_email: email.slice(0, 160),
      customer_phone: String(customer.phone || '').replace(/\D/g, '').slice(0, 15)
    }
  };
  // Cartão gera token; alguns meios (como Pix) não o utilizam.
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
  if (baseUrl()) payload.notification_url = `${baseUrl()}/api/mercadopago/webhook`;

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID()
      },
      body: JSON.stringify(payload)
    });
    const payment = await mpResponse.json();
    if (!mpResponse.ok) return response.status(422).json({ error: payment.message || 'O pagamento não foi autorizado.', cause: payment.cause?.[0]?.description || null });
    const meta = await sendMetaPurchase(payment);
    return response.status(200).json({
      orderId,
      paymentId: payment.id,
      status: payment.status,
      statusDetail: payment.status_detail,
      amount: payload.transaction_amount,
      pix: payment.point_of_interaction?.transaction_data || null,
      metaEventId: meta.eventId || `mp_payment_${payment.id}`
    });
  } catch {
    return response.status(502).json({ error: 'Não foi possível comunicar com o provedor de pagamento.' });
  }
}
