const responsiveCss = document.createElement('link'); responsiveCss.rel = 'stylesheet'; responsiveCss.href = 'assets/css/responsive.css'; document.head.append(responsiveCss);
if (!window.MetaPixel && !document.querySelector('script[src="assets/js/meta-pixel.js"]')) { const metaPixel = document.createElement('script'); metaPixel.src = 'assets/js/meta-pixel.js'; document.head.append(metaPixel); }

const Storefront = (() => {
  const CART = 'chefpro_cart_v1', CUSTOMER = 'chefpro_customer_v1', PAYMENT = 'chefpro_payment_v1';
  const unitPrice = (productId, quantity) => { const units = Math.max(1, Number(quantity) || 1); return productId === 'motor-scent' ? (units === 1 ? 69 : units === 2 ? 59 : 49) : 69; };
  const extrasFor = cart => cart?.id === 'motor-scent' && cart?.extras?.lavenderOil ? 20 : 0;
  const totalFor = cart => Number((unitPrice(cart.id, cart.quantity) * cart.quantity + extrasFor(cart)).toFixed(2));
  const getCart = () => { try { return JSON.parse(localStorage.getItem(CART)); } catch { return null; } };
  const putCart = cart => localStorage.setItem(CART, JSON.stringify(cart));
  const localeContext = () => ({ locale: 'en-US', currency: 'USD', rate: 1 });
  const formatMoney = (value, context) => { const local = Number(value || 0) * context.rate; const formatted = window.NewbooxI18n?.money ? window.NewbooxI18n.money(local, context.currency, context.locale) : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value); return context.currency === 'USD' ? formatted : `${formatted} ≈ ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}`; };
  const brl = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const copy = (context, key) => ({ unit:'per unit', one:'Offer for 1 unit', two:'Offer for 2 units', many:'Offer for 3+ units', remove:'Remove', estimated:'Worldwide delivery in 7–9 calendar days', charged:'Final charge is processed in USD.', empty:'Your cart is empty.', continue:'Continue shopping' })[key];
  const applyBrand = cart => { if (!cart || cart.id !== 'motor-scent') return; document.title = document.title.replace(/MaxLar|ChefPro/g, 'Motor Scent'); document.querySelectorAll('.logo img, .footer img').forEach(image => { image.src = 'assets/images/motorscent/logo.png'; image.alt = 'Motor Scent'; }); };
  const renderCart = async () => {
    const cart = getCart(), root = document.querySelector('#cartItem'); applyBrand(cart); const context = localeContext();
    const set = (id, value) => { const node = document.querySelector(id); if (node) node.textContent = value; };
    if (!cart || !root) { document.querySelector('#empty')?.classList.remove('hidden'); document.querySelector('#checkoutLink')?.classList.add('hidden'); set('#cartCount', '0'); return; }
    set('#cartCount', String(cart.quantity)); set('#deliveryWindow', copy(context, 'estimated')); set('#chargedNote', copy(context, 'charged')); set('#footerCurrency', `${copy(context, 'charged')} · ${context.currency}`);
    const draw = () => { const price = unitPrice(cart.id, cart.quantity), extra = extrasFor(cart), total = totalFor(cart); const tier = cart.quantity === 1 ? copy(context, 'one') : cart.quantity === 2 ? copy(context, 'two') : copy(context, 'many'); root.innerHTML = `<div class="cart-line"><img src="${cart.image}" alt="${String(cart.title || 'Motor Scent').replace(/"/g, '&quot;')}"><div><p class="cart-name">${cart.title || 'Motor Scent'}</p><span class="cart-meta">${formatMoney(price, context)} ${copy(context, 'unit')} · ${tier}</span>${extra ? `<p class="cart-meta">Lavender oil · ${formatMoney(extra, context)}</p>` : ''}<div class="quantity"><button data-change="-1" aria-label="Decrease">−</button><strong>${cart.quantity}</strong><button data-change="1" aria-label="Increase">+</button><button class="remove" data-remove>${copy(context, 'remove')}</button></div></div><b class="cart-price">${formatMoney(total, context)}</b></div>`; set('#subtotal', formatMoney(total, context)); set('#total', formatMoney(total, context)); };
    root.addEventListener('click', event => { if (event.target.matches('[data-remove]')) { localStorage.removeItem(CART); location.reload(); return; } const change = Number(event.target.dataset.change); if (change) { cart.quantity = Math.max(1, Math.min(10, cart.quantity + change)); cart.price = unitPrice(cart.id, cart.quantity); putCart(cart); draw(); } }); draw();
  };
  const renderThankYou = () => { const payment = JSON.parse(sessionStorage.getItem(PAYMENT) || 'null'); const cart = getCart(); applyBrand(cart); if (!payment || !['approved','paid'].includes(payment.status)) return; document.querySelector('#orderReference')?.replaceChildren(`Order ${payment.orderId || ''} · Payment ${payment.paymentId || ''}`); localStorage.removeItem(CART); };
  const track = (event, product, extra = {}) => { const send = () => window.MetaPixel?.track(event, { ...window.MetaPixel.content(product), ...extra }); if (window.MetaPixel) send(); else window.addEventListener('meta-pixel-ready', send, { once: true }); };
  return { CART, CUSTOMER, PAYMENT, brl, unitPrice, extrasFor, totalFor, getCart, putCart, applyBrand, renderCart, renderThankYou, track };
})();
