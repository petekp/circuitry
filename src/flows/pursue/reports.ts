import { z } from 'zod';
import {
  DirtyParentState,
  GeneratedSurfaceStatus,
  WorkRootKind,
} from '../../schemas/change-packet.js';
import { RecoveryRouteKind } from '../../schemas/recovery-route-kind.js';
import { Ref, Sha256 } from '../../schemas/ref.js';
import { VerificationCommand, VerificationResult } from '../../schemas/verification.js';

const PURSUIT_RESULT_SCHEMA_BY_REPORT_ID = {
  'pursuit.contract': 'pursuit.contract@v1',
  'pursuit.graph': 'pursuit.graph@v1',
  'pursuit.wave-plan': 'pursuit.wave-plan@v1',
  'pursuit.batch': 'pursuit.batch@v1',
  'pursuit.verification': 'pursuit.verification@v1',
  'pursuit.review': 'pursuit.review@v1',
} as const;

const PURSUIT_RESULT_PATH_BY_REPORT_ID = {
  'pursuit.contract': 'reports/pursuit/contract.json',
  'pursuit.graph': 'reports/pursuit/graph.json',
  'pursuit.wave-plan': 'reports/pursuit/wave-plan.json',
  'pursuit.batch': 'reports/pursuit/batch.json',
  'pursuit.verification': 'reports/pursuit/verification.json',
  'pursuit.review': 'reports/pursuit/review.json',
} as const;

const NonEmptyStringArray = z.array(z.string().min(1)).min(1);
const PursuitId = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

export const PursuitRisk = z.enum(['low', 'medium', 'high']);
export type PursuitRisk = z.infer<typeof PursuitRisk>;

export const PursuitTouchSet = z
  .object({
    paths: z.array(z.string().min(1)),
    symbols: z.array(z.string().min(1)),
    commands: z.array(z.string().min(1)),
    generated_outputs: z.array(z.string().min(1)),
  })
  .strict();
export type PursuitTouchSet = z.infer<typeof PursuitTouchSet>;

export const PursuitContractItem = z
  .object({
    id: PursuitId,
    title: z.string().min(1),
    goal: z.string().min(1),
    scope: z.string().min(1),
    assumptions: z.array(z.string().min(1)),
    estimated_touch_set: PursuitTouchSet,
    proof_plan: NonEmptyStringArray,
    check_in_triggers: NonEmptyStringArray,
    rollback_notes: z.array(z.string().min(1)),
    risk: PursuitRisk,
  })
  .strict();
export type PursuitContractItem = z.infer<typeof PursuitContractItem>;

export const PursuitContract = z
  .object({
    objective: z.string().min(1),
    pursuits: z.array(PursuitContractItem).min(1),
    execution_policy: z
      .object({
        code_writes: z.literal('serial-only'),
        read_only_parallelism: z.literal('allowed'),
        parallel_write_status: z.literal('blocked-until-safe-apply'),
      })
      .strict(),
    verification_command_candidates: z.array(VerificationCommand).min(1),
  })
  .strict()
  .superRefine((contract, ctx) => {
    const seen = new Set<string>();
    for (const [index, pursuit] of contract.pursuits.entries()) {
      if (seen.has(pursuit.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pursuits', index, 'id'],
          message: `duplicate pursuit id: ${pursuit.id}`,
        });
      }
      seen.add(pursuit.id);
    }
  });
export type PursuitContract = z.infer<typeof PursuitContract>;

export const PursuitGraphNode = z
  .object({
    id: PursuitId,
    goal: z.string().min(1),
    estimated_touch_set: PursuitTouchSet,
    risk: PursuitRisk,
    status: z.enum(['ready', 'blocked', 'deferred']),
    reason: z.string().min(1),
  })
  .strict();
export type PursuitGraphNode = z.infer<typeof PursuitGraphNode>;

