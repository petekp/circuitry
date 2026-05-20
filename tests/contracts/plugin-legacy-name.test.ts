import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve('.');
const LEGACY_PROJECT_NAME = ['circuit', 'next'].join('-');
const LEGACY_MARKETPLACE_NAME = `${LEGACY_PROJECT_NAME}-local`;
const INSTALL_SURFACE_PATHS = [
  '.agents/plugins',
  '.claude-plugin',
  'plugins',
  'package.json',
  'README.md',
];

function walkFiles(path: string): string[] {
  const abs = resolve(REPO_ROOT, path);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [abs];

  const files: string[] = [];
  const stack = [abs];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }
  return files.sort();
}

describe('plugin legacy name guard', () => {
  it('keeps installable Codex and Claude Code surfaces off the legacy project name', () => {
    const offenders = INSTALL_SURFACE_PATHS.flatMap(walkFiles).filter((file) =>
      readFileSync(file, 'utf8').includes(LEGACY_PROJECT_NAME),
    );

    expect(offenders).toEqual([]);
  });

  it('syncs the Codex cache through circuit-local by default and rejects legacy cache names', () => {
    const codexHome = mkdtempSync(join(tmpdir(), 'circuit-codex-home-'));
    try {
      const sync = spawnSync(
        process.execPath,
        [resolve(REPO_ROOT, 'scripts/plugins/sync-codex-cache.ts')],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: { ...process.env, CODEX_HOME: codexHome },
        },
      );
      expect(sync.status, sync.stderr).toBe(0);
      const summary = JSON.parse(sync.stdout) as { target: string; status: string };
      expect(summary.status).toBe('synced');
      expect(summary.target).toContain('/plugins/cache/circuit-local/circuit/');
      expect(summary.target).not.toContain(LEGACY_MARKETPLACE_NAME);

      const legacy = spawnSync(
        process.execPath,
        [
          resolve(REPO_ROOT, 'scripts/plugins/sync-codex-cache.ts'),
          '--marketplace',
          LEGACY_MARKETPLACE_NAME,
        ],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: { ...process.env, CODEX_HOME: codexHome },
        },
      );
      expect(legacy.status).toBe(2);
      expect(legacy.stderr).toContain('legacy circuit-next cache names are not supported');
    } finally {
      rmSync(codexHome, { recursive: true, force: true });
    }
  });
});
