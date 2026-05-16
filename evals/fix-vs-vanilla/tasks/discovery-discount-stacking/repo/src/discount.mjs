export function finalPriceCents({ subtotalCents, couponPercent = 0 }) {
  let discountPercent = 0;

  if (subtotalCents > 10000) {
    discountPercent = 10;
  }
  if (subtotalCents > 20000) {
    discountPercent = 15;
  }

  if (couponPercent > 0) {
    discountPercent += couponPercent;
  }

  return Math.max(0, Math.round(subtotalCents * (1 - discountPercent / 100)));
}
