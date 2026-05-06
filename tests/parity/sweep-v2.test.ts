import { describe, expect, it } from 'vitest';
import {
  completedStepIds,
  expectCompleteTrace,
  expectedPassStepIds,
  loadCompiledFlowFixture,
  runSimpleCompiledFlowV2,
  withTempRun,
} from './core-v2-parity-helpers.js';

describe('sweep core-v2 parity', () => {
  it.each([
    { label: 'default', entryModeName: undefined },
    { label: 'lite', entryModeName: 'lite' },
    { label: 'autonomous', entryModeName: 'autonomous' },
  ])(
    'runs the generated sweep $label flow through the v2 pass route path',
    async ({ entryModeName }) => {
      const fixture = await loadCompiledFlowFixture('sweep');
      await withTempRun(async (runDir) => {
        const result = await runSimpleCompiledFlowV2({
          flowBytes: fixture.bytes,
          runDir,
          runId: '55555555-5555-4555-8555-555555555555',
          goal: 'Sweep cleanup candidates with v2',
          ...(entryModeName === undefined ? {} : { entryModeName }),
        });

        expect(result.outcome).toBe('complete');
        await expectCompleteTrace(runDir);
        expect(await completedStepIds(runDir)).toEqual(
          expectedPassStepIds(fixture.flow, entryModeName),
        );
      });
    },
  );
});
