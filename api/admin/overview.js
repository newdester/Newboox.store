import { timingSafeEqual } from 'node:crypto';
import { rateLimit, sendRateHeaders } from '../_lib/rate-limit.js';
import { getFunnelData } from '../_lib/funnel-store.js';
import { WASHER_VARIANTS } from '../../assets/js/washer-catalog.js';

const PRODUCT_ID = 'toyadent';
const MAX_PAYMENTS = 500;
const MAX_SCANNED_PAYMENTS = 500;
const DAY = 86_400_000;

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const isoDate = value => new Date(value).toISOString().slice(0, 10);
const dateTime = value => new Date(value).toISOString();
const brl = value => Math.round(number(value) * 100) / 100;

function dayAt(value) {
  const raw = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const day = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(day.getTime()) ? null : day;
}

function periodFrom(query) {
  const now = new Date();
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const requestedStart = dayAt(query.current_start);
  const requestedEnd = dayAt(query.current_end);
  const currentEnd = requestedEnd || defaultEnd;
  const currentStart = requestedStart || new Date(currentEnd.getTime() - (29 * DAY));
  const length = Math.floor((currentEnd - currentStart) / DAY) + 1;
  if (length < 1 || length > 365) return null;

  const requestedPreviousStart = dayAt(query.previous_start);
  const requestedPreviousEnd = dayAt(query.previous_end);
  const previousEnd = requestedPreviousEnd || new Date(currentStart.getTime() - DAY);
  const previousStart = requestedPreviousStart || new Date(previousEnd.getTime() - ((length - 1) * DAY));
  const previousLength = Math.floor((previousEnd - previousStart) / DAY) + 1;
  if (previousLength < 1 || previousLength > 365) return null;

  const describe = (start, end) => ({
    start: isoDate(start),
    end: isoDate(end),
    beginAt: `${isoDate(start)}T00:00:00.000Z`,
    endAt: `${isoDate(end)}T23:59:59.999Z`
  });
  return { current: describe(currentStart, currentEnd), previous: describe(previousStart, previousEnd) };
}

function belongsToStore(payment) {
  const reference = String(payment.external_reference || '');
  const fingerprint = [reference, payment.description, payment.metadata?.product_id].join(' ').toLowerCase();
  return reference.startsWith('NB-') || fingerprint.includes('soarfly') || fingerprint.includes(PRODUCT_ID) || fingerprint.includes('toque duplo');
}

function productFor(payment) {
  const value = String(payment.metadata?.product_id || '').toLowerCase();
  const washer = WASHER_VARIANTS.find(variant => variant.id === value);
  if (washer) return { id: washer.id, name: washer.title };
  const match = value.match(/^toyadent-([123])$/);
  if (match) return { id: value, name: `TOYADENT · Kit ${match[1]}` };
  if (value === 'toque-duplo' || /toque duplo/i.test(String(payment.description || ''))) return { id: 'legacy', name: 'Oferta anterior' };
  return { id: 'toyadent-1', name: 'TOYADENT · Kit 1' };
}

function contactFor(payment) {
  const payer = payment.payer || {};
  const metadata = payment.metadata || {};
  const name = String(metadata.customer_name || [payer.first_name, payer.last_name].filter(Boolean).join(' ') || 'Não informado').trim().slice(0, 120);
  const email = String(metadata.customer_email || payer.email || 'Não informado').trim().slice(0, 160);
  const phone = String(metadata.customer_phone || payer.phone?.number || '').replace(/\D/g, '').slice(0, 15);
  return { name, email, phone: phone || 'Não informado' };
}

function canViewContacts(request) {
  const expected = String(process.env.ADMIN_DASHBOARD_TOKEN || '');
  const received = String(request.headers['x-admin-token'] || '');
  if (!expected || !received || expected.length !== received.length) return false;
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(received)); } catch { return false; }
}

function publicMethod(payment) {
  if (payment.payment_method_id === 'pix') return 'pix';
  if (payment.payment_type_id === 'account_money') return 'saldo_mercado_pago';
  if (payment.payment_type_id === 'credit_card') return 'cartao';
  return 'outro';
}

