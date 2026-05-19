export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function mean(values: readonly unknown[]): number | null {
  const usable = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}
