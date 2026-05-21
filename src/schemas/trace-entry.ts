import { z } from 'zod';
import { ChangeKindDeclaration } from './change-kind.js';
import { RelayResolutionSource, ResolvedConnector } from './connector.js';
import { Depth } from './depth.js';
import { CompiledFlowId, InvocationId, RunId, SkillId, SkillSlotId, StepId } from './ids.js';
import { ResolvedSelection } from './selection-policy.js';
import { FanoutFailurePolicy, RelayRole } from './step.js';

const TraceEntryBase = z.object({
  schema_version: z.literal(1),
  sequence: z.number().int().nonnegative(),
  recorded_at: z.string().datetime(),
  run_id: RunId,
});

// SHA-256 over raw bytes, 64-char lowercase hex. Mirrors the convention
// used by `ManifestHash` in src/schemas/manifest.ts so durable transcript
// hashes are shape-compatible with manifest hashes at audit time.
const HEX64 = /^[0-9a-f]{64}$/;
const ContentHash = z.string().regex(HEX64, {
  message: 'must be a 64-character lowercase hex SHA-256 digest',
});

export const RunBootstrappedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('run.bootstrapped'),
  flow_id: CompiledFlowId,
  invocation_id: InvocationId.optional(),
  depth: Depth,
  goal: z.string().min(1),
  change_kind: ChangeKindDeclaration,
  manifest_hash: z.string().min(1),
}).strict();
export type RunBootstrappedTraceEntry = z.infer<typeof RunBootstrappedTraceEntry>;

export const StepEnteredTraceEntry = TraceEntryBase.extend({
  kind: z.literal('step.entered'),
  step_id: StepId,
  attempt: z.number().int().positive(),
}).strict();
export type StepEnteredTraceEntry = z.infer<typeof StepEnteredTraceEntry>;

export const StepReportWrittenTraceEntry = TraceEntryBase.extend({
  kind: z.literal('step.report_written'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  report_path: z.string().min(1),
  report_schema: z.string().min(1),
}).strict();
export type StepReportWrittenTraceEntry = z.infer<typeof StepReportWrittenTraceEntry>;

export const CheckEvaluatedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('check.evaluated'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  check_kind: z.enum([
    'schema_sections',
    'checkpoint_selection',
    'result_verdict',
    'fanout_aggregate',
    'acceptance_criteria',
  ]),
  outcome: z.enum(['pass', 'fail']),
  criterion_id: z.string().min(1).optional(),
  criterion_kind: z.enum(['command', 'report_field']).optional(),
  exit_code: z.number().int().nonnegative().optional(),
  status: z.enum(['passed', 'failed']).optional(),
  stdout_summary: z.string().optional(),
  stderr_summary: z.string().optional(),
  missing_sections: z.array(z.string()).optional(),
  reason: z.string().optional(),
}).strict();
export type CheckEvaluatedTraceEntry = z.infer<typeof CheckEvaluatedTraceEntry>;

export const CheckpointRequestedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('checkpoint.requested'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  options: z.array(z.string()).min(1),
  request_path: z.string().min(1),
  request_report_hash: ContentHash,
  auto_resolved: z.boolean().optional(),
}).strict();
export type CheckpointRequestedTraceEntry = z.infer<typeof CheckpointRequestedTraceEntry>;

export const CheckpointResolvedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('checkpoint.resolved'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  selection: z.string().min(1),
  auto_resolved: z.boolean(),
  resolution_source: z.enum(['safe-default', 'operator', 'safe-autonomous']),
  response_path: z.string().min(1),
}).strict();
export type CheckpointResolvedTraceEntry = z.infer<typeof CheckpointResolvedTraceEntry>;

