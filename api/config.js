import { storeProduct, storeProducts } from './_lib/catalog.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const product = storeProduct();
  return response.status(200).json({
    publicKey: String(process.env.MP_PUBLIC_KEY || '').trim(),
    paymentEnabled: Boolean(process.env.MP_PUBLIC_KEY && process.env.MP_ACCESS_TOKEN),
    webhookConfigured: Boolean(process.env.MP_WEBHOOK_SECRET),
    metaCapiEnabled: Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
    fedexExpressConfigured: Boolean(process.env.FEDEX_CLIENT_ID && process.env.FEDEX_CLIENT_SECRET && process.env.FEDEX_ACCOUNT_NUMBER && process.env.FEDEX_ORIGIN_POSTAL_CODE && process.env.FEDEX_PACKAGE_WEIGHT_KG),
    shipping: { economy: { carrier: 'FedEx', price: 0, minDays: 8, maxDays: 12 }, express: { carrier: 'FedEx', minDays: 2, maxDays: 3 } },
    product,
    kits: storeProducts()
  });
}
