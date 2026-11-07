import { randomUUID } from 'node:crypto';

const API_BASE = String(process.env.CAKTO_API_URL || 'https://api.cakto.com.br/public_api').replace(/\/$/, '');
let tokenCache = { value: '', expiresAt: 0 };

export function caktoConfigured() {
  return Boolean(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);
}

export async function getCaktoToken() {
  if (!caktoConfigured()) throw new Error('Cakto não configurada no servidor.');
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const body = new URLSearchParams({
    client_id: process.env.CAKTO_CLIENT_ID,
    client_secret: process.env.CAKTO_CLIENT_SECRET,
    grant_type: 'client_credentials'
  });
  const result = await fetch(`${API_BASE}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.access_token) throw new Error('Não foi possível autenticar na Cakto.');
  const expiresIn = Number(data.expires_in) || 36000;
  tokenCache = { value: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return tokenCache.value;
}

export async function caktoRequest(path, options = {}) {
  const token = await getCaktoToken();
  const headers = { Accept: 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export function offerForCountry(country) {
  // A loja opera exclusivamente com a oferta internacional em USD.
  // O país continua sendo enviado no endereço para cálculo, antifraude e entrega.
  return process.env.CAKTO_OFFER_ID_USD;
}

export function idempotencyKey(value) {
  return String(value || randomUUID()).slice(0, 120);
}