export const PursuitGraphEdge = z
  .object({
    from: PursuitId,
    to: PursuitId,
    kind: z.enum(['hard-dependency', 'soft-dependency', 'conflict', 'composes-with']),
    reason: z.string().min(1),
  })
  .strict();
export type PursuitGraphEdge = z.infer<typeof PursuitGraphEdge>;

export const PursuitGraphGroup = z
  .object({
    id: PursuitId,
    pursuit_ids: z.array(PursuitId).min(1),
    reason: z.string().min(1),
  })
  .strict();
export type PursuitGraphGroup = z.infer<typeof PursuitGraphGroup>;

export const PursuitGraph = z
  .object({
    verdict: z.literal('accept'),
    nodes: z.array(PursuitGraphNode).min(1),
    edges: z.array(PursuitGraphEdge),
    serial_groups: z.array(PursuitGraphGroup).min(1),
    parallel_read_only_groups: z.array(PursuitGraphGroup).min(1),
    blocked: z.array(
      z
        .object({
          pursuit_id: PursuitId,
          reason: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((graph, ctx) => {
    const nodeIds = new Set<string>();
    for (const [index, node] of graph.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', index, 'id'],
          message: `duplicate node id: ${node.id}`,
        });
      }
      nodeIds.add(node.id);
    }
    for (const [index, edge] of graph.edges.entries()) {
      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index, 'from'],
          message: `edge references unknown pursuit id: ${edge.from}`,
        });
      }
      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index, 'to'],
          message: `edge references unknown pursuit id: ${edge.to}`,
        });
      }
    }
    for (const [groupIndex, group] of [
      ...graph.serial_groups,
      ...graph.parallel_read_only_groups,
    ].entries()) {
      for (const [index, id] of group.pursuit_ids.entries()) {
        if (!nodeIds.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['groups', groupIndex, 'pursuit_ids', index],
            message: `group references unknown pursuit id: ${id}`,
          });
        }
      }
    }
    for (const [index, item] of graph.blocked.entries()) {
      if (!nodeIds.has(item.pursuit_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['blocked', index, 'pursuit_id'],
          message: `blocked item references unknown pursuit id: ${item.pursuit_id}`,
        });
      }
    }
  });
export type PursuitGraph = z.infer<typeof PursuitGraph>;

export const PursuitWave = z
  .object({
    id: PursuitId,
    kind: z.enum(['read-only', 'code-change']),
    pursuit_ids: z.array(PursuitId).min(1),
    execution: z.enum(['parallel', 'serial']),
    reason: z.string().min(1),
    re_ground_after: z.boolean(),
  })
  .strict();
export type PursuitWave = z.infer<typeof PursuitWave>;

export const PursuitWavePlan = z
  .object({
    verdict: z.literal('accept'),
    waves: z.array(PursuitWave).min(1),
    no_parallel_writes_reason: z.string().min(1),
  })
  .strict()
  .superRefine((plan, ctx) => {
    for (const [index, wave] of plan.waves.entries()) {
      if (wave.kind === 'code-change' && wave.execution !== 'serial') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['waves', index, 'execution'],
          message: 'code-change waves must execute serially in Pursuits V1',
        });
      }
    }
  });
export type PursuitWavePlan = z.infer<typeof PursuitWavePlan>;

export const PursuitBatchItem = z
  .object({
    pursuit_id: PursuitId,
    status: z.enum(['completed', 'skipped', 'blocked', 'failed']),
    summary: z.string().min(1),
    evidence: z.array(z.string().min(1)),
  })
  .strict();
export type PursuitBatchItem = z.infer<typeof PursuitBatchItem>;

