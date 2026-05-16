export function getByPointer(document, pointer) {
  if (pointer === '') return document;
  if (!pointer.startsWith('/')) return undefined;

  let current = document;
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = rawToken.replaceAll('~0', '~').replaceAll('~1', '/');
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else if (
      current !== null &&
      typeof current === 'object' &&
      Object.prototype.hasOwnProperty.call(current, token)
    ) {
      current = current[token];
    } else {
      return undefined;
    }
  }

  return current;
}
