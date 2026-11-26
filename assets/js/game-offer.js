import { Storefront } from './storefront.js?v=shop-1';
import { GAME_PRODUCT } from './product-catalog.js?v=1';
import { orderTotals } from './washer-catalog.js?v=soarfly-4';

const form = document.querySelector('#game-offer');
const quantity = form.elements.quantity;
const submit = form.querySelector('button[type="submit"]');
const status = document.querySelector('#offer-status');
const photos = [...document.querySelectorAll('.gallery-thumb[data-photo]')];
const image = document.querySelector('#gallery-image');
const counter = document.querySelector('#photo-counter');
const photoFrame = image.parentElement;
const cartCount = document.querySelector('[data-cart-count]');
let activePhoto = 0;
let touchStart;

const brazilianTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});
const countdown = document.querySelector('#black-friday-countdown');
const updateCountdown = () => {
  const [hour, minute, second] = brazilianTime.format(new Date()).split(':').map(Number);
  const secondsLeft = 24 * 3600 - (hour * 3600 + minute * 60 + second);
  countdown.textContent = [
    Math.floor(secondsLeft / 3600),
    Math.floor(secondsLeft % 3600 / 60),
    secondsLeft % 60
  ].map(value => String(value).padStart(2, '0')).join(':');
};
updateCountdown();
countdown.hidden = false;
setInterval(updateCountdown, 1000);

function showPhoto(index) {
  if (index < 0 || index >= photos.length || index === activePhoto) return;
  const photo = photos[index];
  image.src = photo.dataset.photo;
  image.alt = photo.dataset.alt;
  counter.textContent = `${index + 1} de ${photos.length}`;
  photos.forEach(button => button.setAttribute('aria-pressed', String(button === photo)));
  activePhoto = index;
}

photos.forEach((button, index) => button.addEventListener('click', () => showPhoto(index)));
photoFrame.addEventListener('touchstart', event => {
  touchStart = event.touches.length === 1 ? event.touches[0] : null;
}, { passive: true });
photoFrame.addEventListener('touchend', event => {
  if (!touchStart || event.touches.length) return;
  const { clientX, clientY } = event.changedTouches[0];
  const horizontal = clientX - touchStart.clientX;
  const vertical = clientY - touchStart.clientY;
  touchStart = null;
  if (Math.abs(horizontal) > Math.max(40, Math.abs(vertical))) showPhoto(activePhoto - Math.sign(horizontal));
}, { passive: true });
photoFrame.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

await Storefront.loadConfig();
const product = Storefront.kitById(GAME_PRODUCT.id);
const updateCart = () => {
  const cart = Storefront.getCart();
  cartCount.textContent = String(cart?.kitQuantity || 0);
  document.querySelector('#game-cart-note').hidden = !cart || cart.id === GAME_PRODUCT.id;
};

if (product) {
  document.querySelector('#game-price').textContent = Storefront.brl(product.price);
  document.querySelector('#game-pix').textContent = Storefront.brl(orderTotals(product.price, 1).pixTotal);
  document.querySelector('#game-installments').textContent = `Até ${product.maxInstallments}x sem juros no cartão`;
  submit.disabled = false;
  Storefront.track('ViewContent', product);
} else {
  status.textContent = 'O Game R36S está indisponível no momento.';
}
updateCart();

quantity.addEventListener('change', () => {
  if (!product) return;
  const count = Storefront.kitQuantityFor({ kitQuantity: quantity.value });
  const { subtotal, pixTotal } = orderTotals(product.price, count);
  document.querySelector('#game-total').hidden = count === 1;
  document.querySelector('#game-order-total').textContent = Storefront.brl(subtotal);
  document.querySelector('#game-order-pix').textContent = `${Storefront.brl(pixTotal)} no Pix`;
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

fetch('/api/locale').then(response => response.json()).then(place => {
  if (place.country !== 'BR' || !place.city) return;
  const futureDate = days => {
    const date = new Date();
    while (days > 0) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) days -= 1;
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
  };
  document.querySelector('#delivery').textContent = `Previsão para ${place.city}: ${futureDate(8)} a ${futureDate(12)}. SEDEX no checkout.`;
}).catch(() => {});

window.addEventListener('pageshow', event => {
  if (!event.persisted || !product) return;
  updateCart();
  submit.disabled = false;
});
