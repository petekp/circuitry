import { describe, expect, it } from 'vitest';

import { evaluateSafeApplyRejectOnly } from '../../src/runtime/safe-apply/reject-only.js';
import { Ref, type Ref as RefValue } from '../../src/schemas/ref.js';

const runId = '0191d2f0-aaaa-7fff-8aaa-000000000000';
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const shaC = 'c'.repeat(64);
const shaD = 'd'.repeat(64);
const shaE = 'e'.repeat(64);

function ref(kind: string, path: string, sha256 = shaA): Record<string, unknown> {
  return { kind, ref: path, sha256 };
}

function policyRef(path = 'policy.constraints.writes'): Record<string, unknown> {
  return { kind: 'policy', ref: path };
}

function changePacketRef(): RefValue {
  return Ref.parse(ref('change_packet', 'change-packets/cp-build-act-1.json', shaA));
}

function validPacket(): Record<string, unknown> {
  return {
    schema_version: 1,
    packet_id: 'cp-build-act-1',
    producer: {
      run_id: runId,
      flow_id: 'build',
      step_id: 'build-act',
      attempt: 1,
      connector: 'codex',
      work_root_kind: 'isolated_worktree',
      work_root_ref: ref('worktree', 'worktrees/branch-a', shaB),
    },
    base: {
      ref: 'HEAD',
      tree_hash: shaC,
      status_ref: ref('command', 'commands/git-status-before.json', shaD),
      dirty_parent: {
        state: 'clean',
        policy_ref: policyRef(),
        dirty_paths: [],
        hidden_index_flags: [],
      },
    },
    patch: {
      ref: ref('patch', 'patches/build-act.patch', shaE),
      sha256: shaE,
      format: 'unified_diff',
      applies_to_base: true,
      apply_precheck_ref: ref('command', 'commands/git-apply-check.json', shaA),
    },
    touched_files: {
      runtime_ref: ref('diff', 'diffs/build-act.changed-files.json', shaB),
      files: [
        {
          path: 'src/example.ts',
          status: 'modified',
          source: 'runtime_diff',
          generated_surface: false,
          protected: false,
        },
      ],
      worker_claim_ref: ref('report', 'reports/build-implementation.json', shaC),
      worker_claim_matches_runtime: true,
    },
    claims: [ref('report', 'reports/proof-claims.json', shaD)],
    evidence: [ref('evidence', 'evidence/verification.json', shaE)],
    proof_assessment_refs: [ref('report', 'reports/proof-assessment.json', shaA)],
    commands_run: [ref('command', 'commands/npm-test.json', shaB)],
    risks: [],
    generated_surfaces: {
      status: 'not_touched',
      source_refs: [],
      output_refs: [],
    },
    protected_files: {
      decision: 'allowed',
      policy_ref: policyRef('policy.constraints.protected_files'),
      files: [],
    },
    apply_recommendation: 'apply',
  };
}

function evaluate(packet: unknown, overrides: Record<string, unknown> = {}) {
  return evaluateSafeApplyRejectOnly({
    decisionId: 'gd-safe-apply-build-act-1',
    changePacketRef: changePacketRef(),
    packet,
    ...overrides,
  });
}

