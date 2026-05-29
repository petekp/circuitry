import { describe, expect, it } from 'vitest';
import { ReviewIntake, ReviewRelayResult, ReviewResult } from '../../src/flows/review/reports.js';
import { RunFileStore } from '../../src/runtime/run-files/run-file-store.js';
import { readRuntimeManifestSnapshot } from '../../src/runtime/run/manifest-snapshot.js';
import { CompiledFlow as CompiledFlowSchema } from '../../src/schemas/compiled-flow.js';
import { RunResult } from '../../src/schemas/result.js';
import {
  completedStepIds,
  expectCompleteTrace,
  expectedPassStepIds,
  loadCompiledFlowFixture,
  readTrace,
  runFileExists,
  runSimpleCompiledFlow,
  withTempRun,
} from '../helpers/runtime-flow.js';

describe('review runtime parity', () => {
  it('runs the generated review flow through the runtime compiled-flow path', async () => {
    const fixture = await loadCompiledFlowFixture('review');
    const { flow } = fixture;
    const expectedSteps = expectedPassStepIds(flow);

    await withTempRun(async (runDir) => {
      const result = await runSimpleCompiledFlow({
        flowBytes: fixture.bytes,
        runDir,
        runId: '11111111-1111-4111-8111-111111111111',
        goal: 'review the current change',
      });

      expect(result).toMatchObject({
        schema_version: 1,
        run_id: '11111111-1111-4111-8111-111111111111',
        flow_id: 'review',
        outcome: 'complete',
      });
      expect(await completedStepIds(runDir)).toEqual(expectedSteps);
      await expectCompleteTrace(runDir);

      const files = new RunFileStore(runDir);
      expect(
        ReviewIntake.safeParse(await files.readJson('reports/review-intake.json')).success,
      ).toBe(true);
      expect(
        ReviewRelayResult.safeParse(await files.readJson('stages/analyze/review-raw-findings.json'))
          .success,
      ).toBe(true);
      expect(
        ReviewResult.safeParse(await files.readJson('reports/review-result.json')).success,
      ).toBe(true);
      const runResult = RunResult.parse(await files.readJson('reports/result.json'));
      expect(runResult).toMatchObject({
        flow_id: 'review',
        outcome: 'complete',
        trace_entries_observed: 9,
        manifest_hash: fixture.manifestHash,
      });
      const manifestSnapshot = await readRuntimeManifestSnapshot(runDir);
      const manifestBytes = Buffer.from(manifestSnapshot.bytes_base64, 'base64');
      expect(manifestSnapshot).toMatchObject({
        run_id: '11111111-1111-4111-8111-111111111111',
        flow_id: 'review',
        hash: fixture.manifestHash,
      });
      expect(manifestBytes.equals(fixture.bytes)).toBe(true);
      expect(CompiledFlowSchema.parse(JSON.parse(manifestBytes.toString('utf8'))).id).toBe(
        'review',
      );
      expect((await readTrace(runDir))[0]).toMatchObject({
        kind: 'run.bootstrapped',
        manifest_hash: manifestSnapshot.hash,
      });
      expect(runResult.manifest_hash).toBe(manifestSnapshot.hash);

      await expect(runFileExists(runDir, 'reports/relay/review.request.json')).resolves.toBe(true);
      await expect(runFileExists(runDir, 'reports/relay/review.receipt.txt')).resolves.toBe(true);
    });
  });
});
