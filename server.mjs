import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adminOverview from './api/admin/overview.js';
import metaFunnelEvent from './api/meta/event.js';
import metaPageView from './api/meta/pageview.js';
import mercadoPagoWebhook from './api/mercadopago/webhook.js';
import { paymentAmount, shippingAmount, shippingServiceFrom, storeProduct, storeProducts } from './api/_lib/catalog.js';
import { sendMetaPurchase } from './api/_lib/meta-capi.js';

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
const product = storeProduct();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const reply = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; if (data.length > 300000) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('JSON inválido')); } }); req.on('error', reject); });
const safeQuantity = value => Math.min(10, Math.max(1, Number.parseInt(value, 10) || 1));
const safePaymentStatus = async paymentId => {
  if (!config.accessToken || !/^\d+$/.test(String(paymentId))) return null;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${config.accessToken}` } });
  if (!response.ok) return null;
  const payment = await response.json();
  return String(payment.external_reference || '').startsWith('NB-') ? payment : null;
};

async function processPayment(req, res) {
  const quota = allowRequest(req, 'payment', 5, 60_000); applyRate(res, quota);
  if (!quota.allowed) return reply(res, 429, { error: 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.' });
  if (!config.accessToken || !config.publicKey) return reply(res, 503, { error: 'Integração Mercado Pago não configurada. Adicione as credenciais de teste no arquivo .env.' });
  try {
    const body = await readBody(req);
    const quantity = safeQuantity(body.quantity);
    const selectedProduct = storeProduct(body.productId || '');
    if (!selectedProduct) return reply(res, 422, { error: 'Selecione um produto disponível antes de pagar.' });
    const shippingService = shippingServiceFrom(body.shippingService);
    const shipping = shippingAmount(selectedProduct, quantity, shippingService);
    const carrier = shippingService === 'sedex' ? 'SEDEX' : 'Correios - Entrega Padrão';
    const form = body.formData || {};
    const email = String(form.payer?.email || '').trim();
    if (!form.payment_method_id || !/^\S+@\S+\.\S+$/.test(email)) return reply(res, 422, { error: 'Dados de pagamento incompletos.' });
    const paymentType = form.payment_method_id === 'pix' ? 'bank_transfer' : 'credit_card';
    if (form.payment_type_id && form.payment_type_id !== paymentType) return reply(res, 422, { error: 'Este meio de pagamento não está disponível.' });
    const installments = paymentType === 'credit_card' ? Number(form.installments ?? 1) : 1;
    if (!Number.isInteger(installments) || installments < 1 || installments > selectedProduct.maxInstallments) {
      return reply(res, 422, { error: 'Selecione uma opção válida de parcelamento.' });
    }
    const orderId = `NB-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const payload = {
      transaction_amount: paymentAmount(selectedProduct, quantity, shippingService, form.payment_method_id),
      token: form.token,
      description: `${selectedProduct.title} × ${quantity} · ${shippingService === 'sedex' ? 'SEDEX' : 'frete grátis'}`,
      installments,
      payment_method_id: form.payment_method_id,
      issuer_id: form.issuer_id,
      payer: { ...form.payer, email },
      external_reference: orderId,
      metadata: {
        product_id: selectedProduct.id,
        voltage: selectedProduct.voltage,
        ...(selectedProduct.color ? { color: selectedProduct.color } : {}),
        ...(selectedProduct.power ? { power: selectedProduct.power } : {}),
        quantity: selectedProduct.units * quantity,
        kit_quantity: quantity,
        shipping,
        shipping_service: shippingService,
        carrier,
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
  if (req.method === 'GET' && url.pathname === '/api/config') return reply(res, 200, { publicKey: config.publicKey, paymentEnabled: Boolean(config.accessToken && config.publicKey), webhookConfigured: Boolean(config.webhookSecret), metaCapiEnabled: Boolean(env.META_PIXEL_ID && env.META_ACCESS_TOKEN), metaPixelMatchesBrowser: Boolean(env.META_PIXEL_ID === '1806290673851071'), metaTestMode: Boolean(env.META_TEST_EVENT_CODE), sedexConfigured: true, shipping: { standard: { carrier: 'Correios', price: 0, minDays: 8, maxDays: 12 }, sedex: { carrier: 'SEDEX', price: 12.36, minDays: 2, maxDays: 3 } }, product, kits: storeProducts() });
  if (req.method === 'GET' && url.pathname === '/api/locale') return reply(res, 200, { country: 'BR', city: '', region: '' });
  if (req.method === 'GET' && url.pathname === '/api/payment-status') {
    const quota = allowRequest(req, 'payment-status', 30, 60_000); applyRate(res, quota);
    if (!quota.allowed) return reply(res, 429, { error: 'Muitas consultas. Aguarde alguns instantes.' });
    try {
      const payment = await safePaymentStatus(url.searchParams.get('paymentId'));
      if (!payment) return reply(res, 404, { error: 'Pagamento não encontrado.' });
      const meta = payment.status === 'approved' ? await sendMetaPurchase(payment) : null;
      return reply(res, 200, { paymentId: payment.id, status: payment.status, statusDetail: payment.status_detail, amount: payment.transaction_amount, pix: payment.point_of_interaction?.transaction_data || null, ...(meta ? { metaAccepted: Boolean(meta.sent) } : {}) });
    } catch { return reply(res, 502, { error: 'Não foi possível consultar o pagamento.' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/cancel-payment') {
    const quota = allowRequest(req, 'cancel-payment', 8, 60_000); applyRate(res, quota);
    if (!quota.allowed) return reply(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
    if (!config.accessToken) return reply(res, 503, { error: 'Pagamento indisponível.' });
    try {
      const body = await readBody(req);
      if (!/^\d+$/.test(String(body.paymentId || ''))) return reply(res, 400, { error: 'Pagamento inválido.' });
      const payment = await safePaymentStatus(body.paymentId);
      if (!payment) return reply(res, 404, { error: 'Pagamento não encontrado.' });
      if (payment.payment_method_id !== 'pix') return reply(res, 422, { error: 'Somente o Pix pendente pode ser cancelado por esta ação.' });
      if (!['pending', 'in_process', 'authorized'].includes(payment.status)) return reply(res, 200, { paymentId: payment.id, status: payment.status, cancelled: payment.status === 'cancelled' });
      const result = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(payment.id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() }, body: JSON.stringify({ status: 'cancelled' }) });
      const cancelled = await result.json().catch(() => ({}));
      if (!result.ok) return reply(res, 422, { error: cancelled.message || 'Não foi possível cancelar o Pix pendente.' });
      return reply(res, 200, { paymentId: cancelled.id, status: cancelled.status, cancelled: cancelled.status === 'cancelled' });
    } catch { return reply(res, 502, { error: 'Não foi possível comunicar com o Mercado Pago.' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/overview') {
    const request = { method: req.method, headers: req.headers, socket: req.socket, query: Object.fromEntries(url.searchParams.entries()) };
    const response = { setHeader: (name, value) => res.setHeader(name, value), status(code) { this.code = code; return this; }, json(body) { return reply(res, this.code || 200, body); } };
    return adminOverview(request, response);
  }
  if (req.method === 'POST' && url.pathname === '/api/process_payment') return processPayment(req, res);
  if (req.method === 'POST' && url.pathname === '/api/meta/pageview') {
    try {
      const body = await readBody(req);
      const request = { method: req.method, headers: req.headers, socket: req.socket, body };
      const response = {
        setHeader: (name, value) => res.setHeader(name, value),
        status(code) { this.code = code; return this; },
        json(payload) { return reply(res, this.code || 200, payload); }
      };
      return metaPageView(request, response);
    } catch { return reply(res, 400, { error: 'Corpo inválido.' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/meta/event') {
    try {
      const body = await readBody(req);
      const request = { method: req.method, headers: req.headers, socket: req.socket, body };
      const response = {
        setHeader: (name, value) => res.setHeader(name, value),
        status(code) { this.code = code; return this; },
        json(payload) { return reply(res, this.code || 200, payload); }
      };
      return metaFunnelEvent(request, response);
    } catch { return reply(res, 400, { error: 'Corpo inválido.' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/mercadopago/webhook') {
    try {
      const body = await readBody(req);
      const request = { method: req.method, headers: req.headers, socket: req.socket, query: Object.fromEntries(url.searchParams), body };
      const response = {
        setHeader: (name, value) => res.setHeader(name, value),
        status(code) { this.code = code; return this; },
        json(payload) { return reply(res, this.code || 200, payload); },
        end() { res.writeHead(this.code || 200); res.end(); }
      };
      return mercadoPagoWebhook(request, response);
    } catch { return reply(res, 400, { error: 'Corpo inválido.' }); }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Método não permitido.' });
  const routeFiles = {
    '/': '/index.html',
    '/calcule': '/calcule/index.html',
    '/calcule/': '/calcule/index.html',
    '/game': '/game/index.html',
    '/game/': '/game/index.html',
    '/lampada': '/lampada/index.html',
    '/lampada/': '/lampada/index.html',
    '/mel': '/mel/index.html',
    '/mel/': '/mel/index.html',
    '/admin': '/admin.html',
    '/motorscent': '/index.html',
    '/privacy': '/privacy/index.html',
    '/terms': '/terms/index.html',
    '/cart': '/cart/index.html',
    '/cart/': '/cart/index.html',
    '/checkout': '/checkout.html',
    '/thank-you': '/thank-you/index.html',
    '/thank-you/': '/thank-you/index.html'
  };
  const requestedPath = routeFiles[url.pathname] || url.pathname;
  const pathname = decodeURIComponent(requestedPath);
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root)) return reply(res, 403, { error: 'Acesso negado.' });
  try { const info = await stat(file); if (!info.isFile()) throw new Error('not file'); const data = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); if (req.method === 'HEAD') res.end(); else res.end(data); } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Página não encontrada.'); }
}).listen(process.env.PORT || 4173, () => console.log(`Loja em http://localhost:${process.env.PORT || 4173}`));
