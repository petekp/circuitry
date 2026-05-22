import { z } from 'zod';
import { ResolvedConnector } from './connector.js';
import { CompiledFlowId, RunId, SkillId, SkillSlotId, StepId } from './ids.js';
import { JsonObject } from './json.js';
import { Ref, Sha256 } from './ref.js';
import { Effort, ProviderScopedModel } from './selection-policy.js';
import { RelayRole } from './step.js';

const GuidanceDecisionId = z.string().regex(/^gd-[a-z0-9][a-z0-9._-]*$/);
export type GuidanceDecisionId = z.infer<typeof GuidanceDecisionId>;

export const GuidanceDecisionSubject = z.enum([
  'flow_selection',
  'relay_execution',
  'checkpoint_resolution',
  'proof_policy',
  'recovery_route',
  'safe_apply',
]);
export type GuidanceDecisionSubject = z.infer<typeof GuidanceDecisionSubject>;

export const GuidanceDecisionSource = z.enum([
  'deterministic',
  'heuristic',
  'model_recommended',
  'host_recommended',
  'operator_override',
]);
export type GuidanceDecisionSource = z.infer<typeof GuidanceDecisionSource>;

const ReasonCode = z.string().regex(/^[a-z][a-z0-9_]*$/);
export type ReasonCode = z.infer<typeof ReasonCode>;

export const GuidanceScope = z
  .object({
    run_id: RunId,
    flow_id: CompiledFlowId.optional(),
    step_id: StepId.optional(),
    attempt: z.number().int().positive().optional(),
    branch_id: z.string().min(1).optional(),
  })
  .strict();
export type GuidanceScope = z.infer<typeof GuidanceScope>;

const GuidanceSkillSelection = z
  .object({
    id: SkillId,
    slot: SkillSlotId.optional(),
  })
  .strict();

const RelayExecutionSelected = z
  .object({
    role: RelayRole,
    connector: ResolvedConnector,
    model: ProviderScopedModel.optional(),
    effort: Effort.optional(),
    skills: z.array(GuidanceSkillSelection),
    context_packet_ref: Ref,
    request_payload_hash: Sha256,
  })
  .strict();

const WorkContractRef = Ref.refine((ref) => ref.kind === 'work_contract', {
  message: 'must be a work_contract ref',
});

const FlowSelectionSelected = z
  .object({
    flow_id: CompiledFlowId,
    work_contract_ref: WorkContractRef,
    host_recommendation: z
      .object({
        flow_id: CompiledFlowId,
        accepted: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();

const RejectedGuidanceOption = z
  .object({
    option: JsonObject,
    reason_code: ReasonCode,
    blocked_by: Ref.optional(),
  })
  .strict();

const NonEmptyRefs = z.array(Ref).min(1);

export const GuidanceDecisionTraceEntryBody = z
  .object({
    schema_version: z.literal(1),
    sequence: z.number().int().nonnegative(),
    recorded_at: z.string().datetime(),
    run_id: RunId,
    kind: z.literal('guidance.decision'),
    decision_id: GuidanceDecisionId,
    subject: GuidanceDecisionSubject,
    scope: GuidanceScope,
    source: GuidanceDecisionSource,
    selected: z.union([FlowSelectionSelected, RelayExecutionSelected, JsonObject]),
    input_refs: NonEmptyRefs,
    constraint_refs: NonEmptyRefs,
    contract_refs: NonEmptyRefs,
    policy_refs: NonEmptyRefs,
    evidence_refs: NonEmptyRefs.optional(),
    memory_refs: NonEmptyRefs.optional(),
    reason_codes: z.array(ReasonCode).min(1),
    rejected_options: z.array(RejectedGuidanceOption).max(3).optional(),
  })
  .strict();
export type GuidanceDecisionTraceEntryBody = z.infer<typeof GuidanceDecisionTraceEntryBody>;

export function refineGuidanceDecisionTraceEntry(
  entry: GuidanceDecisionTraceEntryBody,
  ctx: z.RefinementCtx,
): void {
  if (entry.scope.run_id !== entry.run_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope', 'run_id'],
      message: 'scope.run_id must match run_id',
    });
  }

  for (const [index, ref] of entry.constraint_refs.entries()) {
    if (ref.kind !== 'work_contract' && ref.kind !== 'policy') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['constraint_refs', index, 'kind'],
        message: 'constraint_refs must use work_contract or policy refs in V0',
      });
    }
  }
  for (const [index, ref] of entry.contract_refs.entries()) {
    if (ref.kind !== 'work_contract') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contract_refs', index, 'kind'],
        message: 'contract_refs must use work_contract refs',
      });
    }
  }
  for (const [index, ref] of entry.policy_refs.entries()) {
    if (ref.kind !== 'policy') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policy_refs', index, 'kind'],
        message: 'policy_refs must use policy refs',
      });
    }
  }

  if (entry.subject === 'flow_selection') {
    if (!FlowSelectionSelected.safeParse(entry.selected).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selected'],
        message: 'flow_selection selected payload must name flow_id and work_contract_ref',
      });
    }
    return;
  }

  if (entry.scope.flow_id === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope', 'flow_id'],
      message: `${entry.subject} decisions require scope.flow_id`,
    });
  }
  if (entry.scope.step_id === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope', 'step_id'],
      message: `${entry.subject} decisions require scope.step_id`,
    });
  }
  if (entry.scope.attempt === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope', 'attempt'],
      message: `${entry.subject} decisions require scope.attempt`,
    });
  }

  if (
    entry.subject === 'relay_execution' &&
    !RelayExecutionSelected.safeParse(entry.selected).success
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selected'],
      message:
        'relay_execution selected payload must name role, connector, skills, context ref, and request hash',
    });
  }
}

export const GuidanceDecisionTraceEntry = GuidanceDecisionTraceEntryBody.superRefine(
  refineGuidanceDecisionTraceEntry,
);
export type GuidanceDecisionTraceEntry = z.infer<typeof GuidanceDecisionTraceEntry>;
