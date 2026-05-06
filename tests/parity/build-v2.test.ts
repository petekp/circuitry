import { describe, expect, it } from 'vitest';
import { RunFileStore } from '../../src/core-v2/run-files/run-file-store.js';
import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildReview,
  BuildVerification,
} from '../../src/flows/build/reports.js';
import { CompiledFlow as CompiledFlowSchema } from '../../src/schemas/compiled-flow.js';
import { RunResult } from '../../src/schemas/result.js';
import {
  completedStepIds,
  expectCompleteTrace,
  expectedPassStepIds,
  loadCompiledFlowFixture,
  readTrace,
  runSimpleCompiledFlowV2,
  withTempRun,
} from './core-v2-parity-helpers.js';

describe('build v2 parity', () => {
  it('runs the generated build flow through the v2 compiled-flow path', async () => {
    const fixture = await loadCompiledFlowFixture('build');
    const { flow } = fixture;
    const expectedSteps = expectedPassStepIds(flow);

    await withTempRun(async (runDir) => {
      const result = await runSimpleCompiledFlowV2({
        flowBytes: fixture.bytes,
        runDir,
        runId: '55555555-5555-4555-8555-555555555555',
        goal: 'build a small change',
      });

      expect(result).toMatchObject({
        schema_version: 1,
        run_id: '55555555-5555-4555-8555-555555555555',
        flow_id: 'build',
        outcome: 'complete',
      });
      expect(await completedStepIds(runDir)).toEqual(expectedSteps);
      await expectCompleteTrace(runDir);

      const trace = await readTrace(runDir);
      expect(trace).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'step.completed',
            step_id: 'frame-step',
            data: { route: 'continue', details: { selected_choice: 'continue' } },
          }),
        ]),
      );

      const files = new RunFileStore(runDir);
      await expect(
        files.readJson('reports/checkpoints/frame-step-response.json'),
      ).resolves.toMatchObject({
        selected_choice: 'continue',
      });
      expect(BuildBrief.safeParse(await files.readJson('reports/build/brief.json')).success).toBe(
        true,
      );
      expect(BuildPlan.safeParse(await files.readJson('reports/build/plan.json')).success).toBe(
        true,
      );
      expect(
        BuildImplementation.safeParse(await files.readJson('reports/build/implementation.json'))
          .success,
      ).toBe(true);
      expect(
        BuildVerification.safeParse(await files.readJson('reports/build/verification.json'))
          .success,
      ).toBe(true);
      expect(BuildReview.safeParse(await files.readJson('reports/build/review.json')).success).toBe(
        true,
      );
      expect(BuildResult.safeParse(await files.readJson('reports/build-result.json')).success).toBe(
        true,
      );
      const runResult = RunResult.parse(await files.readJson('reports/result.json'));
      expect(runResult).toMatchObject({
        flow_id: 'build',
        outcome: 'complete',
        trace_entries_observed: 14,
        manifest_hash: fixture.manifestHash,
      });
    });
  });

  it('starts from a named entry mode and records the selected depth', async () => {
    const fixture = await loadCompiledFlowFixture('build');
    const raw = JSON.parse(fixture.bytes.toString('utf8')) as Record<string, unknown> & {
      entry_modes: unknown[];
    };
    raw.entry_modes = [
      ...raw.entry_modes,
      {
        name: 'act-only',
        start_at: 'act-step',
        depth: 'deep',
        description: 'Synthetic v2 parity entry mode.',
      },
    ];
    const bytes = Buffer.from(JSON.stringify(raw));
    const flow = CompiledFlowSchema.parse(raw);

    await withTempRun(async (runDir) => {
      const result = await runSimpleCompiledFlowV2({
        flowBytes: bytes,
        runDir,
        runId: '66666666-6666-4666-8666-666666666666',
        goal: 'build with an alternate entry mode',
        entryModeName: 'act-only',
      });

      expect(result).toMatchObject({
        flow_id: 'build',
        outcome: 'complete',
      });
      expect(await completedStepIds(runDir)).toEqual(expectedPassStepIds(flow, 'act-only'));
      const trace = await readTrace(runDir);
      expect(trace[0]).toMatchObject({
        kind: 'run.bootstrapped',
        data: expect.objectContaining({
          entry: 'act-step',
          entry_mode: 'act-only',
          depth: 'deep',
        }),
      });
      expect(trace.find((entry) => entry.kind === 'step.entered')).toMatchObject({
        step_id: 'act-step',
        attempt: 1,
      });
    });
  });

  it('starts from the generated autonomous entry mode and records autonomous depth', async () => {
    const fixture = await loadCompiledFlowFixture('build');
    const flow = CompiledFlowSchema.parse(JSON.parse(fixture.bytes.toString('utf8')));

    await withTempRun(async (runDir) => {
      const result = await runSimpleCompiledFlowV2({
        flowBytes: fixture.bytes,
        runDir,
        runId: '77777777-7777-4777-8777-777777777777',
        goal: 'build autonomously',
        entryModeName: 'autonomous',
      });

      expect(result).toMatchObject({
        flow_id: 'build',
        outcome: 'complete',
      });
      expect(await completedStepIds(runDir)).toEqual(expectedPassStepIds(flow, 'autonomous'));
      const trace = await readTrace(runDir);
      expect(trace[0]).toMatchObject({
        kind: 'run.bootstrapped',
        data: expect.objectContaining({
          entry: 'frame-step',
          entry_mode: 'autonomous',
          depth: 'autonomous',
        }),
      });
    });
  });
});