export const PursuitBatch = z
  .object({
    verdict: z.enum(['accept', 'partial', 'blocked']),
    summary: z.string().min(1),
    serialized_execution: z.literal(true),
    completed: z.array(PursuitBatchItem),
    skipped: z.array(PursuitBatchItem),
    blocked: z.array(PursuitBatchItem),
    failed: z.array(PursuitBatchItem),
    actual_touch_set: PursuitTouchSet,
    proof_evidence: NonEmptyStringArray,
  })
  .strict()
  .superRefine((batch, ctx) => {
    for (const [field, expectedStatus] of [
      ['completed', 'completed'],
      ['skipped', 'skipped'],
      ['blocked', 'blocked'],
      ['failed', 'failed'],
    ] as const) {
      for (const [index, item] of batch[field].entries()) {
        if (item.status !== expectedStatus) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field, index, 'status'],
            message: `status must be '${expectedStatus}' for ${field} items`,
          });
        }
      }
    }
    if (batch.verdict === 'accept' && (batch.blocked.length > 0 || batch.failed.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: "verdict must not be 'accept' when blocked or failed items exist",
      });
    }
    if (batch.verdict === 'accept' && batch.skipped.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: "verdict must not be 'accept' when skipped items exist",
      });
    }
    if (batch.verdict === 'blocked' && batch.blocked.length === 0 && batch.failed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: "verdict must be backed by blocked or failed items when it is 'blocked'",
      });
    }
    const seen = new Set<string>();
    for (const [field, items] of [
      ['completed', batch.completed],
      ['skipped', batch.skipped],
      ['blocked', batch.blocked],
      ['failed', batch.failed],
    ] as const) {
      for (const [index, item] of items.entries()) {
        if (seen.has(item.pursuit_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field, index, 'pursuit_id'],
            message: `duplicate pursuit id in batch: ${item.pursuit_id}`,
          });
        }
        seen.add(item.pursuit_id);
      }
    }
  });
export type PursuitBatch = z.infer<typeof PursuitBatch>;

const PolicyRef = Ref.refine((ref) => ref.kind === 'policy', {
  message: 'policy refs must use kind policy',
});

const ReportOrWorkContractRef = Ref.refine(
  (ref) => ref.kind === 'report' || ref.kind === 'work_contract',
  {
    message: 'estimated touch set refs must use report or work_contract refs',
  },
);

const ReportRef = Ref.refine((ref) => ref.kind === 'report', {
  message: 'branch plan refs must use kind report',
});

const TraceRef = Ref.refine((ref) => ref.kind === 'trace', {
  message: 'guidance and recovery refs must use kind trace',
});

const ChangePacketRef = Ref.refine((ref) => ref.kind === 'change_packet', {
  message: 'change packet refs must use kind change_packet',
});

const SafeApplyRef = Ref.refine((ref) => ref.kind === 'safe_apply', {
  message: 'safe apply refs must use kind safe_apply',
});

const ProofAssessmentRef = Ref.refine((ref) => ref.kind === 'evidence' || ref.kind === 'report', {
  message: 'proof assessment refs must use evidence or report refs',
});

const FinalVerificationRef = Ref.refine((ref) => ref.kind === 'command', {
  message: 'final verification refs must use command refs',
});

const RuntimeTouchedFilesRef = Ref.refine((ref) => ref.kind === 'diff', {
  message: 'runtime touched files must use diff refs',
});

const GeneratedSurfaceRef = Ref.refine((ref) => ref.kind === 'generated_surface', {
  message: 'generated surface refs must use kind generated_surface',
});

const DriftCheckRef = Ref.refine((ref) => ref.kind === 'command', {
  message: 'drift check refs must use command refs',
});

export const PursuitSafeApplyBranchStatus = z.enum([
  'candidate',
  'serial_fallback',
  'blocked',
  'checkpoint_required',
]);
export type PursuitSafeApplyBranchStatus = z.infer<typeof PursuitSafeApplyBranchStatus>;

