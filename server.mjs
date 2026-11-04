import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adminOverview from './api/admin/overview.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries((await readFile(path.join(root, '.env'), 'utf8').catch(() => '')).split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
Object.entries(env).forEach(([key, value]) => { if (!process.env[key]) process.env[key] = value; });
const config = { publicKey: env.MP_PUBLIC_KEY || '', accessToken: env.MP_ACCESS_TOKEN || '', webhookSecret: env.MP_WEBHOOK_SECRET || '', publicBaseUrl: String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '') };
const rateBuckets = new Map();
const allowRequest = (req, scope, limit, windowMs) => {
  const key = `${scope}:${String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()}`;
  const now = Date.now(), current = rateBuckets.get(key);
  if (!current || now >= current.resetAt) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return { allowed: true, remaining: limit - 1, retryAfter: 0 }; }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter: Math.ceil((current.resetAt - now) / 1000) };
};
const applyRate = (res, quota) => { res.setHeader('X-RateLimit-Remaining', String(quota.remaining)); if (!quota.allowed) res.setHeader('Retry-After', String(quota.retryAfter)); };
const validWebhook = (req, url, body) => {
  if (!config.webhookSecret) return false;
  const values = Object.fromEntries(String(req.headers['x-signature'] || '').split(',').map(value => value.trim().split('=')));
  const requestId = String(req.headers['x-request-id'] || '');
  const dataId = String(url.searchParams.get('data.id') || body?.data?.id || '').toLowerCase();
  if (!values.ts || !values.v1 || !requestId || !dataId) return false;
  const expected = createHmac('sha256', config.webhookSecret).update(`id:${dataId};request-id:${requestId};ts:${values.ts};`).digest('hex');
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(values.v1)); } catch { return false; }
};
const products = {
  'chefpro-2l': { id: 'chefpro-2l', title: 'Triturador Elétrico ChefPro 2L Bivolt + Tábua de Madeira Grátis', unitPrice: 49.90, currency: 'BRL' },
  'motor-scent': { id: 'motor-scent', title: 'Motor Scent — Umidificador Automotivo', unitPrice: 139.90, currency: 'BRL' }
};
const priceFor = (product, quantity) => product.id === 'motor-scent' ? (quantity === 1 ? 139.90 : quantity === 2 ? 129.90 : 99.90) : product.unitPrice;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const reply = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; if (data.length > 300000) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('JSON inválido')); } }); req.on('error', reject); });
const safeQuantity = value => Math.min(10, Math.max(1, Number.parseInt(value, 10) || 1));
const safePaymentStatus = async paymentId => {
  if (!config.accessToken || !/^\d+$/.test(String(paymentId))) return null;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${config.accessToken}` } });
  if (!response.ok) return null;
  const payment = await response.json();
  return String(payment.external_reference || '').startsWith('CP-') ? payment : null;
};

async function processPayment(req, res) {
  const quota = allowRequest(req, 'payment', 5, 60_000); applyRate(res, quota);
  if (!quota.allowed) return reply(res, 429, { error: 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.' });
  if (!config.accessToken || !config.publicKey) return reply(res, 503, { error: 'Integração Mercado Pago não configurada. Adicione as credenciais de teste no arquivo .env.' });
  try {
    const body = await readBody(req);
    const quantity = safeQuantity(body.quantity);
    const product = products[String(body.productId || 'chefpro-2l')] || products['chefpro-2l'];
    const form = body.formData || {};
    const email = String(form.payer?.email || '').trim();
    if (!form.payment_method_id || !/^\S+@\S+\.\S+$/.test(email)) return reply(res, 422, { error: 'Dados de pagamento incompletos.' });
    const lavenderOil = product.id === 'motor-scent' && body.extras?.lavenderOil === true;
    const extrasAmount = lavenderOil ? 20 : 0;
    const orderId = `CP-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const payload = {
      transaction_amount: Number((priceFor(product, quantity) * quantity + extrasAmount).toFixed(2)),
      token: form.token,
      description: `${product.title} × ${quantity}${lavenderOil ? ' + óleo de lavanda' : ''}`,
      installments: Number(form.installments) || 1,
      payment_method_id: form.payment_method_id,
      issuer_id: form.issuer_id,
      payer: { ...form.payer, email },
      external_reference: orderId,
      metadata: {
        product_id: product.id,
        quantity,
        lavender_oil: lavenderOil,
        customer_name: String(body.customer?.name || '').slice(0, 120),
        customer_email: email.slice(0, 160),
        customer_phone: String(body.customer?.phone || '').replace(/\D/g, '').slice(0, 15)
      }
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    if (config.publicBaseUrl) payload.notification_url = `${config.publicBaseUrl}/api/mercadopago/webhook`;
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() }, body: JSON.stringify(payload) });
    const payment = await mpResponse.json();
    if (!mpResponse.ok) return reply(res, 422, { error: payment.message || 'O pagamento não foi autorizado.', cause: payment.cause?.[0]?.description || null });
    return reply(res, 200, { orderId, paymentId: payment.id, status: payment.status, statusDetail: payment.status_detail, amount: payload.transaction_amount, pix: payment.point_of_interaction?.transaction_data || null });
  } catch (error) { return reply(res, 500, { error: 'Não foi possível processar o pagamento.', detail: error.message }); }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/config') return reply(res, 200, { publicKey: config.publicKey, paymentEnabled: Boolean(config.accessToken && config.publicKey), metaCapiEnabled: Boolean(env.META_PIXEL_ID && env.META_ACCESS_TOKEN), product: products['chefpro-2l'] });
  if (req.method === 'GET' && url.pathname === '/api/payment-status') {
    const quota = allowRequest(req, 'payment-status', 30, 60_000); applyRate(res, quota);
    if (!quota.allowed) return reply(res, 429, { error: 'Muitas consultas. Aguarde alguns instantes.' });
    try {
      const payment = await safePaymentStatus(url.searchParams.get('paymentId'));
      if (!payment) return reply(res, 404, { error: 'Pagamento não encontrado.' });
      return reply(res, 200, { paymentId: payment.id, status: payment.status, statusDetail: payment.status_detail, amount: payment.transaction_amount, pix: payment.point_of_interaction?.transaction_data || null });
    } catch { return reply(res, 502, { error: 'Não foi possível consultar o pagamento.' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/overview') {
    const request = { method: req.method, headers: req.headers, socket: req.socket, query: Object.fromEntries(url.searchParams.entries()) };
    const response = { setHeader: (name, value) => res.setHeader(name, value), status(code) { this.code = code; return this; }, json(body) { return reply(res, this.code || 200, body); } };
    return adminOverview(request, response);
  }
  if (req.method === 'POST' && url.pathname === '/api/process_payment') return processPayment(req, res);
  if (req.method === 'POST' && url.pathname === '/api/mercadopago/webhook') {
    const quota = allowRequest(req, 'webhook', 120, 60_000); applyRate(res, quota);
    if (!quota.allowed) return reply(res, 429, { error: 'Limite de notificações excedido.' });
    try { const body = await readBody(req); if (!validWebhook(req, url, body)) return reply(res, 401, { error: 'Assinatura de webhook inválida.' }); return reply(res, 200, { received: true }); } catch { return reply(res, 400, { error: 'Corpo inválido.' }); }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Método não permitido.' });
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname === '/admin' ? '/admin.html' : url.pathname === '/motorscent' ? '/motorscent.html' : url.pathname;
  const pathname = decodeURIComponent(requestedPath);
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root)) return reply(res, 403, { error: 'Acesso negado.' });
  try { const info = await stat(file); if (!info.isFile()) throw new Error('not file'); const data = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); if (req.method === 'HEAD') res.end(); else res.end(data); } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Página não encontrada.'); }
}).listen(process.env.PORT || 4173, () => console.log(`Loja em http://localhost:${process.env.PORT || 4173}`));
