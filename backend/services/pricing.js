const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 49;

const PROMO_CODES = {
  WELCOME10: { type: 'percent', value: 10, maxDiscount: 500 },
  SAVE50: { type: 'flat', value: 50, minOrder: 499 },
};

const lineTotal = (product, quantity) => {
  const unit = product.discountPrice != null ? product.discountPrice : product.price;
  return Number((unit * quantity).toFixed(2));
};

const computeSubtotal = (entries) =>
  Number(entries.reduce((sum, e) => sum + e.lineTotal, 0).toFixed(2));

const computeShipping = (subtotal) => (subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE);

const computeDiscount = (code, subtotal) => {
  if (!code) return { discount: 0, promoCode: null };
  const promo = PROMO_CODES[String(code).toUpperCase()];
  if (!promo) throw new Error('Invalid promo code.');
  if (promo.minOrder && subtotal < promo.minOrder) throw new Error(`This code requires a minimum order of ₹${promo.minOrder}.`);
  let discount = 0;
  if (promo.type === 'percent') discount = Math.min((subtotal * promo.value) / 100, promo.maxDiscount || Infinity);
  else discount = promo.value;
  discount = Math.min(Math.round(discount), subtotal);
  return { discount, promoCode: String(code).toUpperCase() };
};

module.exports = {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  PROMO_CODES,
  lineTotal,
  computeSubtotal,
  computeShipping,
  computeDiscount,
};
