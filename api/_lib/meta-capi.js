import { createHash } from 'node:crypto';

const META_ENDPOINT = pixelId => `https://graph.facebook.com/${pixelId}/events`;
const hash = value => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized ? createHash('sha256').update(normalized).digest('hex') : '';
};

export async function sendMetaPurchase(payment) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken || payment.status !== 'approved') return { sent: false };
  const quantity = Math.max(1, Number(payment.metadata?.quantity) || 1);
  const value = Number(payment.transaction_amount);
  const eventId = `mp_payment_${payment.id}`;
  const email = hash(payment.metadata?.customer_email || payment.payer?.email);
  const phone = hash(String(payment.metadata?.customer_phone || payment.payer?.phone?.number || '').replace(/\D/g, ''));
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    user_data: {
      ...(email ? { em: [email] } : {}),
      ...(phone ? { ph: [phone] } : {})
    },
    custom_data: {
      currency: String(payment.currency_id || 'BRL'),
      value,
      content_type: 'product',
      content_ids: [String(payment.metadata?.product_id || 'toyadent-1')],
      contents: [{ id: String(payment.metadata?.product_id || 'toyadent-1'), quantity, item_price: Number((value / quantity).toFixed(2)) }]
    }
  };
  try {
    const body = { data: [event], access_token: accessToken };
    // Permite que eventos de servidor apareçam em Eventos de teste sem expor o código no cliente.
    if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
    const response = await fetch(META_ENDPOINT(pixelId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { sent: response.ok, eventId };
  } catch {
    return { sent: false, eventId };
  }
}
