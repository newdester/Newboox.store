import { randomUUID } from 'node:crypto';
import { paymentAmount, quantityFrom, shippingAmount, shippingServiceFrom, storeProduct } from '../_lib/catalog.js';
import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';

const publicBaseUrl = () => String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'mp-preference', { limit: 10, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
  if (!process.env.MP_ACCESS_TOKEN || !publicBaseUrl()) return response.status(503).json({ error: 'Mercado Pago ainda não configurado.' });

  const product = storeProduct(request.body?.productId);
  const quantity = quantityFrom(request.body?.quantity);
  const shippingService = shippingServiceFrom(request.body?.shippingService);
  const shipping = shippingAmount(product, quantity, shippingService);
  const carrier = shippingService === 'sedex' ? 'SEDEX' : 'Correios - Entrega Padrão';
  const reference = `NB-WALLET-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const payload = {
    purpose: 'wallet_purchase',
    items: [{ id: product.id, title: product.title, quantity, currency_id: 'BRL', unit_price: product.price }],
    shipments: { cost: shipping, mode: 'not_specified' },
    external_reference: reference,
    back_urls: {
      success: `${publicBaseUrl()}/thank-you?source=mercadopago`,
      pending: `${publicBaseUrl()}/thank-you?source=mercadopago`,
      failure: `${publicBaseUrl()}/checkout?payment=failed`
    },
    auto_return: 'approved',
    notification_url: `${publicBaseUrl()}/api/mercadopago/webhook`,
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }], installments: 1 },
    metadata: { product_id: product.id, quantity: product.units * quantity, kit_quantity: quantity, shipping, shipping_service: shippingService, carrier, checkout_price: paymentAmount(product, quantity, shippingService) }
  };

  try {
    const result = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() },
      body: JSON.stringify(payload)
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok || !data.id) return response.status(422).json({ error: data.message || 'Não foi possível iniciar o pagamento com saldo Mercado Pago.' });
    return response.status(200).json({ id: data.id, initPoint: data.init_point, amount: paymentAmount(product, quantity, shippingService) });
  } catch {
    return response.status(502).json({ error: 'Não foi possível comunicar com o Mercado Pago.' });
  }
}
