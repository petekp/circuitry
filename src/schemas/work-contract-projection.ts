import { z } from 'zod';
import { FlowAxes } from './axes.js';
import { CompiledFlowId, ProtocolId, SkillSlotId, StageId, StepId } from './ids.js';
import { JsonObject } from './json.js';
import { Ref } from './ref.js';
import { RouteMap } from './step.js';

export const RecoveryRouteKind = z.enum([
  'retry_same_step_with_feedback',
  'narrow_scope',
  'run_verification',
  'run_independent_review',
  'checkpoint_authority',
  'safe_apply_reject',
  'stop_unsafe',
  'escalate',
  'handoff',
]);
export type RecoveryRouteKind = z.infer<typeof RecoveryRouteKind>;

export const RecoveryFailureCause = z.enum([
  'failed_check',
  'failed_acceptance_criteria',
  'weak_proof',
  'unproved_claim',
  'contradicted_evidence',
  'scope_drift',
  'checkpoint_boundary',
  'relay_connector_failed',
  'relay_result_invalid',
  'apply_conflict',
  'budget_exceeded',
  'protected_file_touched',
  'generated_surface_drift',
  'unknown_failure',
]);
export type RecoveryFailureCause = z.infer<typeof RecoveryFailureCause>;

const ReportSlot = z
  .object({
    step_id: StepId,
    slot: z.string().min(1),
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict();

const ContractRoute = z
  .object({
    step_id: StepId,
    route_id: z.string().min(1),
    target: z.string().min(1),
  })
  .strict();

const ContractBlock = z
  .object({
    step_id: StepId,
    title: z.string().min(1),
    kind: z.enum(['compose', 'verification', 'checkpoint', 'relay', 'sub-run', 'fanout']),
    executor: z.enum(['orchestrator', 'worker']),
    protocol: ProtocolId,
    reads: z.array(z.string()),
    writes: JsonObject,
    check: JsonObject,
    routes: RouteMap,
    route_from_report: JsonObject.optional(),
  })
  .strict();

const ContractSkillSlot = z
  .object({
    step_id: StepId,
    slot_id: SkillSlotId,
    description: z.string().min(1),
  })
  .strict();

const ContractRelay = z
  .object({
    step_id: StepId,
    role: z.enum(['researcher', 'implementer', 'reviewer']),
    writes: JsonObject,
    report: ReportSlot.optional(),
  })
  .strict();

const ContractCheckpointChoices = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('static'),
      ids: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('dynamic'),
      source_ref: JsonObject,
    })
    .strict(),
]);

const ContractCheckpoint = z
  .object({
    step_id: StepId,
    choices: ContractCheckpointChoices,
    writes: JsonObject,
  })
  .strict();

const ContractSubRun = z
  .object({
    step_id: StepId,
    flow_ref: JsonObject,
    goal: z.string().min(1),
    depth: z.string().min(1),
    writes: JsonObject,
  })
  .strict();

const ContractFanout = z
  .object({
    step_id: StepId,
    branches: JsonObject,
    writes: JsonObject,
  })
  .strict();

const AcceptanceCriteriaInput = z
  .object({
    kind: z.literal('acceptance_criteria_input'),
    step_id: StepId,
    criteria: JsonObject,
  })
  .strict();

const CheckInput = z
  .object({
    step_id: StepId,
    check_kind: z.string().min(1),
    source: JsonObject,
  })
  .strict();

const RecoveryRouteBinding = z
  .object({
    step_id: StepId,
    route_id: z.string().min(1),
    route_target: z.string().min(1),
    kind: RecoveryRouteKind,
    allowed_failure_causes: z.array(RecoveryFailureCause).min(1),
    source_ref: Ref,
  })
  .strict();

const BudgetLimit = z
  .object({
    step_id: StepId,
    max_attempts: z.number().int().positive().optional(),
    wall_clock_ms: z.number().int().positive().optional(),
  })
  .strict();

export const ProjectionViolation = z
  .object({
    path: z.string().min(1),
    field: z.string().min(1),
    reason: z.string().min(1),
    source_ref: Ref,
  })
  .strict();
export type ProjectionViolation = z.infer<typeof ProjectionViolation>;

export const WorkContractProjectionV0 = z
  .object({
    schema_version: z.literal(0),
    contract_ref: Ref,
    work_contract: z
      .object({
        flow: z
          .object({
            id: CompiledFlowId,
            version: z.string().min(1),
            purpose: z.string().min(1),
            entry: JsonObject,
            axes: FlowAxes,
            starts_at: StepId,
          })
          .strict(),
        topology: z
          .object({
            stages: z.array(
              z
                .object({
                  id: StageId,
                  title: z.string().min(1),
                  canonical: z.string().min(1).optional(),
                  steps: z.array(StepId).min(1),
                })
                .strict(),
            ),
            stage_path_policy: JsonObject,
            routes: z.array(ContractRoute),
          })
          .strict(),
        blocks: z.array(ContractBlock).min(1),
        authority: z
          .object({
            relays: z.array(ContractRelay),
            checkpoints: z.array(ContractCheckpoint),
            sub_runs: z.array(ContractSubRun),
            fanouts: z.array(ContractFanout),
            skill_slots: z.array(ContractSkillSlot),
          })
          .strict(),
        proof: z
          .object({
            reports: z.array(ReportSlot),
            checks: z.array(CheckInput),
            acceptance_criteria: z.array(AcceptanceCriteriaInput),
          })
          .strict(),
        recovery: z.array(RecoveryRouteBinding),
        limits: z
          .object({
            budgets: z.array(BudgetLimit),
          })
          .strict(),
      })
      .strict(),
    guidance_seed: z
      .object({
        selection_hints: z.array(Ref),
        connector_hints: z.array(Ref),
        skill_hints: z.array(Ref),
        checkpoint_default_hints: z.array(Ref),
        host_recommendations: z.array(Ref).default([]),
      })
      .strict(),
    rejected_authority: z.array(ProjectionViolation),
  })
  .strict();
export type WorkContractProjectionV0 = z.infer<typeof WorkContractProjectionV0>;
