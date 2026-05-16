export function movingAverage(values, windowSize) {
  if (windowSize <= 0) {
    throw new RangeError('windowSize must be positive');
  }

  const averages = [];
  for (let index = windowSize; index < values.length; index += 1) {
    const window = values.slice(index - windowSize + 1, index + 1);
    const total = window.reduce((sum, value) => sum + value, 0);
    averages.push(total / window.length);
  }
  return averages;
}