const ChildExecution = z
  .object({
    kind: z.enum(['relay', 'child_flow']),
    role: z.string().min(1).optional(),
    flow_id: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((execution, ctx) => {
    if (execution.kind === 'relay' && execution.role === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'relay branch execution requires role',
      });
    }
    if (execution.kind === 'child_flow' && execution.flow_id === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['flow_id'],
        message: 'child_flow branch execution requires flow_id',
      });
    }
    if (execution.kind === 'relay' && execution.flow_id !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['flow_id'],
        message: 'relay branch execution must not include flow_id',
      });
    }
    if (execution.kind === 'child_flow' && execution.role !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'child_flow branch execution must not include role',
      });
    }
  });

const PursuitSafeApplyBranch = z
  .object({
    pursuit_id: PursuitId,
    branch_id: z.string().min(1),
    status: PursuitSafeApplyBranchStatus,
    source_pursuit_contract_ref: ReportOrWorkContractRef,
    estimated_touch_set: PursuitTouchSet,
    expected_generated_outputs: z.array(z.string().min(1)),
    risk: PursuitRisk,
    required_claims: NonEmptyStringArray,
    required_verification_commands: z.array(VerificationCommand).min(1),
    allowed_recovery_route_kinds: z.array(RecoveryRouteKind).min(1),
    child_execution: ChildExecution,
    work_root_kind: WorkRootKind,
    proof_policy_ref: PolicyRef,
    expected_change_packet_ref: ChangePacketRef.optional(),
    checkpoint_ref: TraceRef.optional(),
    reason: z.string().min(1).optional(),
  })
  .strict();
export type PursuitSafeApplyBranch = z.infer<typeof PursuitSafeApplyBranch>;

export const PursuitSafeApplyBranchPlan = z
  .object({
    schema_version: z.literal(1),
    mode: z.literal('parallel-isolated-safe-apply'),
    runtime_status: z.literal('planning-only'),
    source_contract_ref: ReportOrWorkContractRef,
    graph_ref: ReportRef,
    wave_plan_ref: ReportRef,
    policy_ref: PolicyRef,
    max_parallel_branches: z.number().int().positive(),
    branches: z.array(PursuitSafeApplyBranch).min(1),
    counts: z
      .object({
        candidate: z.number().int().nonnegative(),
        serial_fallback: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
        checkpoint_required: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const counts = {
      candidate: 0,
      serial_fallback: 0,
      blocked: 0,
      checkpoint_required: 0,
    };
    const branchIds = new Set<string>();
    const pursuitIds = new Set<string>();

    for (const [index, branch] of plan.branches.entries()) {
      counts[branch.status] += 1;
      if (branchIds.has(branch.branch_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branches', index, 'branch_id'],
          message: `duplicate branch id: ${branch.branch_id}`,
        });
      }
      branchIds.add(branch.branch_id);
      if (pursuitIds.has(branch.pursuit_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branches', index, 'pursuit_id'],
          message: `duplicate pursuit id: ${branch.pursuit_id}`,
        });
      }
      pursuitIds.add(branch.pursuit_id);

      if (branch.status === 'candidate') {
        if (branch.work_root_kind !== 'isolated_worktree') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branches', index, 'work_root_kind'],
            message: 'candidate parallel Pursue branches require isolated_worktree',
          });
        }
        if (branch.expected_change_packet_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branches', index, 'expected_change_packet_ref'],
            message: 'candidate branches require expected_change_packet_ref',
          });
        }
        if (!branch.allowed_recovery_route_kinds.includes('safe_apply_reject')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branches', index, 'allowed_recovery_route_kinds'],
            message: 'candidate branches require safe_apply_reject recovery',
          });
        }
      } else {
        if (branch.expected_change_packet_ref !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branches', index, 'expected_change_packet_ref'],
            message: `${branch.status} branches must not reserve ChangePacket refs`,
          });
        }
        if (branch.reason === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branches', index, 'reason'],
            message: `${branch.status} branches require reason`,
          });
        }
      }

      if (branch.status === 'checkpoint_required' && branch.checkpoint_ref === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branches', index, 'checkpoint_ref'],
          message: 'checkpoint_required branches require checkpoint_ref',
        });
      }

      if (branch.expected_generated_outputs.length > 0 && branch.risk === 'low') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branches', index, 'risk'],
          message: 'generated-output branches must be medium or high risk',
        });
      }
      const estimatedGeneratedOutputs = [...branch.estimated_touch_set.generated_outputs].sort();
      const expectedGeneratedOutputs = [...branch.expected_generated_outputs].sort();
      if (
        estimatedGeneratedOutputs.length !== expectedGeneratedOutputs.length ||
        estimatedGeneratedOutputs.some(
          (path, pathIndex) => path !== expectedGeneratedOutputs[pathIndex],
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branches', index, 'expected_generated_outputs'],
          message: 'expected generated outputs must match the estimated generated touch set',
        });
      }
    }

    for (const [status, count] of Object.entries(plan.counts) as Array<
      [keyof typeof counts, number]
    >) {
      if (count !== counts[status]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['counts', status],
          message: `${status} count must match branches`,
        });
      }
    }

    if (counts.candidate > plan.max_parallel_branches) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['max_parallel_branches'],
        message: 'candidate branches must not exceed max_parallel_branches',
      });
    }
  });
