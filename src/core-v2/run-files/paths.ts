import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

function isInsideOrSame(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

export function validateRunFilePath(runRelativePath: string): readonly string[] {
  const issues: string[] = [];
  if (runRelativePath.trim().length === 0) {
    issues.push('must be non-empty');
  }
  if (isAbsolute(runRelativePath)) {
    issues.push('must be relative');
  }
  if (runRelativePath.includes('\\')) {
    issues.push('must use POSIX "/" separators');
  }
  if (runRelativePath.includes(':')) {
    issues.push('must not contain drive-letter or colon forms');
  }
  if (
    runRelativePath
      .split('/')
      .some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    issues.push('must not contain empty, current-directory, or parent-directory segments');
  }
  return issues;
}

export function resolveRunFilePath(runDir: string, runRelativePath: string): string {
  if (runRelativePath.trim().length === 0) {
    throw new Error('run file path must be non-empty');
  }
  if (isAbsolute(runRelativePath)) {
    throw new Error(`run file path must be relative: ${runRelativePath}`);
  }

  const root = resolve(runDir);
  const fullPath = resolve(root, runRelativePath);
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    throw new Error(`run file path escapes run directory: ${runRelativePath}`);
  }
  if (fullPath === root) {
    throw new Error(`run file path must name a file: ${runRelativePath}`);
  }
  const validation = validateRunFilePath(runRelativePath);
  if (validation.length > 0) {
    throw new Error(`run file path ${validation[0]}: ${runRelativePath}`);
  }
  if (existsSync(root)) {
    if (lstatSync(root).isSymbolicLink()) {
      throw new Error(`run file path crosses symlink: ${runRelativePath}`);
    }
    const rootReal = realpathSync.native(root);
    let cursor = root;
    for (const segment of runRelativePath.split('/')) {
      cursor = resolve(cursor, segment);
      if (!existsSync(cursor)) break;
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new Error(`run file path crosses symlink: ${runRelativePath}`);
      }
      if (!isInsideOrSame(rootReal, realpathSync.native(cursor))) {
        throw new Error(`run file path escapes run directory through symlink: ${runRelativePath}`);
      }
    }
  }

  return fullPath;
}
