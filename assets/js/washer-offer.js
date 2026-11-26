import { Storefront } from './storefront.js?v=soarfly-5';
import { orderTotals, WASHER_VARIANTS } from './washer-catalog.js?v=soarfly-4';

const form = document.querySelector('#offer');
const variants = document.querySelector('#variants');
const quantity = form.elements.quantity;
const pricePrefix = document.querySelector('.price-prefix');
const unitPriceValue = document.querySelector('#unit-price-value');
const unitPixOffer = document.querySelector('#unit-pix-offer');
const unitPixPrice = document.querySelector('#unit-pix-price');
const installmentCopy = document.querySelector('#installment-copy');
const bivoltNote = document.querySelector('#bivolt-note');
const total = document.querySelector('#total');
const totalPix = document.querySelector('#total-pix');
const status = document.querySelector('#offer-status');
const addToCart = form.querySelector('button[type="submit"]');
const cartCount = document.querySelector('[data-cart-count]');
const currentVariant = () => Storefront.kitById(variants.querySelector('input:checked')?.value);
let baseOffer;
let deliveryEstimate = '';

const photos = [...document.querySelectorAll('[data-photo]')];
const galleryImage = document.querySelector('#gallery-image');
const photoCounter = document.querySelector('#photo-counter');
const photoFrame = galleryImage.parentElement;
let activePhoto = 0;
let touchStart;

function showPhoto(index) {
  if (index < 0 || index >= photos.length || index === activePhoto) return;
  const button = photos[index];
  galleryImage.src = '/assets/images/soarfly/' + button.dataset.photo + '.webp';
  galleryImage.alt = button.dataset.alt;
  photoCounter.textContent = (index + 1) + ' de ' + photos.length;
  photos.forEach(photo => photo.setAttribute('aria-pressed', String(photo === button)));
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

function renderVariants(products) {
  for (const product of products) {
    const label = document.createElement('label');
    label.className = 'variant';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'voltage';
    radio.value = product.id;
    radio.disabled = !product.available;
    radio.required = product.available;
    const option = document.createElement('span');
    option.className = 'variant-option';
    const title = document.createElement('span');
    title.className = 'variant-name';
    title.textContent = product.id === 'soarfly-bivolt' ? 'Bivolt' : product.voltage;
    const price = document.createElement('span');
    price.className = 'variant-price';
    price.textContent = product.available ? Storefront.brl(product.price) : 'Indisponível';
    radio.setAttribute('aria-label', product.voltage + ', ' + price.textContent);
    option.append(title, price);
    label.append(radio, option);
    variants.append(label);
  }
}

function updateTotal() {
  const variant = currentVariant();
  const offer = variant || baseOffer;
  const count = Storefront.kitQuantityFor({ kitQuantity: quantity.value });
  pricePrefix.hidden = Boolean(variant) || !offer;
  unitPriceValue.textContent = offer ? Storefront.brl(offer.price) : 'Indisponível';
  unitPixOffer.hidden = !offer;
  if (offer) unitPixPrice.textContent = Storefront.brl(orderTotals(offer.price, 1).pixTotal);
  const installments = offer?.maxInstallments || WASHER_VARIANTS[0].maxInstallments;
  const evenInstallments = variant && Math.round(variant.price * 100) % installments === 0;
  const installmentValue = evenInstallments ? ' de ' + Storefront.brl(variant.price / installments) : '';
  installmentCopy.textContent = 'Até ' + installments + 'x' + installmentValue + ' sem juros no cartão';
  installmentCopy.hidden = !offer;
  bivoltNote.hidden = variant?.id !== 'soarfly-bivolt';
  total.parentElement.hidden = !variant;
  if (variant) {
    const { subtotal, pixTotal } = orderTotals(variant.price, count);
    total.textContent = Storefront.brl(subtotal);
    totalPix.textContent = Storefront.brl(pixTotal) + ' no Pix';
  }
  totalPix.hidden = count === 1;
  addToCart.disabled = !baseOffer;
  status.textContent = '';
}

form.addEventListener('change', updateTotal);
form.addEventListener('submit', event => {
  event.preventDefault();
  const variant = currentVariant();
  if (!variant || addToCart.disabled) return;
  const count = Storefront.kitQuantityFor({ kitQuantity: quantity.value });
  const cart = { ...variant, kitQuantity: count, shippingService: 'standard', deliveryEstimate };
  try {
    Storefront.putCart(cart);
    addToCart.disabled = true;
    Storefront.track('AddToCart', cart, { num_items: count, contents: [{ id: variant.id, quantity: count, item_price: variant.price }] });
    location.assign('/cart');
  } catch {
    addToCart.disabled = false;
    status.textContent = 'O navegador não conseguiu salvar a seleção. Abra a loja no navegador e tente novamente.';
  }
});

const catalog = await Storefront.loadConfig();
const products = catalog.kits?.some(product => product.id === WASHER_VARIANTS[0].id) ? catalog.kits : WASHER_VARIANTS;
baseOffer = products.filter(product => product.available).sort((left, right) => left.price - right.price)[0];
renderVariants(products);
updateTotal();
const updateCartCount = () => { cartCount.textContent = String(Storefront.getCart()?.kitQuantity || 0); };
updateCartCount();
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    updateCartCount();
    updateTotal();
  }
});
if (baseOffer) Storefront.track('ViewContent', baseOffer);

fetch('/api/locale').then(response => response.json()).then(place => {
  if (place.country !== 'BR' || !place.city) return;
  const dateAfter = days => {
    const date = new Date();
    while (days > 0) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) days -= 1;
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
  };
  deliveryEstimate = 'Previsão para ' + place.city + ': ' + dateAfter(8) + ' a ' + dateAfter(12);
  document.querySelector('#delivery').textContent = deliveryEstimate + '. SEDEX no checkout.';
}).catch(() => {});
