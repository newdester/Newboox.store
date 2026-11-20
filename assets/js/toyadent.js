(() => {
  const CART_KEY = 'chefpro_cart_v1';
  const kits = [
    { id: 'toyadent-1', units: 1, title: 'TOYADENT · Kit com 1 unidade', price: 22.90, shipping: 9.32 },
    { id: 'toyadent-2', units: 2, title: 'TOYADENT · Kit com 2 unidades', price: 39.90, shipping: 9.32 },
    { id: 'toyadent-3', units: 3, title: 'TOYADENT · Kit com 3 unidades', price: 44.90, shipping: 0 }
  ];
  const image = '/assets/images/toyadent/hero.webp';
  let selected = kits[2];
  let shippingCalculated = false;
  let deliveryEstimate = '';
  let tracked = false;
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const updateCartBadge = () => {
    let units = 0;
    try { units = Number(JSON.parse(localStorage.getItem(CART_KEY) || 'null')?.units) || 0; } catch {}
    document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(units); });
  };

  function selectKit(id) {
    selected = kits.find(kit => kit.id === id) || kits[2];
    document.querySelectorAll('[data-kit]').forEach(button => {
      const active = button.dataset.kit === selected.id;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const shipping = shippingCalculated ? (selected.shipping ? brl(selected.shipping) : 'GRÁTIS') : 'Informe o CEP';
    const total = shippingCalculated ? brl(selected.price + selected.shipping) : 'A calcular';
    document.querySelectorAll('[data-selected-price]').forEach(node => { node.textContent = brl(selected.price); });
    document.querySelectorAll('[data-selected-shipping]').forEach(node => { node.textContent = shipping; });
    document.querySelectorAll('[data-selected-total]').forEach(node => { node.textContent = total; });
    document.querySelectorAll('[data-selected-units]').forEach(node => { node.textContent = String(selected.units); });
    document.querySelectorAll('[data-buy]').forEach(button => {
      button.textContent = shippingCalculated ? 'Comprar agora' : 'Calcular entrega para continuar';
    });
  }

  function saveCart() {
    const product = { ...selected, image, quantity: 1, currency: 'BRL', total: selected.price + selected.shipping, deliveryEstimate };
    localStorage.setItem(CART_KEY, JSON.stringify(product));
    updateCartBadge();
    window.MetaPixel?.track('AddToCart', {
      ...window.MetaPixel.content(product),
      value: product.total,
      contents: [{ id: product.id, quantity: product.units }]
    });
  }

  document.querySelectorAll('[data-kit]').forEach(button => button.addEventListener('click', () => selectKit(button.dataset.kit)));
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
    const name = offset => new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(Date.now() + offset * 86_400_000));
    return `entre ${name(3)} e ${name(5)}`;
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
      deliveryEstimate = `Entrega Full para ${address.localidade} - ${address.uf}: ${deliveryDays()}`;
      shippingCalculated = true;
      selectKit(selected.id);
      feedback.innerHTML = `<strong>${deliveryEstimate}</strong> · Frete <strong>${selected.shipping ? brl(selected.shipping) : 'GRÁTIS'}</strong>.`;
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

  const trackView = () => {
    if (tracked || !window.MetaPixel) return;
    tracked = true;
    const product = { ...selected, image, currency: 'BRL' };
    window.MetaPixel.track('ViewContent', { ...window.MetaPixel.content(product), value: selected.price + selected.shipping });
  };
  selectKit('toyadent-3');
  updateCartBadge();
  trackView();
  window.addEventListener('meta-pixel-ready', trackView, { once: true });
})();

