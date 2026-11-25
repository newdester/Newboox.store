import { Storefront } from './storefront.js?v=soarfly-1';
import { WASHER_VARIANTS } from './washer-catalog.js';

const form = document.querySelector('#offer');
const variants = document.querySelector('#variants');
const quantity = document.querySelector('#quantity');
const total = document.querySelector('#total');
const status = document.querySelector('#offer-status');
const actions = form.querySelectorAll('button[type="submit"]');
const currentVariant = () => Storefront.kitById(new FormData(form).get('voltage'));
let deliveryEstimate = '';

function renderVariants(products) {
  for (const product of products) {
    const label = document.createElement('label');
    label.className = 'variant';
    const title = document.createElement('span');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'voltage';
    radio.value = product.id;
    radio.disabled = !product.available;
    radio.required = product.available;
    title.append(radio, product.voltage);
    const price = document.createElement('strong');
    price.textContent = Storefront.brl(product.price);
    label.append(title, price);
    if (!product.available) {
      const unavailable = document.createElement('small');
      unavailable.textContent = 'Indisponível';
      label.append(unavailable);
    }
    variants.append(label);
  }
}

function updateTotal() {
  const variant = currentVariant();
  const count = Storefront.kitQuantityFor({ kitQuantity: quantity.value });
  total.textContent = variant ? Storefront.brl(Storefront.subtotalFor({ ...variant, kitQuantity: count })) : 'Escolha uma voltagem';
  actions.forEach(button => { button.disabled = !variant; });
  status.textContent = '';
}

form.addEventListener('change', updateTotal);
form.addEventListener('submit', event => {
  event.preventDefault();
  const variant = currentVariant();
  if (!variant) return;
  const count = Storefront.kitQuantityFor({ kitQuantity: quantity.value });
  const cart = { ...variant, kitQuantity: count, shippingService: 'standard', deliveryEstimate };
  try {
    Storefront.putCart(cart);
    Storefront.track('AddToCart', cart, { num_items: count, contents: [{ id: variant.id, quantity: count, item_price: variant.price }] });
    location.assign(event.submitter?.value === '/cart' ? '/cart' : '/checkout');
  } catch {
    status.textContent = 'O navegador não conseguiu salvar a seleção. Abra a loja no navegador e tente novamente.';
  }
});

const catalog = await Storefront.loadConfig();
const products = catalog.kits?.some(product => product.id === WASHER_VARIANTS[0].id) ? catalog.kits : WASHER_VARIANTS;
renderVariants(products);
updateTotal();
const savedCart = Storefront.getCart();
document.querySelector('[data-cart-count]').textContent = String(savedCart?.kitQuantity || 0);
const firstAvailable = products.find(product => product.available);
if (firstAvailable) Storefront.track('ViewContent', firstAvailable);

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
  document.querySelector('#delivery').textContent = deliveryEstimate + '. Entrega padrão grátis.';
}).catch(() => {});
