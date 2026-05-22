import { describe, expect, it } from 'vitest';

import { ChangePacketV0, SafeApplyResultV0 } from '../../src/index.js';

const runId = '0191d2f0-aaaa-7fff-8aaa-000000000000';
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const shaC = 'c'.repeat(64);
const shaD = 'd'.repeat(64);
const shaE = 'e'.repeat(64);

function ref(kind: string, path: string, sha256 = shaA): Record<string, unknown> {
  return { kind, ref: path, sha256 };
}

function traceRef(sequence: number): Record<string, unknown> {
  return {
    kind: 'trace',
    ref: `trace.ndjson#sequence=${sequence}`,
    run_id: runId,
    sequence,
  };
}

function policyRef(path = 'policy.constraints.writes'): Record<string, unknown> {
  return { kind: 'policy', ref: path };
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
      branch_id: 'branch-a',
      connector: 'codex',
      model: 'openai/gpt-5',
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

function validSafeApplyResult(): Record<string, unknown> {
  return {
    schema_version: 1,
    kind: 'safe_apply.result',
    decision_id: 'gd-safe-apply-build-act-1',
    change_packet_ref: ref('change_packet', 'change-packets/cp-build-act-1.json', shaA),
    action: 'applied',
    outcome: 'pass',
    reason_codes: ['applied'],
    base_check: {
      status: 'pass',
      expected_ref: 'HEAD',
      actual_ref: 'HEAD',
      tree_hash_match: true,
    },
    dirty_parent_check: {
      status: 'pass',
      policy_ref: policyRef(),
      refs: [ref('command', 'commands/git-status-before.json', shaB)],
    },
    patch_check: {
      status: 'pass',
      conflict_files: [],
      partial_mutation: 'none',
    },
    touched_file_check: {
      status: 'pass',
      runtime_ref: ref('diff', 'diffs/build-act.changed-files.json', shaC),
      worker_claim_ref: ref('report', 'reports/build-implementation.json', shaD),
    },
    proof_check: {
      status: 'pass',
      proof_assessment_refs: [ref('report', 'reports/proof-assessment.json', shaE)],
    },
    protected_file_check: {
      status: 'pass',
      files: [],
    },
    generated_surface_check: {
      status: 'not_required',
    },
    final_verification: {
      status: 'pass',
      ref: ref('command', 'commands/npm-test.json', shaA),
    },
    applied_patch_ref: ref('patch', 'patches/build-act.patch', shaB),
    result_ref: ref('safe_apply', 'safe-apply/results/cp-build-act-1.json', shaC),
  };
}

describe('ChangePacketV0 schema', () => {
  it('accepts a complete proposed change packet', () => {
    expect(ChangePacketV0.safeParse(validPacket()).success).toBe(true);
  });

  it('rejects packets without a base ref or tree hash', () => {
    const missingRef = validPacket();
    (missingRef.base as Record<string, unknown>).ref = undefined;
    expect(ChangePacketV0.safeParse(missingRef).success).toBe(false);

    const missingTree = validPacket();
    (missingTree.base as Record<string, unknown>).tree_hash = undefined;
    expect(ChangePacketV0.safeParse(missingTree).success).toBe(false);
  });

  it('requires base status refs to be runtime command refs', () => {
    const packet = validPacket();
    (packet.base as Record<string, unknown>).status_ref = policyRef();

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('rejects patch hash mismatches and missing patch refs', () => {
    const hashMismatch = validPacket();
    (hashMismatch.patch as Record<string, unknown>).sha256 = shaA;
    expect(ChangePacketV0.safeParse(hashMismatch).success).toBe(false);

    const missingPatchRef = validPacket();
    (missingPatchRef.patch as Record<string, unknown>).ref = undefined;
    expect(ChangePacketV0.safeParse(missingPatchRef).success).toBe(false);
  });

  it('requires patch precheck refs to be runtime command refs', () => {
    const packet = validPacket();
    (packet.patch as Record<string, unknown>).apply_precheck_ref = ref(
      'report',
      'reports/patch-precheck.json',
      shaA,
    );

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('requires hunk refs to point at diff or patch artifacts', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'src/example.ts',
        status: 'modified',
        source: 'runtime_diff',
        hunks_ref: ref('report', 'reports/hunks.json', shaA),
        generated_surface: false,
        protected: false,
      },
    ];

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('requires runtime-computed touched files instead of worker claims', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).runtime_ref = ref(
      'report',
      'reports/worker-claim.json',
      shaA,
    );

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('rejects apply recommendations when worker claims do not match runtime touched files', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).worker_claim_matches_runtime = false;

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);

    packet.apply_recommendation = 'review';
    expect(ChangePacketV0.safeParse(packet).success).toBe(true);
  });

  it('rejects apply recommendations when the patch does not apply to the base', () => {
    const packet = validPacket();
    (packet.patch as Record<string, unknown>).applies_to_base = false;

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);

    packet.apply_recommendation = 'review';
    expect(ChangePacketV0.safeParse(packet).success).toBe(true);
  });

  it('requires proof assessment refs for write-capable packets', () => {
    const packet = validPacket();
    packet.proof_assessment_refs = [];

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('requires proof assessment refs to point at proof artifacts', () => {
    const packet = validPacket();
    packet.proof_assessment_refs = [policyRef()];

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('rejects generated-surface changes without source, output, and drift-check evidence', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'plugins/codex/skills/run/SKILL.md',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: true,
        protected: false,
      },
    ];
    packet.generated_surfaces = {
      status: 'unknown',
      source_refs: [],
      output_refs: [],
    };

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('accepts generated-surface changes only with source, output, and drift-check evidence', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'plugins/codex/skills/run/SKILL.md',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: true,
        protected: false,
      },
    ];
    packet.generated_surfaces = {
      status: 'synced',
      source_refs: [ref('generated_surface', 'src/commands/run.md', shaA)],
      output_refs: [ref('generated_surface', 'plugins/codex/skills/run/SKILL.md', shaB)],
      drift_check_ref: ref('command', 'commands/emit-check.json', shaC),
    };
    packet.risks = [
      {
        kind: 'generated_surface',
        severity: 'medium',
        refs: [ref('command', 'commands/emit-check.json', shaC)],
      },
    ];

    expect(ChangePacketV0.safeParse(packet).success).toBe(true);
  });

  it('requires generated-surface changes to carry matching risk evidence', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'plugins/codex/skills/run/SKILL.md',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: true,
        protected: false,
      },
    ];
    packet.generated_surfaces = {
      status: 'synced',
      source_refs: [ref('generated_surface', 'src/commands/run.md', shaA)],
      output_refs: [ref('generated_surface', 'plugins/codex/skills/run/SKILL.md', shaB)],
      drift_check_ref: ref('command', 'commands/emit-check.json', shaC),
    };

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('requires generated-surface packet refs and drift checks to use the right ref kinds', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'plugins/codex/skills/run/SKILL.md',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: true,
        protected: false,
      },
    ];
    packet.generated_surfaces = {
      status: 'synced',
      source_refs: [ref('report', 'reports/source-owner.json', shaA)],
      output_refs: [ref('generated_surface', 'plugins/codex/skills/run/SKILL.md', shaB)],
      drift_check_ref: ref('report', 'reports/generated-surface.json', shaC),
    };

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('requires protected-file authority and risk evidence', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'src/runtime/executors/relay.ts',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: false,
        protected: true,
      },
    ];
    packet.protected_files = {
      decision: 'allowed',
      policy_ref: policyRef('policy.constraints.protected_files'),
      files: ['src/runtime/executors/relay.ts'],
    };

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);

    packet.risks = [
      {
        kind: 'protected_file',
        severity: 'high',
        refs: [policyRef('policy.constraints.protected_files')],
      },
    ];

    expect(ChangePacketV0.safeParse(packet).success).toBe(true);
  });

  it('requires checkpoint refs for checkpointed protected files', () => {
    const packet = validPacket();
    (packet.touched_files as Record<string, unknown>).files = [
      {
        path: 'src/runtime/executors/relay.ts',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: false,
        protected: true,
      },
    ];
    packet.protected_files = {
      decision: 'checkpointed',
      policy_ref: policyRef('policy.constraints.protected_files'),
      files: ['src/runtime/executors/relay.ts'],
    };

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);

    (packet.protected_files as Record<string, unknown>).checkpoint_ref = traceRef(8);
    packet.risks = [
      {
        kind: 'protected_file',
        severity: 'high',
        refs: [policyRef('policy.constraints.protected_files')],
      },
    ];
    expect(ChangePacketV0.safeParse(packet).success).toBe(true);
  });

  it('blocks generated-surface apply when drift remains and allows rejection packets to carry drift evidence', () => {
    const drifted = validPacket();
    (drifted.touched_files as Record<string, unknown>).files = [
      {
        path: 'plugins/codex/commands/build.md',
        status: 'modified',
        source: 'runtime_diff',
        generated_surface: true,
        protected: false,
      },
    ];
    drifted.generated_surfaces = {
      status: 'drift_detected',
      source_refs: [ref('generated_surface', 'src/flows/build/command.md', shaB)],
      output_refs: [ref('generated_surface', 'plugins/codex/commands/build.md', shaC)],
      drift_check_ref: ref('command', 'commands/check-flow-drift.json', shaD),
    };
    drifted.risks = [
      {
        kind: 'generated_surface',
        severity: 'medium',
        refs: [ref('evidence', 'evidence/generated-surface-drift.json', shaE)],
      },
    ];
    expect(ChangePacketV0.safeParse(drifted).success).toBe(false);

    drifted.apply_recommendation = 'reject';
    expect(ChangePacketV0.safeParse(drifted).success).toBe(true);

    const missingDriftCheck = {
      ...drifted,
      generated_surfaces: {
        status: 'synced',
        source_refs: [ref('generated_surface', 'src/flows/build/command.md', shaB)],
        output_refs: [ref('generated_surface', 'plugins/codex/commands/build.md', shaC)],
      },
    };
    expect(ChangePacketV0.safeParse(missingDriftCheck).success).toBe(false);

    const synced = {
      ...drifted,
      generated_surfaces: {
        status: 'synced',
        source_refs: [ref('generated_surface', 'src/flows/build/command.md', shaB)],
        output_refs: [ref('generated_surface', 'plugins/codex/commands/build.md', shaC)],
        drift_check_ref: ref('command', 'commands/check-flow-drift.json', shaD),
      },
    };
    expect(ChangePacketV0.safeParse(synced).success).toBe(true);
  });

  it('rejects dirty parent ambiguity and hidden index flags', () => {
    const dirtyAllowed = validPacket();
    (dirtyAllowed.base as Record<string, unknown>).dirty_parent = {
      state: 'dirty_allowed',
      policy_ref: policyRef(),
      dirty_paths: ['src/operator-change.ts'],
      hidden_index_flags: [],
    };
    expect(ChangePacketV0.safeParse(dirtyAllowed).success).toBe(false);

    const hiddenFlag = validPacket();
    (hiddenFlag.base as Record<string, unknown>).dirty_parent = {
      state: 'clean',
      policy_ref: policyRef(),
      dirty_paths: [],
      hidden_index_flags: [{ tag: 'S', path: 'src/hidden.ts' }],
    };
    expect(ChangePacketV0.safeParse(hiddenFlag).success).toBe(false);
  });

  it('requires dirty parent states to carry matching risk evidence', () => {
    const packet = validPacket();
    (packet.base as Record<string, unknown>).dirty_parent = {
      state: 'dirty_allowed',
      policy_ref: policyRef(),
      baseline_snapshot_ref: ref('evidence', 'evidence/baseline-snapshot.json', shaA),
      dirty_paths: ['src/operator-change.ts'],
      hidden_index_flags: [],
    };

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);

    packet.risks = [
      {
        kind: 'dirty_parent',
        severity: 'medium',
        refs: [policyRef()],
      },
    ];
    expect(ChangePacketV0.safeParse(packet).success).toBe(true);
  });

  it('requires dirty parent baseline snapshots to point at evidence or reports', () => {
    const packet = validPacket();
    (packet.base as Record<string, unknown>).dirty_parent = {
      state: 'dirty_allowed',
      policy_ref: policyRef(),
      baseline_snapshot_ref: policyRef(),
      dirty_paths: ['src/operator-change.ts'],
      hidden_index_flags: [],
    };
    packet.risks = [
      {
        kind: 'dirty_parent',
        severity: 'medium',
        refs: [policyRef()],
      },
    ];

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);
  });

  it('keeps pre-SafeApply trusted writes separate from isolated worktrees', () => {
    const packet = validPacket();
    (packet.producer as Record<string, unknown>).work_root_kind = 'pre_safe_apply_trusted_write';

    expect(ChangePacketV0.safeParse(packet).success).toBe(false);

    (packet.producer as Record<string, unknown>).work_root_ref = ref(
      'diff',
      'diffs/parent-checkout-before-after.json',
      shaA,
    );

    expect(ChangePacketV0.safeParse(packet).success).toBe(true);
  });
});

