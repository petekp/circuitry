import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { flowPackages } from '../../src/flows/catalog.js';
import {
  PursuitBatch,
  PursuitContract,
  PursuitGraph,
  PursuitResult,
  PursuitResultReportPointer,
  PursuitReview,
  PursuitSafeApplyBranchPlan,
  PursuitSafeApplyReport,
  PursuitVerification,
  PursuitWavePlan,
} from '../../src/flows/pursue/reports.js';
import { findCloseBuilder } from '../../src/flows/registries/close-writers/registry.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

const PURSUE_FLOW_PATH = join('generated', 'flows', 'pursue', 'circuit.json');
const RUN_ID = '123e4567-e89b-42d3-a456-426614174000';
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

const EXPECTED_REPORT_WRITES = {
  'pursuit.contract': { path: 'reports/pursuit/contract.json', schema: 'pursuit.contract@v1' },
  'pursuit.graph': { path: 'reports/pursuit/graph.json', schema: 'pursuit.graph@v1' },
  'pursuit.wave-plan': {
    path: 'reports/pursuit/wave-plan.json',
    schema: 'pursuit.wave-plan@v1',
  },
  'pursuit.batch': { path: 'reports/pursuit/batch.json', schema: 'pursuit.batch@v1' },
  'pursuit.verification': {
    path: 'reports/pursuit/verification.json',
    schema: 'pursuit.verification@v1',
  },
  'pursuit.review': { path: 'reports/pursuit/review.json', schema: 'pursuit.review@v1' },
  'pursuit.result': { path: 'reports/pursuit-result.json', schema: 'pursuit.result@v1' },
} as const;

function touchSet(overrides: Record<string, unknown> = {}) {
  return {
    paths: ['src/example.ts'],
    symbols: [],
    commands: ['npm run verify'],
    generated_outputs: [],
    ...overrides,
  };
}

function verificationCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pursuit-proof',
    cwd: '.',
    argv: ['npm', 'run', 'verify'],
    timeout_ms: 120_000,
    max_output_bytes: 200_000,
    env: {},
    ...overrides,
  };
}

function batchItem(status: 'completed' | 'skipped' | 'blocked' | 'failed') {
  return {
    pursuit_id: 'pursuit-1',
    status,
    summary: `${status} pursuit`,
    evidence: ['reports/pursuit/batch.json'],
  };
}

function resultPointers() {
  return [
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.contract',
      path: 'reports/pursuit/contract.json',
      schema: 'pursuit.contract@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.graph',
      path: 'reports/pursuit/graph.json',
      schema: 'pursuit.graph@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.wave-plan',
      path: 'reports/pursuit/wave-plan.json',
      schema: 'pursuit.wave-plan@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.batch',
      path: 'reports/pursuit/batch.json',
      schema: 'pursuit.batch@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.verification',
      path: 'reports/pursuit/verification.json',
      schema: 'pursuit.verification@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.review',
      path: 'reports/pursuit/review.json',
      schema: 'pursuit.review@v1',
    }),
  ];
}

function contentRef(
  kind: string,
  ref: string,
  sha256 = SHA_A,
  extra: Record<string, unknown> = {},
) {
  return { kind, ref, sha256, ...extra };
}

function traceRef(sequence: number) {
  return {
    kind: 'trace',
    ref: `trace.ndjson#sequence=${sequence}`,
    run_id: RUN_ID,
    sequence,
  };
}

function policyRef(ref = 'policy/runtime-config-v1') {
  return { kind: 'policy', ref };
}

function workContractRef(ref = 'generated/flows/pursue/circuit.work-contract.v0.json') {
  return contentRef('work_contract', ref, SHA_B, { flow_id: 'pursue' });
}

function safeApplyPacket(overrides: Record<string, unknown> = {}) {
  return {
    pursuit_id: 'pursuit-1',
    branch_id: 'branch-1',
    change_packet_ref: contentRef('change_packet', 'reports/pursuit/change-packets/cp-1.json'),
    status: 'applied',
    safe_apply_decision_ref: traceRef(11),
    safe_apply_result_ref: contentRef('safe_apply', 'reports/pursuit/safe-apply/cp-1.json', SHA_B),
    proof_assessment_refs: [contentRef('evidence', 'reports/proof/pa-1.json', SHA_C)],
    final_verification_ref: contentRef(
      'command',
      'reports/commands/final-verification.json',
      SHA_C,
    ),
    reason_codes: ['applied'],
    ...overrides,
  };
}

