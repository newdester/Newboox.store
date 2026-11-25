import { WASHER_IMAGE, WASHER_VARIANTS } from './washer-catalog.js?v=soarfly-3';

const responsiveCss = document.createElement('link');
responsiveCss.rel = 'stylesheet';
responsiveCss.href = '/assets/css/responsive.css';
document.head.append(responsiveCss);
if (!window.MetaPixel && !document.querySelector('script[src*="assets/js/meta-pixel.js"]')) {
  const metaPixel = document.createElement('script');
  metaPixel.src = '/assets/js/meta-pixel.js?v=20261122-funnel-capi';
  document.head.append(metaPixel);
}

export const Storefront = (() => {
  const CART = 'newboox_soarfly_cart_v1';
  const CUSTOMER = 'chefpro_customer_v1';
  const PAYMENT = 'chefpro_payment_v1';
  const PAYMENT_URL = '/checkout';
  const SEDEX_RATE = 12.36;
  let kits = WASHER_VARIANTS;
  const image = WASHER_IMAGE;
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const kitById = id => kits.find(kit => kit.id === id && kit.available);
  const unitPrice = id => kitById(id)?.price ?? 0;
  const kitQuantityFor = cart => Math.min(10, Math.max(1, Number.parseInt(cart?.kitQuantity, 10) || 1));
  const subtotalFor = cart => Number((unitPrice(cart?.id) * kitQuantityFor(cart)).toFixed(2));
  const shippingServiceFor = cart => cart?.shippingService === 'sedex' ? 'sedex' : 'standard';
  const extrasFor = cart => shippingServiceFor(cart) === 'sedex' ? SEDEX_RATE : 0;
  const totalFor = cart => {
    return Number((subtotalFor(cart) + extrasFor(cart)).toFixed(2));
  };

  const getCart = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(CART));
      const variant = kitById(stored?.id);
      if (!variant) return null;
      return { ...variant, image, kitQuantity: kitQuantityFor(stored), shippingService: shippingServiceFor(stored), deliveryEstimate: String(stored.deliveryEstimate || '') };
    } catch {
      return null;
    }
  };
  const putCart = cart => localStorage.setItem(CART, JSON.stringify({ ...cart, kitQuantity: kitQuantityFor(cart), shippingService: shippingServiceFor(cart) }));
  async function loadConfig() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/config', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Falha ao consultar o catálogo.');
      const config = await response.json();
      if (Array.isArray(config.kits) && config.kits.some(product => product.id === WASHER_VARIANTS[0].id)) kits = config.kits;
      return config;
    } catch {
      return { product: WASHER_VARIANTS[0], kits };
    } finally {
      clearTimeout(timeout);
    }
  }

  const renderCart = async () => {
    const root = document.querySelector('#cartItem');
    await loadConfig();
    let cart = getCart();
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };
    document.documentElement.lang = 'pt-BR';
    document.title = 'Carrinho — Newboox';
    set('#continueShopping', 'Continuar comprando');
    set('#shippingIncluded', 'Frete grátis · 8 a 12 dias úteis');
    set('#cartTitle', 'Seu carrinho');
    set('#summaryTitle', 'Resumo do pedido');
    set('#subtotalLabel', 'Produtos');
    set('#shippingLabel', 'Entrega padrão');
    set('#totalLabel', 'Total com entrega padrão');
    if (!cart || !root) {
      document.querySelector('#empty')?.classList.remove('hidden');
      document.querySelector('#checkoutLink')?.classList.add('hidden');
      set('#cartCount', '0');
      return;
    }
    const kit = kitById(cart.id);
    cart = { ...cart, ...kit, image, kitQuantity: kitQuantityFor(cart), shippingService: shippingServiceFor(cart), currency: 'BRL' };
    putCart(cart);
    const totalUnits = kit.units * cart.kitQuantity;
    const subtotal = subtotalFor(cart);
    const standardEstimate = cart.shippingService === 'standard' && cart.deliveryEstimate
      ? cart.deliveryEstimate
      : 'Entrega padrão grátis · 8 a 12 dias úteis';
    set('#cartCount', String(totalUnits));
    set('#deliveryWindow', standardEstimate);
    document.querySelector('#checkoutLink')?.setAttribute('href', PAYMENT_URL);
    root.innerHTML = `<div class="cart-line"><img src="${image}" alt="Lavadora SOARFLY"><div class="cart-line__content"><p class="cart-name">${kit.title}</p><span class="cart-meta">${totalUnits} ${totalUnits === 1 ? 'unidade' : 'unidades'} · ${brl(kit.price)} por unidade</span><div class="cart-quantity" aria-label="Quantidade"><button type="button" data-decrease aria-label="Diminuir quantidade">−</button><strong>${cart.kitQuantity}</strong><button type="button" data-increase aria-label="Aumentar quantidade">+</button></div><button class="remove" data-remove>Remover</button></div><b class="cart-price">${brl(subtotal)}</b></div>`;
    set('#subtotal', brl(subtotal));
    set('#shippingFree', 'GRÁTIS');
    set('#total', brl(subtotal));
    set('#chargedNote', 'Consulte e escolha o frete expresso no checkout.');
    root.querySelector('[data-remove]')?.addEventListener('click', () => {
      localStorage.removeItem(CART);
      location.reload();
    });
    root.querySelector('[data-decrease]')?.addEventListener('click', () => { cart.kitQuantity = Math.max(1, cart.kitQuantity - 1); putCart(cart); renderCart(); });
    root.querySelector('[data-increase]')?.addEventListener('click', () => { cart.kitQuantity = Math.min(10, cart.kitQuantity + 1); putCart(cart); renderCart(); });
  };

  const renderThankYou = async () => {
    let payment = JSON.parse(sessionStorage.getItem(PAYMENT) || 'null');
    const query = new URLSearchParams(location.search);
    const returnedId = query.get('payment_id') || query.get('collection_id') || payment?.paymentId;
    if (returnedId && /^\d+$/.test(returnedId)) {
      try {
        const response = await fetch(`/api/payment-status?paymentId=${encodeURIComponent(returnedId)}`, { cache: 'no-store' });
        if (response.ok) payment = { ...(payment || {}), ...(await response.json()) };
      } catch {}
    }
    const status = payment?.status || query.get('status') || query.get('collection_status') || 'pending';
    const title = document.querySelector('#thanksTitle');
    const copyNode = document.querySelector('#thanksCopy');
    if (status === 'approved' || status === 'paid') {
      if (title) title.textContent = 'Pagamento aprovado';
      if (copyNode) copyNode.textContent = 'Obrigado! Seu pedido foi confirmado e seguirá pelos Correios.';
      document.querySelector('#orderReference')?.replaceChildren(`Pedido ${payment?.orderId || ''} · Pagamento ${payment?.paymentId || returnedId || ''}`);
      const paymentId = payment?.paymentId || returnedId;
      if (paymentId && getCart()) track('Purchase', getCart(), { value: Number(payment?.amount) || totalFor(getCart()), currency: 'BRL', order_id: payment?.orderId || '' }, `mp_payment_${paymentId}`);
      localStorage.removeItem(CART);
      return;
    }
    if (title) title.textContent = 'Pagamento em processamento';
    if (copyNode) copyNode.textContent = 'Recebemos seu pedido. Assim que o Mercado Pago confirmar, enviaremos a confirmação por e-mail.';
  };

  const track = (event, product, extra = {}, eventId) => {
    const normalized = { ...product, currency: 'BRL', price: totalFor(product) };
    const send = () => window.MetaPixel?.track(event, { ...window.MetaPixel.content(normalized), ...extra }, eventId);
    if (window.MetaPixel) send();
    else window.addEventListener('meta-pixel-ready', send, { once: true });
  };

  return { CART, CUSTOMER, PAYMENT, PAYMENT_URL, brl, unitPrice, shippingServiceFor, extrasFor, subtotalFor, totalFor, kitQuantityFor, getCart, putCart, loadConfig, kitById, renderCart, renderThankYou, track };
})();
