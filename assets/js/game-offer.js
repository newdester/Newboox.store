import { Storefront } from './storefront.js?v=editorial-2';
import { GAME_VARIANTS } from './product-catalog.js?v=2';
import { orderTotals, PIX_DISCOUNT_PERCENT } from './washer-catalog.js?v=soarfly-4';
import { setupGallery } from './product-page.js?v=2';

const gallery = setupGallery();
const form = document.querySelector('#game-offer');
const options = document.querySelector('#game-colors');
const submit = form.querySelector('button[type="submit"]');
const status = document.querySelector('#offer-status');
const cartCount = document.querySelector('[data-cart-count]');
const prices = document.querySelector('#game-prices');
const comparison = document.querySelector('#game-comparison');
const finalPrice = document.querySelector('#game-final-price');
const finalLink = document.querySelector('#game-final-link');
const { pixCents, cardCents } = comparison.dataset;
const percentage = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const currentProduct = () => Storefront.kitById(form.elements.color?.value);
const currentCount = () => Storefront.kitQuantityFor({ kitQuantity: form.elements.quantity.value });

await Storefront.loadConfig();
const available = GAME_VARIANTS.map(variant => Storefront.kitById(variant.id)).filter(Boolean);
const cart = Storefront.getCart();
const initialVariant = available.find(variant => variant.id === cart?.id) || available[0];
for (const variant of GAME_VARIANTS) {
  const product = available.find(item => item.id === variant.id);
  const label = document.createElement('label');
  label.className = 'variant';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'color';
  radio.value = variant.id;
  radio.disabled = !product;
  radio.checked = initialVariant?.id === variant.id;
  const option = document.createElement('span');
  option.className = 'variant-option variant-option--image';
  const thumbnail = document.createElement('img');
  thumbnail.src = variant.image.replace(/\.webp$/, '-mini.webp');
  thumbnail.alt = '';
  thumbnail.width = 40;
  thumbnail.height = 40;
  const name = document.createElement('span');
  name.className = 'variant-name';
  name.textContent = product ? variant.color : `${variant.color} · indisponível`;
  option.append(thumbnail, name);
  label.append(radio, option);
  options.append(label);
}

function updateComparison(count, subtotal, pixTotal) {
  const pixReference = Number(pixCents) * count;
  const cardReference = Number(cardCents) * count;
  const pixSavings = pixReference - Math.round(pixTotal * 100);
  const cardSavings = cardReference - Math.round(subtotal * 100);
  comparison.hidden = !(pixSavings > 0);
  if (comparison.hidden) return;
  const units = `${count} ${count === 1 ? 'unidade' : 'unidades'}`;
  document.querySelector('#game-pix-saving').textContent = `${Storefront.brl(pixSavings / 100)} a menos no Pix`;
  document.querySelector('#game-pix-rate').textContent = `${percentage.format(pixSavings / pixReference)} menor`;
  document.querySelector('#game-comparison-quantity').textContent = `${units} · veja a referência`;
  const cardComparison = document.querySelector('#game-card-saving');
  cardComparison.hidden = !(cardSavings > 0);
  if (!cardComparison.hidden) {
    const rate = percentage.format(cardSavings / cardReference);
    cardComparison.textContent = `No cartão, a diferença é de ${Storefront.brl(cardSavings / 100)} (${rate}) para ${units}.`;
  }
}

function updateOffer() {
  const product = currentProduct();
  const savedCart = Storefront.getCart();
  cartCount.textContent = String(savedCart?.kitQuantity || 0);
  document.querySelector('#game-cart-note').hidden = !savedCart || savedCart.id === product?.id;
  submit.disabled = !product;
  prices.hidden = !product;
  finalPrice.hidden = !product;
  finalLink.textContent = product ? 'Escolher minha cor' : 'Ver disponibilidade';
  status.textContent = product ? '' : 'O Game R36S está indisponível no momento.';
  if (!product) return;
  const count = currentCount();
  const { subtotal, pixTotal } = orderTotals(product.price, count);
  const unitPix = Storefront.brl(orderTotals(product.price, 1).pixTotal);
  document.querySelector('#game-price').textContent = Storefront.brl(product.price);
  document.querySelector('#game-pix').textContent = unitPix;
  finalPrice.textContent = `${unitPix} por unidade no Pix.`;
  document.querySelector('#game-pix-discount').textContent = `${PIX_DISCOUNT_PERCENT}% de desconto`;
  document.querySelector('#game-installments').textContent = `Até ${product.maxInstallments}x sem juros`;
  document.querySelector('#game-total').hidden = count === 1;
  document.querySelector('#game-order-total').textContent = Storefront.brl(subtotal);
  document.querySelector('#game-order-pix').textContent = `${Storefront.brl(pixTotal)} no Pix`;
  updateComparison(count, subtotal, pixTotal);
}

if (initialVariant) {
  gallery.showImage(initialVariant.image);
  Storefront.track('ViewContent', initialVariant);
}
updateOffer();

form.addEventListener('change', event => {
  if (event.target.name === 'color') gallery.showImage(currentProduct()?.image);
  updateOffer();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const product = currentProduct();
  if (!product || submit.disabled) return;
  const count = currentCount();
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
  location.assign(Storefront.CART_URL);
});

window.addEventListener('pageshow', event => {
  if (event.persisted) updateOffer();
});