describe('SafeApplyResultV0 schema', () => {
  it('accepts an applied result with proof and final verification refs', () => {
    expect(SafeApplyResultV0.safeParse(validSafeApplyResult()).success).toBe(true);
  });

  it('rejects freeform reason text', () => {
    const result = validSafeApplyResult();
    result.reason_codes = ['looks_good'];

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);
  });

  it('rejects base-check pass without a matching tree hash', () => {
    const result = validSafeApplyResult();
    (result.base_check as Record<string, unknown>).tree_hash_match = false;

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);
  });

  it('rejects applied results without final verification refs', () => {
    const result = validSafeApplyResult();
    result.final_verification = { status: 'not_run' };

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);
  });

  it('requires final verification refs to be runtime command refs', () => {
    const result = validSafeApplyResult();
    result.final_verification = {
      status: 'pass',
      ref: ref('report', 'reports/final-verification.json', shaA),
    };

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);
  });

  it('rejects pass or applied results when partial mutation is possible', () => {
    const result = validSafeApplyResult();
    result.patch_check = {
      status: 'pass',
      conflict_files: [],
      partial_mutation: 'possible',
    };

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);
  });

  it('represents rejected failures without allowing them to pass or apply', () => {
    const result = validSafeApplyResult();
    result.action = 'rejected';
    result.outcome = 'fail';
    result.reason_codes = ['base_mismatch'];
    result.base_check = {
      status: 'fail',
      expected_ref: 'HEAD',
      actual_ref: 'HEAD~1',
      tree_hash_match: false,
    };
    result.final_verification = { status: 'not_run' };
    result.applied_patch_ref = undefined;

    expect(SafeApplyResultV0.safeParse(result).success).toBe(true);

    result.patch_check = {
      status: 'fail',
      conflict_files: ['src/example.ts'],
      partial_mutation: 'confirmed',
    };
    result.reason_codes = ['apply_conflict'];
    expect(SafeApplyResultV0.safeParse(result).success).toBe(true);
  });

  it('requires apply-conflict reason codes when partial mutation is possible', () => {
    const result = validSafeApplyResult();
    result.action = 'rejected';
    result.outcome = 'fail';
    result.reason_codes = ['rejected'];
    result.patch_check = {
      status: 'fail',
      conflict_files: ['src/example.ts'],
      partial_mutation: 'possible',
    };
    result.final_verification = { status: 'not_run' };
    result.applied_patch_ref = undefined;

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);
  });

  it('requires drift-check refs for passing generated-surface checks', () => {
    const result = validSafeApplyResult();
    result.generated_surface_check = { status: 'pass' };

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);

    result.generated_surface_check = {
      status: 'pass',
      drift_check_ref: ref('command', 'commands/emit-check.json', shaB),
    };
    expect(SafeApplyResultV0.safeParse(result).success).toBe(true);
  });

  it('requires generated-surface drift checks to be command refs', () => {
    const result = validSafeApplyResult();
    result.generated_surface_check = {
      status: 'pass',
      drift_check_ref: ref('report', 'reports/generated-surface.json', shaB),
    };

    expect(SafeApplyResultV0.safeParse(result).success).toBe(false);
  });
});
