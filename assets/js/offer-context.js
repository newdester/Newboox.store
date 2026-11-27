const offers = { lavadora: '/', game: '/game', lampada: '/lampada', mel: '/mel' };
const isOffer = value => Object.prototype.hasOwnProperty.call(offers, value);
export const offerPaths = Object.freeze(Object.values(offers));
const lastOfferKey = 'newboox_last_offer';
export const legacyCartKey = 'newboox_soarfly_cart_v1';

export function offerForProduct(product) {
  return Object.keys(offers).find(offer => offers[offer] === product.url) || 'lavadora';
}

export function savedCartOffer(cart) {
  if (cart?.id?.startsWith?.('game-r36s-')) return 'game';
  if (cart?.id?.startsWith?.('soarfly-')) return 'lavadora';
  return null;
}

export function currentOffer() {
  const path = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  const productOffer = Object.keys(offers).find(offer => offers[offer] === path);
  if (productOffer) return productOffer;

  const requested = new URLSearchParams(location.search).get('oferta');
  if (isOffer(requested)) return requested;
  try {
    const remembered = sessionStorage.getItem(lastOfferKey);
    if (isOffer(remembered)) return remembered;
    return savedCartOffer(JSON.parse(localStorage.getItem(legacyCartKey))) || 'lavadora';
  } catch {
    return 'lavadora';
  }
}

export function offerUrl(route, offer) {
  const url = new URL(route, 'https://newboox.store');
  url.searchParams.set('oferta', offer);
  return url.pathname + url.search + url.hash;
}

export function bindOfferLinks(offer = currentOffer()) {
  try { sessionStorage.setItem(lastOfferKey, offer); } catch {}
  document.querySelectorAll('[data-offer-home]').forEach(link => {
    link.href = offers[offer] + link.dataset.offerHome;
  });
  document.querySelectorAll('[data-offer-route]').forEach(link => {
    link.href = offerUrl(link.dataset.offerRoute, offer);
  });
}
