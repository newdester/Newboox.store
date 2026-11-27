import { orderTotals } from '../../assets/js/washer-catalog.js';
import { STORE_PRODUCTS } from '../../assets/js/product-catalog.js';
import { SHIPPING_OPTIONS } from '../../assets/js/shipping-rules.js';

const asProduct = variant => ({
  ...variant,
  cardPrice: variant.price,
  cashPrice: variant.price,
  shipping: SHIPPING_OPTIONS.standard.price,
  total: variant.price,
  deliveryMinDays: SHIPPING_OPTIONS.standard.minDays,
  deliveryMaxDays: SHIPPING_OPTIONS.standard.maxDays,
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
  return SHIPPING_OPTIONS[shippingServiceFrom(shippingService)].price;
}

export function paymentAmount(product, quantity = 1, shippingService = 'standard', paymentMethod) {
  const totals = orderTotals(product.price, quantityFrom(quantity), shippingAmount(product, quantity, shippingService));
  return paymentMethod === 'pix' ? totals.pixTotal : totals.total;
}
