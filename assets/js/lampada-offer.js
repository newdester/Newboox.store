import { Storefront } from './storefront.js?v=editorial-4';
import { orderTotals } from './washer-catalog.js?v=soarfly-4';
import { setupGallery } from './product-page.js?v=4';

const gallery = setupGallery();
const form = document.querySelector('#lamp-offer');
const cartCount = document.querySelector('[data-cart-count]');
const status = document.querySelector('#offer-status');
const submit = form.querySelector('button[type="submit"]');
const cartNote = document.querySelector('#lamp-cart-note');
const prices = document.querySelector('#lamp-prices');
const quantity = () => Storefront.kitQuantityFor({ kitQuantity: form.elements.quantity.value });
const selectedProduct = () => Storefront.kitById(form.elements.power.value);

function renderPrice(product) {
  const count = quantity();
  const unit = orderTotals(product.price, 1);
  const order = orderTotals(product.price, count);
  document.querySelector('#lamp-price').textContent = Storefront.brl(unit.subtotal);
  document.querySelector('#lamp-pix').textContent = Storefront.brl(unit.pixTotal);
  document.querySelector('#lamp-total').hidden = count === 1;
  document.querySelector('#lamp-order-total').textContent = Storefront.brl(order.subtotal);
  document.querySelector('#lamp-order-pix').textContent = `${Storefront.brl(order.pixTotal)} no Pix`;
}

function renderOffer() {
  const product = selectedProduct();
  const cart = Storefront.getCart();
  cartCount.textContent = String(cart?.kitQuantity || 0);
  cartNote.hidden = !product || !cart || cart.id === product.id;
  prices.hidden = !product;
  submit.disabled = !product;
  status.textContent = product ? '' : 'Lâmpada indisponível no momento.';
  if (product) renderPrice(product);
}

await Storefront.loadConfig();
const options = [...form.querySelectorAll('input[name="power"]')];
for (const option of options) {
  const product = Storefront.kitById(option.value);
  option.disabled = !product;
  option.closest('label').querySelector('.variant-price').textContent = product ? Storefront.brl(product.price) : 'Indisponível';
}
const saved = Storefront.getCart();
const firstAvailable = options.find(option => !option.disabled && option.value === saved?.id) || options.find(option => !option.disabled);
if (firstAvailable) {
  firstAvailable.checked = true;
  form.elements.quantity.value = String(saved?.kitQuantity || 1);
  const product = selectedProduct();
  gallery.showImage(product.image, { ifUntouched: true });
  Storefront.track('ViewContent', product);
} else {
  options.forEach(option => { option.checked = false; });
}
renderOffer();

form.addEventListener('change', event => {
  if (event.target.name === 'power') gallery.showImage(selectedProduct()?.image);
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
