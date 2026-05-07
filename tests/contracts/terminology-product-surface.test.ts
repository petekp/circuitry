// Terminology regression test for product-facing prose.
//
// circuit-next teaches users a small layered vocabulary:
//
//   flow / schematic / block / route / relay / check / trace / report /
//   evidence / run folder / depth / mode / checkpoint
//
// The clean-break migration rejects the old vocabulary in active product
// surfaces and schematic purpose text. Historical/reference files are covered
// by the broader active-file audit, not this prose-only smoke test.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { flowPackages } from '../../src/flows/catalog.js';

const BANNED: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: 'workflow', pattern: /\bworkflow(s)?\b/i },
  { name: 'recipe', pattern: /\brecipe(s)?\b/i },
  { name: 'primitive', pattern: /\bprimitive(s)?\b/i },
  { name: 'phase', pattern: /\bphase(s)?\b/i },
  { name: 'dispatch', pattern: /\bdispatch(?:es|ed|ing)?\b/i },
  { name: 'synthesis', pattern: /\bsynthesis\b/i },
  { name: 'gate', pattern: /\bgate(s)?\b/i },
  { name: 'artifact', pattern: /\bartifact(s)?\b/i },
  { name: 'event log', pattern: /\bevent log\b/i },
  { name: 'events.ndjson', pattern: /\bevents\.ndjson\b/i },
  { name: 'run root', pattern: /\brun root\b/i },
  { name: 'run_root', pattern: /\brun_root\b/i },
  { name: '--run-root', pattern: /\b--run-root\b/i },
  { name: 'rigor', pattern: /\brigor\b/i },
  { name: 'lane', pattern: /\blane(s)?\b/i },
  { name: 'spine', pattern: /\bspine\b/i },
  { name: 'dogfood', pattern: /\bdogfood\b/i },
  { name: 'scalar', pattern: /\bscalar(s)?\b/i },
  { name: 'fixture', pattern: /\bfixture(s)?\b/i },
  { name: 'ADR-NNN id', pattern: /\bADR-[0-9]+\b/i },
  { name: 'Slice', pattern: /\bSlice\b/ },
  { name: 'CC#P[0-9]', pattern: /\bCC#P[0-9]/i },
  { name: 'placeholder-parity', pattern: /\bplaceholder-parity\b/i },
  { name: 'runtime-proof', pattern: /\bruntime-proof\b/i },
];

// Files where the banned vocabulary is allowed to appear in prose
// because the file documents the layered model itself.
const EXEMPT_FILES = new Set<string>(['UBIQUITOUS_LANGUAGE.md']);
const PUBLIC_FLOW_IDS = new Set(
  flowPackages.filter((pkg) => pkg.visibility === 'public').map((pkg) => pkg.id),
);

