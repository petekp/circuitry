export function canAcceptRequest(historyMs, nowMs, windowMs, limit) {
  const active = historyMs.filter((timestamp) => nowMs - timestamp <= windowMs);
  return active.length < limit;
}
