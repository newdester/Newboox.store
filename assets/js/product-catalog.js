import { WASHER_IMAGE, WASHER_VARIANTS } from './washer-catalog.js?v=soarfly-4';

export const GAME_PRODUCT = {
  id: 'game-r36s-64gb',
  title: 'Game R36S · Console portátil 64 GB',
  image: '/assets/images/game/r36s-console.webp',
  url: '/game',
  price: 78.41,
  maxInstallments: 3,
  available: true,
  units: 1,
  currency: 'BRL'
};

export const GAME_VARIANTS = [
  { code: 'preto', color: 'Preto', image: GAME_PRODUCT.image },
  { code: 'branco', color: 'Branco', image: '/assets/images/game/r36s-branco.webp' },
  { code: 'roxo', color: 'Roxo', image: '/assets/images/game/r36s-roxo.webp' }
].map(({ code, color, image }) => ({
  ...GAME_PRODUCT,
  id: GAME_PRODUCT.id + '-' + code,
  title: GAME_PRODUCT.title + ' · ' + color,
  color,
  image
}));

export const STORE_PRODUCTS = [
  ...WASHER_VARIANTS.map(product => ({ ...product, url: '/', image: WASHER_IMAGE })),
  GAME_PRODUCT,
  ...GAME_VARIANTS
];
