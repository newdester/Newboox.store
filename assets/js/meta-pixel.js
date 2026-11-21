(() => {
  const PIXEL_ID = '1806290673851071';
  const ATTRIBUTION_KEY = 'newboox_meta_attribution_v1';
  const readCookie = name => {
    const prefix = `${name}=`;
    const value = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(prefix));
    return value ? decodeURIComponent(value.slice(prefix.length)) : '';
  };
  const readStoredAttribution = () => {
    try { return JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || '{}'); } catch { return {}; }
  };
  const captureAttribution = () => {
    const stored = readStoredAttribution();
    const fbclid = new URLSearchParams(location.search).get('fbclid') || stored.fbclid || '';
    const fbc = readCookie('_fbc') || stored.fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : '');
    const attribution = {
      fbp: readCookie('_fbp') || stored.fbp || '',
      fbc,
      fbclid,
      sourceUrl: stored.sourceUrl || location.href,
      referrerUrl: stored.referrerUrl || document.referrer || '',
      capturedAt: stored.capturedAt || Date.now()
    };
    try { localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution)); } catch {}
    return attribution;
  };
  captureAttribution();
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
  window.MetaPixel = { track: (event, parameters = {}, eventId) => eventId ? window.fbq?.('track', event, parameters, { eventID: eventId }) : window.fbq?.('track', event, parameters), trackCustom: (event, parameters = {}) => window.fbq?.('trackCustom', event, parameters), content, attribution: captureAttribution };
  window.dispatchEvent(new Event('meta-pixel-ready'));
})();
