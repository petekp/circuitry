// Regression: the golden-proof capture script
// (scripts/release/capture-golden-run-proofs.ts) builds checkpoint.resolved
// trace entries when it auto-resolves a checkpoint to the safe default. It used
// to emit `resolution_source: 'safe-autonomous'` / `'safe-default'`, which are
// OUTSIDE the CheckpointResolvedTraceEntry enum (only
// 'declared-default' | 'operator' | 'policy' are valid) and would therefore
// throw at parse time. The runtime always records auto-resolve-to-safe-default
// as 'declared-default' (src/runtime/executors/checkpoint.ts) — depth governs
// relay execution, not checkpoint auto-resolution — so the capture script must
// match. This test pins the parse contract for the entry shape the script emits.

import { describe, expect, it } from 'vitest';
import { CheckpointResolvedTraceEntry } from '../../src/index.js';
import { RUN_A } from '../helpers/runtrace-builders.js';

const goldenProofCheckpointResolved = {
  schema_version: 1 as const,
  sequence: 4,
  recorded_at: '2026-04-18T05:01:40.000Z',
  run_id: RUN_A,
  kind: 'checkpoint.resolved' as const,
  step_id: 'frame',
  attempt: 1,
  selection: 'accept',
  route_id: 'pass',
  auto_resolved: true,
  resolution_source: 'declared-default' as const,
  response_path: 'reports/checkpoint-response.json',
};

describe('golden-run proof capture emits schema-valid resolution_source', () => {
  it('parses the checkpoint.resolved entry the capture script now builds', () => {
    expect(() => CheckpointResolvedTraceEntry.parse(goldenProofCheckpointResolved)).not.toThrow();

    const parsed = CheckpointResolvedTraceEntry.parse(goldenProofCheckpointResolved);
    expect(parsed.resolution_source).toBe('declared-default');
    expect(parsed.auto_resolved).toBe(true);
  });

  // regression: the golden-proof capture used to emit 'safe-autonomous'/'safe-default',
  // which are outside the resolution_source enum and would throw at parse time.
  it('throws on the old out-of-enum resolution_source values', () => {
    expect(() =>
      CheckpointResolvedTraceEntry.parse({
        ...goldenProofCheckpointResolved,
        resolution_source: 'safe-autonomous',
      }),
    ).toThrow();

    expect(() =>
      CheckpointResolvedTraceEntry.parse({
        ...goldenProofCheckpointResolved,
        resolution_source: 'safe-default',
      }),
    ).toThrow();
  });
});
