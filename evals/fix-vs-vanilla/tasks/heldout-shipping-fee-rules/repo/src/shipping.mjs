export function shippingFeeCents({ subtotalCents, region = 'domestic', expedited = false }) {
  let fee = subtotalCents > 5000 ? 0 : 599;

  if (region === 'international') {
    fee += 1500;
  }

  if (expedited) {
    fee += 899;
  }

  return fee;
}
