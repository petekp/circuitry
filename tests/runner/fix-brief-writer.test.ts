import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { fixCompiledFlowPackage } from '../../src/flows/fix/index.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../src/flows/registries/compose-writers/types.js';

function requireFixBriefComposeBuilder(): ComposeBuilder {
  const builder = fixCompiledFlowPackage.writers.compose.find(
    (writer) => writer.resultSchemaName === 'fix.brief@v1',
  );
  if (builder === undefined) {
    throw new Error('fix.brief@v1 compose builder is not registered on the Fix package');
  }
  return builder;
}

const fixBriefComposeBuilder = requireFixBriefComposeBuilder();

const tempRoots: string[] = [];

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writePackageJson(root: string, scripts: Record<string, string>): void {
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'scratch', private: true, scripts }, null, 2)}\n`,
  );
}

function buildBrief(projectRoot: string | undefined): {
  verification_command_candidates: ReadonlyArray<{ argv: readonly string[] }>;
} {
  const context = {
    runFolder: '/tmp/run',
    flow: {} as never,
    step: {} as never,
    goal: 'fix the bug',
    inputs: {},
    ...(projectRoot === undefined ? {} : { projectRoot }),
  } as unknown as ComposeBuildContext;
  return fixBriefComposeBuilder.build(context) as {
    verification_command_candidates: ReadonlyArray<{ argv: readonly string[] }>;
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('fixBriefComposeBuilder verification script discovery', () => {
  it('blocks when no projectRoot is provided', () => {
    expect(() => buildBrief(undefined)).toThrow(/projectRoot was not provided/);
  });

  it('blocks when projectRoot has no package.json', () => {
    const root = tempRoot('fix-brief-no-pkg-');
    expect(() => buildBrief(root)).toThrow(/package\.json.*does not exist/);
  });

  it('blocks instead of inventing npm run verify when no general proof script exists', () => {
    const root = tempRoot('fix-brief-lint-only-');
    writePackageJson(root, { lint: 'echo ok' });
    expect(() => buildBrief(root)).toThrow(/verify, test, or check/);
  });

  it('picks verify when present in package.json scripts', () => {
    const root = tempRoot('fix-brief-verify-');
    writePackageJson(root, { verify: 'echo ok', test: 'echo ok' });
    const brief = buildBrief(root);
    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'verify']);
  });

  it('falls back to test when verify is missing but test exists', () => {
    const root = tempRoot('fix-brief-test-');
    writePackageJson(root, { test: 'echo ok', lint: 'echo ok' });
    const brief = buildBrief(root);
    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'test']);
  });

  it('falls back to check when only check is defined', () => {
    const root = tempRoot('fix-brief-check-');
    writePackageJson(root, { check: 'echo ok', lint: 'echo ok' });
    const brief = buildBrief(root);
    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'check']);
  });

  it('blocks when package.json is malformed', () => {
    const root = tempRoot('fix-brief-malformed-');
    writeFileSync(join(root, 'package.json'), '{not json');
    expect(() => buildBrief(root)).toThrow(/could not be parsed/);
  });

  it('blocks when scripts is an array rather than an object', () => {
    const root = tempRoot('fix-brief-scripts-array-');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'odd', scripts: [] }, null, 2),
    );
    expect(() => buildBrief(root)).toThrow(/scripts must be an object/);
  });

  it('blocks when scripts is null', () => {
    const root = tempRoot('fix-brief-scripts-null-');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'odd', scripts: null }, null, 2),
    );
    expect(() => buildBrief(root)).toThrow(/scripts must be an object/);
  });

  it('respects priority: verify wins over test wins over check', () => {
    const root = tempRoot('fix-brief-priority-');
    writePackageJson(root, { check: 'echo ok', test: 'echo ok', verify: 'echo ok' });
    const brief = buildBrief(root);
    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'verify']);
    mkdirSync(root, { recursive: true });
    writePackageJson(root, { check: 'echo ok', test: 'echo ok' });
    const brief2 = buildBrief(root);
    expect(brief2.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'test']);
  });
});
