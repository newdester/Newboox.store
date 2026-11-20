const responsiveCss = document.createElement('link');
responsiveCss.rel = 'stylesheet';
responsiveCss.href = '/assets/css/responsive.css';
document.head.append(responsiveCss);
if (!window.MetaPixel && !document.querySelector('script[src*="assets/js/meta-pixel.js"]')) {
  const metaPixel = document.createElement('script');
  metaPixel.src = '/assets/js/meta-pixel.js?v=20261124';
  document.head.append(metaPixel);
}

const Storefront = (() => {
  const CART = 'chefpro_cart_v1';
  const CUSTOMER = 'chefpro_customer_v1';
  const PAYMENT = 'chefpro_payment_v1';
  const PAYMENT_URL = '/checkout';
  const defaultKits = [
    { id: 'toyadent-1', units: 1, title: 'TOYADENT · Kit com 1 unidade', price: 22.90, shipping: 9.32 },
    { id: 'toyadent-2', units: 2, title: 'TOYADENT · Kit com 2 unidades', price: 39.90, shipping: 9.32 },
    { id: 'toyadent-3', units: 3, title: 'TOYADENT · Kit com 3 unidades', price: 49.90, shipping: 0 }
  ];
  let kits = defaultKits;
  const image = '/assets/images/toyadent/hero.webp';
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const kitById = id => kits.find(kit => kit.id === id) || kits[2];
  const unitPrice = id => kitById(id).price;
  const extrasFor = cart => kitById(cart?.id).shipping;
  const totalFor = cart => {
    const kit = kitById(cart?.id);
    return Number((kit.price + kit.shipping).toFixed(2));
  };

  const getCart = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(CART));
      if (stored && /^toyadent-[123]$/.test(String(stored.id))) return { ...stored, quantity: 1, image };
      if (!stored) return null;
      const migrated = { ...defaultKits[2], image, quantity: 1, currency: 'BRL' };
      localStorage.setItem(CART, JSON.stringify(migrated));
      return migrated;
    } catch {
      return null;
    }
  };
  const putCart = cart => localStorage.setItem(CART, JSON.stringify({ ...cart, quantity: 1 }));
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
    set('#shippingIncluded', 'Entrega Loggi em 3 a 5 dias úteis');
    set('#cartTitle', 'Seu carrinho');
    set('#summaryTitle', 'Resumo do pedido');
    set('#subtotalLabel', 'Produtos');
    set('#shippingLabel', 'Frete Loggi');
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
    cart = { ...kit, image, quantity: 1, currency: 'BRL' };
    putCart(cart);
    set('#cartCount', String(kit.units));
    set('#deliveryWindow', 'Entrega estimada em 3 a 5 dias úteis via Loggi');
    set('#footerCurrency', 'Pagamento processado em BRL');
    document.querySelector('#checkoutLink')?.setAttribute('href', PAYMENT_URL);
    root.innerHTML = `<div class="cart-line"><img src="${image}" alt="TOYADENT"><div class="cart-line__content"><p class="cart-name">${kit.title}</p><span class="cart-meta">${kit.units} ${kit.units === 1 ? 'unidade' : 'unidades'} de 90g</span><span class="cart-meta">Entrega Loggi em 3 a 5 dias úteis</span><button class="remove" data-remove>Remover</button></div><b class="cart-price">${brl(kit.price)}</b></div>`;
    set('#subtotal', brl(kit.price));
    set('#shippingFree', kit.shipping ? brl(kit.shipping) : 'GRÁTIS');
    set('#total', brl(kit.price + kit.shipping));
    set('#chargedNote', kit.shipping ? 'Frete fixo calculado para todo o Brasil' : 'Kit com 3 unidades: frete grátis');
    root.querySelector('[data-remove]')?.addEventListener('click', () => {
      localStorage.removeItem(CART);
      location.reload();
    });
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
      if (copyNode) copyNode.textContent = 'Obrigado! Seu pedido TOYADENT foi confirmado e será enviado pela Loggi.';
      document.querySelector('#orderReference')?.replaceChildren(`Pedido ${payment?.orderId || ''} · Pagamento ${payment?.paymentId || returnedId || ''}`);
      localStorage.removeItem(CART);
      return;
    }
    if (title) title.textContent = 'Pagamento em processamento';
    if (copyNode) copyNode.textContent = 'Recebemos seu pedido. Assim que o Mercado Pago confirmar, enviaremos a confirmação por e-mail.';
  };

  const track = (event, product, extra = {}) => {
    const normalized = { ...product, currency: 'BRL', price: totalFor(product) };
    const send = () => window.MetaPixel?.track(event, { ...window.MetaPixel.content(normalized), ...extra });
    if (window.MetaPixel) send();
    else window.addEventListener('meta-pixel-ready', send, { once: true });
  };

  return { CART, CUSTOMER, PAYMENT, PAYMENT_URL, brl, unitPrice, extrasFor, totalFor, getCart, putCart, applyBrand, loadConfig, kitById, renderCart, renderThankYou, track };
})();