// connector-I7: `resolved_from` is a `RelayResolutionSource` discriminated
// union that names the winning precedence category AND carries the
// disambiguator (`role` on role-match, `flow_id` on circuit-match).
// An audit reading this trace_entry can reconstruct the exact merged-config entry
// that chose the connector — closes the category-only-provenance gap that the
// flat-enum drafting left open.
//
// `connector: ResolvedConnector` (2-variant: built-in or
// custom descriptor). Named references are pre-resolution pointers and MUST
// NOT appear in the trace; the relayer dereferences them against the
// registry before emitting the trace_entry.
//
// The role ↔ resolved_from.role binding is enforced at the
// TraceEntry-union level, not here, because `z.discriminatedUnion` cannot admit
// ZodEffects variants (wrapped via superRefine). Mirrors the `Step` pattern.
export const RelayStartedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('relay.started'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  connector: ResolvedConnector,
  role: RelayRole,
  resolved_selection: ResolvedSelection,
  resolved_from: RelayResolutionSource,
}).strict();
export type RelayStartedTraceEntry = z.infer<typeof RelayStartedTraceEntry>;

export const LoadedSkillEvidence = z
  .object({
    id: SkillId,
    slot: SkillSlotId.optional(),
    path: z.string().min(1),
    sha256: ContentHash,
    bytes: z.number().int().nonnegative(),
  })
  .strict();
export type LoadedSkillEvidence = z.infer<typeof LoadedSkillEvidence>;

export const SkillsLoadedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('skills.loaded'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  skills: z.array(LoadedSkillEvidence).min(1),
}).strict();
export type SkillsLoadedTraceEntry = z.infer<typeof SkillsLoadedTraceEntry>;

export const RelayCompletedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('relay.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  verdict: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  result_path: z.string().min(1),
  receipt_path: z.string().min(1),
}).strict();
export type RelayCompletedTraceEntry = z.infer<typeof RelayCompletedTraceEntry>;

// The durable relay transcript the connector round-trip test asserts
// on is a five-trace_entry sequence on a single `(step_id, attempt)` pair:
//
//   relay.started → relay.request → relay.receipt →
//   relay.result → relay.completed
//
// `relay.request` carries the SHA-256 of the request payload bytes
// submitted to the connector, before the connector replies. A mock connector
// cannot elide this trace_entry because the hash is observable independent of
// connector output.
export const RelayRequestTraceEntry = TraceEntryBase.extend({
  kind: z.literal('relay.request'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  request_payload_hash: ContentHash,
}).strict();
export type RelayRequestTraceEntry = z.infer<typeof RelayRequestTraceEntry>;

// Connector invocation failures are infrastructure failures, not model
// verdict failures. The trace_entry is additive to the existing relay audit
// trail: `relay.started` and `relay.request` still precede it, and
// this trace_entry repeats the relay provenance plus the pre-await request
// hash so the failed attempt is tied to the exact invocation payload.
export const RelayFailedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('relay.failed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  connector: ResolvedConnector,
  role: RelayRole,
  resolved_selection: ResolvedSelection,
  resolved_from: RelayResolutionSource,
  request_payload_hash: ContentHash,
  reason: z.string().min(1),
}).strict();
export type RelayFailedTraceEntry = z.infer<typeof RelayFailedTraceEntry>;

