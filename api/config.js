const product = {
  id: 'chefpro-2l',
  title: 'Triturador Elétrico ChefPro 2L Bivolt + Tábua de Madeira Grátis',
  unitPrice: 49.9,
  currency: 'BRL'
};

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    publicKey: process.env.MP_PUBLIC_KEY || '',
    paymentEnabled: Boolean(process.env.MP_PUBLIC_KEY && process.env.MP_ACCESS_TOKEN),
    caktoApiEnabled: Boolean(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET),
    caktoOffersConfigured: Boolean(process.env.CAKTO_OFFER_ID_USD && process.env.CAKTO_OFFER_ID_BRL),
    caktoInternationalOfferConfigured: Boolean(process.env.CAKTO_OFFER_ID_USD),
    metaCapiEnabled: Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
    product
  });
}
