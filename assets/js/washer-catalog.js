export const WASHER_IMAGE = '/assets/images/soarfly/lavadora.webp';
export const CARD_INSTALLMENTS = 12;
export const WASHER_VARIANTS = [
  { id: 'soarfly-127v', voltage: '127 V', price: 189, available: true },
  { id: 'soarfly-220v', voltage: '220 V', price: 189, available: true },
  { id: 'soarfly-bivolt', voltage: 'Bivolt (127/220 V)', price: 232.90, available: true }
].map(variant => ({
  ...variant,
  title: `Lavadora de alta pressão SOARFLY · ${variant.voltage}`,
  units: 1,
  currency: 'BRL',
  maxInstallments: CARD_INSTALLMENTS
}));
