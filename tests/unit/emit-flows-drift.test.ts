// Tests for the stale-sibling guard in scripts/flows/emit.ts.
//
// The CLI loader at src/cli/circuit.ts prefers `<mode>.json` over
// `circuit.json` when an axis selection is requested, so a stale per-selection
// sibling (left behind from a renamed/collapsed axis selection) can silently
// drive runtime behavior even after `npm run verify` reports clean.
//
// `--check` must fail when an unexpected JSON sibling exists in a
// schematic-controlled skill dir; `emit` mode must remove it.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '../..');
const emitScript = resolve(projectRoot, 'scripts/flows/emit.ts');
const buildSkillDir = resolve(projectRoot, 'generated/flows/build');
const stalePath = resolve(buildSkillDir, 'never-a-mode.json');
const claudeBuildSkillDir = resolve(projectRoot, 'plugins/claude/skills/build');
const claudeStalePath = resolve(claudeBuildSkillDir, 'never-a-mode.json');
const codexBuildSkillDir = resolve(projectRoot, 'plugins/codex/flows/build');
const codexStalePath = resolve(codexBuildSkillDir, 'never-a-mode.json');
const runtimeProofClaudeDir = resolve(projectRoot, 'plugins/claude/skills/runtime-proof');
const runtimeProofCodexDir = resolve(projectRoot, 'plugins/codex/flows/runtime-proof');
const rootClaudeMarketplacePath = resolve(projectRoot, '.claude-plugin/marketplace.json');
const rootClaudeObsoleteManifestPath = resolve(projectRoot, '.claude-plugin/plugin.json');

function planted(path: string): boolean {
  return existsSync(path);
}

function plantStaleSibling(path: string) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, '{"stale":"sibling"}\n');
}

function removeStaleSiblingIfPresent(path: string) {
  if (planted(path)) unlinkSync(path);
}

function plantInternalHostMirror(dir: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'circuit.json'), '{"id":"runtime-proof"}\n');
}

function removeDirIfPresent(path: string) {
  if (planted(path)) rmSync(path, { recursive: true, force: true });
}

function cleanupPlantedFixtures() {
  removeStaleSiblingIfPresent(stalePath);
  removeStaleSiblingIfPresent(claudeStalePath);
  removeStaleSiblingIfPresent(codexStalePath);
  removeDirIfPresent(runtimeProofClaudeDir);
  removeDirIfPresent(runtimeProofCodexDir);
  removeStaleSiblingIfPresent(rootClaudeObsoleteManifestPath);
}

describe('emit-flows.ts — stale per-mode sibling guard', () => {
  beforeAll(() => {
    // The script imports from dist/, so make sure it's built before any
    // subprocess calls. The verify pipeline does this in order; the test
    // suite needs to do it too when invoked in isolation.
    execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'pipe' });
  });

  afterAll(cleanupPlantedFixtures);

  it('detects and removes stale generated siblings and host surfaces', () => {
    cleanupPlantedFixtures();

    plantStaleSibling(stalePath);
    plantStaleSibling(claudeStalePath);
    plantStaleSibling(codexStalePath);
    const staleCheck = spawnSync('node', [emitScript, '--check'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(staleCheck.status).toBe(1);
    const staleCheckOutput = `${staleCheck.stdout ?? ''}\n${staleCheck.stderr ?? ''}`;
    expect(staleCheckOutput).toContain('generated/flows/build/never-a-mode.json');
    expect(staleCheckOutput).toContain('plugins/claude/skills/build/never-a-mode.json');
    expect(staleCheckOutput).toContain('plugins/codex/flows/build/never-a-mode.json');
    expect(staleCheckOutput).toContain('not in the emit plan');

    cleanupPlantedFixtures();
    plantStaleSibling(stalePath);
    plantStaleSibling(claudeStalePath);
    plantStaleSibling(codexStalePath);
    expect(planted(stalePath)).toBe(true);
    expect(planted(claudeStalePath)).toBe(true);
    expect(planted(codexStalePath)).toBe(true);
    const staleEmit = spawnSync('node', [emitScript], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(staleEmit.status).toBe(0);
    expect(planted(stalePath)).toBe(false);
    expect(planted(claudeStalePath)).toBe(false);
    expect(planted(codexStalePath)).toBe(false);
    expect(staleEmit.stdout ?? '').toContain(
      'removed stale generated/flows/build/never-a-mode.json',
    );
    expect(staleEmit.stdout ?? '').toContain(
      'removed stale plugins/claude/skills/build/never-a-mode.json',
    );
    expect(staleEmit.stdout ?? '').toContain(
      'removed stale plugins/codex/flows/build/never-a-mode.json',
    );

    cleanupPlantedFixtures();
    plantInternalHostMirror(runtimeProofClaudeDir);
    plantInternalHostMirror(runtimeProofCodexDir);
    const internalMirrorCheck = spawnSync('node', [emitScript, '--check'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(internalMirrorCheck.status).toBe(1);
    const internalMirrorOutput = `${internalMirrorCheck.stdout ?? ''}\n${
      internalMirrorCheck.stderr ?? ''
    }`;
    expect(internalMirrorOutput).toContain('plugins/claude/skills/runtime-proof');
    expect(internalMirrorOutput).toContain('plugins/codex/flows/runtime-proof');
    expect(internalMirrorOutput).toContain('stale host mirror for internal flow');

    const internalMirrorEmit = spawnSync('node', [emitScript], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(internalMirrorEmit.status).toBe(0);
    expect(planted(runtimeProofClaudeDir)).toBe(false);
    expect(planted(runtimeProofCodexDir)).toBe(false);
    expect(internalMirrorEmit.stdout ?? '').toContain(
      'removed internal host mirror plugins/claude/skills/runtime-proof',
    );
    expect(internalMirrorEmit.stdout ?? '').toContain(
      'removed internal host mirror plugins/codex/flows/runtime-proof',
    );

    cleanupPlantedFixtures();
    const marketplaceBefore = readFileSync(rootClaudeMarketplacePath, 'utf8');
    plantStaleSibling(rootClaudeObsoleteManifestPath);
    const rootEmit = spawnSync('node', [emitScript], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(rootEmit.status).toBe(0);
    expect(planted(rootClaudeObsoleteManifestPath)).toBe(false);
    expect(readFileSync(rootClaudeMarketplacePath, 'utf8')).toBe(marketplaceBefore);
    expect(rootEmit.stdout ?? '').toContain(
      'removed obsolete root host surface .claude-plugin/plugin.json',
    );

    cleanupPlantedFixtures();
  });
});
