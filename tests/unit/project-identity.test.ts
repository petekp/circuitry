import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeGitRemoteUrl,
  readMemoryManifest,
  resolveProjectId,
  stampMemoryManifest,
} from '../../src/memory/project-identity.js';

const tempRoots: string[] = [];

function tempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'project-identity-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('resolveProjectId (Slice 5 D1)', () => {
  it('an explicit config project_id wins over git remote and runs-base', () => {
    const repoRoot = tempRepo();
    const resolved = resolveProjectId({
      repoRoot,
      configProjectId: 'my-pinned-project',
      gitRemoteUrl: 'git@github.com:owner/repo.git',
    });
    expect(resolved.source).toBe('config');
    expect(resolved.projectId).toBe('my-pinned-project');
    expect(resolved.warnings).toEqual([]);
  });

  it('a git remote yields a stable id with no instability warning', () => {
    const repoRoot = tempRepo();
    const resolved = resolveProjectId({
      repoRoot,
      gitRemoteUrl: 'git@github.com:owner/repo.git',
    });
    expect(resolved.source).toBe('git_remote');
    expect(resolved.warnings).toEqual([]);
    // SSH and HTTPS clones of the same repo hash to the same id.
    const https = resolveProjectId({
      repoRoot,
      gitRemoteUrl: 'https://github.com/owner/repo.git',
    });
    expect(https.projectId).toBe(resolved.projectId);
    expect(https.source).toBe('git_remote');
  });

  it('no remote and no config falls back to runs-base with project_id_unstable', () => {
    const repoRoot = tempRepo();
    const resolved = resolveProjectId({ repoRoot, gitRemoteUrl: null });
    expect(resolved.source).toBe('runs_base');
    expect(resolved.warnings).toHaveLength(1);
    expect(resolved.warnings[0]?.code).toBe('project_id_unstable');
  });

  it('normalizes ssh and https remotes to one basis', () => {
    expect(normalizeGitRemoteUrl('git@github.com:owner/repo.git')).toBe('github.com/owner/repo');
    expect(normalizeGitRemoteUrl('https://github.com/owner/repo.git')).toBe(
      'github.com/owner/repo',
    );
    expect(normalizeGitRemoteUrl('https://user@github.com/owner/repo/')).toBe(
      'github.com/owner/repo',
    );
  });

  it('stamps and reads back the memory manifest', () => {
    const repoRoot = tempRepo();
    const memoryDir = join(repoRoot, '.circuit', 'memory');
    const resolved = resolveProjectId({ repoRoot, memoryDir, gitRemoteUrl: null });
    const path = stampMemoryManifest(resolved, { memoryDir });
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    expect(manifest.project_id).toBe(resolved.projectId);
    expect(manifest.source).toBe('runs_base');
    expect(readMemoryManifest({ memoryDir })?.project_id).toBe(resolved.projectId);
  });
});
