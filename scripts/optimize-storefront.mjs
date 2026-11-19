import fs from 'node:fs';

const pages = ['index.html', 'motorscent.html'];
const heroName = 'hf_20261016_162023_146ac201-ab77-4067-b595-3ef6933ea4ca.png';

for (const page of pages) {
  let html = fs.readFileSync(page, 'utf8');

  // The offer must be correct before JavaScript, geolocation or API calls finish.
  html = html.replaceAll('99.95', '69.00').replaceAll('9995', '6900');

  // Remove the copied Shopify telemetry/payment bootloaders. They still contact
  // the former store from every country and do not participate in this checkout.
  const obsoleteSources = [
    'trekkie.', 'preloads', 'loader.init-shop-cart-sync', 'loader.payment-terms',
    'load_feature-', 'storefront-', 'origin_trials-', 'privacy-banner',
    'bfcc46', 'shop_events_listener-', 'shopify-perf-kit-', 'webmcp-',
    'standard-actions.js'
  ];
  const obsoleteInline = [
    'wpmLoader(', 'captcha-bootstrap', 'ShopifyPaypalV4VisibilityTracking',
    'shopify:webmcp_adapter_loaded', 'shopify.dynamic_checkout',
    'portableWalletsHideBuyerConsent'
  ];
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, script => {
    if (obsoleteSources.some(source => script.includes(source))) return '';
    if (obsoleteInline.some(marker => script.includes(marker))) return '';
    return script;
  });
  html = html.replace(/<link[^>]+accelerated-checkout[^>]*>/gi, '');

  // Do not make no-JS visitors download product media from the former store.
  html = html.replace(
    /<noscript><div class="product__media media">\s*<img src="\/\/www\.motorscent\.co\/cdn\/shop\/files\/([^?\"]+)[^>]*>\s*<\/div><\/noscript>/g,
    (_match, filename) => `<noscript><div class="product__media media"><img src="motorscent-assets/images/${filename}" alt="Motor Scent" loading="lazy" decoding="async"></div></noscript>`
  );

  // Cap responsive local images at 990 px. This avoids multi-megabyte 2K PNGs on
  // high-density phones while keeping enough detail for the product gallery.
  html = html.replace(/srcset="(motorscent-assets\/images\/[^"]+)"/g, (_match, value) => {
    const candidates = value.split(',').map(item => item.trim());
    const reduced = candidates.filter(item => {
      const width = Number(item.match(/\s(\d+)w$/)?.[1] || 0);
      return !width || width <= 990;
    });
    return `srcset="${(reduced.length ? reduced : candidates).join(', ')}"`;
  });

  // The first product image is the LCP element; provide a lightweight fallback
  // and priority hints directly in markup instead of waiting for JavaScript.
  const originalHero = `src="motorscent-assets/images/${heroName}"`;
  html = html.replaceAll(
    originalHero,
    `src="motorscent-assets/images/${heroName.replace('.png', '_9.png')}" decoding="async" fetchpriority="high"`
  );
  html = html.replace(/decoding="async" fetchpriority="high"([^>]*?) decoding="async"/g, 'decoding="async" fetchpriority="high"$1');

  fs.writeFileSync(page, html);
}
