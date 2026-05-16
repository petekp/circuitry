export function slugifyTitle(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-');
}
