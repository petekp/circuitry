import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gitWorktreeRunner } from '../../src/runtime/fanout/worktree.js';

/**
 * Characterization tests for `gitWorktreeRunner` (src/runtime/fanout/worktree.ts).
 *
 * This module shells out to real `git` via `spawnSync` and had ZERO coverage
 * before the Phase 3 fanout restructure. These tests LOCK current behavior —
 * including the exact thrown-Error message FORMATS — so the restructure has a
 * safety net. They are NOT a spec; if `git` behaves a certain way today, we
 * assert that, surprises included.
 *
 * Hermeticity contract:
 *   - Every repo is a fresh `git init` in an OS temp dir; we never read or
 *     mutate the surrounding circuit repo's git state.
 *   - user.email / user.name / commit.gpgsign are set on the *local* repo
 *     config only (via `git -c` for init and `git config --local` after), so
 *     commits succeed on any machine without touching the developer's global
 *     git config.
 *   - Worktrees live in a SIBLING temp dir, never inside the repo working tree.
 *   - Both temp dirs are removed in afterEach even on failure.
 *
 * CHARACTERIZATION FINDING 1: `add()` and `remove()` pass NO `cwd` to spawnSync,
 * so they implicitly operate on the *process* working directory — git must
 * resolve the target repo from `process.cwd()`. Only `changedFiles()` pins
 * `cwd: worktreePath`. To exercise add/remove hermetically we `process.chdir`
 * into the temp repo for the duration of each test and restore cwd in afterEach;
 * this both makes the tests deterministic AND documents the implicit-cwd contract
 * the Phase 3 restructure must preserve (or deliberately change). See the
 * dedicated "operates on process.cwd" test for the explicit lock.
 *
 * CHARACTERIZATION FINDING 2: all three methods are SYNCHRONOUS — declared
 * `void`/`readonly string[]`, not `async`, and they `throw` rather than reject.
 * (The WorktreeRunner interface permits a Promise return, but this concrete
 * impl never returns one.) So error paths must be asserted with the SYNC form
 * `expect(() => fn()).toThrow(...)`; an `.rejects` form would never see a
 * promise because the throw escapes argument evaluation before one is built.
 */

// `changedFiles` is declared optional on the WorktreeRunner interface
// (`changedFiles?`), so the implementation we are characterizing might in
// principle omit it. Bind a guaranteed-present reference up front; if it is
// ever dropped, this throws loudly rather than silently skipping coverage.
/**
 * Call `changedFiles` and characterize that THIS impl returns synchronously (an
 * array, never a Promise). The interface return type is the union
 * `readonly string[] | Promise<readonly string[]>`; we assert the array branch
 * at runtime and narrow it so happy-path tests can spread/compare directly. If
 * the Phase 3 restructure makes it async, this assertion fails loudly rather
 * than silently passing a never-resolved Promise into a `.toEqual`.
 *
 * `changedFiles` is also declared OPTIONAL on the interface (`changedFiles?`),
 * so we assert it is present up front — if a restructure drops it, this throws
 * loudly rather than silently skipping coverage.
 */
function changedFiles(worktreePath: string, baseRef: string): readonly string[] {
  const method = gitWorktreeRunner.changedFiles;
  if (method === undefined) {
    throw new Error('gitWorktreeRunner.changedFiles is expected to be defined');
  }
  const result = method(worktreePath, baseRef);
  if (result instanceof Promise) {
    throw new Error('expected gitWorktreeRunner.changedFiles to return synchronously');
  }
  return result;
}

const BASE_BRANCH = 'trunk';

/** Run git in `cwd`, returning the spawn result. Does not throw on nonzero. */
function git(cwd: string, ...args: string[]): SpawnSyncReturns<string> {
  // `encoding: 'utf8'` makes stdout/stderr strings; type it explicitly so the
  // string-only overload is selected (the bare ReturnType is `string | Buffer`).
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

/** Run git in `cwd` and assert success, surfacing stderr on failure. */
function gitOk(cwd: string, ...args: string[]): string {
  const result = git(cwd, ...args);
  if (result.status !== 0) {
    throw new Error(`setup git ${args.join(' ')} failed: ${result.stderr ?? ''}`);
  }
  return (result.stdout ?? '').trim();
}

let repoDir: string;
let worktreeParent: string;
let baseRef: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  repoDir = await mkdtemp(join(tmpdir(), 'circuit-wt-repo-'));
  worktreeParent = await mkdtemp(join(tmpdir(), 'circuit-wt-trees-'));

  // `-c init.defaultBranch` pins the initial branch name so the base ref is
  // deterministic regardless of the host's git defaults (main vs master).
  gitOk(repoDir, '-c', `init.defaultBranch=${BASE_BRANCH}`, 'init');
  // Local-only identity + disabled signing so the commit below works in any
  // environment (CI, signing-required global config, etc.).
  gitOk(repoDir, 'config', '--local', 'user.email', 'circuit-test@example.com');
  gitOk(repoDir, 'config', '--local', 'user.name', 'Circuit Test');
  gitOk(repoDir, 'config', '--local', 'commit.gpgsign', 'false');

  await writeFile(join(repoDir, 'README.md'), 'base\n', 'utf8');
  gitOk(repoDir, 'add', 'README.md');
  gitOk(repoDir, 'commit', '-m', 'initial commit');

  // Capture the immutable base ref (full SHA) of the initial commit.
  baseRef = gitOk(repoDir, 'rev-parse', 'HEAD');

  // add()/remove() carry no cwd, so git resolves the repo from process.cwd().
  // Anchor the process at the temp repo so these methods act on it (and never
  // on the surrounding circuit repo). Restored in afterEach.
  process.chdir(repoDir);
});

