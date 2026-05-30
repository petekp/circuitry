import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/**
 * Canonical enumerator for the "source files" of a single run whose latest mtime
 * defines `source_fingerprint.latest_source_mtime_ms`.
 *
 * Both the index-rebuild path (extract.ts) and the staleness-recompute path
 * (indexer.ts) MUST derive their fingerprint file set from THIS function, so the
 * recorded fingerprint and the recomputed fingerprint enumerate identical file
 * sets by construction. Two divergent walkers previously caused a fresh rebuild
 * to be reported `possibly_stale` (SD-FIX-1).
 *
 * Inclusion policy (intent: only files that contribute documents drive staleness):
 *   - `manifest.snapshot.json` (run root), if present
 *   - `trace.ndjson` (run root), if present
 *   - every `*.json` under `reports/` (recursively)
 * Non-JSON reports (e.g. `run-surface.md`, `operator-summary.md/.html`) are
 * generated OUTPUTS, not sources, so they are EXCLUDED from the fingerprint.
 *
 * Symlink policy (explicit, identical on both sides): symlinks are NOT followed.
 * A symlinked entry under `reports/` is skipped, and any real path that escapes
 * the reports root is rejected. This matches the stricter rebuild-side stance.
 */
export function collectRunSourceFiles(runFolder: string): string[] {
  const runFolderAbs = resolve(runFolder);
  const files = new Set<string>();

  for (const candidate of [
    resolve(runFolderAbs, 'manifest.snapshot.json'),
    resolve(runFolderAbs, 'trace.ndjson'),
  ]) {
    if (existsSync(candidate) && !isSymlink(candidate)) files.add(candidate);
  }

  const reportsRoot = resolve(runFolderAbs, 'reports');
  for (const absPath of walkReportJsonFiles(reportsRoot)) {
    files.add(absPath);
  }

  return [...files].sort();
}

function isSymlink(absPath: string): boolean {
  try {
    return lstatSync(absPath).isSymbolicLink();
  } catch {
    return false;
  }
}

function isInside(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

function walkReportJsonFiles(reportsRoot: string): string[] {
  if (!existsSync(reportsRoot)) return [];
  const rootReal = realpathSync.native(reportsRoot);
  const out: string[] = [];
  const stack = [reportsRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absPath = resolve(current, entry.name);
      // Do NOT follow symlinks: skip them outright on both sides. We check the
      // dirent flag first (cheap, from readdir) and fall back to lstat so a
      // symlink is excluded regardless of how the entry was reported.
      if (entry.isSymbolicLink() || lstatSync(absPath).isSymbolicLink()) continue;
      const real = realpathSync.native(absPath);
      if (!isInside(rootReal, real)) continue;
      if (entry.isDirectory()) {
        stack.push(absPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        out.push(absPath);
      }
    }
  }

  return out;
}