function safeApplyBranch(overrides: Record<string, unknown> = {}) {
  return {
    pursuit_id: 'pursuit-1',
    branch_id: 'branch-1',
    status: 'candidate',
    source_pursuit_contract_ref: workContractRef(),
    estimated_touch_set: touchSet(),
    expected_generated_outputs: [],
    risk: 'medium',
    required_claims: ['The requested change is implemented and verified'],
    required_verification_commands: [verificationCommand()],
    allowed_recovery_route_kinds: ['retry_same_step_with_feedback', 'safe_apply_reject'],
    child_execution: {
      kind: 'relay',
      role: 'implementer',
    },
    work_root_kind: 'isolated_worktree',
    proof_policy_ref: policyRef('policy.proof.standard'),
    expected_change_packet_ref: contentRef(
      'change_packet',
      'reports/pursuit/change-packets/cp-1.json',
      SHA_A,
    ),
    ...overrides,
  };
}

function safeApplyBranchPlan(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    mode: 'parallel-isolated-safe-apply',
    runtime_status: 'planning-only',
    source_contract_ref: workContractRef(),
    graph_ref: contentRef('report', 'reports/pursuit/graph.json', SHA_A),
    wave_plan_ref: contentRef('report', 'reports/pursuit/wave-plan.json', SHA_B),
    policy_ref: policyRef('policy.constraints.pursue.parallel_writes'),
    max_parallel_branches: 2,
    branches: [safeApplyBranch()],
    counts: {
      candidate: 1,
      serial_fallback: 0,
      blocked: 0,
      checkpoint_required: 0,
    },
    ...overrides,
  };
}

function safeApplyReport(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    mode: 'parallel-isolated-safe-apply',
    base: {
      ref: 'HEAD',
      tree_hash: SHA_A,
      dirty_parent_state: 'clean',
      policy_ref: policyRef(),
    },
    branch_plan_ref: contentRef('report', 'reports/pursuit/branch-plan.json', SHA_B),
    proof_policy_decision_ref: traceRef(10),
    packets: [safeApplyPacket()],
    applied_order: ['branch-1'],
    counts: {
      applied: 1,
      rejected: 0,
      blocked: 0,
      failed_before_packet: 0,
      serial_fallback: 0,
    },
    touch_set_reconciliation: [
      {
        pursuit_id: 'pursuit-1',
        estimated_touch_set_ref: workContractRef(),
        runtime_touched_files_ref: contentRef(
          'diff',
          'reports/pursuit/runtime-touched.diff',
          SHA_B,
        ),
        generated_surface_status: 'not_touched',
        scope_status: 'inside_estimate',
      },
    ],
    generated_surfaces: {
      status: 'not_touched',
      source_refs: [],
      output_refs: [],
    },
    final_verification: {
      status: 'passed',
      ref: contentRef('command', 'reports/commands/final-verification.json', SHA_C),
    },
    ...overrides,
  };
}

function loadFlow(path: string): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(readFileSync(path, 'utf-8')));
}

function reportWritesBySchema(flow: CompiledFlow): Map<string, string> {
  const writes = new Map<string, string>();
  for (const step of flow.steps) {
    const writesSlot = 'writes' in step ? step.writes : undefined;
    if (writesSlot !== undefined && 'report' in writesSlot && writesSlot.report !== undefined) {
      const report = writesSlot.report;
      writes.set(report.schema, report.path);
    }
  }
  return writes;
}

function packageReportSchemas(flowId: string): readonly string[] {
  const pkg = flowPackages.find((candidate) => candidate.id === flowId);
  if (pkg === undefined) throw new Error(`missing flow package '${flowId}'`);
  return [
    ...pkg.relayReports.map((report) => report.schemaName),
    ...(pkg.reportSchemas ?? []).map((report) => report.schemaName),
  ];
}

