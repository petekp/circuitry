export function extractH2SectionBodies(
  markdown: string,
): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split(/\r?\n/);
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentHeading) {
      return;
    }

    sections[currentHeading] = buffer.join("\n").trim();
  };

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);

    if (match) {
      flush();
      currentHeading = match[1];
      buffer = [];
      continue;
    }

    if (currentHeading) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

export function extractFirstTitleLine(markdown: string): string | null {
  const match = /^#\s+(.+?)\s*$/m.exec(markdown);
  return match ? match[1] : null;
}