describe('SafeApply reject-only mode', () => {
  it('records review-required instead of applying an otherwise valid packet', () => {
    const outcome = evaluate(validPacket());
    expect(outcome.status).toBe('recorded');
    if (outcome.status !== 'recorded') throw new Error('expected recorded outcome');

    expect(outcome.result.action).toBe('accepted_for_review');
    expect(outcome.result.outcome).toBe('fail');
    expect(outcome.result.reason_codes).toEqual(['review_required']);
    expect(outcome.result.patch_check.partial_mutation).toBe('none');
    expect(outcome.result.final_verification).toEqual({ status: 'not_run' });
    expect(outcome.result.applied_patch_ref).toBeUndefined();
  });

  it('reports packet schema failures before a SafeApply result can be recorded', () => {
    const packet = validPacket();
    packet.schema_version = 2;

    const outcome = evaluate(packet);

    expect(outcome).toMatchObject({
      status: 'packet_invalid',
      reason_codes: ['packet_invalid'],
    });
    if (outcome.status !== 'packet_invalid') throw new Error('expected invalid packet outcome');
    expect(outcome.issues.length).toBeGreaterThan(0);
  });

  it('rejects base mismatches without partial mutation', () => {
    const outcome = evaluate(validPacket(), {
      actualBaseRef: 'HEAD~1',
      treeHashMatches: false,
    });
    expect(outcome.status).toBe('recorded');
    if (outcome.status !== 'recorded') throw new Error('expected recorded outcome');

    expect(outcome.result.action).toBe('rejected');
    expect(outcome.result.reason_codes).toEqual(['base_mismatch']);
    expect(outcome.result.base_check).toEqual({
      status: 'fail',
      expected_ref: 'HEAD',
      actual_ref: 'HEAD~1',
      tree_hash_match: false,
    });
    expect(outcome.result.patch_check.partial_mutation).toBe('none');
  });

  it('rejects worker touched-file mismatches without using the worker claim as proof', () => {
    const packet = validPacket();
    packet.apply_recommendation = 'review';
    (packet.touched_files as Record<string, unknown>).worker_claim_matches_runtime = false;

    const outcome = evaluate(packet);
    expect(outcome.status).toBe('recorded');
    if (outcome.status !== 'recorded') throw new Error('expected recorded outcome');

    expect(outcome.result.action).toBe('rejected');
    expect(outcome.result.reason_codes).toEqual(['touched_files_mismatch']);
    expect(outcome.result.touched_file_check.status).toBe('fail');
    expect(outcome.result.patch_check.partial_mutation).toBe('none');
  });

  it('rejects dirty parent states before apply', () => {
    const packet = validPacket();
    (packet.base as Record<string, unknown>).dirty_parent = {
      state: 'dirty_rejected',
      policy_ref: policyRef(),
      dirty_paths: ['src/operator-change.ts'],
      hidden_index_flags: [],
    };
    packet.risks = [
      {
        kind: 'dirty_parent',
        severity: 'medium',
        refs: [ref('evidence', 'evidence/dirty-parent.json', shaB)],
      },
    ];

    const outcome = evaluate(packet);
    expect(outcome.status).toBe('recorded');
    if (outcome.status !== 'recorded') throw new Error('expected recorded outcome');

    expect(outcome.result.action).toBe('rejected');
    expect(outcome.result.reason_codes).toEqual(['dirty_parent']);
    expect(outcome.result.dirty_parent_check.status).toBe('fail');
    expect(outcome.result.patch_check.partial_mutation).toBe('none');
  });

  it('rejects generated-surface drift before apply', () => {
    const packet = validPacket();
    packet.apply_recommendation = 'reject';
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'plugins/codex/commands/build.md',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: true,
        protected: false,
      },
    ];
    packet.generated_surfaces = {
      status: 'drift_detected',
      source_refs: [ref('generated_surface', 'src/flows/build/command.md', shaB)],
      output_refs: [ref('generated_surface', 'plugins/codex/commands/build.md', shaC)],
      drift_check_ref: ref('command', 'commands/check-flow-drift.json', shaD),
    };
    packet.risks = [
      {
        kind: 'generated_surface',
        severity: 'medium',
        refs: [ref('evidence', 'evidence/generated-surface-drift.json', shaE)],
      },
    ];

    const outcome = evaluate(packet);
    expect(outcome.status).toBe('recorded');
    if (outcome.status !== 'recorded') throw new Error('expected recorded outcome');

    expect(outcome.result.action).toBe('rejected');
    expect(outcome.result.reason_codes).toEqual(['generated_surface_drift']);
    expect(outcome.result.generated_surface_check.status).toBe('fail');
    expect(outcome.result.patch_check.partial_mutation).toBe('none');
  });

  it('routes protected-file checkpoints into a rejected result instead of applying', () => {
    const packet = validPacket();
    const touchedFiles = packet.touched_files as Record<string, unknown>;
    touchedFiles.files = [
      {
        path: 'src/runtime/run/guidance.ts',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: false,
        protected: true,
      },
    ];
    packet.risks = [
      {
        kind: 'protected_file',
        severity: 'high',
        refs: [ref('evidence', 'evidence/protected-file.json', shaB)],
      },
    ];
    packet.protected_files = {
      decision: 'checkpointed',
      policy_ref: policyRef('policy.constraints.protected_files'),
      checkpoint_ref: {
        kind: 'trace',
        ref: 'trace.ndjson#sequence=5',
        run_id: runId,
        sequence: 5,
      },
      files: ['src/runtime/run/guidance.ts'],
    };

    const outcome = evaluate(packet);
    expect(outcome.status).toBe('recorded');
    if (outcome.status !== 'recorded') throw new Error('expected recorded outcome');

    expect(outcome.result.action).toBe('rejected');
    expect(outcome.result.reason_codes).toEqual(['protected_file_touched']);
    expect(outcome.result.protected_file_check.status).toBe('checkpoint_required');
    expect(outcome.result.patch_check.partial_mutation).toBe('none');
  });
});
