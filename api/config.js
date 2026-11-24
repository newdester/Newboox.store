import { catalogConfig, storeProduct } from './_lib/catalog.js';

const BROWSER_PIXEL_ID = '1806290673851071';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const product = storeProduct();
  const catalog = catalogConfig();
  return response.status(200).json({
    publicKey: String(process.env.MP_PUBLIC_KEY || '').trim(),
    paymentEnabled: Boolean(process.env.MP_PUBLIC_KEY && process.env.MP_ACCESS_TOKEN),
    webhookConfigured: Boolean(process.env.MP_WEBHOOK_SECRET),
    metaCapiEnabled: Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
    metaPixelMatchesBrowser: Boolean(process.env.META_PIXEL_ID && process.env.META_PIXEL_ID === BROWSER_PIXEL_ID),
    metaTestMode: Boolean(process.env.META_TEST_EVENT_CODE),
    sedexConfigured: true,
    shipping: catalog.shipping,
    product,
    models: catalog.models,
    pricingTiers: catalog.pricingTiers,
    maxOrderQuantity: catalog.maxOrderQuantity
  });
}
