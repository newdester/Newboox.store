(() => {
  const CART_KEY = 'chefpro_cart_v1';
  const kits = [
    { id: 'toyadent-1', units: 1, title: 'TOYADENT · Kit com 1 unidade', price: 22.90, originalPrice: 37.20 },
    { id: 'toyadent-2', units: 2, title: 'TOYADENT · Kit com 2 unidades', price: 39.90, originalPrice: 74.40 },
    { id: 'toyadent-3', units: 3, title: 'TOYADENT · Kit com 3 unidades', price: 44.90, originalPrice: 111.60 }
  ];
  const image = '/assets/images/toyadent/hero.webp';
  let selected = kits[2];
  let kitQuantity = 1;
  let deliveryEstimate = 'Entrega padrão grátis · 8 a 12 dias úteis';
  let tracked = false;
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const updateCartBadge = () => {
    let units = 0;
    try { const saved = JSON.parse(localStorage.getItem(CART_KEY) || 'null'); units = (Number(saved?.units) || 0) * (Number(saved?.kitQuantity) || 1); } catch {}
    document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(units); });
  };

  function selectKit(id) {
    selected = kits.find(kit => kit.id === id) || kits[2];
    document.querySelectorAll('[data-kit]').forEach(button => {
      const active = button.dataset.kit === selected.id;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const subtotal = Number((selected.price * kitQuantity).toFixed(2));
    const shipping = 'GRÁTIS';
    const total = brl(subtotal);
    document.querySelectorAll('[data-selected-price]').forEach(node => { node.textContent = brl(subtotal); });
    document.querySelectorAll('[data-selected-shipping]').forEach(node => { node.textContent = shipping; });
    document.querySelectorAll('[data-selected-total]').forEach(node => { node.textContent = total; });
    document.querySelectorAll('[data-selected-units]').forEach(node => { node.textContent = String(selected.units); });
    document.querySelectorAll('[data-kit-quantity]').forEach(node => { node.textContent = String(kitQuantity); });
    document.querySelectorAll('[data-buy]').forEach(button => { button.textContent = 'Comprar agora'; });
  }

  function saveCart(destination) {
    const subtotal = Number((selected.price * kitQuantity).toFixed(2));
    const shipping = 0;
    const product = { ...selected, image, kitQuantity, shippingService: 'standard', currency: 'BRL', total: subtotal, shipping, carrier: 'Correios - Entrega Padrão', deliveryEstimate };
    localStorage.setItem(CART_KEY, JSON.stringify(product));
    updateCartBadge();
    window.MetaPixel?.track('AddToCart', {
      ...window.MetaPixel.content(product),
      value: product.total,
      contents: [{ id: product.id, quantity: product.units * kitQuantity }]
    });
    window.location.assign(destination);
  }

  document.querySelectorAll('[data-kit]').forEach(button => button.addEventListener('click', () => selectKit(button.dataset.kit)));
  document.querySelector('[data-quantity-decrease]')?.addEventListener('click', () => { kitQuantity = Math.max(1, kitQuantity - 1); selectKit(selected.id); });
  document.querySelector('[data-quantity-increase]')?.addEventListener('click', () => { kitQuantity = Math.min(10, kitQuantity + 1); selectKit(selected.id); });
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => saveCart('/checkout')));
  document.querySelectorAll('[data-add-cart]').forEach(button => button.addEventListener('click', () => saveCart('/cart')));
  document.querySelectorAll('a[href="#oferta"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('#oferta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  const addBusinessDays = days => {
    const date = new Date();
    let added = 0;
    while (added < days) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) added += 1;
    }
    return date;
  };
  const deliveryDays = () => {
    const format = date => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
    return `entre ${format(addBusinessDays(8))} e ${format(addBusinessDays(12))}`;
  };
  const loadLocationEstimate = async () => {
    const node = document.querySelector('#locationEstimate');
    try {
      const location = await fetch('/api/locale', { cache: 'no-store' }).then(response => response.json());
      const place = [location.city, location.region].filter(Boolean).join(' - ');
      deliveryEstimate = `${place ? `Previsão para ${place}` : 'Previsão de entrega'}: ${deliveryDays()}`;
      if (node) node.innerHTML = `<strong>${deliveryEstimate}</strong><span>Entrega padrão grátis. Endereço e opção SEDEX ficam no checkout.</span>`;
    } catch {
      deliveryEstimate = `Entrega padrão grátis: ${deliveryDays()}`;
      if (node) node.textContent = `${deliveryEstimate}. Endereço e opção SEDEX ficam no checkout.`;
    }
  };

  document.querySelectorAll('[data-gallery-thumb]').forEach(button => button.addEventListener('click', () => {
    const main = document.querySelector('[data-gallery-main]');
    if (!main) return;
    main.src = button.dataset.galleryThumb;
    main.alt = button.dataset.galleryAlt || 'TOYADENT';
    document.querySelectorAll('[data-gallery-thumb]').forEach(item => item.classList.toggle('selected', item === button));
  }));

  const trackView = () => {
    if (tracked || !window.MetaPixel) return;
    tracked = true;
    const product = { ...selected, image, currency: 'BRL' };
    window.MetaPixel.track('ViewContent', { ...window.MetaPixel.content(product), value: selected.price * kitQuantity });
  };
  selectKit('toyadent-3');
  updateCartBadge();
  loadLocationEstimate();
  trackView();
  window.addEventListener('meta-pixel-ready', trackView, { once: true });
})();

