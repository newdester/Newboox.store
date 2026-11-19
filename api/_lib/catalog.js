const numberFrom = (value, fallback) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function storeProduct() {
  return {
    id: String(process.env.STORE_PRODUCT_ID || 'motor-scent').trim(),
    title: String(process.env.STORE_PRODUCT_NAME || 'Motor Scent').trim(),
    currency: 'BRL',
    originalPrice: numberFrom(process.env.STORE_ORIGINAL_PRICE, 279.90),
    cardPrice: numberFrom(process.env.STORE_CARD_PRICE, 149.90),
    cashPrice: numberFrom(process.env.STORE_CASH_PRICE, 129.90),
    maxInstallments: 12
  };
}

export const quantityFrom = value => Math.min(10, Math.max(1, Number.parseInt(value, 10) || 1));

export function paymentAmount(product, quantity, paymentType) {
  const unit = paymentType === 'credit_card' ? product.cardPrice : product.cashPrice;
  return Number((unit * quantity).toFixed(2));
}
