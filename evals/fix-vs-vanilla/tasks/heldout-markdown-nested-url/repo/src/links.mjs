export function extractLinks(markdown) {
  const links = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = pattern.exec(markdown)) !== null) {
    links.push({
      text: match[1],
      href: match[2],
    });
  }

  return links;
}
