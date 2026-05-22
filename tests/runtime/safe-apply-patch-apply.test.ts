import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { guardedApplyPatch } from '../../src/runtime/safe-apply/patch-apply.js';

let root: string;

function git(args: readonly string[]): void {
  execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

function gitOutput(args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function treeFingerprint(): string {
  return sha256(
    execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
}

function writePatch(name: string, body: string): string {
  const path = join(root, name);
  writeFileSync(path, body);
  return path;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'circuit-safe-apply-test-'));
  git(['init', '--quiet']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Circuit Test']);
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src/example.txt'), 'before\n');
  git(['add', 'src/example.txt']);
  git(['commit', '--quiet', '-m', 'initial']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('guardedApplyPatch', () => {
  it('prechecks in a temporary root before applying to the parent checkout', () => {
    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('change.patch', patch);

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: sha256(patch),
      expectedBaseTreeHash: treeFingerprint(),
    });

    expect(result.status).toBe('applied');
    expect(result.parent_mutation).toBe('applied');
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('after\n');
    expect(result.temp_root_removed).toBe(true);
  });

  it('resolves relative patch paths from the project root', () => {
    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    writePatch('relative.patch', patch);

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath: 'relative.patch',
      expectedPatchSha256: sha256(patch),
    });

    expect(result.status).toBe('applied');
    expect(result.parent_mutation).toBe('applied');
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('after\n');
  });

  it('rejects patch hash mismatches before creating an apply root', () => {
    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('change.patch', patch);

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: '0'.repeat(64),
    });

    expect(result).toMatchObject({
      status: 'rejected',
      reason_codes: ['patch_hash_mismatch'],
      parent_mutation: 'none',
      temp_root_removed: false,
    });
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
  });

  it('rejects missing patch files before creating an apply root', () => {
    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath: 'missing.patch',
      expectedPatchSha256: '0'.repeat(64),
    });

    expect(result).toMatchObject({
      status: 'rejected',
      reason_codes: ['packet_invalid'],
      parent_mutation: 'none',
      temp_root_removed: false,
    });
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
  });

  it('rejects patch paths outside the project root before reading them', () => {
    const outsideRoot = mkdtempSync(join(tmpdir(), 'circuit-safe-apply-outside-'));
    try {
      const patch = [
        'diff --git a/src/example.txt b/src/example.txt',
        '--- a/src/example.txt',
        '+++ b/src/example.txt',
        '@@ -1 +1 @@',
        '-before',
        '+after',
        '',
      ].join('\n');
      const patchPath = join(outsideRoot, 'outside.patch');
      writeFileSync(patchPath, patch);

      const result = guardedApplyPatch({
        projectRoot: root,
        patchPath,
        expectedPatchSha256: sha256(patch),
      });

      expect(result).toMatchObject({
        status: 'rejected',
        reason_codes: ['packet_invalid'],
        parent_mutation: 'none',
        temp_root_removed: false,
      });
      expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('rejects patch symlinks that resolve outside the project root', () => {
    const outsideRoot = mkdtempSync(join(tmpdir(), 'circuit-safe-apply-symlink-'));
    try {
      const patch = [
        'diff --git a/src/example.txt b/src/example.txt',
        '--- a/src/example.txt',
        '+++ b/src/example.txt',
        '@@ -1 +1 @@',
        '-before',
        '+after',
        '',
      ].join('\n');
      const outsidePatchPath = join(outsideRoot, 'outside.patch');
      const linkPath = join(root, 'linked.patch');
      writeFileSync(outsidePatchPath, patch);
      symlinkSync(outsidePatchPath, linkPath);

      const result = guardedApplyPatch({
        projectRoot: root,
        patchPath: 'linked.patch',
        expectedPatchSha256: sha256(patch),
      });

      expect(result).toMatchObject({
        status: 'rejected',
        reason_codes: ['packet_invalid'],
        parent_mutation: 'none',
        temp_root_removed: false,
      });
      expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('rejects patch conflicts without mutating the parent checkout', () => {
    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-not-the-current-content',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('conflict.patch', patch);

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: sha256(patch),
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_codes).toEqual(['apply_conflict']);
    expect(result.parent_mutation).toBe('none');
    expect(result.temp_root_removed).toBe(true);
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
  });

  it('reports missing base refs as base mismatches before parent mutation', () => {
    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('missing-base.patch', patch);

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: sha256(patch),
      baseRef: 'missing-safe-apply-base',
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_codes).toEqual(['base_mismatch']);
    expect(result.parent_mutation).toBe('none');
    expect(result.temp_root_removed).toBe(false);
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
  });

  it('rejects stale base refs before parent mutation even when the patch applies cleanly', () => {
    const initialBase = gitOutput(['rev-parse', 'HEAD']);
    writeFileSync(join(root, 'src/unrelated.txt'), 'unrelated\n');
    git(['add', 'src/unrelated.txt']);
    git(['commit', '--quiet', '-m', 'unrelated']);

    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('stale-base.patch', patch);

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: sha256(patch),
      baseRef: initialBase,
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_codes).toEqual(['base_mismatch']);
    expect(result.parent_mutation).toBe('none');
    expect(result.temp_root_removed).toBe(false);
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
  });

  it('rejects base tree mismatches before parent mutation', () => {
    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('tree-mismatch.patch', patch);

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: sha256(patch),
      expectedBaseTreeHash: '0'.repeat(64),
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_codes).toEqual(['base_mismatch']);
    expect(result.parent_mutation).toBe('none');
    expect(result.temp_root_removed).toBe(false);
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
  });

  it('rejects dirty tracked parent changes before parent mutation', () => {
    writeFileSync(join(root, 'src/unrelated.txt'), 'before\n');
    git(['add', 'src/unrelated.txt']);
    git(['commit', '--quiet', '-m', 'add unrelated']);

    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('dirty-parent.patch', patch);
    writeFileSync(join(root, 'src/unrelated.txt'), 'operator edit\n');

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: sha256(patch),
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_codes).toEqual(['dirty_parent']);
    expect(result.parent_mutation).toBe('none');
    expect(result.temp_root_removed).toBe(false);
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
    expect(readFileSync(join(root, 'src/unrelated.txt'), 'utf8')).toBe('operator edit\n');
  });

  it('rejects dirty untracked parent changes other than the patch artifact', () => {
    const patch = [
      'diff --git a/src/example.txt b/src/example.txt',
      '--- a/src/example.txt',
      '+++ b/src/example.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n');
    const patchPath = writePatch('dirty-untracked-parent.patch', patch);
    writeFileSync(join(root, 'src/operator-note.txt'), 'operator note\n');

    const result = guardedApplyPatch({
      projectRoot: root,
      patchPath,
      expectedPatchSha256: sha256(patch),
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_codes).toEqual(['dirty_parent']);
    expect(result.parent_mutation).toBe('none');
    expect(result.temp_root_removed).toBe(false);
    expect(readFileSync(join(root, 'src/example.txt'), 'utf8')).toBe('before\n');
  });
});
