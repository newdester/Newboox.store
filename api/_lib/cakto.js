import { randomUUID } from 'node:crypto';

const configuredApiBase = String(process.env.CAKTO_API_URL || 'https://api.cakto.com.br/public_api').trim().replace(/\/$/, '');
const API_BASE = /\/public_api$/i.test(configuredApiBase) ? configuredApiBase : `${configuredApiBase}/public_api`;
const DEFAULT_PRODUCT_ID_USD = 'dabef23e-c8f4-4eba-ab9d-0b6d95aaf6e4';
let tokenCache = { value: '', expiresAt: 0 };
let catalogCache = { value: null, expiresAt: 0 };

export function caktoConfigured() {
  return Boolean(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);
}

export async function getCaktoToken() {
  if (!caktoConfigured()) throw new Error('Cakto não configurada no servidor.');
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const body = new URLSearchParams({
    client_id: String(process.env.CAKTO_CLIENT_ID).trim(),
    client_secret: String(process.env.CAKTO_CLIENT_SECRET).trim()
  });
  const result = await fetch(`${API_BASE}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.access_token) {
    const reason = String(data.error || data.detail || data.message || '').slice(0, 80);
    throw new Error(`Não foi possível autenticar na Cakto${reason ? ` (${reason})` : ''}.`);
  }
  const expiresIn = Number(data.expires_in) || 36000;
  tokenCache = { value: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return tokenCache.value;
}

export async function caktoRequest(path, options = {}) {
  const token = await getCaktoToken();
  const headers = { Accept: 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export function internationalProductId() {
  return String(process.env.CAKTO_PRODUCT_ID_USD || DEFAULT_PRODUCT_ID_USD).trim();
}

export async function internationalCatalog() {
  if (catalogCache.value && catalogCache.expiresAt > Date.now()) return catalogCache.value;
  const productId = internationalProductId();
  const result = await caktoRequest(`/products/${encodeURIComponent(productId)}/`);
  const product = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(product.detail || product.message || 'Produto internacional não encontrado na Cakto.');
  if (String(product.status || '').toLowerCase() !== 'active') throw new Error('O produto internacional está inativo na Cakto.');
  let offers = Array.isArray(product.offers) ? product.offers : [];
  if (!offers.length) {
    const offersResult = await caktoRequest(`/offers/?product=${encodeURIComponent(productId)}&status=active&type=unique&limit=100`);
    const offersData = await offersResult.json().catch(() => ({}));
    if (offersResult.ok) offers = Array.isArray(offersData.results) ? offersData.results : [];
  }
  const configuredId = String(process.env.CAKTO_OFFER_ID_USD || '').trim();
  let configuredOffer = configuredId ? offers.find(item => String(item.id) === configuredId && String(item.status).toLowerCase() === 'active') : null;
  if (configuredId && !configuredOffer) {
    const offerResult = await caktoRequest(`/offers/${encodeURIComponent(configuredId)}/`);
    const offerData = await offerResult.json().catch(() => ({}));
    if (offerResult.ok && String(offerData.product || '') === String(product.id || productId)) configuredOffer = offerData;
  }
  const offer = configuredOffer
    || offers.find(item => item.default && String(item.status).toLowerCase() === 'active')
    || offers.find(item => String(item.status).toLowerCase() === 'active');
  if (!offer) throw new Error('O produto internacional não possui oferta ativa.');
  if (String(offer.status || '').toLowerCase() !== 'active') throw new Error('A oferta internacional está inativa na Cakto.');
  const currency = String(offer.currency || product.currency || 'USD').toUpperCase();
  if (currency !== 'USD') throw new Error('A oferta vinculada ao checkout não está configurada em USD.');
  const value = {
    product: { id: String(product.id || productId), name: String(product.name || 'Motor Scent'), status: String(product.status), currency },
    offer: { id: String(offer.id), name: String(offer.name || product.name || 'Motor Scent'), status: String(offer.status), price: Number(offer.price || product.price || 0), currency }
  };
  if (!Number.isFinite(value.offer.price) || value.offer.price <= 0) throw new Error('A oferta internacional não possui um preço válido.');
  catalogCache = { value, expiresAt: Date.now() + 5 * 60_000 };
  return value;
}

export async function offerForCountry() {
  return (await internationalCatalog()).offer.id;
}

export function idempotencyKey(value) {
  return String(value || randomUUID()).slice(0, 120);
}
