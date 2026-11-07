import { createHmac, timingSafeEqual } from 'node:crypto';
import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';

export const config = { api: { bodyParser: false } };

async function rawBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (typeof request.rawBody === 'string') return Buffer.from(request.rawBody);
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function validSignature(request, raw) {
  const secret = String(process.env.CAKTO_WEBHOOK_SECRET || '');
  const timestamp = String(request.headers['x-cakto-timestamp'] || '');
  const header = String(request.headers['x-cakto-signature'] || '');
  const received = header.replace(/^v1=/, '').trim();
  if (!secret || !timestamp || !received || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60 * 1000) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw.toString('utf8')}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'cakto-webhook', { limit: 120, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Limite de notificações excedido.' });
  try {
    const raw = await rawBody(request);
    if (!validSignature(request, raw)) return response.status(401).json({ error: 'Assinatura de webhook inválida.' });
    const event = JSON.parse(raw.toString('utf8'));
    const type = String(event.event || event.type || event.name || 'unknown');
    // O processamento financeiro definitivo deve consultar a Cakto pelo ID do pedido.
    // O endpoint responde rapidamente para evitar reentregas; dados sensíveis não são registrados.
    return response.status(200).json({ received: true, event: type });
  } catch {
    return response.status(400).json({ error: 'Payload de webhook inválido.' });
  }
}