export type PursuitSafeApplyBranchPlan = z.infer<typeof PursuitSafeApplyBranchPlan>;

const PursuitSafeApplyReasonCode = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const PursuitSafeApplyPacketStatus = z.enum([
  'applied',
  'rejected',
  'blocked',
  'failed_before_packet',
  'serial_fallback',
]);
export type PursuitSafeApplyPacketStatus = z.infer<typeof PursuitSafeApplyPacketStatus>;

const PursuitSafeApplyPacket = z
  .object({
    pursuit_id: PursuitId,
    branch_id: z.string().min(1),
    change_packet_ref: ChangePacketRef.optional(),
    status: PursuitSafeApplyPacketStatus,
    safe_apply_decision_ref: TraceRef.optional(),
    safe_apply_result_ref: SafeApplyRef.optional(),
    proof_assessment_refs: z.array(ProofAssessmentRef),
    final_verification_ref: FinalVerificationRef.optional(),
    recovery_route_ref: TraceRef.optional(),
    reason_codes: z.array(PursuitSafeApplyReasonCode).min(1),
  })
  .strict();
export type PursuitSafeApplyPacket = z.infer<typeof PursuitSafeApplyPacket>;

export const PursuitSafeApplyReport = z
  .object({
    schema_version: z.literal(1),
    mode: z.literal('parallel-isolated-safe-apply'),
    base: z
      .object({
        ref: z.string().min(1),
        tree_hash: Sha256,
        dirty_parent_state: DirtyParentState,
        policy_ref: PolicyRef,
      })
      .strict(),
    branch_plan_ref: ReportRef,
    proof_policy_decision_ref: TraceRef,
    packets: z.array(PursuitSafeApplyPacket).min(1),
    applied_order: z.array(z.string().min(1)),
    counts: z
      .object({
        applied: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
        failed_before_packet: z.number().int().nonnegative(),
        serial_fallback: z.number().int().nonnegative(),
      })
      .strict(),
    touch_set_reconciliation: z
      .array(
        z
          .object({
            pursuit_id: PursuitId,
            estimated_touch_set_ref: ReportOrWorkContractRef,
            runtime_touched_files_ref: RuntimeTouchedFilesRef.optional(),
            generated_surface_status: GeneratedSurfaceStatus,
            scope_status: z.enum(['inside_estimate', 'expanded', 'unknown']),
          })
          .strict(),
      )
      .min(1),
    generated_surfaces: z
      .object({
        status: GeneratedSurfaceStatus,
        source_refs: z.array(GeneratedSurfaceRef),
        output_refs: z.array(GeneratedSurfaceRef),
        drift_check_ref: DriftCheckRef.optional(),
      })
      .strict(),
    final_verification: z
      .object({
        status: z.enum(['passed', 'failed', 'skipped']),
        ref: FinalVerificationRef.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((report, ctx) => {
    const counts = {
      applied: 0,
      rejected: 0,
      blocked: 0,
      failed_before_packet: 0,
      serial_fallback: 0,
    };
    const branchIds = new Set<string>();
    const pursuitIds = new Set<string>();
    const appliedBranchIds = new Set<string>();

    for (const [index, packet] of report.packets.entries()) {
      counts[packet.status] += 1;
      if (branchIds.has(packet.branch_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['packets', index, 'branch_id'],
          message: `duplicate branch id: ${packet.branch_id}`,
        });
      }
      branchIds.add(packet.branch_id);
      if (pursuitIds.has(packet.pursuit_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['packets', index, 'pursuit_id'],
          message: `duplicate pursuit id: ${packet.pursuit_id}`,
        });
      }
      pursuitIds.add(packet.pursuit_id);
      if (packet.status === 'applied') appliedBranchIds.add(packet.branch_id);

      if (packet.status === 'applied') {
        if (packet.change_packet_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'change_packet_ref'],
            message: 'applied packets require change_packet_ref',
          });
        }
        if (packet.safe_apply_decision_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'safe_apply_decision_ref'],
            message: 'applied packets require safe_apply_decision_ref',
          });
        }
        if (packet.safe_apply_result_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'safe_apply_result_ref'],
            message: 'applied packets require safe_apply_result_ref',
          });
        }
        if (packet.proof_assessment_refs.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'proof_assessment_refs'],
            message: 'applied packets require proof assessment refs',
          });
        }
        if (packet.final_verification_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'final_verification_ref'],
            message: 'applied packets require final verification refs',
          });
        }
      }

      if (packet.status === 'rejected') {
        if (packet.change_packet_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'change_packet_ref'],
            message: 'rejected packets require change_packet_ref',
          });
        }
        if (packet.safe_apply_decision_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'safe_apply_decision_ref'],
            message: 'rejected packets require safe_apply_decision_ref',
          });
        }
        if (packet.safe_apply_result_ref === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['packets', index, 'safe_apply_result_ref'],
            message: 'rejected packets require safe_apply_result_ref',
          });
        }
      }

      if (
        (packet.status === 'rejected' ||
          packet.status === 'blocked' ||
          packet.status === 'failed_before_packet' ||
          packet.status === 'serial_fallback') &&
        packet.recovery_route_ref === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['packets', index, 'recovery_route_ref'],
          message: `${packet.status} packets require recovery_route_ref`,
        });
      }

      if (
        (packet.status === 'blocked' ||
          packet.status === 'failed_before_packet' ||
          packet.status === 'serial_fallback') &&
        (packet.change_packet_ref !== undefined ||
          packet.safe_apply_decision_ref !== undefined ||
          packet.safe_apply_result_ref !== undefined)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['packets', index],
          message: `${packet.status} packets must not carry SafeApply refs`,
        });
      }
    }

    for (const [status, count] of Object.entries(report.counts) as Array<
      [keyof typeof counts, number]
    >) {
      if (count !== counts[status]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['counts', status],
          message: `${status} count must match packets`,
        });
      }
    }

    if (report.applied_order.length !== appliedBranchIds.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['applied_order'],
        message: 'applied_order must list every applied branch exactly once',
      });
    }
    const seenAppliedOrder = new Set<string>();
    for (const [index, branchId] of report.applied_order.entries()) {
      if (!appliedBranchIds.has(branchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applied_order', index],
          message: `applied_order references non-applied branch id: ${branchId}`,
        });
      }
      if (seenAppliedOrder.has(branchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applied_order', index],
          message: `duplicate applied_order branch id: ${branchId}`,
        });
      }
      seenAppliedOrder.add(branchId);
    }

    const reconciliationIds = new Set<string>();
    for (const [index, item] of report.touch_set_reconciliation.entries()) {
      if (reconciliationIds.has(item.pursuit_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['touch_set_reconciliation', index, 'pursuit_id'],
          message: `duplicate touch-set reconciliation for pursuit id: ${item.pursuit_id}`,
        });
      }
      reconciliationIds.add(item.pursuit_id);
      if (!pursuitIds.has(item.pursuit_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['touch_set_reconciliation', index, 'pursuit_id'],
          message: `touch-set reconciliation references unknown pursuit id: ${item.pursuit_id}`,
        });
      }
    }
    for (const pursuitId of pursuitIds) {
      if (!reconciliationIds.has(pursuitId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['touch_set_reconciliation'],
          message: `missing touch-set reconciliation for pursuit id: ${pursuitId}`,
        });
      }
    }

    const appliedPursuitIds = new Set(
      report.packets
        .filter((packet) => packet.status === 'applied')
        .map((packet) => packet.pursuit_id),
    );
    for (const [index, item] of report.touch_set_reconciliation.entries()) {
      if (!appliedPursuitIds.has(item.pursuit_id)) continue;
      if (item.runtime_touched_files_ref === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['touch_set_reconciliation', index, 'runtime_touched_files_ref'],
          message: 'applied pursuits require runtime_touched_files_ref',
        });
      }
      if (
        item.generated_surface_status === 'unknown' ||
        item.generated_surface_status === 'drift_detected'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['touch_set_reconciliation', index, 'generated_surface_status'],
          message: 'applied pursuits cannot have unknown or drifted generated surfaces',
        });
      }
    }

    const reconciliationGeneratedStatuses = new Set(
      report.touch_set_reconciliation.map((item) => item.generated_surface_status),
    );
    const expectedGeneratedStatus = reconciliationGeneratedStatuses.has('drift_detected')
      ? 'drift_detected'
      : reconciliationGeneratedStatuses.has('unknown')
        ? 'unknown'
        : reconciliationGeneratedStatuses.has('synced')
          ? 'synced'
          : 'not_touched';
    if (report.generated_surfaces.status !== expectedGeneratedStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['generated_surfaces', 'status'],
        message: `generated surface status must summarize touch-set reconciliation as ${expectedGeneratedStatus}`,
      });
    }
    if (report.generated_surfaces.status === 'not_touched') {
      if (
        report.generated_surfaces.source_refs.length > 0 ||
        report.generated_surfaces.output_refs.length > 0 ||
        report.generated_surfaces.drift_check_ref !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces'],
          message: 'not_touched generated surfaces must not carry generated-surface refs',
        });
      }
    }

    if (
      report.final_verification.status === 'passed' &&
      report.final_verification.ref === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['final_verification', 'ref'],
        message: 'passed final verification requires ref',
      });
    }
    if (counts.applied > 0 && report.final_verification.status !== 'passed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['final_verification', 'status'],
        message: 'applied packets require passed final verification',
      });
    }
    const unresolvedPacketCount =
      counts.rejected + counts.blocked + counts.failed_before_packet + counts.serial_fallback;
    if (
      report.final_verification.status === 'passed' &&
      unresolvedPacketCount === 0 &&
      (report.generated_surfaces.status === 'unknown' ||
        report.generated_surfaces.status === 'drift_detected')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['generated_surfaces', 'status'],
        message: 'passed final verification cannot close unknown or drifted generated surfaces',
      });
    }
    if (report.generated_surfaces.status === 'synced') {
      if (report.generated_surfaces.source_refs.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces', 'source_refs'],
          message: 'synced generated surfaces require source refs',
        });
      }
      if (report.generated_surfaces.output_refs.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces', 'output_refs'],
          message: 'synced generated surfaces require output refs',
        });
      }
      if (report.generated_surfaces.drift_check_ref === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces', 'drift_check_ref'],
          message: 'synced generated surfaces require drift check ref',
        });
      }
    }
  });
