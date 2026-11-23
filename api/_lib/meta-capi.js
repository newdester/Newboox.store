import { createHash } from 'node:crypto';
import { recordFunnelEvent } from './funnel-store.js';

const META_ENDPOINT = pixelId => `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v25.0'}/${pixelId}/events`;
const hash = value => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized ? createHash('sha256').update(normalized).digest('hex') : '';
};

export async function sendMetaPurchase(payment) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (payment.status !== 'approved') return { sent: false, reason: 'payment_not_approved' };
  const quantity = Math.max(1, Number(payment.metadata?.quantity) || 1);
  const value = Number(payment.transaction_amount);
  const eventId = `mp_payment_${payment.id}`;
  const approvedAt = Date.parse(payment.date_approved || payment.date_created || '') || Date.now();
  const sourceUrl = String(payment.metadata?.meta_source_url || process.env.PUBLIC_BASE_URL || 'https://newboox.store/');
  const sourcePath = (() => { try { return new URL(sourceUrl).pathname || '/'; } catch { return '/'; } })();
  const record = async metaAccepted => {
    const stored = await recordFunnelEvent({
      eventName: 'Purchase', eventId, eventTime: approvedAt, path: sourcePath, value,
      currency: payment.currency_id || 'BRL', fbp: Boolean(payment.metadata?.meta_fbp),
      fbc: Boolean(payment.metadata?.meta_fbc), metaAccepted
    });
    if (stored.configured && !stored.stored && !stored.duplicate) console.error('Purchase analytics storage failed', { eventId, reason: stored.reason });
    return stored;
  };
  if (!pixelId || !accessToken) {
    await record(false);
    return { sent: false, eventId, reason: 'meta_not_configured' };
  }
  const email = hash(payment.metadata?.customer_email || payment.payer?.email);
  const phone = hash(String(payment.metadata?.customer_phone || payment.payer?.phone?.number || '').replace(/\D/g, ''));
  const firstName = hash(payment.metadata?.customer_first_name);
  const lastName = hash(payment.metadata?.customer_last_name);
  const city = hash(payment.metadata?.customer_city);
  const state = hash(payment.metadata?.customer_state);
  const zip = hash(String(payment.metadata?.customer_zip || '').replace(/\D/g, ''));
  const externalId = hash(payment.external_reference);
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(approvedAt / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: sourceUrl.replace(/\/$/, ''),
    user_data: {
      ...(email ? { em: [email] } : {}),
      ...(phone ? { ph: [phone] } : {}),
      ...(firstName ? { fn: [firstName] } : {}),
      ...(lastName ? { ln: [lastName] } : {}),
      ...(city ? { ct: [city] } : {}),
      ...(state ? { st: [state] } : {}),
      ...(zip ? { zp: [zip] } : {}),
      ...(externalId ? { external_id: [externalId] } : {}),
      ...(payment.metadata?.meta_fbp ? { fbp: String(payment.metadata.meta_fbp) } : {}),
      ...(payment.metadata?.meta_fbc ? { fbc: String(payment.metadata.meta_fbc) } : {}),
      ...(payment.metadata?.meta_client_ip ? { client_ip_address: String(payment.metadata.meta_client_ip) } : {}),
      client_user_agent: String(payment.metadata?.meta_client_user_agent || 'Newboox-MercadoPago-Webhook/1.0')
    },
    custom_data: {
      currency: String(payment.currency_id || 'BRL'),
      value,
      order_id: String(payment.external_reference || payment.id),
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
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6500)
    });
    const result = await response.json().catch(() => ({}));
    const resultEvent = {
      sent: response.ok && Number(result.events_received || 0) > 0,
      eventId,
      status: response.status,
      eventsReceived: Number(result.events_received || 0),
      fbtraceId: String(result.fbtrace_id || ''),
      error: result.error ? { code: result.error.code, subcode: result.error.error_subcode, message: result.error.message } : null
    };
    await record(resultEvent.sent);
    return resultEvent;
  } catch (error) {
    await record(false);
    return { sent: false, eventId, status: 0, eventsReceived: 0, error: { message: error.message } };
  }
}

export async function sendMetaPageView({ eventId, eventSourceUrl, fbp, fbc, clientIp, userAgent }) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return { sent: false, reason: 'meta_not_configured' };
  const event = {
    event_name: 'PageView',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl,
    user_data: {
      ...(fbp ? { fbp: String(fbp).slice(0, 200) } : {}),
      ...(fbc ? { fbc: String(fbc).slice(0, 500) } : {}),
      ...(clientIp ? { client_ip_address: String(clientIp).slice(0, 64) } : {}),
      client_user_agent: String(userAgent || 'Newboox-Website/1.0').slice(0, 500)
    }
  };
  try {
    const body = { data: [event], access_token: accessToken };
    if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
    const response = await fetch(META_ENDPOINT(pixelId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6500)
    });
    const result = await response.json().catch(() => ({}));
    return {
      sent: response.ok && Number(result.events_received || 0) > 0,
      eventId,
      status: response.status,
      eventsReceived: Number(result.events_received || 0),
      fbtraceId: String(result.fbtrace_id || ''),
      error: result.error ? { code: result.error.code, subcode: result.error.error_subcode, message: result.error.message } : null
    };
  } catch (error) {
    return { sent: false, eventId, status: 0, eventsReceived: 0, error: { message: error.message } };
  }
}

export async function sendMetaFunnelEvent({ eventName, eventId, eventSourceUrl, customData, fbp, fbc, clientIp, userAgent }) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return { sent: false, reason: 'meta_not_configured' };
  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl,
    user_data: {
      ...(fbp ? { fbp: String(fbp).slice(0, 200) } : {}),
      ...(fbc ? { fbc: String(fbc).slice(0, 500) } : {}),
      ...(clientIp ? { client_ip_address: String(clientIp).slice(0, 64) } : {}),
      client_user_agent: String(userAgent || 'Newboox-Website/1.0').slice(0, 500)
    },
    ...(customData && Object.keys(customData).length ? { custom_data: customData } : {})
  };
  try {
    const body = { data: [event], access_token: accessToken };
    if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
    const response = await fetch(META_ENDPOINT(pixelId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6500)
    });
    const result = await response.json().catch(() => ({}));
    return {
      sent: response.ok && Number(result.events_received || 0) > 0,
      eventId,
      status: response.status,
      eventsReceived: Number(result.events_received || 0),
      fbtraceId: String(result.fbtrace_id || ''),
      error: result.error ? { code: result.error.code, subcode: result.error.error_subcode, message: result.error.message } : null
    };
  } catch (error) {
    return { sent: false, eventId, status: 0, eventsReceived: 0, error: { message: error.message } };
  }
}
