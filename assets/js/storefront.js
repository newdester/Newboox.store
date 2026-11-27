import { orderTotals } from './washer-catalog.js?v=soarfly-4';
import { STORE_PRODUCTS } from './product-catalog.js?v=3';
import { bindOfferLinks, currentOffer, legacyCartKey, offerForProduct, offerUrl, savedCartOffer } from './offer-context.js?v=2';

const responsiveCss = document.createElement('link');
responsiveCss.rel = 'stylesheet';
responsiveCss.href = '/assets/css/responsive.css';
document.head.append(responsiveCss);
if (!window.MetaPixel && !document.querySelector('script[src*="assets/js/meta-pixel.js"]')) {
  const metaPixel = document.createElement('script');
  metaPixel.src = '/assets/js/meta-pixel.js?v=20261126-game';
  document.head.append(metaPixel);
}

export const Storefront = (() => {
  const offer = currentOffer();
  bindOfferLinks(offer);
  const CART = `${legacyCartKey}:${offer}`;
  const CUSTOMER = 'chefpro_customer_v1';
  const legacyPaymentKey = 'chefpro_payment_v1';
  const PAYMENT = `${legacyPaymentKey}:${offer}`;
  const paymentPath = route => offerUrl(route, offer);
  const CART_URL = paymentPath('/cart');
  const PAYMENT_URL = paymentPath('/checkout');
  const SEDEX_RATE = 12.36;
  let kits = STORE_PRODUCTS;
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const kitById = id => kits.find(kit => kit.id === id && kit.available);
  const unitPrice = id => kitById(id)?.price ?? 0;
  const kitQuantityFor = cart => Math.min(10, Math.max(1, Number.parseInt(cart?.kitQuantity, 10) || 1));
  const shippingServiceFor = cart => cart?.shippingService === 'sedex' ? 'sedex' : 'standard';
  const extrasFor = cart => shippingServiceFor(cart) === 'sedex' ? SEDEX_RATE : 0;
  const totalsFor = cart => orderTotals(unitPrice(cart?.id), kitQuantityFor(cart), extrasFor(cart));
  const totalFor = cart => totalsFor(cart).total;

  const legacyCart = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(legacyCartKey));
      return savedCartOffer(stored) === offer ? stored : null;
    } catch {
      return null;
    }
  };
  const removeLegacyCart = () => {
    if (legacyCart()) localStorage.removeItem(legacyCartKey);
  };
  const clearCart = () => {
    localStorage.removeItem(CART);
    removeLegacyCart();
  };
  const getCart = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(CART)) ?? legacyCart();
      const product = kitById(stored?.id);
      if (!product || offerForProduct(product) !== offer) return null;
      const checkoutId = /^[A-Za-z0-9-]{20,60}$/.test(stored.checkoutId || '') ? stored.checkoutId : '';
      return { ...product, checkoutId, kitQuantity: kitQuantityFor(stored), shippingService: shippingServiceFor(stored), deliveryEstimate: String(stored.deliveryEstimate || '') };
    } catch {
      return null;
    }
  };
  const putCart = cart => {
    cart.checkoutId ||= window.crypto?.randomUUID?.()
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CART, JSON.stringify({ ...cart, kitQuantity: kitQuantityFor(cart), shippingService: shippingServiceFor(cart) }));
    removeLegacyCart();
  };
  async function loadConfig() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/config', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Falha ao consultar o catálogo.');
      const config = await response.json();
      if (Array.isArray(config.kits) && config.kits.some(product => product.id === STORE_PRODUCTS[0].id)) {
        kits = config.kits.map(product => ({ ...STORE_PRODUCTS.find(item => item.id === product.id), ...product }));
      }
      return config;
    } catch {
      return { product: STORE_PRODUCTS[0], kits };
    } finally {
      clearTimeout(timeout);
    }
  }

  const renderCart = async () => {
    const root = document.querySelector('#cartItem');
    await loadConfig();
    const cart = getCart();
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };
    document.documentElement.lang = 'pt-BR';
    document.title = 'Carrinho — Newboox';
    set('#continueShopping', 'Continuar comprando');
    set('#cartTitle', 'Seu carrinho');
    set('#summaryTitle', 'Resumo do pedido');
    set('#subtotalLabel', 'Produtos');
    set('#shippingLabel', 'Frete e prazo');
    set('#totalLabel', 'Total dos produtos');
    if (!cart || !root) {
      document.querySelector('#empty')?.classList.remove('hidden');
      document.querySelector('#checkoutLink')?.classList.add('hidden');
      set('#cartCount', '0');
      return;
    }
    const kit = kitById(cart.id);
    putCart(cart);
    const totalUnits = kit.units * cart.kitQuantity;
    const { subtotal, pixTotal } = totalsFor({ ...cart, shippingService: 'standard' });
    set('#cartCount', String(totalUnits));
    const checkoutLink = document.querySelector('#checkoutLink');
    checkoutLink?.setAttribute('href', PAYMENT_URL);
    checkoutLink?.classList.remove('hidden');
    root.innerHTML = `<div class="cart-line"><img src="${kit.image}" alt=""><div class="cart-line__content"><p class="cart-name">${kit.title}</p><span class="cart-meta">${totalUnits} ${totalUnits === 1 ? 'unidade' : 'unidades'} · ${brl(kit.price)} por unidade</span><div class="cart-quantity" aria-label="Quantidade"><button type="button" data-decrease aria-label="Diminuir quantidade">−</button><strong>${cart.kitQuantity}</strong><button type="button" data-increase aria-label="Aumentar quantidade">+</button></div><button class="remove" data-remove>Remover</button></div><b class="cart-price">${brl(subtotal)}</b></div>`;
    set('#subtotal', brl(subtotal));
    set('#shippingFree', 'No checkout');
    set('#total', brl(subtotal));
    set('#cartPixTotal', brl(pixTotal));
    document.querySelector('#cartPixOffer')?.classList.remove('hidden');
    set('#chargedNote', 'Confira as opções de entrega após informar o CEP.');
    root.querySelector('[data-remove]')?.addEventListener('click', () => {
      clearCart();
      location.reload();
    });
    const changeQuantity = delta => {
      const next = kitQuantityFor({ kitQuantity: cart.kitQuantity + delta });
      if (next === cart.kitQuantity) return;
      cart.checkoutId = '';
      cart.kitQuantity = next;
      putCart(cart);
      renderCart();
    };
    root.querySelector('[data-decrease]')?.addEventListener('click', () => changeQuantity(-1));
    root.querySelector('[data-increase]')?.addEventListener('click', () => changeQuantity(1));
  };

  const renderThankYou = async () => {
    const query = new URLSearchParams(location.search);
    const gatewayId = query.get('payment_id') || query.get('collection_id');
    let payment = null;
    try {
      let saved = sessionStorage.getItem(PAYMENT);
      if (!saved && !query.has('oferta') && legacyCart()) saved = sessionStorage.getItem(legacyPaymentKey);
      payment = JSON.parse(saved);
    } catch {}
    if (gatewayId && String(payment?.paymentId) !== gatewayId) payment = null;
    const returnedId = gatewayId || payment?.paymentId;
    if (returnedId && /^\d+$/.test(returnedId)) {
      try {
        const response = await fetch(`/api/payment-status?paymentId=${encodeURIComponent(returnedId)}`, { cache: 'no-store' });
        if (response.ok) payment = { ...(payment || {}), ...(await response.json()) };
      } catch {}
    }
    const status = payment?.status || 'pending';
    const title = document.querySelector('#thanksTitle');
    const copyNode = document.querySelector('#thanksCopy');
    if (status === 'approved' || status === 'paid') {
      if (title) title.textContent = 'Pagamento aprovado';
      if (copyNode) copyNode.textContent = 'Obrigado! Seu pedido foi confirmado e seguirá pelos Correios.';
      document.querySelector('#orderReference')?.replaceChildren(`Pedido ${payment?.orderId || ''} · Pagamento ${payment?.paymentId || returnedId || ''}`);
      const paymentId = payment?.paymentId || returnedId;
      if (paymentId && getCart()) track('Purchase', getCart(), { value: Number(payment?.amount) || totalFor(getCart()), currency: 'BRL', order_id: payment?.orderId || '' }, `mp_payment_${paymentId}`);
      if (paymentId) clearCart();
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

  return { CART_URL, CUSTOMER, PAYMENT, paymentPath, brl, unitPrice, shippingServiceFor, extrasFor, totalFor, totalsFor, kitQuantityFor, getCart, putCart, loadConfig, kitById, renderCart, renderThankYou, track };
})();
