(() => {
  const CART_KEY = 'chefpro_cart_v1';
  const product = { id: 'toque-duplo', title: 'Toque Duplo', image: '/assets/images/toque-duplo.webp', price: 149.90, currency: 'BRL' };
  let tracked = false;
  const saveCart = () => {
    localStorage.setItem(CART_KEY, JSON.stringify({ ...product, quantity: 1 }));
    window.MetaPixel?.track('AddToCart', { ...window.MetaPixel.content(product), contents: [{ id: product.id, quantity: 1 }] });
  };
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => { saveCart(); window.location.assign('/checkout'); }));
  document.querySelectorAll('a[href="#oferta"]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); document.querySelector('#oferta')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  const trackView = () => { if (tracked || !window.MetaPixel) return; tracked = true; window.MetaPixel.track('ViewContent', window.MetaPixel.content(product)); };
  trackView(); window.addEventListener('meta-pixel-ready', trackView, { once: true });
  fetch('/api/config', { cache: 'no-store' }).then(response => response.json()).then(config => { if (!config?.product) return; product.id = config.product.id || product.id; product.title = config.product.title || product.title; product.price = Number(config.product.cardPrice) || product.price; }).catch(() => {});
})();
