const KIT_DEFINITIONS = [
  { id: 'toyadent-1', units: 1, price: 22.90, shipping: 9.32 },
  { id: 'toyadent-2', units: 2, price: 39.90, shipping: 9.32 },
  { id: 'toyadent-3', units: 3, price: 49.90, shipping: 0 }
];

const asProduct = kit => ({
  ...kit,
  title: `TOYADENT · Kit com ${kit.units} ${kit.units === 1 ? 'unidade' : 'unidades'}`,
  currency: 'BRL',
  originalPrice: kit.price,
  cardPrice: kit.price,
  cashPrice: kit.price,
  total: Number((kit.price + kit.shipping).toFixed(2)),
  maxInstallments: 1,
  deliveryMinBusinessDays: 3,
  deliveryMaxBusinessDays: 5,
  carrier: 'Loggi'
});

export function storeProducts() {
  return KIT_DEFINITIONS.map(asProduct);
}

export function storeProduct(productId = 'toyadent-1') {
  return storeProducts().find(product => product.id === String(productId || '')) || storeProducts()[0];
}

export const quantityFrom = () => 1;

export function paymentAmount(product) {
  return Number((product.price + product.shipping).toFixed(2));
}
