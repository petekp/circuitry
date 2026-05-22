import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';

import type { SafeApplyReasonCode } from '../../schemas/change-packet.js';
import type { Sha256 } from '../../schemas/ref.js';

export type GuardedPatchApplyInput = {
  readonly projectRoot: string;
  readonly patchPath: string;
  readonly expectedPatchSha256: Sha256;
  readonly baseRef?: string;
  readonly expectedBaseTreeHash?: Sha256;
  readonly keepTempRoot?: boolean;
};

export type ParentMutationStatus = 'none' | 'applied' | 'possible';

export type GuardedPatchApplyResult =
  | {
      readonly status: 'applied';
      readonly reason_codes: readonly ['applied'];
      readonly temp_root: string;
      readonly temp_root_removed: boolean;
      readonly parent_mutation: 'applied';
    }
  | {
      readonly status: 'rejected';
      readonly reason_codes: readonly [SafeApplyReasonCode];
      readonly temp_root?: string;
      readonly temp_root_removed: boolean;
      readonly parent_mutation: Exclude<ParentMutationStatus, 'applied'>;
      readonly stderr: string;
    };

function sha256File(path: string): Sha256 {
  return createHash('sha256').update(readFileSync(path)).digest('hex') as Sha256;
}

function sha256Text(text: string): Sha256 {
  return createHash('sha256').update(text).digest('hex') as Sha256;
}

function runGit(cwd: string, args: readonly string[]): void {
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50_000_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readGit(cwd: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50_000_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readGitRaw(cwd: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50_000_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function errorMessage(error: unknown): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'stderr' in error &&
    Buffer.isBuffer((error as { stderr: unknown }).stderr)
  ) {
    return (error as { stderr: Buffer }).stderr.toString('utf8').trim();
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'stderr' in error &&
    typeof (error as { stderr: unknown }).stderr === 'string'
  ) {
    return (error as { stderr: string }).stderr.trim();
  }
  return error instanceof Error ? error.message : String(error);
}

function cleanupTempRoot(tempRoot: string, keepTempRoot: boolean | undefined): boolean {
  if (keepTempRoot) return false;
  rmSync(tempRoot, { recursive: true, force: true });
  return true;
}

function isInsideRoot(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function rejectBeforeTempRoot(
  reason: SafeApplyReasonCode,
  stderr: string,
): GuardedPatchApplyResult {
  return {
    status: 'rejected',
    reason_codes: [reason],
    temp_root_removed: false,
    parent_mutation: 'none',
    stderr,
  };
}

function trackedParentIsDirty(projectRoot: string): boolean {
  try {
    runGit(projectRoot, ['diff-index', '--quiet', 'HEAD', '--']);
    return false;
  } catch {
    return true;
  }
}

function untrackedParentPaths(projectRoot: string): string[] {
  const output = readGitRaw(projectRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  return output.split('\0').filter(Boolean);
}

export function guardedApplyPatch(input: GuardedPatchApplyInput): GuardedPatchApplyResult {
  let projectRoot: string;
  try {
    projectRoot = realpathSync(resolve(input.projectRoot));
  } catch (error) {
    return rejectBeforeTempRoot('packet_invalid', errorMessage(error));
  }
  const patchPath = resolve(projectRoot, input.patchPath);
  let realPatchPath: string;
  try {
    realPatchPath = realpathSync(patchPath);
  } catch (error) {
    return rejectBeforeTempRoot('packet_invalid', errorMessage(error));
  }
  if (!isInsideRoot(projectRoot, realPatchPath)) {
    return rejectBeforeTempRoot(
      'packet_invalid',
      `patch path must stay inside project root: ${input.patchPath}`,
    );
  }

  let actualPatchSha256: Sha256;
  try {
    actualPatchSha256 = sha256File(realPatchPath);
  } catch (error) {
    return rejectBeforeTempRoot('packet_invalid', errorMessage(error));
  }
  if (actualPatchSha256 !== input.expectedPatchSha256) {
    return rejectBeforeTempRoot(
      'patch_hash_mismatch',
      `patch hash mismatch: expected ${input.expectedPatchSha256}, got ${actualPatchSha256}`,
    );
  }

  if (input.baseRef !== undefined) {
    try {
      const expectedBase = readGit(projectRoot, ['rev-parse', input.baseRef]);
      const actualBase = readGit(projectRoot, ['rev-parse', 'HEAD']);
      if (expectedBase !== actualBase) {
        return rejectBeforeTempRoot(
          'base_mismatch',
          `base mismatch: expected ${expectedBase}, got ${actualBase}`,
        );
      }
    } catch (error) {
      return rejectBeforeTempRoot('base_mismatch', errorMessage(error));
    }
  }

  if (input.expectedBaseTreeHash !== undefined) {
    try {
      const actualTreeHash = sha256Text(readGitRaw(projectRoot, ['ls-tree', '-r', '-z', 'HEAD']));
      if (actualTreeHash !== input.expectedBaseTreeHash) {
        return rejectBeforeTempRoot(
          'base_mismatch',
          `base tree mismatch: expected ${input.expectedBaseTreeHash}, got ${actualTreeHash}`,
        );
      }
    } catch (error) {
      return rejectBeforeTempRoot('base_mismatch', errorMessage(error));
    }
  }

  const patchRelativePath = relative(projectRoot, realPatchPath);
  if (trackedParentIsDirty(projectRoot)) {
    return rejectBeforeTempRoot('dirty_parent', 'parent checkout has tracked changes');
  }
  const unrelatedUntrackedPaths = untrackedParentPaths(projectRoot).filter(
    (path) => path !== patchRelativePath,
  );
  if (unrelatedUntrackedPaths.length > 0) {
    return rejectBeforeTempRoot(
      'dirty_parent',
      `parent checkout has untracked paths: ${unrelatedUntrackedPaths.join(', ')}`,
    );
  }

  const tempRoot = mkdtempSync(resolve(tmpdir(), 'circuit-safe-apply-'));
  let tempRootRemoved = false;
  let failureReason: SafeApplyReasonCode = 'apply_conflict';
  let parentMutation: Exclude<ParentMutationStatus, 'applied'> = 'none';
  try {
    runGit(tmpdir(), ['clone', '--quiet', '--shared', '--no-checkout', projectRoot, tempRoot]);
    failureReason = 'base_mismatch';
    runGit(tempRoot, ['checkout', '--quiet', input.baseRef ?? 'HEAD']);
    failureReason = 'apply_conflict';
    runGit(tempRoot, ['apply', '--check', realPatchPath]);
    runGit(tempRoot, ['apply', realPatchPath]);

    runGit(projectRoot, ['apply', '--check', realPatchPath]);
    parentMutation = 'possible';
    runGit(projectRoot, ['apply', realPatchPath]);

    tempRootRemoved = cleanupTempRoot(tempRoot, input.keepTempRoot);
    return {
      status: 'applied',
      reason_codes: ['applied'],
      temp_root: tempRoot,
      temp_root_removed: tempRootRemoved,
      parent_mutation: 'applied',
    };
  } catch (error) {
    tempRootRemoved = cleanupTempRoot(tempRoot, input.keepTempRoot);
    return {
      status: 'rejected',
      reason_codes: [failureReason],
      temp_root: tempRoot,
      temp_root_removed: tempRootRemoved,
      parent_mutation: parentMutation,
      stderr: errorMessage(error),
    };
  }
}
