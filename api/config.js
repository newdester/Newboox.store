import { storeProduct, storeProducts } from './_lib/catalog.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const product = storeProduct();
  return response.status(200).json({
    publicKey: String(process.env.MP_PUBLIC_KEY || '').trim(),
    paymentEnabled: Boolean(process.env.MP_PUBLIC_KEY && process.env.MP_ACCESS_TOKEN),
    webhookConfigured: Boolean(process.env.MP_WEBHOOK_SECRET),
    metaCapiEnabled: Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
    sedexConfigured: Boolean(process.env.CORREIOS_API_USER && process.env.CORREIOS_API_PASSWORD && process.env.CORREIOS_CONTRACT_NUMBER && process.env.CORREIOS_ORIGIN_POSTAL_CODE && process.env.CORREIOS_PACKAGE_WEIGHT_G),
    shipping: { standard: { carrier: 'Correios', price: 0, minDays: 8, maxDays: 12 }, sedex: { carrier: 'SEDEX', minDays: 2, maxDays: 3 } },
    product,
    kits: storeProducts()
  });
}
