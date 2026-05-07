import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  'src',
  'tests',
  'scripts',
  'docs',
  'plugins',
  'generated',
  'examples',
  'README.md',
  'AGENTS.md',
  'UBIQUITOUS_LANGUAGE.md',
  'package.json',
] as const;

const OLD_TERM_EXEMPT_PATH_PREFIXES = [
  'docs/release/parity/',
  'docs/ideas/',
  'docs/learnings/',
] as const;

const EXEMPT_FILES = new Set([
  'UBIQUITOUS_LANGUAGE.md',
  'docs/release/parity-matrix.generated.md',
  'tests/contracts/terminology-active-surface.test.ts',
  'tests/contracts/terminology-product-surface.test.ts',
]);

const TEXT_EXTENSIONS = new Set([
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.js',
  '.yaml',
  '.yml',
]);

const OLD_TERMS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: 'workflow', pattern: /\bworkflows?\b/i },
  { name: 'recipe', pattern: /\brecipes?\b/i },
  { name: 'primitive', pattern: /\bprimitives?\b/i },
  { name: 'phase', pattern: /\bphases?\b/i },
  { name: 'dispatch', pattern: /\bdispatch(?:es|ed|ing)?\b/i },
  { name: 'synthesis', pattern: /\bsynthesis\b/i },
  { name: 'gate', pattern: /\bgates?\b/i },
  { name: 'artifact', pattern: /\bartifacts?\b/i },
  { name: 'event log', pattern: /\bevent logs?\b/i },
  { name: 'events.ndjson', pattern: /\bevents\.ndjson\b/i },
  { name: 'run root', pattern: /\brun root\b/i },
  { name: 'run_root', pattern: /\brun_root\b/i },
  { name: '--run-root', pattern: /--run-root\b/i },
  { name: 'runlog', pattern: /\brunlog\b/i },
  { name: 'RunLog', pattern: /\bRunLog\b/ },
  { name: 'rigor', pattern: /\brigor\b/i },
  { name: 'lane', pattern: /\blanes?\b/i },
  { name: 'spine', pattern: /\bspine\b/i },
  { name: 'dogfood', pattern: /\bdogfood\b/i },
];

const RUNTIME_FOUNDATION_RESIDUE: ReadonlyArray<{
  readonly name: string;
  readonly pattern: RegExp;
}> = [
  { name: 'core-v2', pattern: /\bcore-v2\b/i },
  { name: 'v2 runtime', pattern: /\bv2 runtime\b/i },
  { name: 'v2 token', pattern: /\bv2\b/i },
  { name: 'retained', pattern: /\bretained\b/i },
  { name: 'retired', pattern: /\bretired\b/i },
  { name: 'legacy runtime', pattern: /\blegacy runtime\b/i },
  { name: 'old runtime', pattern: /\bold runtime\b/i },
  { name: 'cutover', pattern: /\bcutover\b/i },
  { name: 'back-compat', pattern: /\bback-compat\b/i },
  { name: 'compatibility facade', pattern: /\bcompatibility facade\b/i },
  { name: 'CIRCUIT_V2_RUNTIME', pattern: /\bCIRCUIT_V2_RUNTIME\b/ },
  { name: 'CIRCUIT_DISABLE_V2_RUNTIME', pattern: /\bCIRCUIT_DISABLE_V2_RUNTIME\b/ },
  { name: 'CIRCUIT_V2_RUNTIME_CANDIDATE', pattern: /\bCIRCUIT_V2_RUNTIME_CANDIDATE\b/ },
  { name: 'review packet filename', pattern: /\bcircuit-v2-[^\s"']*review[^\s"']*/i },
  { name: 'src/core-v2 path', pattern: /\bsrc\/core-v2\b/i },
];

const REVIEW_PACKET_FILE = /^circuit-v2-.*review.*\.(?:zip|md)$/i;

function isExempt(path: string): boolean {
  return EXEMPT_FILES.has(path);
}

function isOldTermExempt(path: string): boolean {
  return (
    EXEMPT_FILES.has(path) ||
    OLD_TERM_EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

function isTextFile(path: string): boolean {
  for (const ext of TEXT_EXTENSIONS) {
    if (path.endsWith(ext)) return true;
  }
  return false;
}

function walk(path: string, files: string[]): void {
  if (isExempt(path)) return;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
      walk(join(path, entry), files);
    }
    return;
  }
  if (stat.isFile() && isTextFile(path)) files.push(path);
}

function activeFiles(): readonly string[] {
  const files: string[] = [];
  for (const root of ROOTS) {
    try {
      walk(root, files);
    } catch {
      // Optional roots can be absent in partial checkouts.
    }
  }
  return files;
}

describe('terminology — active repo surface', () => {
  it('active filenames use clean-break terminology', () => {
    const offenders = activeFiles().flatMap((file) => {
      if (isOldTermExempt(file)) return [];
      return OLD_TERMS.filter(({ pattern }) => pattern.test(file)).map(({ name }) => ({
        file,
        term: name,
      }));
    });

    expect(offenders).toEqual([]);
  });

  it('active file contents use clean-break terminology', () => {
    const offenders: Array<{
      readonly file: string;
      readonly line: number;
      readonly term: string;
    }> = [];

    for (const file of activeFiles()) {
      if (isOldTermExempt(file)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line === undefined) continue;
        for (const { name, pattern } of OLD_TERMS) {
          if (pattern.test(line)) {
            offenders.push({ file, line: index + 1, term: name });
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('active surfaces do not mention runtime transition residue', () => {
    const offenders: Array<{
      readonly file: string;
      readonly line: number;
      readonly term: string;
    }> = [];

    for (const file of activeFiles()) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line === undefined) continue;
        for (const { name, pattern } of RUNTIME_FOUNDATION_RESIDUE) {
          if (pattern.test(line)) {
            offenders.push({ file, line: index + 1, term: name });
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('repo root has no review packet files or runtime transition paths', () => {
    const rootOffenders = readdirSync('.').filter((entry) => REVIEW_PACKET_FILE.test(entry));
    expect(rootOffenders).toEqual([]);
    expect(() => statSync('src/core-v2')).toThrow();
    expect(() => statSync('tests/core-v2')).toThrow();
  });
});