// Strip YAML frontmatter, fenced code blocks, and inline code spans.
// What remains is the prose surface that should teach the new vocabulary.
function stripCodeAndFrontmatter(source: string): string {
  let s = source;

  // Frontmatter at file head (--- ... ---). Only the first occurrence,
  // and only if the very first non-newline characters open it.
  if (s.startsWith('---\n')) {
    const end = s.indexOf('\n---', 4);
    if (end !== -1) {
      const lineBreak = s.indexOf('\n', end + 4);
      s = lineBreak === -1 ? '' : s.slice(lineBreak + 1);
    }
  }

  // Fenced code blocks. Matches ```lang? ... ```.
  s = s.replace(/```[\s\S]*?```/g, '');

  // Inline code spans. Single-backtick runs that don't span multiple
  // lines.
  s = s.replace(/`[^`\n]*`/g, '');

  // Markdown link targets — keep the link text, drop the URL/path.
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // HTML comments — these are doc-only markers, not prose.
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  return s;
}

// Catalog the files this test guards. We list explicit roots and walk
// directories so adding a new flow or doc doesn't silently dodge the
// check.
function listProductFacingFiles(): readonly string[] {
  const files: string[] = [];

  files.push('README.md');
  files.push('AGENTS.md');
  files.push('plugins/claude/README.md');

  // Direct command sources.
  for (const entry of readdirSync('src/commands')) {
    if (entry.endsWith('.md')) {
      files.push(join('src/commands', entry));
    }
  }

  // Per-flow command and contract sources.
  for (const id of readdirSync('src/flows')) {
    const dir = join('src/flows', id);
    let isDir = false;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) continue;
    const command = join(dir, 'command.md');
    const contract = join(dir, 'contract.md');
    try {
      if (statSync(command).isFile()) files.push(command);
    } catch {
      // not present
    }
    try {
      if (statSync(contract).isFile()) files.push(contract);
    } catch {
      // not present
    }
  }

  // Flow design notes.
  for (const entry of readdirSync('docs/flows')) {
    if (entry.endsWith('.md')) {
      files.push(join('docs/flows', entry));
    }
  }

  return files.filter((f) => !EXEMPT_FILES.has(f));
}

describe('terminology — product-facing prose', () => {
  // Anti-vacuity floor: if file discovery breaks (wrong root, missing
  // flow folders, etc.), this test would silently pass. Pin a
  // realistic minimum and surface a clear failure if it drops.
  it('discovers a non-trivial set of product-facing files', () => {
    const files = listProductFacingFiles();
    expect(
      files.length,
      'product-facing file discovery is unexpectedly small — the test would pass vacuously',
    ).toBeGreaterThanOrEqual(15);
  });

  it('product-facing prose uses the canonical Circuit vocabulary', () => {
    const offenders: {
      readonly file: string;
      readonly term: string;
      readonly line: number;
      readonly text: string;
    }[] = [];

    for (const file of listProductFacingFiles()) {
      const raw = readFileSync(file, 'utf8');
      const stripped = stripCodeAndFrontmatter(raw);
      const lines = stripped.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index];
        if (text === undefined) continue;
        for (const { name, pattern } of BANNED) {
          if (pattern.test(text)) {
            offenders.push({ file, term: name, line: index + 1, text: text.trim() });
          }
        }
      }
    }

    expect(
      offenders,
      [
        'Banned terminology found in product-facing prose.',
        'See UBIQUITOUS_LANGUAGE.md for the canonical vocabulary;',
        'internal/runtime names belong inside backticks or fenced code,',
        'or in low-level engine modules, not in product surfaces.',
      ].join(' '),
    ).toEqual([]);
  });

  it('schematic purpose text uses the canonical Circuit vocabulary', () => {
    const offenders: {
      readonly file: string;
      readonly term: string;
      readonly text: string;
    }[] = [];

    for (const id of readdirSync('src/flows')) {
      if (!PUBLIC_FLOW_IDS.has(id)) continue;
      const file = join('src/flows', id, 'schematic.json');
      try {
        if (!statSync(file).isFile()) continue;
      } catch {
        continue;
      }
      const raw = readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as { readonly purpose?: unknown };
      const text = typeof parsed.purpose === 'string' ? parsed.purpose : '';
      for (const { name, pattern } of BANNED) {
        if (pattern.test(text)) {
          offenders.push({ file, term: name, text });
        }
      }
    }

    expect(offenders, 'Banned terminology found in schematic purpose text.').toEqual([]);
  });

  it('flow source files use schematic and block names', () => {
    for (const path of [
      'src/schemas/flow-blocks.ts',
      'src/schemas/flow-schematic.ts',
      'docs/flows/block-catalog.json',
      'src/flows/compile-schematic-to-flow.ts',
    ]) {
      expect(statSync(path).isFile(), `${path} should exist`).toBe(true);
    }

    for (const path of [
      'src/schemas/flow-scalars.ts',
      'src/schemas/flow-recipe.ts',
      'docs/flows/scalar-catalog.json',
      'src/runtime/compile-recipe-to-flow.ts',
    ]) {
      expect(() => statSync(path), `${path} should not exist`).toThrow();
    }

    for (const id of PUBLIC_FLOW_IDS) {
      expect(statSync(join('src/flows', id, 'schematic.json')).isFile()).toBe(true);
      expect(() => statSync(join('src/flows', id, 'recipe.json'))).toThrow();
    }
  });

  it('ubiquitous language is based on flows, schematics, blocks, and relays', () => {
    const raw = readFileSync('UBIQUITOUS_LANGUAGE.md', 'utf8');

    for (const term of ['Flow', 'Schematic', 'Block', 'Stage', 'Route', 'Relay', 'Trace']) {
      expect(raw, `ubiquitous language should define ${term}`).toMatch(
        new RegExp(`\\*\\*${term}\\*\\*`),
      );
    }

    expect(raw).not.toMatch(/Stage 1 draft/);
    expect(raw).not.toMatch(/## Methodology vocabulary/);
    expect(raw).not.toMatch(/## Core types[\s\S]*\*\*CompiledFlow\*\* `\[draft\]`/);
  });
});
