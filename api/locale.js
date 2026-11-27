function decode(value) {
  const text = String(value || '');
  try { return decodeURIComponent(text.replace(/\+/g, ' ')); } catch { return text; }
}

export function localeFromHeaders(headers, fallbackCountry = 'US') {
  const country = String(headers['x-vercel-ip-country'] || headers['cf-ipcountry'] || fallbackCountry).trim().toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : fallbackCountry,
    city: decode(headers['x-vercel-ip-city']),
    region: decode(headers['x-vercel-ip-country-region'])
  };
}

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.status(200).json(localeFromHeaders(request.headers));
}
