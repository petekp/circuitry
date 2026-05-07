// Run-relative projection path helper.
//
// Operator-facing projections read files by paths stored in run outputs. This
// helper keeps those reads inside the run folder, including when existing path
// segments are symlinks.
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { RunRelativePath } from '../schemas/scalars.js';

function isInside(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot !== '' && !fromRoot.startsWith('..') && !isAbsolute(fromRoot);
}

export function resolveRunRelative(runFolder: string, relPath: string): string {
  const parsed = RunRelativePath.safeParse(relPath);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`run-relative path rejected: ${JSON.stringify(relPath)} (${detail})`);
  }

  const rootAbs = resolve(runFolder);
  const targetAbs = resolve(rootAbs, parsed.data);
  if (!isInside(rootAbs, targetAbs)) {
    throw new Error(`run-relative path rejected: ${JSON.stringify(relPath)} escapes run folder`);
  }
  if (!existsSync(rootAbs)) return targetAbs;

  const rootReal = realpathSync.native(rootAbs);
  let cursor = rootAbs;
  for (const segment of parsed.data.split('/')) {
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) break;

    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `run-relative path rejected: ${JSON.stringify(relPath)} crosses symlink ${JSON.stringify(cursor)}`,
      );
    }

    const cursorReal = realpathSync.native(cursor);
    if (!isInside(rootReal, cursorReal)) {
      throw new Error(
        `run-relative path rejected: ${JSON.stringify(relPath)} escapes real run folder through ${JSON.stringify(cursor)}`,
      );
    }
  }

  return targetAbs;
}
