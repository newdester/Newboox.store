export default function handler(request, response) {
  const country = String(request.headers['x-vercel-ip-country'] || request.headers['cf-ipcountry'] || 'US').trim().toUpperCase();
  response.setHeader('Cache-Control', 'private, max-age=300');
  response.status(200).json({ country: /^[A-Z]{2}$/.test(country) ? country : 'US' });
}
