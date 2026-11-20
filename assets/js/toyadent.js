(() => {
  const CART_KEY = 'chefpro_cart_v1';
  const kits = [
    { id: 'toyadent-1', units: 1, title: 'TOYADENT · Kit com 1 unidade', price: 22.90, shipping: 9.32 },
    { id: 'toyadent-2', units: 2, title: 'TOYADENT · Kit com 2 unidades', price: 39.90, shipping: 9.32 },
    { id: 'toyadent-3', units: 3, title: 'TOYADENT · Kit com 3 unidades', price: 49.90, shipping: 0 }
  ];
  const image = '/assets/images/toyadent/hero.webp';
  let selected = kits[2];
  let tracked = false;
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  function selectKit(id) {
    selected = kits.find(kit => kit.id === id) || kits[2];
    document.querySelectorAll('[data-kit]').forEach(button => {
      const active = button.dataset.kit === selected.id;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const shipping = selected.shipping ? brl(selected.shipping) : 'GRÁTIS';
    const total = brl(selected.price + selected.shipping);
    document.querySelectorAll('[data-selected-price]').forEach(node => { node.textContent = brl(selected.price); });
    document.querySelectorAll('[data-selected-shipping]').forEach(node => { node.textContent = shipping; });
    document.querySelectorAll('[data-selected-total]').forEach(node => { node.textContent = total; });
    document.querySelectorAll('[data-selected-units]').forEach(node => { node.textContent = String(selected.units); });
  }

  function saveCart() {
    const product = { ...selected, image, quantity: 1, currency: 'BRL', total: selected.price + selected.shipping };
    localStorage.setItem(CART_KEY, JSON.stringify(product));
    window.MetaPixel?.track('AddToCart', {
      ...window.MetaPixel.content(product),
      value: product.total,
      contents: [{ id: product.id, quantity: product.units }]
    });
  }

  document.querySelectorAll('[data-kit]').forEach(button => button.addEventListener('click', () => selectKit(button.dataset.kit)));
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => {
    saveCart();
    window.location.assign('/checkout');
  }));
  document.querySelectorAll('a[href="#oferta"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('#oferta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  const shippingForm = document.querySelector('#shippingSimulator');
  shippingForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.querySelector('#shippingZip');
    const feedback = document.querySelector('#shippingFeedback');
    const zip = String(input?.value || '').replace(/\D/g, '');
    if (zip.length !== 8) {
      feedback.textContent = 'Digite um CEP com 8 números.';
      feedback.dataset.error = 'true';
      return;
    }
    feedback.textContent = 'Consultando entrega…';
    feedback.dataset.error = 'false';
    let location = '';
    try {
      const address = await fetch(`https://viacep.com.br/ws/${zip}/json/`).then(response => response.json());
      if (!address.erro) location = ` para ${address.localidade} - ${address.uf}`;
    } catch {}
    feedback.innerHTML = `Entrega Loggi${location}: <strong>3 a 5 dias úteis</strong> · Frete <strong>${selected.shipping ? brl(selected.shipping) : 'GRÁTIS'}</strong>.`;
  });

  const trackView = () => {
    if (tracked || !window.MetaPixel) return;
    tracked = true;
    const product = { ...selected, image, currency: 'BRL' };
    window.MetaPixel.track('ViewContent', { ...window.MetaPixel.content(product), value: selected.price + selected.shipping });
  };
  selectKit('toyadent-3');
  trackView();
  window.addEventListener('meta-pixel-ready', trackView, { once: true });
})();