describe('Pursue report schemas', () => {
  it('accepts minimal valid Pursue reports', () => {
    expect(
      PursuitContract.parse({
        objective: 'Ship two coordinated changes without collisions',
        pursuits: [
          {
            id: 'pursuit-1',
            title: 'Update runtime contract',
            goal: 'Update src/example.ts',
            scope: 'Only the named file',
            assumptions: ['No external service changes are required'],
            estimated_touch_set: touchSet(),
            proof_plan: ['Run npm run verify'],
            check_in_triggers: ['A shared file needs a conflicting edit'],
            rollback_notes: ['Revert the local file edit'],
            risk: 'medium',
          },
        ],
        execution_policy: {
          code_writes: 'serial-only',
          read_only_parallelism: 'allowed',
          parallel_write_status: 'blocked-until-safe-apply',
        },
        verification_command_candidates: [verificationCommand()],
      }),
    ).toBeDefined();
    expect(
      PursuitGraph.parse({
        verdict: 'accept',
        nodes: [
          {
            id: 'pursuit-1',
            goal: 'Update src/example.ts',
            estimated_touch_set: touchSet(),
            risk: 'medium',
            status: 'ready',
            reason: 'Ready after framing',
          },
        ],
        edges: [],
        serial_groups: [
          {
            id: 'serial-code-writes',
            pursuit_ids: ['pursuit-1'],
            reason: 'Code writes are serial in Pursuits V1',
          },
        ],
        parallel_read_only_groups: [
          {
            id: 'parallel-discovery',
            pursuit_ids: ['pursuit-1'],
            reason: 'Read-only discovery can happen before writes',
          },
        ],
        blocked: [],
      }),
    ).toBeDefined();
    expect(
      PursuitWavePlan.parse({
        verdict: 'accept',
        waves: [
          {
            id: 'discovery',
            kind: 'read-only',
            pursuit_ids: ['pursuit-1'],
            execution: 'parallel',
            reason: 'Gather context first',
            re_ground_after: true,
          },
          {
            id: 'serial-code-writes',
            kind: 'code-change',
            pursuit_ids: ['pursuit-1'],
            execution: 'serial',
            reason: 'Avoid write collisions',
            re_ground_after: true,
          },
        ],
        no_parallel_writes_reason: 'V1 does not apply parallel worktree edits.',
      }),
    ).toBeDefined();
    expect(
      PursuitBatch.parse({
        verdict: 'accept',
        summary: 'Completed the coordinated batch',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['npm run verify passed'],
      }),
    ).toBeDefined();
    expect(
      PursuitVerification.parse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'pursuit-proof',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            exit_code: 0,
            status: 'passed',
            duration_ms: 25,
            stdout_summary: 'All checks passed',
            stderr_summary: '',
          },
        ],
      }),
    ).toBeDefined();
    expect(
      PursuitReview.parse({
        verdict: 'clean',
        summary: 'No coordination issues found',
        findings: [],
      }),
    ).toBeDefined();
    expect(
      PursuitResult.parse({
        summary: 'All pursuits completed',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'clean',
        total_pursuits: 1,
        completed_count: 1,
        skipped_count: 0,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }),
    ).toBeDefined();
  });

  it('blocks parallel code-change waves', () => {
    expect(
      PursuitWavePlan.safeParse({
        verdict: 'accept',
        waves: [
          {
            id: 'unsafe-code-wave',
            kind: 'code-change',
            pursuit_ids: ['pursuit-1', 'pursuit-2'],
            execution: 'parallel',
            reason: 'This would collide',
            re_ground_after: true,
          },
        ],
        no_parallel_writes_reason: 'Code writes must be serial.',
      }).success,
    ).toBe(false);
  });

  it('keeps Pursue V1 serial-write report fields strict before SafeApply cutover', () => {
    expect(
      PursuitContract.safeParse({
        objective: 'Do coordinated work',
        pursuits: [
          {
            id: 'pursuit-1',
            title: 'Update runtime contract',
            goal: 'Update src/example.ts',
            scope: 'Only the named file',
            assumptions: ['No external service changes are required'],
            estimated_touch_set: touchSet(),
            proof_plan: ['Run npm run verify'],
            check_in_triggers: ['A shared file needs a conflicting edit'],
            rollback_notes: ['Revert the local file edit'],
            risk: 'medium',
          },
        ],
        execution_policy: {
          code_writes: 'parallel-isolated-safe-apply',
          read_only_parallelism: 'allowed',
          parallel_write_status: 'enabled',
        },
        verification_command_candidates: [verificationCommand()],
      }).success,
    ).toBe(false);
    expect(
      PursuitBatch.safeParse({
        verdict: 'accept',
        summary: 'This would hide parallel writes',
        serialized_execution: false,
        completed: [batchItem('completed')],
        skipped: [],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['npm run verify passed'],
      }).success,
    ).toBe(false);
    expect(
      PursuitResult.safeParse({
        summary: 'Unsafe result',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'clean',
        total_pursuits: 1,
        completed_count: 1,
        skipped_count: 0,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: false,
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
  });

  it('accepts a planning-only Pursue SafeApply branch plan without enabling parallel writes', () => {
    expect(PursuitSafeApplyBranchPlan.parse(safeApplyBranchPlan())).toBeDefined();
    expect(
      PursuitSafeApplyBranchPlan.parse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              pursuit_id: 'pursuit-1',
              branch_id: 'branch-1',
              status: 'serial_fallback',
              expected_change_packet_ref: undefined,
              reason: 'Protected runtime files stay serial until checkpoint authority exists',
            }),
          ],
          counts: {
            candidate: 0,
            serial_fallback: 1,
            blocked: 0,
            checkpoint_required: 0,
          },
        }),
      ),
    ).toBeDefined();
  });

  it('rejects Pursue SafeApply branch plans that would smuggle in unsafe parallel writes', () => {
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              work_root_kind: 'parent_checkout_diff_capture',
            }),
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              expected_change_packet_ref: undefined,
            }),
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          runtime_status: 'enabled',
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              child_execution: {
                kind: 'relay',
                role: 'implementer',
                flow_id: 'fix',
              },
            }),
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              child_execution: {
                kind: 'child_flow',
                flow_id: 'fix',
                role: 'implementer',
              },
            }),
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              allowed_recovery_route_kinds: ['retry_same_step_with_feedback'],
            }),
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('keeps Pursue SafeApply branch-plan counts, refs, and fallbacks honest', () => {
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          counts: {
            candidate: 0,
            serial_fallback: 0,
            blocked: 0,
            checkpoint_required: 0,
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch(),
            safeApplyBranch({
              branch_id: 'branch-1',
              pursuit_id: 'pursuit-2',
            }),
          ],
          counts: {
            candidate: 2,
            serial_fallback: 0,
            blocked: 0,
            checkpoint_required: 0,
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              status: 'blocked',
              expected_change_packet_ref: undefined,
            }),
          ],
          counts: {
            candidate: 0,
            serial_fallback: 0,
            blocked: 1,
            checkpoint_required: 0,
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              status: 'checkpoint_required',
              expected_change_packet_ref: undefined,
              reason: 'Protected files need authority',
            }),
          ],
          counts: {
            candidate: 0,
            serial_fallback: 0,
            blocked: 0,
            checkpoint_required: 1,
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyBranchPlan.safeParse(
        safeApplyBranchPlan({
          branches: [
            safeApplyBranch({
              estimated_touch_set: touchSet({
                generated_outputs: ['plugins/codex/flows/pursue/circuit.json'],
              }),
              expected_generated_outputs: [],
            }),
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('accepts a strict Pursue SafeApply report without enabling it in the V1 flow', () => {
    expect(PursuitSafeApplyReport.parse(safeApplyReport())).toBeDefined();
    expect(
      PursuitSafeApplyReport.parse(
        safeApplyReport({
          generated_surfaces: {
            status: 'synced',
            source_refs: [contentRef('generated_surface', 'src/flows/pursue/data.ts', SHA_A)],
            output_refs: [
              contentRef(
                'generated_surface',
                'generated/flows/pursue/circuit.work-contract.v0.json',
                SHA_B,
              ),
            ],
            drift_check_ref: contentRef('command', 'reports/commands/check-flow-drift.json', SHA_C),
          },
          touch_set_reconciliation: [
            {
              pursuit_id: 'pursuit-1',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched.diff',
                SHA_B,
              ),
              generated_surface_status: 'synced',
              scope_status: 'inside_estimate',
            },
          ],
        }),
      ),
    ).toBeDefined();
  });

  it('keeps SafeApply packet counts and applied order honest', () => {
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          counts: {
            applied: 0,
            rejected: 0,
            blocked: 0,
            failed_before_packet: 0,
            serial_fallback: 0,
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          applied_order: ['missing-branch'],
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          packets: [safeApplyPacket({ reason_codes: ['Bad-Reason'] })],
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          packets: [
            safeApplyPacket(),
            safeApplyPacket({
              branch_id: 'branch-1',
              pursuit_id: 'pursuit-2',
            }),
          ],
          applied_order: ['branch-1', 'branch-1'],
          counts: {
            applied: 2,
            rejected: 0,
            blocked: 0,
            failed_before_packet: 0,
            serial_fallback: 0,
          },
          touch_set_reconciliation: [
            {
              pursuit_id: 'pursuit-1',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched-1.diff',
                SHA_B,
              ),
              generated_surface_status: 'not_touched',
              scope_status: 'inside_estimate',
            },
            {
              pursuit_id: 'pursuit-2',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched-2.diff',
                SHA_C,
              ),
              generated_surface_status: 'not_touched',
              scope_status: 'inside_estimate',
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects applied packets without packet, guidance, proof, runtime touch, and final verification refs', () => {
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          packets: [
            safeApplyPacket({
              change_packet_ref: undefined,
              safe_apply_decision_ref: undefined,
              safe_apply_result_ref: undefined,
              proof_assessment_refs: [],
              final_verification_ref: undefined,
            }),
          ],
          touch_set_reconciliation: [
            {
              pursuit_id: 'pursuit-1',
              estimated_touch_set_ref: workContractRef(),
              generated_surface_status: 'not_touched',
              scope_status: 'inside_estimate',
            },
          ],
          final_verification: {
            status: 'skipped',
          },
        }),
      ).success,
    ).toBe(false);
  });

  it('requires rejected packets to remain visible with SafeApply and recovery refs', () => {
    expect(
      PursuitSafeApplyReport.parse(
        safeApplyReport({
          packets: [
            safeApplyPacket({
              status: 'rejected',
              final_verification_ref: undefined,
              recovery_route_ref: traceRef(12),
              reason_codes: ['weak_proof'],
            }),
          ],
          applied_order: [],
          counts: {
            applied: 0,
            rejected: 1,
            blocked: 0,
            failed_before_packet: 0,
            serial_fallback: 0,
          },
          touch_set_reconciliation: [
            {
              pursuit_id: 'pursuit-1',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched.diff',
                SHA_B,
              ),
              generated_surface_status: 'not_touched',
              scope_status: 'inside_estimate',
            },
          ],
          final_verification: {
            status: 'skipped',
          },
        }),
      ),
    ).toBeDefined();
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          packets: [
            safeApplyPacket({
              status: 'rejected',
              final_verification_ref: undefined,
              recovery_route_ref: undefined,
              safe_apply_result_ref: undefined,
            }),
          ],
          applied_order: [],
          counts: {
            applied: 0,
            rejected: 1,
            blocked: 0,
            failed_before_packet: 0,
            serial_fallback: 0,
          },
          final_verification: {
            status: 'skipped',
          },
        }),
      ).success,
    ).toBe(false);
  });

  it('allows applied work to be reported beside visible unresolved packets', () => {
    expect(
      PursuitSafeApplyReport.parse(
        safeApplyReport({
          packets: [
            safeApplyPacket(),
            safeApplyPacket({
              pursuit_id: 'pursuit-2',
              branch_id: 'branch-2',
              status: 'blocked',
              change_packet_ref: undefined,
              safe_apply_decision_ref: undefined,
              safe_apply_result_ref: undefined,
              final_verification_ref: undefined,
              proof_assessment_refs: [],
              recovery_route_ref: traceRef(12),
              reason_codes: ['rejected'],
            }),
          ],
          applied_order: ['branch-1'],
          counts: {
            applied: 1,
            rejected: 0,
            blocked: 1,
            failed_before_packet: 0,
            serial_fallback: 0,
          },
          touch_set_reconciliation: [
            {
              pursuit_id: 'pursuit-1',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched-1.diff',
                SHA_B,
              ),
              generated_surface_status: 'not_touched',
              scope_status: 'inside_estimate',
            },
            {
              pursuit_id: 'pursuit-2',
              estimated_touch_set_ref: workContractRef(),
              generated_surface_status: 'unknown',
              scope_status: 'unknown',
            },
          ],
          generated_surfaces: {
            status: 'unknown',
            source_refs: [],
            output_refs: [],
          },
        }),
      ),
    ).toBeDefined();
  });

  it('keeps blocked, failed, and serial-fallback packets out of SafeApply refs', () => {
    for (const status of ['blocked', 'failed_before_packet', 'serial_fallback'] as const) {
      expect(
        PursuitSafeApplyReport.parse(
          safeApplyReport({
            packets: [
              safeApplyPacket({
                status,
                change_packet_ref: undefined,
                safe_apply_decision_ref: undefined,
                safe_apply_result_ref: undefined,
                final_verification_ref: undefined,
                proof_assessment_refs: [],
                recovery_route_ref: traceRef(12),
                reason_codes: ['rejected'],
              }),
            ],
            applied_order: [],
            counts: {
              applied: 0,
              rejected: 0,
              blocked: status === 'blocked' ? 1 : 0,
              failed_before_packet: status === 'failed_before_packet' ? 1 : 0,
              serial_fallback: status === 'serial_fallback' ? 1 : 0,
            },
            touch_set_reconciliation: [
              {
                pursuit_id: 'pursuit-1',
                estimated_touch_set_ref: workContractRef(),
                generated_surface_status: 'unknown',
                scope_status: 'unknown',
              },
            ],
            generated_surfaces: {
              status: 'unknown',
              source_refs: [],
              output_refs: [],
            },
            final_verification: {
              status: 'skipped',
            },
          }),
        ),
      ).toBeDefined();
      expect(
        PursuitSafeApplyReport.safeParse(
          safeApplyReport({
            packets: [
              safeApplyPacket({
                status,
                final_verification_ref: undefined,
                recovery_route_ref: traceRef(12),
              }),
            ],
            applied_order: [],
            counts: {
              applied: 0,
              rejected: 0,
              blocked: status === 'blocked' ? 1 : 0,
              failed_before_packet: status === 'failed_before_packet' ? 1 : 0,
              serial_fallback: status === 'serial_fallback' ? 1 : 0,
            },
            final_verification: {
              status: 'skipped',
            },
          }),
        ).success,
      ).toBe(false);
    }
  });

  it('rejects missing touch-set reconciliation and generated-surface drift with passed verification', () => {
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          touch_set_reconciliation: [
            {
              pursuit_id: 'missing-pursuit',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched.diff',
                SHA_B,
              ),
              generated_surface_status: 'not_touched',
              scope_status: 'inside_estimate',
            },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          touch_set_reconciliation: [
            {
              pursuit_id: 'pursuit-1',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched.diff',
                SHA_B,
              ),
              generated_surface_status: 'drift_detected',
              scope_status: 'expanded',
            },
          ],
          generated_surfaces: {
            status: 'drift_detected',
            source_refs: [],
            output_refs: [],
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          generated_surfaces: {
            status: 'synced',
            source_refs: [],
            output_refs: [],
            drift_check_ref: contentRef('command', 'reports/commands/check-flow-drift.json', SHA_C),
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          touch_set_reconciliation: [
            {
              pursuit_id: 'pursuit-1',
              estimated_touch_set_ref: workContractRef(),
              runtime_touched_files_ref: contentRef(
                'diff',
                'reports/pursuit/runtime-touched.diff',
                SHA_B,
              ),
              generated_surface_status: 'synced',
              scope_status: 'inside_estimate',
            },
          ],
          generated_surfaces: {
            status: 'not_touched',
            source_refs: [],
            output_refs: [],
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      PursuitSafeApplyReport.safeParse(
        safeApplyReport({
          generated_surfaces: {
            status: 'not_touched',
            source_refs: [contentRef('generated_surface', 'src/flows/pursue/data.ts', SHA_A)],
            output_refs: [],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects coordination graphs that reference unknown pursuits', () => {
    expect(
      PursuitGraph.safeParse({
        verdict: 'accept',
        nodes: [
          {
            id: 'pursuit-1',
            goal: 'Update src/example.ts',
            estimated_touch_set: touchSet(),
            risk: 'medium',
            status: 'ready',
            reason: 'Ready after framing',
          },
        ],
        edges: [{ from: 'pursuit-1', to: 'missing-pursuit', kind: 'conflict', reason: 'bad ref' }],
        serial_groups: [
          {
            id: 'serial-code-writes',
            pursuit_ids: ['missing-pursuit'],
            reason: 'bad ref',
          },
        ],
        parallel_read_only_groups: [
          {
            id: 'parallel-discovery',
            pursuit_ids: ['pursuit-1'],
            reason: 'Read-only discovery can happen before writes',
          },
        ],
        blocked: [{ pursuit_id: 'missing-pursuit', reason: 'bad ref' }],
      }).success,
    ).toBe(false);
  });

  it('keeps batch verdicts and item buckets honest', () => {
    expect(
      PursuitBatch.safeParse({
        verdict: 'accept',
        summary: 'Should not accept failed work',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [],
        blocked: [],
        failed: [batchItem('failed')],
        actual_touch_set: touchSet(),
        proof_evidence: ['failed proof'],
      }).success,
    ).toBe(false);
    expect(
      PursuitBatch.safeParse({
        verdict: 'partial',
        summary: 'Wrong bucket status',
        serialized_execution: true,
        completed: [batchItem('blocked')],
        skipped: [],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['bucket mismatch'],
      }).success,
    ).toBe(false);
    expect(
      PursuitBatch.safeParse({
        verdict: 'accept',
        summary: 'Should not accept skipped work',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [batchItem('skipped')],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['partial proof'],
      }).success,
    ).toBe(false);
    expect(
      PursuitBatch.safeParse({
        verdict: 'blocked',
        summary: 'Blocked verdict needs blocked or failed items',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['blocked without blocked item'],
      }).success,
    ).toBe(false);
  });

  it('keeps review verdicts aligned with finding severity', () => {
    expect(
      PursuitReview.safeParse({
        verdict: 'needs-followup',
        summary: 'A follow-up is required',
        findings: [],
      }).success,
    ).toBe(false);
    expect(
      PursuitReview.safeParse({
        verdict: 'clean',
        summary: 'Findings cannot be hidden behind clean',
        findings: [{ severity: 'low', text: 'Low finding', file_refs: ['src/example.ts:1'] }],
      }).success,
    ).toBe(false);
    expect(
      PursuitReview.safeParse({
        verdict: 'needs-followup',
        summary: 'Medium findings must retry before close',
        findings: [{ severity: 'medium', text: 'Medium finding', file_refs: ['src/example.ts:1'] }],
      }).success,
    ).toBe(false);
    expect(
      PursuitReview.safeParse({
        verdict: 'needs-followup',
        summary: 'Low findings can close as follow-up work',
        findings: [{ severity: 'low', text: 'Low finding', file_refs: ['src/example.ts:1'] }],
      }).success,
    ).toBe(true);
  });

  it('keeps complete results tied to clean review, passed verification, and exact counts', () => {
    expect(
      PursuitResult.safeParse({
        summary: 'Verification failed',
        outcome: 'complete',
        verification_status: 'failed',
        review_verdict: 'clean',
        total_pursuits: 1,
        completed_count: 1,
        skipped_count: 0,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
    expect(
      PursuitResult.safeParse({
        summary: 'Counts do not add up',
        outcome: 'needs_attention',
        verification_status: 'passed',
        review_verdict: 'needs-followup',
        total_pursuits: 3,
        completed_count: 1,
        skipped_count: 0,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
    expect(
      PursuitResult.safeParse({
        summary: 'Skipped work cannot be complete',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'clean',
        total_pursuits: 2,
        completed_count: 1,
        skipped_count: 1,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
    expect(
      PursuitResultReportPointer.safeParse({
        report_id: 'pursuit.graph',
        path: 'reports/pursuit/wrong.json',
        schema: 'pursuit.graph@v1',
      }).success,
    ).toBe(false);
  });

  it('rejects close reports when the batch does not cover every contracted pursuit once', () => {
    const flow = loadFlow(PURSUE_FLOW_PATH);
    const closeStep = flow.steps.find((step) => step.id === 'close-step');
    if (closeStep?.kind !== 'compose' || closeStep.writes?.report === undefined) {
      throw new Error('Pursue close step must be a compose step with a report write');
    }
    const closeBuilder = findCloseBuilder('pursuit.result@v1');
    if (closeBuilder === undefined) throw new Error('Pursue close builder must be registered');

    const contract = PursuitContract.parse({
      objective: 'Ship two coordinated changes without collisions',
      pursuits: [
        {
          id: 'pursuit-1',
          title: 'Update runtime contract',
          goal: 'Update src/example.ts',
          scope: 'Only the named file',
          assumptions: ['No external service changes are required'],
          estimated_touch_set: touchSet(),
          proof_plan: ['Run npm run verify'],
          check_in_triggers: ['A shared file needs a conflicting edit'],
          rollback_notes: ['Revert the local file edit'],
          risk: 'medium',
        },
        {
          id: 'pursuit-2',
          title: 'Update docs',
          goal: 'Update docs/example.md',
          scope: 'Only the named docs file',
          assumptions: ['No external service changes are required'],
          estimated_touch_set: touchSet({ paths: ['docs/example.md'] }),
          proof_plan: ['Run npm run verify'],
          check_in_triggers: ['A shared file needs a conflicting edit'],
          rollback_notes: ['Revert the local file edit'],
          risk: 'low',
        },
      ],
      execution_policy: {
        code_writes: 'serial-only',
        read_only_parallelism: 'allowed',
        parallel_write_status: 'blocked-until-safe-apply',
      },
      verification_command_candidates: [verificationCommand()],
    });
    const graph = PursuitGraph.parse({
      verdict: 'accept',
      nodes: contract.pursuits.map((pursuit) => ({
        id: pursuit.id,
        goal: pursuit.goal,
        estimated_touch_set: pursuit.estimated_touch_set,
        risk: pursuit.risk,
        status: 'ready',
        reason: 'Ready after framing',
      })),
      edges: [],
      serial_groups: [
        {
          id: 'serial-code-writes',
          pursuit_ids: ['pursuit-1', 'pursuit-2'],
          reason: 'Code writes are serial in Pursuits V1',
        },
      ],
      parallel_read_only_groups: [
        {
          id: 'parallel-discovery',
          pursuit_ids: ['pursuit-1', 'pursuit-2'],
          reason: 'Read-only discovery can happen before writes',
        },
      ],
      blocked: [],
    });
    const wavePlan = PursuitWavePlan.parse({
      verdict: 'accept',
      waves: [
        {
          id: 'serial-code-writes',
          kind: 'code-change',
          pursuit_ids: ['pursuit-1', 'pursuit-2'],
          execution: 'serial',
          reason: 'Avoid write collisions',
          re_ground_after: true,
        },
      ],
      no_parallel_writes_reason: 'V1 does not apply parallel worktree edits.',
    });
    const incompleteBatch = PursuitBatch.parse({
      verdict: 'accept',
      summary: 'Completed only one pursuit',
      serialized_execution: true,
      completed: [batchItem('completed')],
      skipped: [],
      blocked: [],
      failed: [],
      actual_touch_set: touchSet(),
      proof_evidence: ['npm run verify passed'],
    });

    expect(() =>
      closeBuilder.build({
        runFolder: '.',
        flow,
        closeStep,
        goal: 'two pursuits',
        inputs: {
          contract,
          graph,
          wavePlan,
          batch: incompleteBatch,
          verification: PursuitVerification.parse({
            overall_status: 'passed',
            commands: [
              {
                command_id: 'pursuit-proof',
                argv: ['npm', 'run', 'verify'],
                cwd: '.',
                exit_code: 0,
                status: 'passed',
                duration_ms: 25,
                stdout_summary: 'All checks passed',
                stderr_summary: '',
              },
            ],
          }),
          review: PursuitReview.parse({
            verdict: 'clean',
            summary: 'No coordination issues found',
            findings: [],
          }),
        },
      }),
    ).toThrow(/missing pursuit id 'pursuit-2'/);
  });
});

describe('Pursue generated flow report bindings', () => {
  const writes = reportWritesBySchema(loadFlow(PURSUE_FLOW_PATH));

  it('binds Pursue reports to generated flow paths and schemas', () => {
    for (const expected of Object.values(EXPECTED_REPORT_WRITES)) {
      expect(writes.get(expected.schema), `${expected.schema} generated report write`).toBe(
        expected.path,
      );
    }
  });

  it('keeps SafeApply planning reports out of the active Pursue V1 flow', () => {
    const flow = loadFlow(PURSUE_FLOW_PATH);
    const flowText = JSON.stringify(flow);
    expect(packageReportSchemas('pursue')).not.toContain('pursuit.safe_apply@v1');
    expect([...writes.keys()]).not.toContain('pursuit.safe_apply@v1');
    expect(flowText).not.toContain('parallel-isolated-safe-apply');
    expect(flowText).not.toContain('pursuit.safe_apply@v1');
  });

  it('gives the close writer every required upstream Pursue report', () => {
    const flow = loadFlow(PURSUE_FLOW_PATH);
    const closeStep = flow.steps.find((step) => step.id === 'close-step');
    expect(closeStep?.reads).toEqual(
      expect.arrayContaining([
        'reports/pursuit/contract.json',
        'reports/pursuit/graph.json',
        'reports/pursuit/wave-plan.json',
        'reports/pursuit/batch.json',
        'reports/pursuit/verification.json',
        'reports/pursuit/review.json',
      ]),
    );
  });
});
