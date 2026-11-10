import { randomUUID } from 'node:crypto';
import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';
import { caktoRequest, idempotencyKey, offerForCountry } from '../_lib/cakto.js';

const required = (value, max = 180) => String(value || '').trim().slice(0, max);

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'cakto-payment', { limit: 5, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });

  const body = request.body || {};
  const country = required(body.country, 2).toUpperCase();
  const offerId = offerForCountry(country);
  if (!offerId) return response.status(503).json({ error: 'Oferta internacional em USD ainda não configurada.' });
  const customer = body.customer || {};
  const address = body.address || {};
  const cardToken = required(body.cardToken, 220);
  const email = required(customer.email, 160);
  if (!cardToken || !/^\S+@\S+\.\S+$/.test(email) || !required(customer.fingerprint, 160) || !body.threeDSecure?.referenceId) return response.status(422).json({ error: 'Dados do cliente, antifraude ou autenticação 3DS incompletos.' });
  const installments = Math.min(12, Math.max(1, Number.parseInt(body.installments, 10) || 1));
  const payload = {
    paymentMethod: 'threeDs',
    customer: {
      name: required(customer.name, 120), email,
      phone: required(customer.phone, 32), fingerprint: required(customer.fingerprint, 160)
    },
    items: [{ offerId, quantity: Math.min(10, Math.max(1, Number.parseInt(body.quantity, 10) || 1)), offerType: 'main' }],
    card: { token: cardToken },
    installments,
    antifraud_profiling_attempt_reference: required(body.antifraudReference, 160),
    address: {
      country, state: required(address.state, 80), city: required(address.city, 100), zipcode: required(address.zipcode, 24),
      street: required(address.street, 160), number: required(address.number, 30), neighborhood: required(address.neighborhood, 100), complement: required(address.complement, 100)
    },
    externalReference: `NB-${Date.now()}-${randomUUID().slice(0, 8)}`
  };
  if (required(customer.docType, 10) && required(customer.docNumber, 32)) {
    payload.customer.docType = required(customer.docType, 10).toLowerCase();
    payload.customer.docNumber = required(customer.docNumber, 32).replace(/\D/g, '');
  }
  if (body.threeDSecure && typeof body.threeDSecure === 'object') {
    payload.threeDSecure = {
      cavv: required(body.threeDSecure.cavv, 500), eci: required(body.threeDSecure.eci, 20),
      xid: required(body.threeDSecure.xid, 500), referenceId: required(body.threeDSecure.referenceId, 500),
      version: required(body.threeDSecure.version, 40)
    };
  }
  try {
    const caktoResponse = await caktoRequest('/payments/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey(body.idempotencyKey) },
      body: JSON.stringify(payload)
    });
    const result = await caktoResponse.json().catch(() => ({}));
    if (!caktoResponse.ok) return response.status(caktoResponse.status >= 500 ? 502 : 422).json({ error: result.message || result.detail || 'A Cakto não autorizou o pagamento.' });
    return response.status(200).json({ paymentId: result.id || result.paymentId || null, status: result.status || 'pending', amount: result.amount || null, pix: result.pix || null });
  } catch (error) {
    return response.status(502).json({ error: error.message || 'Não foi possível comunicar com a Cakto.' });
  }
}
