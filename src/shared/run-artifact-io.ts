import { statSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';

// Run-folder-relative path for an artifact reference: when the path is absolute
// it is rebased onto the run folder; an already-relative path is returned as-is.
// Verbatim consolidation of the byte-identical copies formerly in
// process-evidence/projection.ts and run-envelope/source-record.ts.
export function runRelativePath(runFolder: string, path: string): string {
  return isAbsolute(path) ? relative(runFolder, path) : path;
}

// Modification time of an artifact in whole milliseconds. Truncated to an
// integer so source fingerprints stay stable across platforms whose statSync
// reports sub-millisecond precision. Verbatim consolidation of history's
// mtimeMs (extract.ts) and indexer.ts's inline statSync(...).mtimeMs read.
export function mtimeMs(path: string): number {
  return Math.trunc(statSync(path).mtimeMs);
}
