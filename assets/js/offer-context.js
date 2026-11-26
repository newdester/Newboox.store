const offers = { lavadora: '/', game: '/game' };
const isOffer = value => value === 'lavadora' || value === 'game';
const lastOfferKey = 'newboox_last_offer';
export const legacyCartKey = 'newboox_soarfly_cart_v1';

export function offerForProduct(product) {
  return product.url === offers.game ? 'game' : 'lavadora';
}

export function savedCartOffer(cart) {
  if (cart?.id?.startsWith?.('game-r36s-')) return 'game';
  if (cart?.id?.startsWith?.('soarfly-')) return 'lavadora';
  return null;
}

export function currentOffer() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  if (path === offers.game || path === '/game/index.html') return 'game';
  if (path === offers.lavadora || path === '/index.html') return 'lavadora';

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
