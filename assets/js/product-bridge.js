(() => {
  const CART_KEY = 'chefpro_cart_v1';
  const product = { id: 'chefpro-2l', title: 'Triturador Elétrico ChefPro 2L Bivolt + Tábua de Madeira Grátis', price: 49.90, image: 'https://lojamaxlarapp.com/cdn/shop/files/6_700x_e3bfb5c3-31ad-4db8-8622-d66c1ed366f3.webp?v=1789224097' };
  const pixPrice = 49.90;
  const loadPixel = callback => {
    if (window.MetaPixel) return callback();
    window.addEventListener('meta-pixel-ready', callback, { once: true });
    if (!document.querySelector('script[src="assets/js/meta-pixel.js"]')) { const script = document.createElement('script'); script.src = 'assets/js/meta-pixel.js'; document.head.append(script); }
  };
  loadPixel(() => window.MetaPixel.track('ViewContent', window.MetaPixel.content(product)));
  const replaceText = (root, from, to) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => /^(SCRIPT|STYLE)$/i.test(node.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let node; node = walker.nextNode();) node.nodeValue = node.nodeValue.replaceAll(from, to);
  };
  const updateLandingDetails = () => {
    const root = document.querySelector('product-price[data-product-id="8695262085295"]') || document.querySelector('#MainContent product-price');
    if (root) {
      root.querySelectorAll('.price').forEach(price => { price.textContent = 'R$ 49,90'; price.dataset.price = '4990'; });
      root.querySelectorAll('.discount__percentage').forEach(discount => { discount.lastChild.nodeValue = '64%'; });
      const installmentCopy = root.querySelector('.parcelamento');
      // O Brick é a fonte de verdade para o valor exato de cada parcela.
      // Assim evitamos anunciar uma divisão com arredondamento diferente.
      if (installmentCopy) installmentCopy.textContent = 'Até 12x sem juros no cartão';
    }
    replaceText(document.body, 'Prazo de envio de 2 a 5 dias', 'Entrega estimada de 5 a 7 dias corridos');
    replaceText(document.body, 'Aceitamos Cartão, PIX e Boleto.', 'Aceitamos cartão de crédito, Pix e saldo Mercado Pago.');
    replaceText(document.body, '10% OFF no pix + Envio Imediato', 'Pix, cartão e saldo Mercado Pago');
    document.querySelectorAll('.product-pix').forEach(element => { element.textContent = 'Pix, cartão e saldo Mercado Pago'; });
    document.querySelectorAll('[aria-labelledby="pi-boleto"]').forEach(icon => icon.closest('.payment-icon')?.remove());
    const paymentOptions = document.getElementById('modal-open-button');
    if (paymentOptions) {
      const note = document.createElement('p');
      note.className = 'product-payment-note';
      note.textContent = `Até 12x sem juros no cartão · R$ ${pixPrice.toFixed(2).replace('.', ',')} no Pix`;
      note.style.margin = '0 0 12px';
      note.style.fontSize = '14px';
      note.style.fontWeight = '600';
      paymentOptions.replaceWith(note);
    }
  };
  document.addEventListener('DOMContentLoaded', updateLandingDetails);
  const saveCart = quantity => localStorage.setItem(CART_KEY, JSON.stringify({ ...product, quantity: Math.min(10, Math.max(1, Number(quantity) || 1)) }));
  const goToCart = quantity => { const units = Math.min(10, Math.max(1, Number(quantity) || 1)); saveCart(units); loadPixel(() => window.MetaPixel.track('AddToCart', { ...window.MetaPixel.content(product), contents: [{ id: product.id, quantity: units }] })); window.location.assign('/cart'); };
  document.addEventListener('submit', event => { const form = event.target instanceof Element ? event.target.closest('form.shopify-product-form') : null; if (!form) return; event.preventDefault(); event.stopImmediatePropagation(); goToCart(form.querySelector('[name="quantity"]')?.value); }, true);
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const cart = target.closest('[aria-label^="Abrir carrinho"], cart-icon, a[href="/cart"], a[href^="/cart?"]');
    if (cart) { event.preventDefault(); event.stopImmediatePropagation(); const quantity = document.querySelector('form.shopify-product-form [name="quantity"]')?.value || 1; goToCart(quantity); return; }
    const link = target.closest('a[href]');
    const href = link?.getAttribute('href') || '';
    if (/^\/(?:collections|products|pages|account|customer_authentication)(?:\/|$)/.test(href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('index.html');
    }
  }, true);
})();
