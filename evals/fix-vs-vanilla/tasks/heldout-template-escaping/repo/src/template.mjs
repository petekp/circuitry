export function render(template, data) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path) => {
    const value = lookup(data, path.trim());
    return value ? String(value) : '';
  });
}

function lookup(data, path) {
  return path.split('.').reduce((current, part) => {
    if (current === null || typeof current !== 'object') return undefined;
    return current[part];
  }, data);
}
