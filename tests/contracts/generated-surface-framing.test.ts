import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

const runSurfacePaths = [
  'src/commands/run.md',
  'plugins/claude/commands/run.md',
  'plugins/codex/commands/run.md',
  'plugins/codex/skills/run/SKILL.md',
];

const directFlowSourcePaths = [
  'src/flows/build/command.md',
  'src/flows/explore/command.md',
  'src/flows/fix/command.md',
  'src/flows/goal/command.md',
  'src/flows/prototype/command.md',
  'src/flows/review/command.md',
];

const directFlowGeneratedPaths = [
  ...['build', 'explore', 'fix', 'goal', 'prototype', 'review'].flatMap((flow) => [
    `plugins/claude/commands/${flow}.md`,
    `plugins/codex/commands/${flow}.md`,
    `plugins/codex/skills/${flow}/SKILL.md`,
  ]),
];

const goalSurfacePaths = [
  'src/flows/goal/command.md',
  'plugins/claude/commands/goal.md',
  'plugins/codex/commands/goal.md',
  'plugins/codex/skills/goal/SKILL.md',
];

describe('generated host surface framing', () => {
  it('makes run the intent front door instead of a flow selector', () => {
    for (const path of runSurfacePaths) {
      const content = readRepoFile(path);

      expect(content, path).toContain('intent front door');
      expect(content, path).toContain('records the selected flow');
      expect(content, path).not.toMatch(/flow selector/i);
      expect(content, path).not.toContain('Direct Flow Bypass');
      expect(content, path).not.toContain('host model chooses the flow before invoking Circuit');
      expect(content, path).not.toContain('skip this classifier layer');
      expect(content, path).not.toContain('Chooses and runs the best Circuit flow');
    }
  });

  it('marks direct flow sources as expert controls, not runtime bypasses', () => {
    for (const path of [...directFlowSourcePaths, ...directFlowGeneratedPaths]) {
      const content = readRepoFile(path);

      expect(content, path).toMatch(/expert control|deliberate starting point/i);
      expect(content, path).toContain('This is not a runtime bypass');
      expect(content, path).toContain('records the selected flow');
      expect(content, path).toContain('trace');
      expect(content, path).toContain('reports');
      expect(content, path).toContain('evidence');
      expect(content, path).not.toContain('without asking the router to choose');
      expect(content, path).not.toContain('router bypass behavior');
    }
  });

  it('keeps manifests intent-first and direct skills expert-only', () => {
    const codexManifest = readRepoFile('plugins/codex/.codex-plugin/plugin.json');
    const claudeManifest = readRepoFile('plugins/claude/.claude-plugin/plugin.json');

    expect(codexManifest).toContain('coding intents');
    expect(codexManifest).toContain('expert controls');
    expect(codexManifest).not.toContain('choose the best bundled Circuit flow');

    expect(claudeManifest).toContain('intent front door');
    expect(claudeManifest).toContain('expert controls');
    expect(claudeManifest).not.toContain('selects the best flow');
  });

  it('de-emphasizes Goal as a separate public concept', () => {
    for (const path of goalSurfacePaths) {
      const content = readRepoFile(path);

      expect(content, path).toContain('Circuit Run');
      expect(content, path).toContain('Goal-style completion discipline');
      expect(content, path).toContain('existing Goal use cases');
      expect(content, path).toContain('old Goal run folders');
    }
  });
});
