import { execFileSync } from 'node:child_process';

// Cross-cutting formatting primitives shared by the generation scripts under
// scripts/. These were duplicated verbatim in scripts/release/shared.ts and
// scripts/schemas/emit-yaml-schemas.ts; hoisting them here keeps a single
// source of truth for "how generated JSON is canonicalized and biome-formatted"
// so drift checks across release and schema emitters stay byte-aligned.

// Pretty-print a value as stable JSON with a trailing newline. Generated JSON
// artifacts are committed in this shape so a `--check` byte comparison is
// meaningful.
export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// Run `biome format` over the supplied content via stdin, using `relPath` as
// the virtual file path so biome applies the right per-path formatting rules.
// `cwd` selects the project whose biome config governs the format. Returns the
// formatted content; callers compare it against the committed bytes.
export function formatWithBiome(relPath: string, content: string, cwd: string): string {
  return execFileSync('npx', ['biome', 'format', '--stdin-file-path', relPath], {
    cwd,
    input: content,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
