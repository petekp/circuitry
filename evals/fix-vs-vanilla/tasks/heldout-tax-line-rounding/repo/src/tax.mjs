export function totalTaxCents(lines, rateBps) {
  const taxableSubtotal = lines.reduce((sum, line) => {
    const discount = line.discountCents ?? 0;
    return sum + line.amountCents - discount;
  }, 0);

  return Math.round((taxableSubtotal * rateBps) / 10000);
}