function statusBucket(status) {
  if (status === 'approved') return 'approved';
  if (['pending', 'in_process', 'authorized'].includes(status)) return 'pending';
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) return 'failed';
  return 'other';
}

function maskedId(payment) {
  const value = String(payment.id || payment.external_reference || '');
  return value.length > 4 ? `••••${value.slice(-4)}` : '••••';
}

async function fetchPayments(range) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('Mercado Pago não configurado.');
  const payments = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total && offset < MAX_SCANNED_PAYMENTS && payments.length < MAX_PAYMENTS) {
    const url = new URL('https://api.mercadopago.com/v1/payments/search');
    url.searchParams.set('sort', 'date_created');
    url.searchParams.set('criteria', 'desc');
    url.searchParams.set('range', 'date_created');
    url.searchParams.set('begin_date', range.beginAt);
    url.searchParams.set('end_date', range.endAt);
    url.searchParams.set('limit', '50');
    url.searchParams.set('offset', String(offset));
    const result = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!result.ok) throw new Error(`Mercado Pago indisponível (${result.status}).`);
    const payload = await result.json();
    const page = Array.isArray(payload.results) ? payload.results : Array.isArray(payload?.[0]?.results) ? payload[0].results : [];
    total = number(payload.paging?.total || payload?.[0]?.paging?.total || page.length);
    payments.push(...page.filter(belongsToStore));
    if (!page.length || page.length < 50) break;
    offset += page.length;
  }
  return payments;
}

function aggregate(payments, range) {
  const days = new Map();
  for (let day = new Date(`${range.start}T00:00:00.000Z`); day <= new Date(`${range.end}T00:00:00.000Z`); day = new Date(day.getTime() + DAY)) {
    days.set(isoDate(day), { date: isoDate(day), revenue: 0, approved: 0, attempts: 0 });
  }
  const methods = { pix: { orders: 0, revenue: 0 }, cartao: { orders: 0, revenue: 0 }, saldo_mercado_pago: { orders: 0, revenue: 0 }, outro: { orders: 0, revenue: 0 } };
  const products = Object.fromEntries([
    ...WASHER_VARIANTS.map(variant => [variant.id, variant.title]),
    ['toyadent-1', 'TOYADENT · Kit 1'],
    ['toyadent-2', 'TOYADENT · Kit 2'],
    ['toyadent-3', 'TOYADENT · Kit 3'],
    ['legacy', 'Oferta anterior']
  ].map(([id, name]) => [id, { id, name, attempts: 0, approved: 0, pending: 0, failed: 0, revenue: 0 }]));
  const installments = Array.from({ length: 12 }, (_, index) => ({ installments: index + 1, orders: 0 }));
  const totals = { attempts: 0, approved: 0, pending: 0, failed: 0, other: 0, revenue: 0, refunded: 0, pendingValue: 0 };
  const safePayments = payments.sort((left, right) => new Date(right.date_created) - new Date(left.date_created));

  safePayments.forEach(payment => {
    const createdAt = payment.date_created || payment.date_last_updated || payment.date_approved;
    if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) return;
    const day = days.get(isoDate(createdAt));
    const amount = brl(payment.transaction_amount);
    const status = statusBucket(payment.status);
    const method = publicMethod(payment);
    const product = productFor(payment);
    const productTotals = products[product.id];
    totals.attempts += 1;
    totals[status] += 1;
    productTotals.attempts += 1;
    productTotals[status] += 1;
    if (day) day.attempts += 1;
    if (status === 'approved') {
      const refunded = brl(payment.transaction_amount_refunded);
      totals.revenue = brl(totals.revenue + amount - refunded);
      totals.refunded = brl(totals.refunded + refunded);
      productTotals.revenue = brl(productTotals.revenue + amount - refunded);
      methods[method].orders += 1;
      methods[method].revenue = brl(methods[method].revenue + amount - refunded);
      if (day) { day.approved += 1; day.revenue = brl(day.revenue + amount - refunded); }
      const count = Math.min(12, Math.max(1, Number.parseInt(payment.installments, 10) || 1));
      installments[count - 1].orders += 1;
    }
    if (status === 'pending') totals.pendingValue = brl(totals.pendingValue + amount);
  });

  return {
    range: { start: range.start, end: range.end },
    totals: { ...totals, approvalRate: totals.attempts ? Math.round((totals.approved / totals.attempts) * 1000) / 10 : null },
    methods: Object.entries(methods).map(([method, values]) => ({ method, ...values })),
    installments: installments.filter(item => item.orders > 0),
    daily: [...days.values()],
    products: Object.values(products),
    recent: safePayments.slice(0, 10).map(payment => ({
      id: maskedId(payment),
      createdAt: dateTime(payment.date_created || payment.date_last_updated || new Date()),
      status: payment.status || 'unknown',
      method: publicMethod(payment),
      installments: Math.min(12, Math.max(1, Number.parseInt(payment.installments, 10) || 1)),
      amount: brl(payment.transaction_amount),
      product: productFor(payment).name
    }))
  };
}

