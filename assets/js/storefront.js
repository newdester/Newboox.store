const responsiveCss = document.createElement('link');
responsiveCss.rel = 'stylesheet';
responsiveCss.href = '/assets/css/responsive.css';
document.head.append(responsiveCss);
if (!window.MetaPixel && !document.querySelector('script[src*="assets/js/meta-pixel.js"]')) {
  const metaPixel = document.createElement('script');
  metaPixel.src = '/assets/js/meta-pixel.js?v=20261124-tercos';
  document.head.append(metaPixel);
}

const Storefront = (() => {
  const CART = 'newboox_rosary_cart_v2';
  const CUSTOMER = 'newboox_customer_v1';
  const PAYMENT = 'newboox_payment_v1';
  const PAYMENT_URL = '/checkout';
  const SEDEX_RATE = 12.36;
  const DEFAULT_MODELS = [
    { id: 'terco-sao-miguel', title: 'Terço de São Miguel Arcanjo', tiktokVideoId: '7590141020285701393', tiktokUrl: 'https://www.tiktok.com/@tercosdesing/video/7590141020285701393', price: 89.90, units: 1 },
    { id: 'terco-aparecida', title: 'Terço de Nossa Senhora Aparecida', tiktokVideoId: '7694326293432765702', tiktokUrl: 'https://www.tiktok.com/@tercosdesing/video/7694326293432765702', price: 89.90, units: 1 },
    { id: 'terco-divino-espirito', title: 'Terço do Divino Espírito Santo', tiktokVideoId: '7693251625376435508', tiktokUrl: 'https://www.tiktok.com/@tercosdesing/video/7693251625376435508', price: 89.90, units: 1 }
  ];
  const DEFAULT_TIERS = [
    { minQuantity: 1, maxQuantity: 1, unitPrice: 89.90 },
    { minQuantity: 2, maxQuantity: 2, unitPrice: 75.90 },
    { minQuantity: 3, maxQuantity: 10, unitPrice: 59.90 }
  ];
  let models = DEFAULT_MODELS;
  let pricingTiers = DEFAULT_TIERS;
  let maxOrderQuantity = 10;
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const modelById = id => models.find(model => model.id === String(id || '')) || null;
  const quantityFrom = value => Math.min(maxOrderQuantity, Math.max(1, Number.parseInt(value, 10) || 1));
  const quantityFor = cart => (Array.isArray(cart?.items) ? cart.items : []).reduce((sum, item) => sum + quantityFrom(item.quantity), 0);
  const priceForQuantity = quantity => {
    const count = quantityFrom(quantity);
    const tier = pricingTiers.find(item => count >= Number(item.minQuantity) && count <= Number(item.maxQuantity));
    return Number(tier?.unitPrice) || DEFAULT_TIERS[2].unitPrice;
  };
  const offerTotal = quantity => Number((quantityFrom(quantity) * priceForQuantity(quantity)).toFixed(2));
  const shippingServiceFor = cart => cart?.shippingService === 'sedex' ? 'sedex' : 'standard';
  const extrasFor = cart => shippingServiceFor(cart) === 'sedex' ? SEDEX_RATE : 0;
  const subtotalFor = cart => offerTotal(quantityFor(cart));
  const totalFor = cart => Number((subtotalFor(cart) + extrasFor(cart)).toFixed(2));
  const cleanItems = rows => {
    if (!Array.isArray(rows)) return [];
    const merged = new Map();
    let total = 0;
    rows.forEach(row => {
      const model = modelById(row?.id || row?.productId);
      const quantity = Number.parseInt(row?.quantity, 10);
      if (!model || !Number.isInteger(quantity) || quantity < 1) return;
      const available = Math.max(0, maxOrderQuantity - total);
      const accepted = Math.min(quantity, available);
      if (!accepted) return;
      total += accepted;
      merged.set(model.id, (merged.get(model.id) || 0) + accepted);
    });
    return [...merged.entries()].map(([id, quantity]) => ({ id, quantity }));
  };
  const getCart = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(CART) || 'null');
      if (!stored || !Array.isArray(stored.items)) return null;
      const items = cleanItems(stored.items);
      if (!items.length) return null;
      return { items, shippingService: shippingServiceFor(stored), deliveryEstimate: String(stored.deliveryEstimate || '') };
    } catch { return null; }
  };
  const putCart = cart => {
    const items = cleanItems(cart?.items);
    if (!items.length) { localStorage.removeItem(CART); return null; }
    const saved = { items, shippingService: shippingServiceFor(cart), deliveryEstimate: String(cart.deliveryEstimate || '') };
    localStorage.setItem(CART, JSON.stringify(saved));
    return saved;
  };
  const addToCart = (id, quantity = 1) => {
    const model = modelById(id);
    if (!model) return null;
    const cart = getCart() || { items: [], shippingService: 'standard' };
    const items = cart.items.map(item => ({ ...item }));
    const existing = items.find(item => item.id === model.id);
    const add = quantityFrom(quantity);
    if (quantityFor(cart) + add > maxOrderQuantity) throw new Error('O limite é de 10 unidades por pedido.');
    if (existing) existing.quantity += add;
    else items.push({ id: model.id, quantity: add });
    return putCart({ ...cart, items });
  };
  const replaceCart = (id, quantity = 1) => putCart({ items: [{ id, quantity: quantityFrom(quantity) }], shippingService: 'standard' });
  const applyBrand = () => {
    document.title = document.title.replace(/TOYADENT|ChefPro|MaxLar|Motor Scent|Toque Duplo/gi, 'Newboox');
  };
  async function loadConfig() {
    try {
      const config = await fetch('/api/config', { cache: 'no-store' }).then(response => response.json());
      if (Array.isArray(config.models) && config.models.length) models = config.models;
      if (Array.isArray(config.pricingTiers) && config.pricingTiers.length) pricingTiers = config.pricingTiers;
      if (Number.isInteger(config.maxOrderQuantity)) maxOrderQuantity = config.maxOrderQuantity;
      return config;
    } catch {
      return { product: models[0], models, pricingTiers, maxOrderQuantity };
    }
  }
  const linePrice = (cart, item) => Number((Number(item.quantity) * priceForQuantity(quantityFor(cart))).toFixed(2));

  async function renderCart() {
    const root = document.querySelector('#cartItem');
    let cart = getCart();
    applyBrand();
    await loadConfig();
    cart = getCart();
    const set = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
    document.documentElement.lang = 'pt-BR';
    document.title = 'Carrinho — Newboox';
    set('#continueShopping', 'Continuar comprando');
    set('#shippingIncluded', 'Entrega padrão grátis · SEDEX opcional');
    set('#cartTitle', 'Seu carrinho');
    set('#summaryTitle', 'Resumo do pedido');
    set('#subtotalLabel', 'Produtos');
    set('#shippingLabel', 'Entrega padrão');
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
    cart = putCart(cart);
    const count = quantityFor(cart);
    const unit = priceForQuantity(count);
    const shipping = extrasFor(cart);
    set('#cartCount', String(count));
    set('#deliveryWindow', shippingServiceFor(cart) === 'sedex' ? 'SEDEX · 2 a 3 dias úteis' : (cart.deliveryEstimate || 'Entrega padrão grátis · 8 a 12 dias úteis'));
    set('#footerCurrency', 'Pagamento processado em BRL');
    document.querySelector('#checkoutLink')?.setAttribute('href', PAYMENT_URL);
    root.innerHTML = cart.items.map(item => {
      const model = modelById(item.id);
      if (!model) return '';
      return '<article class="cart-line" data-cart-model="' + escapeHtml(item.id) + '">' +
        '<div class="product-thumb" aria-hidden="true">📿</div>' +
        '<div class="cart-line__content"><p class="cart-name">' + escapeHtml(model.title) + '</p>' +
        '<span class="cart-meta">' + brl(unit) + ' cada · Vídeo de <a href="' + escapeHtml(model.tiktokUrl) + '" target="_blank" rel="noopener">terçosdesign</a></span>' +
        '<div class="cart-quantity" aria-label="Quantidade"><button type="button" data-decrease aria-label="Diminuir quantidade">−</button><strong>' + item.quantity + '</strong><button type="button" data-increase aria-label="Aumentar quantidade">+</button></div>' +
        '<button class="remove" type="button" data-remove>Remover</button></div><b class="cart-price">' + brl(linePrice(cart, item)) + '</b></article>';
    }).join('');
    set('#subtotal', brl(subtotalFor(cart)));
    set('#shippingFree', shipping ? brl(shipping) : 'GRÁTIS');
    set('#total', brl(totalFor(cart)));
    set('#chargedNote', count === 1 ? '1 unidade · Cartão, Pix ou saldo Mercado Pago' : count === 2 ? 'R$ 75,90 por unidade para 2 peças' : 'R$ 59,90 por unidade a partir de 3 peças');
    root.querySelectorAll('[data-cart-model]').forEach(row => {
      const id = row.dataset.cartModel;
      row.querySelector('[data-remove]')?.addEventListener('click', () => {
        putCart({ ...cart, items: cart.items.filter(item => item.id !== id) });
        renderCart();
      });
      row.querySelector('[data-decrease]')?.addEventListener('click', () => {
        const items = cart.items.map(item => item.id === id ? { ...item, quantity: item.quantity - 1 } : item).filter(item => item.quantity > 0);
        putCart({ ...cart, items });
        renderCart();
      });
      row.querySelector('[data-increase]')?.addEventListener('click', () => {
        const items = cart.items.map(item => item.id === id ? { ...item, quantity: item.quantity + 1 } : item);
        try { putCart({ ...cart, items }); renderCart(); }
        catch (error) { set('#chargedNote', error.message); }
      });
    });
  }

  const track = (event, cart, extra = {}, eventId) => {
    const count = quantityFor(cart);
    const unitPrice = priceForQuantity(count);
    const tracked = {
      items: (cart?.items || []).map(item => {
        const model = modelById(item.id);
        return { id: item.id, title: model?.title || item.id, quantity: item.quantity, unitPrice };
      }),
      total: totalFor(cart),
      currency: 'BRL'
    };
    const send = () => window.MetaPixel?.track(event, { ...window.MetaPixel.content(tracked), ...extra }, eventId);
    if (window.MetaPixel) send();
    else window.addEventListener('meta-pixel-ready', send, { once: true });
  };

  async function renderThankYou() {
    let payment = JSON.parse(sessionStorage.getItem(PAYMENT) || 'null');
    const query = new URLSearchParams(location.search);
    const returnedId = query.get('payment_id') || query.get('collection_id') || payment?.paymentId;
    if (returnedId && /^\d+$/.test(returnedId)) {
      try {
        const response = await fetch('/api/payment-status?paymentId=' + encodeURIComponent(returnedId), { cache: 'no-store' });
        if (response.ok) payment = { ...(payment || {}), ...(await response.json()) };
      } catch {}
    }
    const status = payment?.status || query.get('status') || query.get('collection_status') || 'pending';
    const title = document.querySelector('#thanksTitle');
    const copyNode = document.querySelector('#thanksCopy');
    applyBrand();
    if (status === 'approved' || status === 'paid') {
      if (title) title.textContent = 'Pagamento aprovado';
      if (copyNode) copyNode.textContent = 'Obrigado! Seu pedido de terços foi confirmado. Você receberá atualizações após a confirmação do pagamento.';
      document.querySelector('#orderReference')?.replaceChildren('Pedido ' + (payment?.orderId || '') + ' · Pagamento ' + (payment?.paymentId || returnedId || ''));
      const paymentId = payment?.paymentId || returnedId;
      const cart = getCart();
      if (paymentId && cart) track('Purchase', cart, { value: Number(payment?.amount) || totalFor(cart), currency: 'BRL', order_id: payment?.orderId || '' }, 'mp_payment_' + paymentId);
      localStorage.removeItem(CART);
      return;
    }
    if (title) title.textContent = 'Pagamento em processamento';
    if (copyNode) copyNode.textContent = 'Recebemos seu pedido. Assim que o Mercado Pago confirmar, enviaremos a atualização por e-mail.';
  }

  return {
    CART, CUSTOMER, PAYMENT, PAYMENT_URL, brl, models: () => models, modelById, quantityFrom, quantityFor,
    priceForQuantity, offerTotal, linePrice, shippingServiceFor, extrasFor, subtotalFor, totalFor,
    getCart, putCart, addToCart, replaceCart, applyBrand, loadConfig, renderCart, renderThankYou, track
  };
})();
