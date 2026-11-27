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

export const LAMP_VARIANTS = [
  { watts: 30, price: 19.90 },
  { watts: 50, price: 24.90 },
  { watts: 60, price: 28.90 }
].map(({ watts, price }) => ({
  id: `lampada-led-${watts}w`,
  title: `Lâmpada LED de emergência · ${watts} W`,
  image: `/assets/images/lampada/${watts}w.webp`,
  url: '/lampada',
  power: `${watts} W`,
  price,
  maxInstallments: 3,
  available: true,
  units: 1,
  currency: 'BRL'
}));

export const STORE_PRODUCTS = [
  ...WASHER_VARIANTS.map(product => ({ ...product, url: '/', image: WASHER_IMAGE })),
  GAME_PRODUCT,
  ...GAME_VARIANTS,
  ...LAMP_VARIANTS,
  {
    id: 'meleira-200ml',
    title: 'Meleira dosadora acrílica · 200 ml',
    image: '/assets/images/mel/meleira.webp',
    url: '/mel',
    price: 14.90,
    maxInstallments: 3,
    available: true,
    units: 1,
    currency: 'BRL'
  }
];
