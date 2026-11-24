const PRODUCT_MODELS = [
  {
    id: 'terco-sao-miguel',
    title: 'Terço de São Miguel Arcanjo',
    tiktokVideoId: '7590141020285701393',
    tiktokUrl: 'https://www.tiktok.com/@tercosdesing/video/7590141020285701393'
  },
  {
    id: 'terco-aparecida',
    title: 'Terço de Nossa Senhora Aparecida',
    tiktokVideoId: '7694326293432765702',
    tiktokUrl: 'https://www.tiktok.com/@tercosdesing/video/7694326293432765702'
  },
  {
    id: 'terco-divino-espirito',
    title: 'Terço do Divino Espírito Santo',
    tiktokVideoId: '7693251625376435508',
    tiktokUrl: 'https://www.tiktok.com/@tercosdesing/video/7693251625376435508'
  }
];

const PRICING_TIERS = [
  { minQuantity: 1, maxQuantity: 1, unitPrice: 89.90 },
  { minQuantity: 2, maxQuantity: 2, unitPrice: 75.90 },
  { minQuantity: 3, maxQuantity: 10, unitPrice: 59.90 }
];
const MAX_ORDER_QUANTITY = 10;
const SEDEX_RATE = 12.36;
const DEFAULT_PRODUCT_ID = PRODUCT_MODELS[0].id;

export const quantityFrom = value => Math.min(MAX_ORDER_QUANTITY, Math.max(1, Number.parseInt(value, 10) || 1));
export const shippingServiceFrom = value => String(value || '').toLowerCase() === 'sedex' ? 'sedex' : 'standard';

export function storeProducts() {
  return PRODUCT_MODELS.map(model => ({
    ...model,
    units: 1,
    price: PRICING_TIERS[0].unitPrice,
    currency: 'BRL',
    maxInstallments: 1,
    deliveryMinDays: 8,
    deliveryMaxDays: 12,
    carrier: 'Correios - Entrega Padrão'
  }));
}

export function storeProduct(productId = DEFAULT_PRODUCT_ID) {
  return storeProducts().find(product => product.id === String(productId || '')) || null;
}

export function normalizeOrderItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > PRODUCT_MODELS.length) {
    throw new Error('Selecione ao menos um modelo de terço.');
  }
  const items = new Map();
  let totalQuantity = 0;
  for (const row of input) {
    const id = String(row?.productId || row?.id || '');
    const product = storeProduct(id);
    const rawQuantity = Number(row?.quantity);
    if (!product || !Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > MAX_ORDER_QUANTITY) {
      throw new Error('Confira os modelos e as quantidades do pedido.');
    }
    totalQuantity += rawQuantity;
    if (totalQuantity > MAX_ORDER_QUANTITY) throw new Error('O limite é de 10 unidades por pedido.');
    items.set(id, (items.get(id) || 0) + rawQuantity);
  }
  return [...items.entries()].map(([id, quantity]) => ({ product: storeProduct(id), productId: id, quantity }));
}

export function itemCount(items) {
  return (Array.isArray(items) ? items : []).reduce((total, row) => total + quantityFrom(row?.quantity), 0);
}

export function unitPriceForQuantity(quantity) {
  const count = quantityFrom(quantity);
  return count >= 3 ? PRICING_TIERS[2].unitPrice : PRICING_TIERS[count - 1].unitPrice;
}

export function subtotalForItems(items) {
  const count = itemCount(items);
  return Number((count * unitPriceForQuantity(count)).toFixed(2));
}

export function shippingAmount(items, shippingService = 'standard') {
  return shippingServiceFrom(shippingService) === 'sedex' ? SEDEX_RATE : 0;
}

export function paymentAmount(items, shippingService = 'standard') {
  return Number((subtotalForItems(items) + shippingAmount(items, shippingService)).toFixed(2));
}

export function catalogConfig() {
  return {
    models: storeProducts(),
    pricingTiers: PRICING_TIERS,
    maxOrderQuantity: MAX_ORDER_QUANTITY,
    shipping: {
      standard: { carrier: 'Correios', price: 0, minDays: 8, maxDays: 12 },
      sedex: { carrier: 'SEDEX', price: SEDEX_RATE, minDays: 2, maxDays: 3 }
    }
  };
}
