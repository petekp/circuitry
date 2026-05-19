import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const RUNNER = resolve('evals/circuit-vs-vanilla/run-comparison.ts');

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'circuit-vs-vanilla-runner-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function writePrompt(): string {
  const promptPath = join(workDir, 'prompt.md');
  writeFileSync(promptPath, 'Comparison runner dry-run prompt fixture.\n');
  return promptPath;
}

function dryRun(args: string[]): string {
  const outDir = join(workDir, 'results');
  mkdirSync(outDir, { recursive: true });
  return execFileSync(
    'node',
    [
      RUNNER,
      '--task-id',
      'dry-run-test',
      '--prompt-file',
      writePrompt(),
      '--out-dir',
      outDir,
      '--dry-run',
      '--skip-build',
      ...args,
    ],
    { encoding: 'utf8' },
  );
}

describe('comparison runner dry-run', () => {
  it('prints the Codex circuit and vanilla commands when --provider codex is selected', () => {
    const stdout = dryRun(['--provider', 'codex', '--flow', 'review']);
    const metadata = JSON.parse(stdout.split('\nDry run only.')[0] ?? stdout);
    expect(metadata.provider).toBe('codex');
    expect(metadata.arms['circuit-codex'].command).toEqual(
      expect.arrayContaining(['node', 'bin/circuit', 'run', 'review']),
    );
    expect(metadata.arms['vanilla-codex'].command[0]).toBe('codex');
    expect(metadata.arms['vanilla-codex'].command).toContain('exec');
    expect(metadata.arms['vanilla-codex'].command).not.toContain('claude');
  });

  it('prints the Claude Code circuit and vanilla commands when --provider claude-code is selected', () => {
    const stdout = dryRun([
      '--provider',
      'claude-code',
      '--flow',
      'review',
      '--model',
      'claude-haiku-4-5-20251001',
      '--effort',
      'low',
    ]);
    const metadata = JSON.parse(stdout.split('\nDry run only.')[0] ?? stdout);
    expect(metadata.provider).toBe('claude-code');
    expect(metadata.model).toBe('claude-haiku-4-5-20251001');
    expect(metadata.effort).toBe('low');
    // Circuit arm still routes through bin/circuit; the wrapper on PATH
    // intercepts the claude-code connector subprocess and pins the model.
    expect(metadata.arms['circuit-claude-code'].command).toEqual(
      expect.arrayContaining(['node', 'bin/circuit', 'run', 'review']),
    );
    expect(metadata.arms['circuit-claude-code'].run_folder).toContain('circuit-claude-code/run');
    // Vanilla arm calls claude directly with the same dispatch flags Circuit's
    // claude-code connector uses, so the comparison holds tool surface
    // constant. The wrapper injects --model/--effort so neither flag needs to
    // appear here.
    const vanillaCommand: string[] = metadata.arms['vanilla-claude-code'].command;
    expect(vanillaCommand[0]).toBe('claude');
    expect(vanillaCommand).toContain('-p');
    expect(vanillaCommand).toContain('--permission-mode');
    expect(vanillaCommand).toContain('bypassPermissions');
    expect(vanillaCommand).toContain('--strict-mcp-config');
    expect(vanillaCommand).toContain('--disable-slash-commands');
    expect(vanillaCommand).toContain('--no-session-persistence');
    expect(vanillaCommand).not.toContain('exec');
  });
});
