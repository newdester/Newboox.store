let cache = { at: 0, rates: null };

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  if (cache.rates && Date.now() - cache.at < 15 * 60 * 1000) return response.status(200).json({ base: 'USD', rates: cache.rates });
  try {
    const result = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await result.json();
    if (!result.ok || !data.rates) throw new Error('exchange rate unavailable');
    cache = { at: Date.now(), rates: data.rates };
    return response.status(200).json({ base: 'USD', rates: data.rates });
  } catch {
    return response.status(200).json({ base: 'USD', rates: { USD: 1 } });
  }
}