export type PursuitSafeApplyReport = z.infer<typeof PursuitSafeApplyReport>;

export const PursuitVerification = VerificationResult;
export type PursuitVerification = z.infer<typeof PursuitVerification>;

export const PursuitReviewFinding = z
  .object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type PursuitReviewFinding = z.infer<typeof PursuitReviewFinding>;

export const PursuitReviewVerdict = z.enum(['clean', 'needs-followup', 'blocked']);
export type PursuitReviewVerdict = z.infer<typeof PursuitReviewVerdict>;

export const PursuitReview = z
  .object({
    verdict: PursuitReviewVerdict,
    summary: z.string().min(1),
    findings: z.array(PursuitReviewFinding),
  })
  .strict()
  .superRefine((review, ctx) => {
    const mediumOrHigher = review.findings.filter((finding) =>
      ['critical', 'high', 'medium'].includes(finding.severity),
    );
    if (review.verdict === 'clean' && review.findings.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['findings'],
        message: "findings must be empty when verdict is 'clean'",
      });
    }
    if (review.verdict !== 'clean' && review.findings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['findings'],
        message: `findings must be non-empty when verdict is '${review.verdict}'`,
      });
    }
    if (review.verdict === 'needs-followup' && mediumOrHigher.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message:
          "verdict must be 'blocked' when review findings include medium, high, or critical severity",
      });
    }
  });
