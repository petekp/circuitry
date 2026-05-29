import { describe, expect, it } from 'vitest';

import {
  attemptResultFromProjection,
  runAutonomousContinuation,
} from '../../src/run-envelope/autonomous-run.js';
import type { ProcessEvidenceProjection } from '../../src/schemas/process-evidence.js';
import { goalContract as contract } from './run-envelope-fixtures.js';

function projection(overrides: {
  outcome: ProcessEvidenceProjection['outcome'];
  declared?: readonly string[];
  evidence?: readonly string[];
  flowId?: string;
}): ProcessEvidenceProjection {
  return {
    schema: 'process.evidence@v0',
    flow_id: overrides.flowId ?? 'build',
    attempt_id: 'attempt',
    outcome: overrides.outcome,
    summary: 'summary',
    child_run_ref: {
      kind: 'trace',
      ref: 'trace.ndjson',
      run_id: '00000000-0000-4000-8000-00000000c101',
    },
    evidence_refs: (overrides.evidence ?? []).map((ref) => ({ kind: 'report', ref })),
    declared_report_paths: [...(overrides.declared ?? [])],
    missing_evidence: [],
    trace_entries_observed: 4,
    manifest_hash: 'runtime:build@0.1.0',
  } as unknown as ProcessEvidenceProjection;
}

describe('attemptResultFromProjection (S10)', () => {
  it('maps complete-with-satisfied-evidence to complete', () => {
    const result = attemptResultFromProjection(
      projection({
        outcome: 'complete',
        declared: ['reports/x.json'],
        evidence: ['reports/x.json'],
      }),
    );
    expect(result.outcome).toBe('complete');
    expect(result.unmetEvidence).toEqual([]);
  });

  it('maps complete-with-missing-evidence to needs_followup with the missing refs', () => {
    const result = attemptResultFromProjection(
      projection({ outcome: 'complete', declared: ['reports/x.json'], evidence: [] }),
    );
    expect(result.outcome).toBe('needs_followup');
    expect(result.unmetEvidence).toEqual(['reports/x.json']);
    expect(result.unmetKinds).toEqual(['command']);
  });

  it('derives process and unmet kind from projection.flow_id, not the requested route', () => {
    // A projection whose flow_id differs from the requested route must drive the
    // attempt's process and unmet kind, so recovery routes by the flow that
    // actually ran. flow_id 'explore' maps to kind 'review', distinct from
    // 'build' -> 'command'; this fails if derivation reverts to the requested route.
    const result = attemptResultFromProjection(
      projection({
        outcome: 'complete',
        flowId: 'explore',
        declared: ['reports/x.json'],
        evidence: [],
      }),
    );
    expect(result.process_id).toBe('explore');
    expect(result.unmetKinds).toEqual(['review']);
  });

  it('maps non-complete outcomes faithfully', () => {
    expect(attemptResultFromProjection(projection({ outcome: 'checkpoint_waiting' })).outcome).toBe(
      'checkpoint',
    );
    expect(attemptResultFromProjection(projection({ outcome: 'failed' })).outcome).toBe('failed');
    expect(attemptResultFromProjection(projection({ outcome: 'aborted' })).outcome).toBe('failed');
    expect(attemptResultFromProjection(projection({ outcome: 'blocked' })).outcome).toBe('blocked');
    expect(attemptResultFromProjection(projection({ outcome: 'handoff' })).outcome).toBe('handoff');
  });
});

describe('runAutonomousContinuation (S10)', () => {
  it('completes in one attempt when the primary flow satisfies its evidence', async () => {
    const processIds: string[] = [];
    const result = await runAutonomousContinuation({
      contract: contract(),
      primaryProcessId: 'build',
      runFlow: async ({ processId }) => {
        processIds.push(processId);
        return {
          projection: projection({
            outcome: 'complete',
            declared: ['reports/x.json'],
            evidence: ['reports/x.json'],
          }),
        };
      },
    });
    expect(result.outcome).toBe('complete');
    expect(processIds).toEqual(['build']);
  });

  it('runs real follow-up attempts, routes by unmet kind, and stops honestly on no-progress', async () => {
    const processIds: string[] = [];
    const result = await runAutonomousContinuation({
      contract: contract(),
      primaryProcessId: 'build',
      // Always complete-but-missing the same evidence: the loop must route the
      // follow-up by unmet kind (command -> fix) and then escalate on no-progress
      // rather than silently looping or claiming completion.
      runFlow: async ({ processId }) => {
        processIds.push(processId);
        return {
          projection: projection({
            outcome: 'complete',
            declared: ['reports/x.json'],
            evidence: [],
          }),
        };
      },
    });
    expect(result.outcome).toBe('needs_attention');
    expect(result.outcome).not.toBe('complete');
    expect(processIds[0]).toBe('build');
    expect(processIds[1]).toBe('fix'); // command unmet -> fix
    expect(result.stopReason).toMatch(/no-progress|attempt limit/i);
  });

  it('stops at a checkpoint surfaced by a real attempt', async () => {
    const result = await runAutonomousContinuation({
      contract: contract(),
      primaryProcessId: 'build',
      runFlow: async () => ({ projection: projection({ outcome: 'checkpoint_waiting' }) }),
    });
    expect(result.outcome).toBe('needs_attention');
    expect(result.stopReason).toMatch(/checkpoint/i);
  });
});
