import { Storefront } from './storefront.js?v=shop-1';
import { GAME_PRODUCT } from './product-catalog.js?v=1';
import { orderTotals } from './washer-catalog.js?v=soarfly-4';

const form = document.querySelector('#game-offer');
const quantity = form.elements.quantity;
const submit = form.querySelector('button');
const status = document.querySelector('#offer-status');
const photos = [...document.querySelectorAll('[data-photo]')];
const image = document.querySelector('#game-image');

photos.forEach(button => button.addEventListener('click', () => {
  image.src = button.dataset.photo;
  image.alt = button.dataset.alt;
  photos.forEach(photo => photo.setAttribute('aria-pressed', String(photo === button)));
}));

await Storefront.loadConfig();
const product = Storefront.kitById(GAME_PRODUCT.id);
const cart = Storefront.getCart();
document.querySelector('[data-cart-count]').textContent = String(cart?.kitQuantity || 0);
document.querySelector('#game-cart-note').hidden = !cart || cart.id === GAME_PRODUCT.id;

if (product) {
  document.querySelector('#game-price').textContent = Storefront.brl(product.price);
  document.querySelector('#game-pix').textContent = Storefront.brl(orderTotals(product.price, 1).pixTotal);
  document.querySelector('#game-installments').textContent = `No cartão em até ${product.maxInstallments}x sem juros`;
  submit.disabled = false;
  Storefront.track('ViewContent', product);
} else {
  status.textContent = 'O Game R36S está indisponível no momento.';
}

quantity.addEventListener('change', () => {
  if (!product) return;
  const count = Storefront.kitQuantityFor({ kitQuantity: quantity.value });
  const { subtotal, pixTotal } = orderTotals(product.price, count);
  document.querySelector('#game-total').hidden = count === 1;
  document.querySelector('#game-order-total').textContent = Storefront.brl(subtotal);
  document.querySelector('#game-order-pix').textContent = Storefront.brl(pixTotal) + ' no Pix';
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!product || submit.disabled) return;
  const count = Storefront.kitQuantityFor({ kitQuantity: quantity.value });
  const order = { ...product, kitQuantity: count, shippingService: 'standard' };
  try {
    Storefront.putCart(order);
  } catch {
    status.textContent = 'O navegador não conseguiu salvar sua seleção. Tente novamente.';
    return;
  }
  submit.disabled = true;
  try {
    Storefront.track('AddToCart', order, {
      num_items: count,
      contents: [{ id: product.id, quantity: count, item_price: product.price }]
    });
  } catch {}
  location.assign('/cart');
});

window.addEventListener('pageshow', event => {
  if (!event.persisted || !product) return;
  const currentCart = Storefront.getCart();
  document.querySelector('[data-cart-count]').textContent = String(currentCart?.kitQuantity || 0);
  document.querySelector('#game-cart-note').hidden = !currentCart || currentCart.id === product.id;
  submit.disabled = false;
});
