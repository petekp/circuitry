import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CompiledFlowRunOptionsV2Like } from '../../src/core-v2/run/child-runner.js';
import type { GraphRunResultV2 } from '../../src/core-v2/run/graph-runner.js';
import { RunResult } from '../../src/schemas/result.js';
import {
  completedStepIds,
  createSimpleParityExecutors,
  expectCompleteTrace,
  loadCompiledFlowFixture,
  readTrace,
  runSimpleCompiledFlowV2,
  withTempRun,
} from './core-v2-parity-helpers.js';

async function buildChildRunner(options: CompiledFlowRunOptionsV2Like): Promise<GraphRunResultV2> {
  const resultPath = join(options.runDir, 'reports', 'result.json');
  await mkdir(dirname(resultPath), { recursive: true });
  const body = RunResult.parse({
    schema_version: 1,
    run_id: options.runId ?? 'build-child-run',
    flow_id: 'build',
    goal: options.goal,
    outcome: 'complete',
    summary: 'build child completed',
    closed_at: new Date(0).toISOString(),
    trace_entries_observed: 1,
    manifest_hash: 'build-child-hash',
    verdict: 'accept',
  });
  await writeFile(resultPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return {
    schema_version: 1,
    run_id: body.run_id,
    flow_id: body.flow_id,
    goal: body.goal,
    outcome: body.outcome,
    summary: body.summary,
    closed_at: body.closed_at,
    trace_entries_observed: body.trace_entries_observed,
    manifest_hash: body.manifest_hash,
    verdict: 'accept',
    resultPath,
  };
}

describe('migrate core-v2 parity', () => {
  it.each([
    { label: 'default', entryModeName: undefined },
    { label: 'autonomous', entryModeName: 'autonomous' },
  ])(
    'runs the generated migrate $label flow through the v2 sub-run path',
    async ({ entryModeName }) => {
      const migrate = await loadCompiledFlowFixture('migrate');
      const build = await loadCompiledFlowFixture('build');

      await withTempRun(async (runDir) => {
        const result = await runSimpleCompiledFlowV2({
          flowBytes: migrate.bytes,
          runDir,
          runId: '44444444-4444-4444-8444-444444444444',
          goal: 'Migrate a dependency with v2',
          ...(entryModeName === undefined ? {} : { entryModeName }),
          executors: {
            ...createSimpleParityExecutors(),
          },
          childCompiledFlowResolver: (ref) => {
            expect(ref.flowId).toBe('build');
            return { flowBytes: build.bytes };
          },
          childRunner: buildChildRunner,
        });

        expect(result.outcome).toBe('complete');
        expect(result.verdict).toBe('accept');
        await expectCompleteTrace(runDir);
        expect(await completedStepIds(runDir)).toContain('batch-step');
        const entries = await readTrace(runDir);
        expect(entries.find((entry) => entry.kind === 'sub_run.started')?.child_flow_id).toBe(
          'build',
        );
        expect(entries.find((entry) => entry.kind === 'sub_run.completed')?.verdict).toBe('accept');
        const copied = RunResult.parse(
          JSON.parse(
            await readFile(join(runDir, 'reports', 'migrate', 'batch-result.json'), 'utf8'),
          ),
        );
        expect(copied.flow_id).toBe('build');
      });
    },
  );
});
