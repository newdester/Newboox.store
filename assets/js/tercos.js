(() => {
  let selectedId = 'terco-sao-miguel';
  let quantity = 1;
  let trackingSent = false;
  const $ = selector => document.querySelector(selector);
  const brl = value => Storefront.brl(value);
  const modelGrid = $('#modelGrid');

  function renderModels() {
    const models = Storefront.models();
    if (!modelGrid) return;
    modelGrid.innerHTML = models.map(model => '<button class="model-choice' + (model.id === selectedId ? ' selected' : '') + '" type="button" data-model="' + model.id + '" aria-pressed="' + (model.id === selectedId) + '">' +
      '<span class="model-choice__icon" aria-hidden="true">📿</span><span><strong>' + model.title + '</strong><small>Modelo devocional</small></span><span class="model-choice__check" aria-hidden="true">✓</span></button>').join('');
    modelGrid.querySelectorAll('[data-model]').forEach(button => button.addEventListener('click', () => selectModel(button.dataset.model)));
  }

  function updateOffer() {
    const model = Storefront.modelById(selectedId) || Storefront.models()[0];
    const unit = Storefront.priceForQuantity(quantity);
    const total = Storefront.offerTotal(quantity);
    $('#selectedModel') && ($('#selectedModel').textContent = model?.title || 'Terço devocional');
    $('#selectedModelOffer') && ($('#selectedModelOffer').textContent = model?.title || 'Terço devocional');
    $('#selectedUnitPrice') && ($('#selectedUnitPrice').textContent = brl(unit));
    $('#selectedPrice') && ($('#selectedPrice').textContent = brl(total));
    $('#selectedQuantity') && ($('#selectedQuantity').textContent = String(quantity));
    $('#offerOne') && ($('#offerOne').textContent = brl(89.90));
    $('#offerTwoTotal') && ($('#offerTwoTotal').textContent = brl(151.80));
    $('#offerTwoUnit') && ($('#offerTwoUnit').textContent = brl(75.90) + ' cada');
    $('#offerThreeUnit') && ($('#offerThreeUnit').textContent = brl(59.90) + ' cada');
    document.querySelectorAll('[data-tier]').forEach(button => button.classList.toggle('selected', Number(button.dataset.tier) === Math.min(quantity, 3)));
    document.querySelectorAll('[data-quantity]').forEach(node => { node.textContent = String(quantity); });
    document.querySelectorAll('[data-buy]').forEach(button => { button.textContent = 'Comprar agora · ' + brl(total); });
    document.querySelectorAll('[data-add-cart]').forEach(button => { button.textContent = 'Adicionar ao carrinho'; });
  }

  function selectModel(id) {
    if (!Storefront.modelById(id)) return;
    selectedId = id;
    renderModels();
    updateOffer();
  }

  function addToCart(destination) {
    const model = Storefront.modelById(selectedId);
    try {
      if (destination === '/checkout') Storefront.replaceCart(selectedId, quantity);
      else Storefront.addToCart(selectedId, quantity);
      const cart = Storefront.getCart();
      Storefront.track('AddToCart', cart, { value: Storefront.totalFor(cart), currency: 'BRL', num_items: Storefront.quantityFor(cart) });
      location.assign(destination);
    } catch (error) {
      const status = $('#offerStatus');
      if (status) { status.textContent = error.message; status.classList.add('show'); }
    }
  }

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
    return 'entre ' + format(addBusinessDays(8)) + ' e ' + format(addBusinessDays(12));
  };
  async function loadLocationEstimate() {
    const node = $('#locationEstimate');
    try {
      const location = await fetch('/api/locale', { cache: 'no-store' }).then(response => response.json());
      const place = [location.city, location.region].filter(Boolean).join(' · ');
      if (node) node.textContent = (place ? 'Entrega estimada para ' + place + ': ' : 'Entrega padrão grátis: ') + deliveryDays() + ' dias úteis. SEDEX opcional no checkout.';
    } catch {
      if (node) node.textContent = 'Entrega padrão grátis: ' + deliveryDays() + ' dias úteis. SEDEX opcional no checkout.';
    }
  }

  document.querySelectorAll('[data-tier]').forEach(button => button.addEventListener('click', () => {
    quantity = Number(button.dataset.tier);
    updateOffer();
  }));
  $('[data-quantity-decrease]')?.addEventListener('click', () => { quantity = Math.max(1, quantity - 1); updateOffer(); });
  $('[data-quantity-increase]')?.addEventListener('click', () => {
    if (quantity >= 10) return;
    quantity += 1;
    updateOffer();
  });
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => addToCart('/checkout')));
  document.querySelectorAll('[data-add-cart]').forEach(button => button.addEventListener('click', () => addToCart('/cart')));
  document.querySelectorAll('a[href="#oferta"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    $('#oferta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.querySelectorAll('[data-load-tiktok]').forEach(button => button.addEventListener('click', () => {
    const id = String(button.dataset.loadTiktok || '');
    if (!/^\d{15,20}$/.test(id)) return;
    const frame = document.createElement('iframe');
    frame.src = 'https://www.tiktok.com/player/v1/' + id + '?controls=1&description=0&music_info=0&autoplay=0';
    frame.title = button.dataset.videoTitle || 'Vídeo de terço publicado no TikTok';
    frame.loading = 'lazy';
    frame.allow = 'fullscreen; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const wrapper = button.closest('.tiktok-media');
    wrapper?.replaceChildren(frame);
  }));

  (async () => {
    await Storefront.loadConfig();
    renderModels();
    updateOffer();
    loadLocationEstimate();
    if (!trackingSent && window.MetaPixel) {
      trackingSent = true;
      const model = Storefront.modelById(selectedId);
      const productCart = {
        items: [{ id: model.id, title: model.title, quantity: 1, unitPrice: 89.90 }],
        shippingService: 'standard'
      };
      Storefront.track('ViewContent', productCart, { value: 89.90, currency: 'BRL', num_items: 1 });
    }
  })();
  window.addEventListener('meta-pixel-ready', () => {
    if (trackingSent) return;
    trackingSent = true;
    const model = Storefront.modelById(selectedId);
    Storefront.track('ViewContent', { items: [{ id: model.id, quantity: 1 }], shippingService: 'standard' }, { value: 89.90, currency: 'BRL', num_items: 1 });
  }, { once: true });
  const badgeCart = Storefront.getCart();
  document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(Storefront.quantityFor(badgeCart)); });
})();
