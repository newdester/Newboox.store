import { orderTotals } from '../../assets/js/washer-catalog.js';
import { STORE_PRODUCTS } from '../../assets/js/product-catalog.js';

const SEDEX_RATE = 12.36;

const asProduct = variant => ({
  ...variant,
  cardPrice: variant.price,
  cashPrice: variant.price,
  shipping: 0,
  total: variant.price,
  deliveryMinDays: 8,
  deliveryMaxDays: 12,
  carrier: 'Correios - Entrega Padrão'
});

export function storeProducts() {
  return STORE_PRODUCTS.map(asProduct);
}

export function storeProduct(productId = 'soarfly-127v') {
  return storeProducts().find(product => product.id === productId && product.available) || null;
}

export const quantityFrom = value => Math.min(10, Math.max(1, Number.parseInt(value, 10) || 1));
export const shippingServiceFrom = value => String(value || '').toLowerCase() === 'sedex' ? 'sedex' : 'standard';

export function shippingAmount(product, quantity = 1, shippingService = 'standard') {
  quantityFrom(quantity);
  return shippingServiceFrom(shippingService) === 'sedex' ? SEDEX_RATE : 0;
}

export function paymentAmount(product, quantity = 1, shippingService = 'standard', paymentMethod) {
  const totals = orderTotals(product.price, quantityFrom(quantity), shippingAmount(product, quantity, shippingService));
  return paymentMethod === 'pix' ? totals.pixTotal : totals.total;
}
