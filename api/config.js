import { storeProduct } from './_lib/catalog.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const product = storeProduct();
  return response.status(200).json({
    publicKey: String(process.env.MP_PUBLIC_KEY || '').trim(),
    paymentEnabled: Boolean(process.env.MP_PUBLIC_KEY && process.env.MP_ACCESS_TOKEN),
    webhookConfigured: Boolean(process.env.MP_WEBHOOK_SECRET),
    metaCapiEnabled: Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
    product
  });
}
