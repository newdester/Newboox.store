(() => {
  const PIXEL_ID = '1806290673851071';
  if (window.MetaPixel) return;
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = true; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', PIXEL_ID);
  if (window.META_AUTO_PAGEVIEW !== false) fbq('track', 'PageView');
  const content = product => ({ content_ids: [product.id], content_name: product.title, content_type: 'product', currency: product.currency || 'BRL', value: Number(product.price) });
  window.MetaPixel = { track: (event, parameters = {}, eventId) => eventId ? window.fbq?.('track', event, parameters, { eventID: eventId }) : window.fbq?.('track', event, parameters), trackCustom: (event, parameters = {}) => window.fbq?.('trackCustom', event, parameters), content };
  window.dispatchEvent(new Event('meta-pixel-ready'));
})();