function contacts(payments, enabled) {
  if (!enabled) return { enabled: false, configured: Boolean(process.env.ADMIN_DASHBOARD_TOKEN), records: [] };
  return {
    enabled: true,
    configured: true,
    records: payments.slice(0, 100).map(payment => ({
      ...contactFor(payment),
      product: productFor(payment).name,
      createdAt: dateTime(payment.date_created || payment.date_last_updated || new Date()),
      status: payment.status || 'unknown',
      method: publicMethod(payment),
      amount: brl(payment.transaction_amount),
      orderId: String(payment.external_reference || payment.id || '').slice(0, 80)
    }))
  };
}

function change(current, previous) {
  if (!previous) return null;
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function fetchMetaCampaigns(range) {
  const account = String(process.env.META_AD_ACCOUNT_ID || '');
  const token = String(process.env.META_ADS_ACCESS_TOKEN || '');
  const version = String(process.env.META_GRAPH_API_VERSION || '');
  if (!account || !token || !version) return { connected: false, reason: 'Configure META_AD_ACCOUNT_ID, META_ADS_ACCESS_TOKEN e META_GRAPH_API_VERSION.' };
  try {
    const url = new URL(`https://graph.facebook.com/${version}/${account.replace(/^\/+/, '')}/insights`);
    url.searchParams.set('level', 'campaign');
    url.searchParams.set('fields', 'campaign_name,spend,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas');
    url.searchParams.set('time_range', JSON.stringify({ since: range.start, until: range.end }));
    url.searchParams.set('limit', '100');
    url.searchParams.set('access_token', token);
    const result = await fetch(url);
    if (!result.ok) throw new Error('A API de anúncios recusou a consulta.');
    const payload = await result.json();
    const metric = (items, action) => number((items || []).find(item => item.action_type === action)?.value);
    return {
      connected: true,
      campaigns: (payload.data || []).map(item => ({
        name: String(item.campaign_name || 'Campanha sem nome').slice(0, 120),
        spend: brl(item.spend), impressions: number(item.impressions), clicks: number(item.clicks), ctr: number(item.ctr), cpc: brl(item.cpc),
        purchases: metric(item.actions, 'offsite_conversion.fb_pixel_purchase') || metric(item.actions, 'purchase'),
        purchaseValue: brl(metric(item.action_values, 'offsite_conversion.fb_pixel_purchase') || metric(item.action_values, 'purchase'))
      }))
    };
  } catch {
    return { connected: false, reason: 'Não foi possível consultar a API de anúncios. Revise as permissões ads_read e read_insights.' };
  }
}

function recommendations(current, integrations, funnel) {
  const suggestions = [];
  if (!integrations.metaAds) suggestions.push({ priority: 'alta', title: 'Conectar dados de campanha', detail: 'Adicione as credenciais de leitura da Meta para comparar investimento, CTR, CPC e compras por campanha.' });
  if (!integrations.firstPartyFunnelStorage) suggestions.push({ priority: 'alta', title: 'Ativar histórico do funil', detail: 'Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel para salvar eventos agregados sem dados pessoais.' });
  else if (!funnel.available) suggestions.push({ priority: 'alta', title: 'Verificar banco do funil', detail: funnel.reason || 'A base Redis configurada não respondeu ao painel.' });
  else if (current.totals.approved > 0 && Number(funnel.events.InitiateCheckout?.observed || 0) === 0) suggestions.push({ priority: 'alta', title: 'Revisar início do checkout', detail: 'Há pagamentos aprovados, mas nenhum InitiateCheckout registrado neste período. Compare a data do deploy e a configuração do armazenamento do funil.' });
  if (current.totals.pending > 0) suggestions.push({ priority: 'média', title: 'Recuperar Pix pendentes', detail: `${current.totals.pending} pagamento(s) aguardam conclusão. Automatize lembretes após a criação do Pix e antes da expiração.` });
  if (current.totals.attempts >= 5 && number(current.totals.approvalRate) < 65) suggestions.push({ priority: 'média', title: 'Reduzir recusas de pagamento', detail: `A aprovação entre tentativas está em ${current.totals.approvalRate}%. Revise mensagens de confiança, CPF/CEP e destaque Pix como alternativa.` });
  if (!current.totals.attempts) suggestions.push({ priority: 'baixa', title: 'Aguardando dados de venda', detail: 'Não há pagamentos deste produto no período selecionado. Confirme as datas ou aguarde as primeiras transações.' });
  return suggestions.slice(0, 5);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Método não permitido.' });
  const quota = rateLimit(request, 'admin-dashboard', { limit: 20, windowMs: 60_000 });
  sendRateHeaders(response, quota);
  if (!quota.allowed) return response.status(429).json({ error: 'Muitas consultas. Aguarde um minuto.' });
  const periods = periodFrom(request.query || {});
  if (!periods) return response.status(422).json({ error: 'Use períodos entre 1 e 365 dias.' });

  try {
    const [currentPayments, previousPayments, currentCampaigns, previousCampaigns, currentFunnel, previousFunnel] = await Promise.all([
      fetchPayments(periods.current), fetchPayments(periods.previous), fetchMetaCampaigns(periods.current), fetchMetaCampaigns(periods.previous),
      getFunnelData(periods.current), getFunnelData(periods.previous)
    ]);
    const current = aggregate(currentPayments, periods.current);
    const previous = aggregate(previousPayments, periods.previous);
    const integrations = {
      mercadoPago: Boolean(process.env.MP_ACCESS_TOKEN), webhook: Boolean(process.env.MP_WEBHOOK_SECRET),
      metaCapi: Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
      metaPixelMatchesBrowser: Boolean(process.env.META_PIXEL_ID === '1806290673851071'),
      metaAds: currentCampaigns.connected, firstPartyFunnelStorage: currentFunnel.available, customerRecords: Boolean(process.env.ADMIN_DASHBOARD_TOKEN)
    };
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      generatedAt: new Date().toISOString(), periods: { current: periods.current, previous: periods.previous }, current, previous,
      comparison: { revenue: change(current.totals.revenue, previous.totals.revenue), approved: change(current.totals.approved, previous.totals.approved), attempts: change(current.totals.attempts, previous.totals.attempts) },
      campaigns: { current: currentCampaigns, previous: previousCampaigns }, integrations,
      funnel: { available: currentFunnel.available, configured: currentFunnel.configured, current: currentFunnel, previous: previousFunnel, approvedPurchases: current.totals.approved, trackedEvents: ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'] },
      contacts: contacts(currentPayments, canViewContacts(request)),
      recommendations: recommendations(current, integrations, currentFunnel), limitations: ['Pagamentos e valores aprovados vêm diretamente do Mercado Pago; eventos do funil são agregados e não identificam pessoas.', 'O histórico de pagamentos e do funil depende da retenção disponível em cada integração.', 'Nome, e-mail e telefone só ficam disponíveis após autenticação do administrador. CPF, endereço, cartão e chaves não são exibidos.']
    });
  } catch (error) {
    return response.status(502).json({ error: error.message || 'Não foi possível carregar os dados do painel.' });
  }
}
