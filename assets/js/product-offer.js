import { Storefront } from './storefront.js?v=editorial-5';
import { orderTotals } from './washer-catalog.js?v=soarfly-4';
import { setupGallery } from './product-page.js?v=4';

const gallery = document.querySelector('.gallery-thumb[data-photo]') ? setupGallery() : null;
const form = document.querySelector('[data-product-offer]');
const cartCount = document.querySelector('[data-cart-count]');
const status = document.querySelector('#offer-status');
const submit = form.querySelector('button[type="submit"]');
const cartNote = document.querySelector('[data-cart-note]');
const prices = document.querySelector('[data-offer-prices]');
const unitCard = prices.querySelector('[data-unit-card]');
const unitPix = prices.querySelector('[data-unit-pix]');
const orderTotal = form.querySelector('[data-order-total]');
const orderCard = orderTotal.querySelector('[data-order-card]');
const orderPix = orderTotal.querySelector('[data-order-pix]');
const options = [...form.querySelectorAll('input[name="variant"]')];
const quantity = () => Storefront.kitQuantityFor({ kitQuantity: form.elements.quantity.value });
const selectedProduct = () => Storefront.kitById(form.elements.variant?.value || form.dataset.productId);

function renderPrice(product) {
  const count = quantity();
  const unit = orderTotals(product.price, 1);
  const order = orderTotals(product.price, count);
  unitCard.textContent = Storefront.brl(unit.subtotal);
  unitPix.textContent = Storefront.brl(unit.pixTotal);
  orderTotal.hidden = count === 1;
  orderCard.textContent = Storefront.brl(order.subtotal);
  orderPix.textContent = `${Storefront.brl(order.pixTotal)} no Pix`;
}

function renderOffer() {
  const product = selectedProduct();
  const cart = Storefront.getCart();
  cartCount.textContent = String(cart?.kitQuantity || 0);
  if (cartNote) cartNote.hidden = !product || !cart || cart.id === product.id;
  prices.hidden = !product;
  submit.disabled = !product;
  status.textContent = product ? '' : 'Produto indisponível no momento.';
  if (product) renderPrice(product);
}

await Storefront.loadConfig();
for (const option of options) {
  const product = Storefront.kitById(option.value);
  option.disabled = !product;
  option.closest('label').querySelector('.variant-price').textContent = product ? Storefront.brl(product.price) : 'Indisponível';
}
const saved = Storefront.getCart();
const firstAvailable = options.find(option => !option.disabled && option.value === saved?.id) || options.find(option => !option.disabled);
options.forEach(option => { option.checked = option === firstAvailable; });
const initialProduct = selectedProduct();
if (initialProduct) {
  form.elements.quantity.value = String(saved?.kitQuantity || 1);
  gallery?.showImage(initialProduct.image, { ifUntouched: true });
  Storefront.track('ViewContent', initialProduct);
}
renderOffer();

form.addEventListener('change', event => {
  if (event.target.name === 'variant') gallery?.showImage(selectedProduct()?.image);
  renderOffer();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const product = selectedProduct();
  if (!product || submit.disabled) return;
  const count = quantity();
  const cart = { ...product, kitQuantity: count, shippingService: 'standard' };
  try {
    Storefront.putCart(cart);
    submit.disabled = true;
    Storefront.track('AddToCart', cart, { num_items: count, contents: [{ id: product.id, quantity: count, item_price: product.price }] });
    location.assign(Storefront.CART_URL);
  } catch {
    submit.disabled = false;
    status.textContent = 'O navegador não conseguiu salvar a seleção. Tente de novo.';
  }
});

window.addEventListener('pageshow', event => {
  if (event.persisted) renderOffer();
});
