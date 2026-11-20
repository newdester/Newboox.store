const responsiveCss = document.createElement('link'); responsiveCss.rel = 'stylesheet'; responsiveCss.href = 'assets/css/responsive.css'; document.head.append(responsiveCss);
if (!window.MetaPixel && !document.querySelector('script[src*="assets/js/meta-pixel.js"]')) { const metaPixel = document.createElement('script'); metaPixel.src = '/assets/js/meta-pixel.js?v=20261124'; document.head.append(metaPixel); }

const Storefront = (() => {
  const CART = 'chefpro_cart_v1', CUSTOMER = 'chefpro_customer_v1', PAYMENT = 'chefpro_payment_v1';
  const PAYMENT_URL = '/checkout';
  let catalogUnitPrice = 149.90, catalogCashPrice = 129.90, catalogOriginalPrice = 279.90;
  const unitPrice = () => catalogUnitPrice;
  const extrasFor = () => 0;
  const totalFor = cart => Number((unitPrice(cart.id, cart.quantity) * cart.quantity + extrasFor(cart)).toFixed(2));
  const getCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem(CART));
      if (!cart) return null;
      if (cart.id !== 'toque-duplo' || !/^Toque Duplo\b/i.test(String(cart.title || ''))) {
        const migrated = { id: 'toque-duplo', title: 'Toque Duplo', image: '/assets/images/toque-duplo.webp', quantity: Math.min(10, Math.max(1, Number(cart.quantity) || 1)), price: catalogUnitPrice };
        localStorage.setItem(CART, JSON.stringify(migrated));
        return migrated;
      }
      return cart;
    } catch { return null; }
  };
  const putCart = cart => localStorage.setItem(CART, JSON.stringify(cart));
  const localeContext = async () => ({ country: 'BR', locale: 'pt-BR', language: 'pt', currency: 'BRL', rate: 1 });
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const copy = (context, key) => window.NewbooxI18n?.text?.(key, context.locale) || key;
  const applyBrand = () => { document.title = document.title.replace(/Motor Scent|MaxLar|ChefPro/g, 'Toque Duplo'); };
  const renderCart = async () => {
    const cart = getCart(), root = document.querySelector('#cartItem'); applyBrand(cart); const context = await localeContext();
    try { const config = await fetch('/api/config', { cache: 'no-store' }).then(response => response.json()); if (config.product) { catalogUnitPrice = Number(config.product.cardPrice) || catalogUnitPrice; catalogCashPrice = Number(config.product.cashPrice) || catalogCashPrice; catalogOriginalPrice = Number(config.product.originalPrice) || catalogOriginalPrice; } } catch {}
    const set = (id, value) => { const node = document.querySelector(id); if (node) node.textContent = value; };
    document.documentElement.lang = context.locale; document.title = `${copy(context, 'cart')} — Toque Duplo`;
    const localized = { '#continueShopping': 'continueShopping', '#shippingIncluded': 'included', '#cartTitle': 'yourCart', '#emptyText': 'empty', '#emptyContinue': 'continueShopping', '#summaryTitle': 'summary', '#subtotalLabel': 'subtotal', '#shippingLabel': 'shipping', '#shippingFree': 'free', '#totalLabel': 'total', '#checkoutLink': 'title', '#paymentNotice': 'paymentNotice', '#footerHome': 'home', '#footerLegal': 'privacyTerms', '#ratingText': 'reviews' };
    Object.entries(localized).forEach(([selector, key]) => set(selector, copy(context, key)));
    if (!cart || !root) { document.querySelector('#empty')?.classList.remove('hidden'); document.querySelector('#checkoutLink')?.classList.add('hidden'); set('#cartCount', '0'); return; }
    set('#cartCount', String(cart.quantity)); set('#deliveryWindow', copy(context, 'deliveryWindow')); set('#chargedNote', copy(context, 'charged')); set('#footerCurrency', `${copy(context, 'charged')} · ${context.currency}`);
    document.querySelector('#checkoutLink')?.setAttribute('href', PAYMENT_URL);
    const draw = () => { const price = unitPrice(), total = Number((price * cart.quantity).toFixed(2)); const pixTotal = Number((catalogCashPrice * cart.quantity).toFixed(2)); const title = String(cart.title || 'Toque Duplo'); root.innerHTML = `<div class="cart-line"><img src="${cart.image}" alt="${title.replace(/"/g, '&quot;')}"><div class="cart-line__content"><p class="cart-name">${title}</p><span class="cart-meta"><del>${brl(catalogOriginalPrice)}</del> · 12x de ${brl(price / 12)} sem juros</span><span class="cart-meta"><strong>${brl(catalogCashPrice)} no Pix</strong></span><div class="quantity"><button data-change="-1" aria-label="${copy(context, 'decrease')}">−</button><strong aria-live="polite">${cart.quantity}</strong><button data-change="1" aria-label="${copy(context, 'increase')}">+</button><button class="remove" data-remove>${copy(context, 'remove')}</button></div></div><b class="cart-price">${brl(total)}</b></div>`; set('#subtotal', brl(total)); set('#total', brl(total)); set('#chargedNote', `Ou ${brl(pixTotal)} à vista no Pix`); };
    root.addEventListener('click', event => { if (event.target.matches('[data-remove]')) { localStorage.removeItem(CART); location.reload(); return; } const change = Number(event.target.dataset.change); if (change) { cart.quantity = Math.max(1, Math.min(10, cart.quantity + change)); cart.price = unitPrice(cart.id, cart.quantity); putCart(cart); draw(); } }); draw();
  };
  const renderThankYou = async () => {
    let payment = JSON.parse(sessionStorage.getItem(PAYMENT) || 'null');
    const query = new URLSearchParams(location.search);
    const returnedId = query.get('payment_id') || query.get('collection_id');
    if (returnedId && /^\d+$/.test(returnedId)) {
      try {
        const response = await fetch(`/api/payment-status?paymentId=${encodeURIComponent(returnedId)}`, { cache: 'no-store' });
        if (response.ok) payment = { ...(payment || {}), ...(await response.json()) };
      } catch {}
    }
    const cart = getCart(); applyBrand(cart);
    const status = payment?.status || query.get('status') || query.get('collection_status') || 'pending';
    const title = document.querySelector('#thanksTitle');
    const copyNode = document.querySelector('#thanksCopy');
    if (status === 'approved' || status === 'paid') {
      if (title) title.textContent = 'Pagamento aprovado';
      if (copyNode) copyNode.textContent = 'Obrigado! Seu pedido foi confirmado e você receberá as atualizações por e-mail.';
      document.querySelector('#orderReference')?.replaceChildren(`Pedido ${payment?.orderId || ''} · Pagamento ${payment?.paymentId || returnedId || ''}`);
      localStorage.removeItem(CART);
      return;
    }
    if (title) title.textContent = 'Pagamento em processamento';
    if (copyNode) copyNode.textContent = 'Recebemos seu pedido. Assim que o Mercado Pago confirmar o pagamento, enviaremos a confirmação por e-mail.';
  };
  const track = (event, product, extra = {}) => { const send = () => window.MetaPixel?.track(event, { ...window.MetaPixel.content(product), ...extra }); if (window.MetaPixel) send(); else window.addEventListener('meta-pixel-ready', send, { once: true }); };
  return { CART, CUSTOMER, PAYMENT, PAYMENT_URL, brl, unitPrice, extrasFor, totalFor, getCart, putCart, applyBrand, renderCart, renderThankYou, track };
})();
