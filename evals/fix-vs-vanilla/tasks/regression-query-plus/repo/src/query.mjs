export function parseQuery(query) {
  const trimmed = query.startsWith('?') ? query.slice(1) : query;
  const out = {};

  for (const part of trimmed.split('&')) {
    if (part.length === 0) continue;
    const [rawKey, rawValue = ''] = part.split('=');
    out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
  }

  return out;
}