// `relay.receipt` carries the connector-returned receipt id — an opaque
// identifier the connector assigns to the in-flight relay so audit
// tooling can reconstruct what receipt the connector handed back. Kept as
// `z.string().min(1)` (not a hash) because connectors choose their own
// receipt-id format (UUID, ULID, provider-side run id, etc.).
//
// Scoping note. The intra-log correlation between `relay.request`
// and `relay.result` is `(step_id,
// attempt, ordering)`, NOT `receipt_id`. `RelayResultTraceEntry` does not
// echo the receipt. The receipt id is identity-of-record for the
// connector-side relay (so an auditor can ask the connector "what
// happened to receipt X"), not a cryptographic binding between the
// in-log trace_entries. Hash-tightening of `receipt_id` is deferred until a
// real connector surfaces concrete receipt formats; `z.string().min(1)`
// + the whitespace-rejection test in
// `tests/contracts/relay-transcript-schema.test.ts` is the
// current boundary. A stricter format constraint authored now would
// over-specify without provider-shape evidence.
export const RelayReceiptTraceEntry = TraceEntryBase.extend({
  kind: z.literal('relay.receipt'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  cli_version: z.string().min(1),
  receipt_id: z
    .string()
    .min(1)
    .refine((s) => s.trim().length > 0, {
      message: 'receipt_id must contain at least one non-whitespace character',
    }),
}).strict();
export type RelayReceiptTraceEntry = z.infer<typeof RelayReceiptTraceEntry>;

// `relay.result` carries the SHA-256 of the result report bytes
// returned by the connector, before the reducer projects and the result-
// writer persists. Hash is required so the close-criterion test can
// assert on content — not byte-shape — of a real connector's output.
export const RelayResultTraceEntry = TraceEntryBase.extend({
  kind: z.literal('relay.result'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  result_report_hash: ContentHash,
}).strict();
export type RelayResultTraceEntry = z.infer<typeof RelayResultTraceEntry>;

export const StepCompletedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('step.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  route_taken: z.string().min(1),
}).strict();
export type StepCompletedTraceEntry = z.infer<typeof StepCompletedTraceEntry>;

export const StepAbortedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('step.aborted'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  reason: z.string().min(1),
}).strict();
export type StepAbortedTraceEntry = z.infer<typeof StepAbortedTraceEntry>;

export const RunClosedOutcome = z.enum(['complete', 'aborted', 'handoff', 'stopped', 'escalated']);
export type RunClosedOutcome = z.infer<typeof RunClosedOutcome>;

// Sub-run / fanout linkage trace entries. Every run (parent and child)
// gets its own RunId, and run_id-consistency forbids cross-run trace
// smuggling. Audit linkage therefore flows through dedicated trace
// entries at the parent step boundary — never by nesting child trace
// entries inside the parent log.
//
// `child_run_id` is the canonical handle. An auditor reading the parent
// log can locate the child's separate run directory, replay the child's
// trace.ndjson, and reconstruct the full execution graph.
export const SubRunStartedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('sub_run.started'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  child_run_id: RunId,
  child_flow_id: CompiledFlowId,
  child_entry_mode: z.string().regex(/^[a-z][a-z0-9-]*$/),
  child_depth: Depth,
}).strict();
export type SubRunStartedTraceEntry = z.infer<typeof SubRunStartedTraceEntry>;

export const SubRunCompletedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('sub_run.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  child_run_id: RunId,
  child_outcome: RunClosedOutcome,
  // Verdict admitted from the child's terminal result body. NO_VERDICT_SENTINEL
  // when the child closed without a parseable result body — mirrors the
  // existing relay.completed sentinel pattern.
  verdict: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  // Where the child's result.json was copied into the parent run-folder.
  result_path: z.string().min(1),
}).strict();
export type SubRunCompletedTraceEntry = z.infer<typeof SubRunCompletedTraceEntry>;

// Fanout has a richer trace_entry surface because the parent must record per-
// branch lifecycle. The shape mirrors sub_run.* but with a branch_id added
// so the parent log captures which branch produced each outcome.
const FanoutConcurrencyLimit = z.union([z.number().int().positive(), z.literal('unbounded')]);

const FanoutExecutionPolicy = z
  .object({
    configured_concurrency: FanoutConcurrencyLimit,
    effective_concurrency: FanoutConcurrencyLimit,
    writable_relay_branches_serialized: z.boolean(),
    reason: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.writable_relay_branches_serialized && policy.reason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'serialized writable relay fanouts require a reason',
      });
    }
  });

export const FanoutStartedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('fanout.started'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  // Resolved branch list AT EXPANSION TIME. For static branches this
  // mirrors the schematic's authored list. For dynamic branches this is the
  // result of template expansion against the source report, so an
  // auditor can see exactly which N branches were spawned without
  // reconstructing the expansion themselves.
  branch_ids: z.array(z.string().min(1)).min(1),
  on_child_failure: FanoutFailurePolicy,
  execution_policy: FanoutExecutionPolicy.optional(),
}).strict();
export type FanoutStartedTraceEntry = z.infer<typeof FanoutStartedTraceEntry>;

