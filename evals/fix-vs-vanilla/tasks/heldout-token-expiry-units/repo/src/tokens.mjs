export function isExpired(token, nowMs) {
  const expiresAtMs = token.expiresAt ?? 0;
  return expiresAtMs <= nowMs;
}
