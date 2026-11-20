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
  let shippingCalculated = false;
  let deliveryEstimate = '';
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
    const shipping = shippingCalculated ? 'GRÁTIS' : 'Informe o CEP';
    const total = shippingCalculated ? brl(subtotal) : 'A calcular';
    document.querySelectorAll('[data-selected-price]').forEach(node => { node.textContent = brl(subtotal); });
    document.querySelectorAll('[data-selected-shipping]').forEach(node => { node.textContent = shipping; });
    document.querySelectorAll('[data-selected-total]').forEach(node => { node.textContent = total; });
    document.querySelectorAll('[data-selected-units]').forEach(node => { node.textContent = String(selected.units); });
    document.querySelectorAll('[data-kit-quantity]').forEach(node => { node.textContent = String(kitQuantity); });
    document.querySelectorAll('[data-buy]').forEach(button => {
      button.textContent = shippingCalculated ? 'Comprar agora' : 'Calcular entrega para continuar';
    });
  }

  function saveCart() {
    const subtotal = Number((selected.price * kitQuantity).toFixed(2));
    const shipping = 0;
    const product = { ...selected, image, kitQuantity, currency: 'BRL', total: subtotal, shipping, carrier: 'FedEx Economy', deliveryEstimate };
    localStorage.setItem(CART_KEY, JSON.stringify(product));
    updateCartBadge();
    window.MetaPixel?.track('AddToCart', {
      ...window.MetaPixel.content(product),
      value: product.total,
      contents: [{ id: product.id, quantity: product.units * kitQuantity }]
    });
  }

  document.querySelectorAll('[data-kit]').forEach(button => button.addEventListener('click', () => selectKit(button.dataset.kit)));
  document.querySelector('[data-quantity-decrease]')?.addEventListener('click', () => { kitQuantity = Math.max(1, kitQuantity - 1); selectKit(selected.id); });
  document.querySelector('[data-quantity-increase]')?.addEventListener('click', () => { kitQuantity = Math.min(10, kitQuantity + 1); selectKit(selected.id); });
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => {
    if (!shippingCalculated) {
      document.querySelector('#shippingSimulator')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelector('#shippingZip')?.focus();
      return;
    }
    saveCart();
    window.location.assign('/checkout');
  }));
  document.querySelectorAll('a[href="#oferta"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('#oferta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  const shippingForm = document.querySelector('#shippingSimulator');
  const deliveryDays = () => {
    const format = offset => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(Date.now() + offset * 86_400_000));
    return `entre ${format(8)} e ${format(12)}`;
  };
  shippingForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.querySelector('#shippingZip');
    const feedback = document.querySelector('#shippingFeedback');
    const zip = String(input?.value || '').replace(/\D/g, '');
    if (zip.length !== 8) {
      feedback.textContent = 'Digite um CEP com 8 números.';
      feedback.dataset.error = 'true';
      shippingCalculated = false;
      selectKit(selected.id);
      return;
    }
    feedback.textContent = 'Consultando entrega…';
    feedback.dataset.error = 'false';
    try {
      const address = await fetch(`https://viacep.com.br/ws/${zip}/json/`).then(response => response.json());
      if (address.erro) throw new Error('CEP não encontrado.');
      deliveryEstimate = `FedEx Economy grátis para ${address.localidade} - ${address.uf}: ${deliveryDays()}`;
      shippingCalculated = true;
      selectKit(selected.id);
      feedback.innerHTML = `<strong>${deliveryEstimate}</strong><span class="shipping-option"><b>FedEx Economy</b><small>8 a 12 dias · rastreado</small><strong>GRÁTIS</strong></span><span class="shipping-option shipping-option--express"><b>FedEx Express</b><small>2 a 3 dias · cotação conforme o CEP</small><strong>SOB CONSULTA</strong></span>`;
    } catch (error) {
      shippingCalculated = false;
      selectKit(selected.id);
      feedback.textContent = error.message || 'Não foi possível consultar o CEP. Tente novamente.';
      feedback.dataset.error = 'true';
    }
  });
  document.querySelector('#shippingZip')?.addEventListener('input', event => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
    event.target.value = digits.replace(/^(\d{5})(\d)/, '$1-$2');
    shippingCalculated = false;
    deliveryEstimate = '';
    selectKit(selected.id);
  });

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
  trackView();
  window.addEventListener('meta-pixel-ready', trackView, { once: true });
})();