export const FanoutBranchStartedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('fanout.branch_started'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  branch_id: z.string().min(1),
  branch_kind: z.enum(['relay', 'sub-run']),
  child_run_id: RunId,
  // Worktree path provisioned for this branch (relative to project root).
  // Records where the per-branch isolation lived for postmortem auditing.
  worktree_path: z.string().min(1),
}).strict();
export type FanoutBranchStartedTraceEntry = z.infer<typeof FanoutBranchStartedTraceEntry>;

export const FanoutBranchCompletedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('fanout.branch_completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  branch_id: z.string().min(1),
  branch_kind: z.enum(['relay', 'sub-run']),
  child_run_id: RunId,
  child_outcome: RunClosedOutcome,
  verdict: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  result_path: z.string().min(1),
}).strict();
export type FanoutBranchCompletedTraceEntry = z.infer<typeof FanoutBranchCompletedTraceEntry>;

export const FanoutJoinedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('fanout.joined'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  // The join policy that ran; mirrors the FanoutAggregateCheck.join.policy
  // field but echoed into the trace_entry so the audit log is self-contained
  // (no need to cross-reference the schematic to interpret outcomes).
  policy: z.enum(['pick-winner', 'disjoint-merge', 'aggregate-only', 'aggregate-survivors']),
  // For pick-winner: the selected branch_id. Absent for the other policies.
  selected_branch_id: z.string().min(1).optional(),
  // Path to the runtime-built aggregate report.
  aggregate_path: z.string().min(1),
  // Count of branches that closed 'complete' vs other outcomes — quick
  // health summary readable without reconstructing per-branch trace_entries.
  branches_completed: z.number().int().nonnegative(),
  branches_failed: z.number().int().nonnegative(),
}).strict();
export type FanoutJoinedTraceEntry = z.infer<typeof FanoutJoinedTraceEntry>;

export const RunClosedTraceEntry = TraceEntryBase.extend({
  kind: z.literal('run.closed'),
  outcome: RunClosedOutcome,
  reason: z.string().optional(),
}).strict();
export type RunClosedTraceEntry = z.infer<typeof RunClosedTraceEntry>;

// Cross-variant superRefine enforces the
// `RelayStartedTraceEntry.role === resolved_from.role` binding when
// `resolved_from.source === 'role'`. Mirrors the Step pattern: keep each
// discriminated-union variant as a plain ZodObject (so discrimination works)
// and hoist cross-field refinements to the union level.
export const TraceEntry = z
  .discriminatedUnion('kind', [
    RunBootstrappedTraceEntry,
    StepEnteredTraceEntry,
    StepReportWrittenTraceEntry,
    CheckEvaluatedTraceEntry,
    CheckpointRequestedTraceEntry,
    CheckpointResolvedTraceEntry,
    RelayStartedTraceEntry,
    SkillsLoadedTraceEntry,
    RelayRequestTraceEntry,
    RelayFailedTraceEntry,
    RelayReceiptTraceEntry,
    RelayResultTraceEntry,
    RelayCompletedTraceEntry,
    SubRunStartedTraceEntry,
    SubRunCompletedTraceEntry,
    FanoutStartedTraceEntry,
    FanoutBranchStartedTraceEntry,
    FanoutBranchCompletedTraceEntry,
    FanoutJoinedTraceEntry,
    StepCompletedTraceEntry,
    StepAbortedTraceEntry,
    RunClosedTraceEntry,
  ])
  .superRefine((ev, ctx) => {
    if (ev.kind !== 'relay.started' && ev.kind !== 'relay.failed') return;
    if (ev.resolved_from.source === 'role' && ev.resolved_from.role !== ev.role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolved_from', 'role'],
        message: `resolved_from.role '${ev.resolved_from.role}' does not agree with trace_entry role '${ev.role}'`,
      });
    }
  });
export type TraceEntry = z.infer<typeof TraceEntry>;
