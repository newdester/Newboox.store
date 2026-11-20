const KIT_DEFINITIONS = [
  { id: 'toyadent-1', units: 1, price: 22.90 },
  { id: 'toyadent-2', units: 2, price: 39.90 },
  { id: 'toyadent-3', units: 3, price: 44.90 }
];
const ORIGINAL_UNIT_PRICE = 37.20;
const SHIPPING_RATE = 9.32;
const FREE_SHIPPING_THRESHOLD = 40;

const asProduct = kit => ({
  ...kit,
  title: `TOYADENT · Kit com ${kit.units} ${kit.units === 1 ? 'unidade' : 'unidades'}`,
  currency: 'BRL',
  originalPrice: Number((kit.units * ORIGINAL_UNIT_PRICE).toFixed(2)),
  cardPrice: kit.price,
  cashPrice: kit.price,
  shipping: kit.price >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATE,
  total: Number((kit.price + (kit.price >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATE)).toFixed(2)),
  maxInstallments: 1,
  deliveryMinDays: 3,
  deliveryMaxDays: 5,
  carrier: 'Entrega Full'
});

export function storeProducts() {
  return KIT_DEFINITIONS.map(asProduct);
}

export function storeProduct(productId = 'toyadent-1') {
  return storeProducts().find(product => product.id === String(productId || '')) || storeProducts()[0];
}

export const quantityFrom = value => Math.min(10, Math.max(1, Number.parseInt(value, 10) || 1));

export function shippingAmount(product, quantity = 1) {
  const subtotal = Number(product.price) * quantityFrom(quantity);
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATE;
}

export function paymentAmount(product, quantity = 1) {
  const amount = Number(product.price) * quantityFrom(quantity);
  return Number((amount + shippingAmount(product, quantity)).toFixed(2));
}
