const COOKIE_NAME = 'newboox_entrega';
const CEP_FORMAT = /^\d{8}$/;

function brazilianDestination(city, region) {
  const name = String(city || '').trim().slice(0, 90);
  const state = String(region || '').trim().toUpperCase().replace(/^BR-/, '');
  return name && /^[A-Z]{2}$/.test(state) ? { city: name, region: state } : null;
}

export function postalDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

export function formatPostalCode(value) {
  const digits = postalDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function readDeliveryPreference() {
  try {
    const prefix = `${COOKIE_NAME}=`;
    const cookie = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
    if (!cookie) return null;
    const { postalCode, city, region } = JSON.parse(decodeURIComponent(cookie.slice(prefix.length)));
    const destination = brazilianDestination(city, region);
    return destination && CEP_FORMAT.test(postalCode) ? { ...destination, postalCode } : null;
  } catch {
    return null;
  }
}

export function saveDeliveryPreference({ postalCode, city, region }) {
  const destination = brazilianDestination(city, region);
  if (!destination || !CEP_FORMAT.test(postalCode)) return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  try {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ ...destination, postalCode }))}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
  } catch {}
}

export async function approximateDeliveryDestination(signal) {
  const response = await fetch('/api/locale', { cache: 'no-store', signal });
  if (!response.ok) return null;
  const { country, city, region } = await response.json();
  return country === 'BR' ? brazilianDestination(city, region) : null;
}

export async function lookupPostalCode(postalCode, signal) {
  if (!CEP_FORMAT.test(postalCode)) return null;
  const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, { signal, referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Consulta de CEP indisponível.');
  const data = await response.json();
  const destination = brazilianDestination(data.localidade, data.uf);
  if (data.erro || !destination) return null;
  return { ...destination, postalCode, street: String(data.logradouro || '') };
}