afterEach(async () => {
  // Restore cwd BEFORE removing temp dirs so we never leave the process parked
  // inside a directory we are about to delete.
  process.chdir(originalCwd);
  await rm(repoDir, { recursive: true, force: true });
  await rm(worktreeParent, { recursive: true, force: true });
});

/** Resolve the symbolic HEAD branch name inside a worktree. */
function headBranch(worktreePath: string): string {
  return gitOk(worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD');
}

describe('gitWorktreeRunner.add', () => {
  it('creates a worktree directory on a new branch checked out from baseRef', () => {
    const worktreePath = join(worktreeParent, 'feature-a');

    gitWorktreeRunner.add({ worktreePath, baseRef, branchName: 'feature-a' });

    // The worktree directory now exists on disk...
    expect(existsSync(worktreePath)).toBe(true);
    // ...and is git-aware (a .git file/pointer is present in a linked worktree).
    expect(existsSync(join(worktreePath, '.git'))).toBe(true);
    // HEAD inside the worktree is the freshly created branch.
    expect(headBranch(worktreePath)).toBe('feature-a');
    // The new branch points at the same commit as baseRef (branched from it).
    expect(gitOk(worktreePath, 'rev-parse', 'HEAD')).toBe(baseRef);
  });

  it('throws with the "git worktree add failed (exit" format when the branch name already exists', () => {
    const firstPath = join(worktreeParent, 'dup-1');
    const secondPath = join(worktreeParent, 'dup-2');
    gitWorktreeRunner.add({ worktreePath: firstPath, baseRef, branchName: 'dup' });

    // Reusing an existing branch name with `-b` is a git error (exit 255 today).
    expect(() =>
      gitWorktreeRunner.add({ worktreePath: secondPath, baseRef, branchName: 'dup' }),
    ).toThrow(/^git worktree add failed \(exit /);
  });

  it('throws with the "git worktree add failed (exit" format for a bogus baseRef', () => {
    const worktreePath = join(worktreeParent, 'bogus-base');

    expect(() =>
      gitWorktreeRunner.add({
        worktreePath,
        baseRef: 'this-ref-does-not-exist',
        branchName: 'from-bogus',
      }),
    ).toThrow(/^git worktree add failed \(exit /);
  });

  it('operates on process.cwd() (no cwd is passed to spawnSync), so it throws when cwd is not the target repo', () => {
    // Locks the implicit-cwd contract: add() resolves the repo from the process
    // working directory, NOT from worktreePath. When cwd is not a git repo, git
    // exits 128 ("not a git repository") and the failure surfaces in the add
    // message format. The Phase 3 restructure should treat this as load-bearing.
    const worktreePath = join(worktreeParent, 'cwd-dependent');
    process.chdir(worktreeParent); // a temp dir that is not a git repo
    expect(() =>
      gitWorktreeRunner.add({ worktreePath, baseRef, branchName: 'cwd-dependent' }),
    ).toThrow(/^git worktree add failed \(exit /);
  });
});

describe('gitWorktreeRunner.remove', () => {
  it('removes a previously added worktree so git no longer lists it', () => {
    const worktreePath = join(worktreeParent, 'to-remove');
    gitWorktreeRunner.add({ worktreePath, baseRef, branchName: 'to-remove' });
    expect(existsSync(worktreePath)).toBe(true);
    expect(gitOk(repoDir, 'worktree', 'list')).toContain(worktreePath);

    gitWorktreeRunner.remove(worktreePath);

    // The directory is gone and `git worktree list` no longer mentions it.
    expect(existsSync(worktreePath)).toBe(false);
    expect(gitOk(repoDir, 'worktree', 'list')).not.toContain(worktreePath);
  });

  it('throws with the "git worktree remove failed (exit" format for a path that is not a worktree', () => {
    const notAWorktree = join(worktreeParent, 'never-added');

    expect(() => gitWorktreeRunner.remove(notAWorktree)).toThrow(
      /^git worktree remove failed \(exit /,
    );
  });
});

describe('gitWorktreeRunner.changedFiles', () => {
  it('returns [] (not [""]) when the worktree HEAD equals baseRef', () => {
    const worktreePath = join(worktreeParent, 'no-changes');
    gitWorktreeRunner.add({ worktreePath, baseRef, branchName: 'no-changes' });

    const result = changedFiles(worktreePath, baseRef);

    // Empty diff: the trailing-blank-line filter must yield [] rather than [''].
    expect(result).toEqual([]);
  });

  it('returns the names of files added/modified and committed in the worktree', async () => {
    const worktreePath = join(worktreeParent, 'with-changes');
    gitWorktreeRunner.add({ worktreePath, baseRef, branchName: 'with-changes' });

    // One new file and one modification to the pre-existing base file.
    await writeFile(join(worktreePath, 'added.txt'), 'new file\n', 'utf8');
    await writeFile(join(worktreePath, 'README.md'), 'base\nmore\n', 'utf8');
    gitOk(worktreePath, 'add', 'added.txt', 'README.md');
    gitOk(worktreePath, 'commit', '-m', 'work in worktree');

    const result = changedFiles(worktreePath, baseRef);

    // git diff --name-only reports both paths (sorted by git); assert the set.
    expect([...result].sort()).toEqual(['README.md', 'added.txt']);
  });

  it('throws with the "git diff --name-only failed (exit" format for a bogus baseRef', () => {
    const worktreePath = join(worktreeParent, 'diff-bogus');
    gitWorktreeRunner.add({ worktreePath, baseRef, branchName: 'diff-bogus' });

    expect(() => changedFiles(worktreePath, 'this-ref-does-not-exist')).toThrow(
      /^git diff --name-only failed \(exit /,
    );
  });
});
