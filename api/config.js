import { internationalCatalog, internationalProductId } from './_lib/cakto.js';

const DISPLAY_UNIT_PRICE_USD = 69;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const base = {
    publicKey: process.env.MP_PUBLIC_KEY || '',
    paymentEnabled: Boolean(process.env.MP_PUBLIC_KEY && process.env.MP_ACCESS_TOKEN),
    caktoApiEnabled: Boolean(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET),
    caktoClientId: String(process.env.CAKTO_CLIENT_ID || '').trim(),
    metaCapiEnabled: Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
    displayUnitPrice: DISPLAY_UNIT_PRICE_USD,
    processingFee: 0.99,
    product: { id: internationalProductId(), title: 'Motor Scent', unitPrice: DISPLAY_UNIT_PRICE_USD, currency: 'USD' }
  };
  if (!base.caktoApiEnabled) return response.status(200).json({ ...base, caktoCheckoutReady: false, caktoOffersConfigured: false, caktoInternationalOfferConfigured: false });
  try {
    const catalog = await internationalCatalog();
    return response.status(200).json({
      ...base,
      caktoCheckoutReady: true,
      caktoOffersConfigured: true,
      caktoInternationalOfferConfigured: true,
      product: { id: catalog.product.id, title: catalog.product.name, unitPrice: DISPLAY_UNIT_PRICE_USD, currency: catalog.offer.currency },
      offer: catalog.offer
    });
  } catch (error) {
    return response.status(200).json({ ...base, caktoCheckoutReady: false, caktoOffersConfigured: false, caktoInternationalOfferConfigured: false, caktoConfigurationError: error.message });
  }
}
