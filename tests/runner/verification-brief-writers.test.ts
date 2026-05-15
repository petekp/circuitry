import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildCompiledFlowPackage } from '../../src/flows/build/index.js';
import type { BuildBrief } from '../../src/flows/build/reports.js';
import { migrateCompiledFlowPackage } from '../../src/flows/migrate/index.js';
import type { MigrateBrief } from '../../src/flows/migrate/reports.js';
import type { CheckpointBriefBuilder } from '../../src/flows/registries/checkpoint-writers/types.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../src/flows/registries/compose-writers/types.js';
import { sweepCompiledFlowPackage } from '../../src/flows/sweep/index.js';
import type { SweepBrief } from '../../src/flows/sweep/reports.js';

const roots: string[] = [];

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function writePackageJson(root: string, scripts: Record<string, string>): void {
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ private: true, scripts }, null, 2)}\n`,
  );
}

function checkpointWriter(): CheckpointBriefBuilder {
  const writer = buildCompiledFlowPackage.writers.checkpoint.find(
    (candidate) => candidate.resultSchemaName === 'build.brief@v1',
  );
  if (writer === undefined) throw new Error('build.brief@v1 checkpoint writer missing');
  return writer;
}

function composeWriter(flow: 'migrate' | 'sweep'): ComposeBuilder {
  const writers =
    flow === 'migrate'
      ? migrateCompiledFlowPackage.writers.compose
      : sweepCompiledFlowPackage.writers.compose;
  const schema = flow === 'migrate' ? 'migrate.brief@v1' : 'sweep.brief@v1';
  const writer = writers.find((candidate) => candidate.resultSchemaName === schema);
  if (writer === undefined) throw new Error(`${schema} compose writer missing`);
  return writer;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('verification brief writers', () => {
  it('Build resolves build and lint commands from the project instead of the schematic template', () => {
    const projectRoot = tempRoot('build-brief-resolver-');
    writePackageJson(projectRoot, {
      dev: 'vite',
      build: 'tsc',
      start: 'vite preview',
      lint: 'eslint .',
    });

    const brief = checkpointWriter().build({
      runFolder: '/tmp/run',
      projectRoot,
      goal: 'Build + lint must stay clean',
      responsePath: 'reports/checkpoints/frame-step-response.json',
      step: {
        id: 'frame-step',
        kind: 'checkpoint',
        writes: {
          request: 'reports/checkpoints/frame-step-request.json',
          response: 'reports/checkpoints/frame-step-response.json',
        },
        policy: {
          choices: [{ id: 'continue' }],
          report_template: {
            scope: 'Make the smallest safe change.',
            success_criteria: ['Verification passes'],
          },
        },
      },
    } as never) as BuildBrief;

    expect(brief.verification_command_candidates.map((command) => command.argv)).toEqual([
      ['npm', 'run', 'build'],
      ['npm', 'run', 'lint'],
    ]);
  });

  it('Migrate resolves a general proof command instead of hardcoding npm run check', () => {
    const projectRoot = tempRoot('migrate-brief-resolver-');
    writePackageJson(projectRoot, { verify: 'vitest', check: 'tsc --noEmit' });

    const brief = composeWriter('migrate').build({
      runFolder: '/tmp/run',
      flow: {} as never,
      step: {} as never,
      goal: 'migrate the legacy API',
      projectRoot,
      inputs: {},
    } satisfies ComposeBuildContext) as MigrateBrief;

    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'verify']);
  });

  it('Sweep resolves a general proof command instead of hardcoding npm run check', () => {
    const projectRoot = tempRoot('sweep-brief-resolver-');
    writePackageJson(projectRoot, { test: 'vitest', check: 'tsc --noEmit' });

    const brief = composeWriter('sweep').build({
      runFolder: '/tmp/run',
      flow: {} as never,
      step: {} as never,
      goal: 'cleanup dead code',
      projectRoot,
      inputs: {},
    } satisfies ComposeBuildContext) as SweepBrief;

    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'test']);
  });
});
