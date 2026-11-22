const responsiveCss = document.createElement('link');
responsiveCss.rel = 'stylesheet';
responsiveCss.href = '/assets/css/responsive.css';
document.head.append(responsiveCss);
if (!window.MetaPixel && !document.querySelector('script[src*="assets/js/meta-pixel.js"]')) {
  const metaPixel = document.createElement('script');
  metaPixel.src = '/assets/js/meta-pixel.js?v=20261122-server-pageview';
  document.head.append(metaPixel);
}

const Storefront = (() => {
  const CART = 'chefpro_cart_v1';
  const CUSTOMER = 'chefpro_customer_v1';
  const PAYMENT = 'chefpro_payment_v1';
  const PAYMENT_URL = '/checkout';
  const SEDEX_RATE = 12.36;
  const defaultKits = [
    { id: 'toyadent-1', units: 1, title: 'TOYADENT · Kit com 1 unidade', price: 22.90, originalPrice: 37.20 },
    { id: 'toyadent-2', units: 2, title: 'TOYADENT · Kit com 2 unidades', price: 39.90, originalPrice: 74.40 },
    { id: 'toyadent-3', units: 3, title: 'TOYADENT · Kit com 3 unidades', price: 44.90, originalPrice: 111.60 }
  ];
  let kits = defaultKits;
  const image = '/assets/images/toyadent/hero.webp';
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const kitById = id => kits.find(kit => kit.id === id) || kits[2];
  const unitPrice = id => kitById(id).price;
  const kitQuantityFor = cart => Math.min(10, Math.max(1, Number.parseInt(cart?.kitQuantity, 10) || 1));
  const subtotalFor = cart => Number((kitById(cart?.id).price * kitQuantityFor(cart)).toFixed(2));
  const shippingServiceFor = cart => cart?.shippingService === 'sedex' ? 'sedex' : 'standard';
  const extrasFor = cart => shippingServiceFor(cart) === 'sedex' ? SEDEX_RATE : 0;
  const totalFor = cart => {
    return Number((subtotalFor(cart) + extrasFor(cart)).toFixed(2));
  };

  const getCart = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(CART));
      if (stored && /^toyadent-[123]$/.test(String(stored.id))) return { ...stored, kitQuantity: kitQuantityFor(stored), shippingService: shippingServiceFor(stored), image };
      if (!stored) return null;
      const migrated = { ...defaultKits[2], image, kitQuantity: 1, shippingService: 'standard', currency: 'BRL' };
      localStorage.setItem(CART, JSON.stringify(migrated));
      return migrated;
    } catch {
      return null;
    }
  };
  const putCart = cart => localStorage.setItem(CART, JSON.stringify({ ...cart, kitQuantity: kitQuantityFor(cart), shippingService: shippingServiceFor(cart) }));
  const applyBrand = () => {
    document.title = document.title.replace(/Toque Duplo|Motor Scent|MaxLar|ChefPro/g, 'TOYADENT');
  };

  async function loadConfig() {
    try {
      const config = await fetch('/api/config', { cache: 'no-store' }).then(response => response.json());
      if (Array.isArray(config.kits) && config.kits.length === 3) kits = config.kits;
      return config;
    } catch {
      return { product: defaultKits[0], kits };
    }
  }

  const renderCart = async () => {
    let cart = getCart();
    const root = document.querySelector('#cartItem');
    applyBrand();
    await loadConfig();
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };
    document.documentElement.lang = 'pt-BR';
    document.title = 'Carrinho — TOYADENT';
    set('#continueShopping', 'Continuar comprando');
    set('#shippingIncluded', 'Frete grátis · 8 a 12 dias úteis');
    set('#cartTitle', 'Seu carrinho');
    set('#summaryTitle', 'Resumo do pedido');
    set('#subtotalLabel', 'Produtos');
    set('#shippingLabel', 'Frete');
    set('#totalLabel', 'Total');
    set('#paymentNotice', 'Pagamento protegido pelo Mercado Pago. Cartão, Pix ou saldo Mercado Pago.');
    set('#footerHome', 'Início');
    set('#footerLegal', 'Privacidade · Termos');
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
    const shipping = extrasFor(cart);
    set('#cartCount', String(totalUnits));
    set('#deliveryWindow', cart.shippingService === 'sedex' ? 'SEDEX · 2 a 3 dias úteis' : (cart.deliveryEstimate || 'Entrega padrão grátis · 8 a 12 dias úteis'));
    set('#footerCurrency', 'Pagamento processado em BRL');
    document.querySelector('#checkoutLink')?.setAttribute('href', PAYMENT_URL);
    root.innerHTML = `<div class="cart-line"><img src="${image}" alt="TOYADENT"><div class="cart-line__content"><p class="cart-name">${kit.title}</p><span class="cart-meta">${totalUnits} ${totalUnits === 1 ? 'unidade' : 'unidades'} de 90g</span><span class="cart-meta">${cart.shippingService === 'sedex' ? 'SEDEX · 2 a 3 dias úteis' : (cart.deliveryEstimate || 'Entrega padrão grátis · 8 a 12 dias úteis')}</span><div class="cart-quantity" aria-label="Quantidade de kits"><button type="button" data-decrease aria-label="Diminuir quantidade">−</button><strong>${cart.kitQuantity}</strong><button type="button" data-increase aria-label="Aumentar quantidade">+</button></div><button class="remove" data-remove>Remover</button></div><b class="cart-price">${brl(subtotal)}</b></div>`;
    set('#subtotal', brl(subtotal));
    set('#shippingFree', shipping ? brl(shipping) : 'GRÁTIS');
    set('#total', brl(totalFor(cart)));
    set('#chargedNote', cart.deliveryEstimate || 'Prazo calculado conforme o CEP informado');
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
    const returnedId = query.get('payment_id') || query.get('collection_id');
    if (returnedId && /^\d+$/.test(returnedId)) {
      try {
        const response = await fetch(`/api/payment-status?paymentId=${encodeURIComponent(returnedId)}`, { cache: 'no-store' });
        if (response.ok) payment = { ...(payment || {}), ...(await response.json()) };
      } catch {}
    }
    const status = payment?.status || query.get('status') || query.get('collection_status') || 'pending';
    const title = document.querySelector('#thanksTitle');
    const copyNode = document.querySelector('#thanksCopy');
    applyBrand();
    if (status === 'approved' || status === 'paid') {
      if (title) title.textContent = 'Pagamento aprovado';
      if (copyNode) copyNode.textContent = 'Obrigado! Seu pedido TOYADENT foi confirmado e seguirá pelos Correios.';
      document.querySelector('#orderReference')?.replaceChildren(`Pedido ${payment?.orderId || ''} · Pagamento ${payment?.paymentId || returnedId || ''}`);
      const paymentId = payment?.paymentId || returnedId;
      if (paymentId) track('Purchase', getCart() || kitById('toyadent-1'), { value: Number(payment?.amount) || totalFor(getCart()), currency: 'BRL', order_id: payment?.orderId || '' }, `mp_payment_${paymentId}`);
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

  return { CART, CUSTOMER, PAYMENT, PAYMENT_URL, brl, unitPrice, shippingServiceFor, extrasFor, subtotalFor, totalFor, kitQuantityFor, getCart, putCart, applyBrand, loadConfig, kitById, renderCart, renderThankYou, track };
})();
