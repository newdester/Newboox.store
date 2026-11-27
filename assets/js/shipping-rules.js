export const SHIPPING_OPTIONS = Object.freeze({
  standard: Object.freeze({ carrier: 'Correios', price: 0, minDays: 5, maxDays: 7, dayType: 'calendar' }),
  sedex: Object.freeze({ carrier: 'SEDEX', price: 12.36, minDays: 2, maxDays: 3, dayType: 'business' })
});

const brasiliaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric', day: 'numeric'
});

export function standardDeliveryRange(now = new Date(), locale = 'pt-BR') {
  const parts = Object.fromEntries(brasiliaDate.formatToParts(now).map(({ type, value }) => [type, Number(value)]));
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' });
  const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
  return [SHIPPING_OPTIONS.standard.minDays, SHIPPING_OPTIONS.standard.maxDays].map(days => {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return `${weekday.format(date)} (${shortDate.format(date)})`;
  });
}
