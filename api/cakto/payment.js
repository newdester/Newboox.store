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
  if (!/^[A-Z]{2}$/.test(country)) return response.status(422).json({ error: 'País de entrega inválido.' });
  const customer = body.customer || {};
  const address = body.address || {};
  const cardToken = required(body.cardToken, 220);
  const email = required(customer.email, 160);
  const phone = required(customer.phone, 32).replace(/\D/g, '');
  if (!cardToken || !/^\S+@\S+\.\S+$/.test(email) || !required(customer.fingerprint, 160) || !required(body.antifraudReference, 160) || !body.threeDSecure?.referenceId) return response.status(422).json({ error: 'Dados do cliente, antifraude ou autenticação 3DS incompletos.' });
  if (!/^\d{8,15}$/.test(phone)) return response.status(422).json({ error: 'Informe o telefone com código do país.' });
  if (![address.state, address.city, address.zipcode, address.street, address.number].every(value => required(value, 180))) return response.status(422).json({ error: 'Endereço de entrega incompleto.' });
  const installments = Math.min(12, Math.max(1, Number.parseInt(body.installments, 10) || 1));
  try {
    const offerId = await offerForCountry(country);
    const payload = {
    paymentMethod: 'threeDs',
    customer: {
      name: required(customer.name, 120), email,
      phone, fingerprint: required(customer.fingerprint, 160)
    },
    items: [{ offerId, quantity: Math.min(10, Math.max(1, Number.parseInt(body.quantity, 10) || 1)), offerType: 'main' }],
    card: { token: cardToken },
    installments,
    antifraud_profiling_attempt_reference: required(body.antifraudReference, 160),
    address: {
      country, state: required(address.state, 80), city: required(address.city, 100), zipcode: required(address.zipcode, 24),
      street: required(address.street, 160), number: required(address.number, 30), neighborhood: required(address.neighborhood, 100), complement: required(address.complement, 100)
    },
      metadata: {
        utm_source: required(body.metadata?.utm_source, 255), utm_medium: required(body.metadata?.utm_medium, 255),
        utm_campaign: required(body.metadata?.utm_campaign, 255), utm_term: required(body.metadata?.utm_term, 255),
        utm_content: required(body.metadata?.utm_content, 255), sck: required(body.metadata?.sck, 255) || `NB-${Date.now()}-${randomUUID().slice(0, 8)}`
      },
      threeDSecure: {
      cavv: required(body.threeDSecure.cavv, 500), eci: required(body.threeDSecure.eci, 20),
      xid: required(body.threeDSecure.xid, 500), referenceId: required(body.threeDSecure.referenceId, 500),
        version: required(body.threeDSecure.version, 40), dataOnly: body.threeDSecure.dataOnly === true
      }
    };
    if (['cpf', 'cnpj'].includes(required(customer.docType, 10).toLowerCase()) && required(customer.docNumber, 32)) {
      payload.customer.docType = required(customer.docType, 10).toLowerCase();
      payload.customer.docNumber = required(customer.docNumber, 32).replace(/\D/g, '');
    }
    const caktoResponse = await caktoRequest('/payments/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey(body.idempotencyKey) },
      body: JSON.stringify(payload)
    });
    const result = await caktoResponse.json().catch(() => ({}));
    if (!caktoResponse.ok) {
      const detail = result.message || result.detail || Object.values(result).flat().find(value => typeof value === 'string') || 'A Cakto não autorizou o pagamento.';
      return response.status(caktoResponse.status >= 500 ? 502 : 422).json({ error: detail });
    }
    const status = String(result.status || 'pending').toLowerCase();
    if (['declined', 'refused'].includes(status)) return response.status(422).json({ error: result.reason || 'O cartão não foi autorizado. Confira os dados ou use outro cartão.', status });
    return response.status(status === 'pending' ? 202 : 200).json({ orderId: result.refId || result.id || null, paymentId: result.id || null, status, amount: result.amount || null, currency: 'USD' });
  } catch (error) {
    return response.status(502).json({ error: error.message || 'Não foi possível comunicar com a Cakto.' });
  }
}