export type PursuitReview = z.infer<typeof PursuitReview>;

export const PursuitResultReportId = z.enum([
  'pursuit.contract',
  'pursuit.graph',
  'pursuit.wave-plan',
  'pursuit.batch',
  'pursuit.verification',
  'pursuit.review',
]);
export type PursuitResultReportId = z.infer<typeof PursuitResultReportId>;

export const PursuitResultReportPointer = z
  .object({
    report_id: PursuitResultReportId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = PURSUIT_RESULT_SCHEMA_BY_REPORT_ID[pointer.report_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`,
      });
    }
    const expectedPath = PURSUIT_RESULT_PATH_BY_REPORT_ID[pointer.report_id];
    if (pointer.path !== expectedPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['path'],
        message: `path must be '${expectedPath}' for report_id '${pointer.report_id}'`,
      });
    }
  });
export type PursuitResultReportPointer = z.infer<typeof PursuitResultReportPointer>;

export const PursuitResult = z
  .object({
    summary: z.string().min(1),
    outcome: z.enum(['complete', 'needs_attention', 'blocked', 'failed']),
    verification_status: z.enum(['passed', 'failed']),
    review_verdict: PursuitReviewVerdict,
    total_pursuits: z.number().int().positive(),
    completed_count: z.number().int().nonnegative(),
    skipped_count: z.number().int().nonnegative(),
    blocked_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    serial_code_writes: z.literal(true),
    evidence_links: z.array(PursuitResultReportPointer).length(6),
  })
  .strict()
  .superRefine((result, ctx) => {
    const accounted =
      result.completed_count + result.skipped_count + result.blocked_count + result.failed_count;
    if (accounted !== result.total_pursuits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['total_pursuits'],
        message: 'total_pursuits must equal completed + skipped + blocked + failed counts',
      });
    }
    if (result.outcome === 'complete') {
      if (result.verification_status !== 'passed') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verification_status'],
          message: "verification_status must be 'passed' when outcome is 'complete'",
        });
      }
      if (result.review_verdict !== 'clean') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review_verdict'],
          message: "review_verdict must be 'clean' when outcome is 'complete'",
        });
      }
      if (result.blocked_count > 0 || result.failed_count > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['outcome'],
          message: "outcome must not be 'complete' when pursuits are blocked or failed",
        });
      }
      if (result.skipped_count > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['outcome'],
          message: "outcome must not be 'complete' when pursuits are skipped",
        });
      }
    }
  });
export type PursuitResult = z.infer<typeof PursuitResult>;
