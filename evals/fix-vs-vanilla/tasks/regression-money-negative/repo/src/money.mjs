export function parseAmount(input) {
  const cleaned = String(input).replace(/[^0-9.]/g, '');
  if (cleaned === '') return 0;
  return Number(cleaned);
}
