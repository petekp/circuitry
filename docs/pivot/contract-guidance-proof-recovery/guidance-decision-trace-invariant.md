# GuidanceDecision Trace Invariant

Status: implementation-spec direction for the Circuit pivot. This is not
current runtime behavior until the matching schema, runtime, tests, contracts,
and generated surfaces change.

## Purpose

GuidanceDecision is the trace record for an important runtime choice made inside
the work contract and policy rules.

The invariant is simple:

> A consequential action must have a matching recorded decision before Circuit
> takes that action.

The one ordering exception is flow selection. The current `RunTrace` requires
`run.bootstrapped` to be the first trace entry, so flow-selection guidance cannot
appear before bootstrap inside the same run. For V0, `run.bootstrapped` keeps the
selected flow, and the first `guidance.decision` after bootstrap must record and
validate that flow selection before any `step.entered` entry.

## Source Evidence

- The pivot doctrine says no agent action gets authority unless a contract
  allows it, a guidance decision traces it, and proof can verify or recover from
  it. See [pivot-brief.md](pivot-brief.md).
- The pivot brief names GuidanceDecision as the second implementation-readiness
  gate and says current trace has no first-class `guidance.decision`. See
  [pivot-brief.md](pivot-brief.md#guidancedecision).
- WorkContract Projection V0 says old selection and connector hints may seed
  guidance, but must not be final authority. See
  [work-contract-projection-v0.md](work-contract-projection-v0.md).
- The glossary defines Trace as the ordered record of what happened during a
  run and lists the current trace kinds. See
  [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md).
- Current `TraceEntry` has run, step, check, checkpoint, relay, skills, sub-run,
  fanout, and close entries, but no `guidance.decision`. See
  [src/schemas/trace-entry.ts](../../../src/schemas/trace-entry.ts).
- Current `RunTrace` requires bootstrap first, contiguous sequence numbers,
  one run id, one bootstrap, at most one close, and no entries after close. See
  [src/schemas/run.ts](../../../src/schemas/run.ts).
- Current relay execution resolves connector, selection, skills, and prompt
  before appending `relay.started` and `relay.request`. See
  [src/runtime/executors/relay.ts](../../../src/runtime/executors/relay.ts).
- Current checkpoint execution can resolve defaults and auto-resolution before
  appending `checkpoint.resolved`. See
  [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts).
- Current graph execution aborts undeclared routes and only treats `retry` and
  `revise` as recovery labels. See
  [src/runtime/run/graph-runner.ts](../../../src/runtime/run/graph-runner.ts).
- Current trace contract tests cover bootstrap ordering, sequence rules, run-id
  consistency, and close behavior. See
  [tests/contracts/runtrace-schema.test.ts](../../../tests/contracts/runtrace-schema.test.ts)
  and
  [tests/runtime/runtime-trace-contract.test.ts](../../../tests/runtime/runtime-trace-contract.test.ts).
- Current relay provenance tests assert resolved connector and selection
  provenance in the run trace. See
  [tests/runner/runner-relay-provenance.test.ts](../../../tests/runner/runner-relay-provenance.test.ts).
- Current checkpoint tests cover default and autonomous checkpoint resolution.
  See
  [tests/unit/checkpoint-auto-resolution.test.ts](../../../tests/unit/checkpoint-auto-resolution.test.ts).
- Generated host surfaces are generated from source and checked by the emit
  script. See [docs/generated-surfaces.md](../../generated-surfaces.md).

## Proposed Trace Entry

```ts
type GuidanceDecisionTraceEntry = TraceEntryBase & {
  kind: 'guidance.decision';
  decision_id: GuidanceDecisionId;
  subject:
    | 'flow_selection'
    | 'relay_execution'
    | 'checkpoint_resolution'
    | 'proof_policy'
    | 'recovery_route'
    | 'safe_apply';
  scope: GuidanceScope;
  source:
    | 'deterministic'
    | 'heuristic'
    | 'model_recommended'
    | 'host_recommended'
    | 'operator_override';
  selected: JsonObject;
  input_refs: Ref[];
  constraint_refs: Ref[];
  contract_refs: Ref[];
  policy_refs: Ref[];
  evidence_refs?: Ref[];
  memory_refs?: Ref[];
  reason_codes: ReasonCode[];
  rejected_options?: RejectedGuidanceOption[];
};
```

Do not add required prose explanations or uncalibrated confidence. Use
`reason_codes`, refs, and rejected options.

`input_refs`, `constraint_refs`, `contract_refs`, `policy_refs`, and
`reason_codes` are required and non-empty. `constraint_refs` are ordinary
`Ref` values that point to the hard limits that bounded the decision, usually
specific WorkContract or policy entries. A model, host, or operator can
recommend a decision, but the recorded GuidanceDecision is the runtime-validated
decision.

## Guidance Scope

```ts
type GuidanceScope = {
  run_id: RunId;
  flow_id?: CompiledFlowId;
  step_id?: StepId;
  attempt?: number;
  branch_id?: string;
};
```

Rules:

- `run_id` is always required.
- `flow_id` is required after flow selection.
- `step_id` and `attempt` are required for relay, checkpoint, proof, recovery,
  and safe-apply decisions tied to a step attempt.
- `branch_id` is required when the decision applies to one fanout branch.

## Ref Shape

Refs are not notes. They are stable pointers to the inputs, rules, contracts,
trace entries, and evidence that bounded a decision.

```ts
type Ref = {
  kind:
    | 'work_contract'
    | 'policy'
    | 'trace'
    | 'report'
    | 'evidence'
    | 'request'
    | 'context_packet'
    | 'diff'
    | 'patch'
    | 'command'
    | 'change_packet'
    | 'safe_apply'
    | 'memory'
    | 'operator_input';
  ref: string;
  sha256?: string;
  run_id?: RunId;
  flow_id?: CompiledFlowId;
  step_id?: StepId;
  attempt?: number;
  sequence?: number;
};
```

Required rules:

- `trace` refs require `run_id`, `sequence`, and `ref:
  "trace.ndjson#sequence=<n>"`.
- `work_contract` refs require `flow_id`, `ref`, and `sha256`.
- `policy` refs require `ref`. If the policy comes from a file, `sha256` is
  required.
- `constraint_refs` must use `work_contract` or `policy` refs in V0. Add a
  separate `constraint` ref kind later only if constraints become stored
  artifacts.
- Content refs require `sha256`: `report`, `evidence`, `request`,
  `context_packet`, `diff`, `patch`, `command`, `change_packet`, and
  `safe_apply`.
- `operator_input` refs must point to a checkpoint response, CLI resume input,
  or host input record.
- `memory` refs are optional in the first cutover. Memory can inform a decision
  but cannot grant authority.

## Subject-Specific Selected Shapes

### Flow Selection

```ts
selected: {
  flow_id: CompiledFlowId;
  work_contract_ref: Ref;
  host_recommendation?: {
    flow_id: CompiledFlowId;
    accepted: boolean;
  };
}
```

Matching rule:

- The decision must be the first material decision after `run.bootstrapped`.
- `selected.flow_id` must equal `run.bootstrapped.flow_id`.
- If a host recommended the flow, the decision source is `host_recommended`,
  `input_refs` include the host recommendation, and
  `selected.host_recommendation` records whether Circuit accepted it.
- If Circuit rejects the host recommendation, `selected.flow_id` records the
  validated flow that will run, and `rejected_options` records the host's
  rejected flow.
- No `step.entered` may appear before this decision.

### Relay Execution

```ts
selected: {
  role: RelayRole;
  connector: ResolvedConnector;
  model?: ProviderScopedModel;
  effort?: Effort;
  skills: Array<{ id: SkillId; slot?: SkillSlotId }>;
  context_packet_ref: Ref;
  request_payload_hash: string;
}
```

Matching rule:

- Before any `relay.started` or `relay.failed`, there must be a preceding
  `guidance.decision` with subject `relay_execution`, same `run_id`,
  `flow_id`, `step_id`, and `attempt`.
- `selected.role` must equal `relay.started.role` or `relay.failed.role`.
- `selected.connector` must equal the resolved connector in the relay trace
  entry.
- `selected.model`, `selected.effort`, and `selected.skills` must equal the
  relay's selected worker inputs. If the relay trace still repeats
  `resolved_selection`, it must match `GuidanceDecision.selected`; it cannot be
  a separate source of truth.
- `selected.request_payload_hash` must equal the following
  `relay.request.request_payload_hash`.
- If `skills.loaded` appears for the same step attempt, its skill ids and slots
  must match `selected.skills`.

V0 decision: context sent to the worker is part of `relay_execution` through
`context_packet_ref` and `request_payload_hash`. A separate `context_packet`
subject is intentionally not part of V0. Add it later only if one context packet
is reused across multiple relays.

### Checkpoint Resolution

```ts
selected: {
  choice_id: string;
  route_id: string;
  auto_resolved: boolean;
  resolution_source: 'declared-default' | 'operator' | 'policy';
}
```

Matching rule:

- `checkpoint.requested` may appear without a resolution when the run is waiting.
- Every `checkpoint.resolved` must have a preceding `guidance.decision` with
  subject `checkpoint_resolution`, same `run_id`, `flow_id`, `step_id`, and
  `attempt`.
- `selected.choice_id` must equal `checkpoint.resolved.selection`.
- `selected.auto_resolved` must equal `checkpoint.resolved.auto_resolved`.
- `selected.route_id` must be declared by the WorkContract. If a checkpoint
  choice falls back to `pass`, that fallback must also be declared.
- `safe-autonomous` is not a valid future resolution source.
- Old `auto_resolution` policies such as `highest-score`, `accept-as-is`, and
  `first-acceptable` cannot resolve a checkpoint unless the decision records the
  policy, inputs, evidence refs, and rejected alternatives.

### Proof Policy

```ts
selected: {
  proof_profile: string;
  required_claim_kinds: string[];
  required_evidence_kinds: string[];
  close_requires_proven: boolean;
}
```

Matching rule:

- Before a proof assessment is written for a step or run, there must be a
  preceding `guidance.decision` with subject `proof_policy` for the same scope.
- The proof assessment must reference the matching decision id.
- Acceptance criteria `check.evaluated` entries are evidence inputs only. They
  do not replace proof assessment.
- A write-capable run cannot close as complete unless proof assessment refs show
  required claims are proven.

The exact Claim, Evidence, and ProofAssessment schemas belong to the proof spec.
This spec only defines the guidance decision that chooses the proof policy.

### Recovery Route

```ts
selected: {
  route_id: string;
  recovery_kind: RecoveryRouteKind;
  failure_ref: Ref;
}
```

Matching rule:

- Before `step.completed.route_taken` records a recovery route, there must be a
  preceding `guidance.decision` with subject `recovery_route`, same `run_id`,
  `flow_id`, `step_id`, and `attempt`.
- `selected.route_id` must equal `step.completed.route_taken`.
- `selected.route_id` must be declared by the WorkContract.
- `selected.failure_ref` must point to the failed check, relay, checkpoint, proof
  assessment, or safe-apply result that caused recovery.
- Unknown failure can route only to a declared escalation or stop route.

### Safe Apply

```ts
selected: {
  action: 'accept' | 'reject' | 'apply';
  change_packet_ref: Ref;
  base_ref: Ref;
  protected_file_decision?: 'allowed' | 'rejected' | 'checkpointed';
  final_verification_ref?: Ref;
}
```

Matching rule:

- Before any future safe-apply trace entry accepts, rejects, or applies a change,
  there must be a preceding `guidance.decision` with subject `safe_apply`.
- The safe-apply trace entry must reference the matching decision id.
- `selected.change_packet_ref`, `selected.base_ref`, and any patch/content refs
  must carry hashes.
- `apply` requires final verification evidence. `reject` requires a reason code.
- SafeApply cannot be used to make unverified proof look proven.

The exact ChangePacket and SafeApply trace entries belong to the SafeApply spec.

## Sequence Invariants

The existing RunTrace invariants stay in force:

- first trace entry is `run.bootstrapped`;
- sequence numbers are 0-based and contiguous;
- every trace entry has the same `run_id`;
- a run has one bootstrap and at most one close;
- nothing appears after `run.closed`.

Guidance adds these invariants:

- `decision_id` is unique within a run.
- Flow-selection guidance is the first material decision after bootstrap and
  before any `step.entered`.
- Every relay, checkpoint resolution, proof assessment, recovery route, and
  safe-apply action has exactly one matching prior GuidanceDecision in the same
  run.
- A later operator override does not mutate an earlier decision. It records a
  new decision that references the earlier decision in `input_refs` or
  `rejected_options`.
- A guidance decision cannot choose a route, connector, skill, proof policy, or
  apply action forbidden by WorkContract or policy.
- Guidance may use memory refs, but memory refs never satisfy
  `constraint_refs`, `contract_refs`, or `policy_refs`.

## Death Tests

Schema tests:

- `TraceEntry` accepts `guidance.decision` with required refs and reason codes.
- `TraceEntry` rejects `guidance.decision` without `input_refs`,
  `constraint_refs`, `contract_refs`, `policy_refs`, or `reason_codes`, and
  rejects those fields when they are empty arrays.
- `TraceEntry` rejects `confidence` and freeform rationale fields.
- `TraceEntry` rejects content refs without `sha256`.
- `RunTrace` rejects duplicate `decision_id` within one run.

Sequence tests:

- `RunTrace` rejects `step.entered` before flow-selection guidance.
- `RunTrace` rejects `relay.started` without matching prior relay guidance.
- `RunTrace` rejects `relay.failed` without matching prior relay guidance.
- `RunTrace` rejects `checkpoint.resolved` without matching checkpoint guidance.
- `RunTrace` rejects `checkpoint.resolved` with `safe-autonomous`.
- `RunTrace` rejects a recovery `step.completed.route_taken` without matching
  recovery guidance.
- `RunTrace` rejects a future safe-apply action without matching safe-apply
  guidance.
- `RunTrace` rejects a write-capable `run.closed: complete` without proof
  assessment refs.

Runtime tests:

- Relay executor refuses to append `relay.started` unless it has just recorded
  matching relay guidance.
- Relay executor aborts if the selected connector, role, model, effort, skills,
  or request hash differs from guidance.
- Checkpoint executor records checkpoint guidance before resolving a declared
  default.
- Checkpoint executor fails closed for old untraced auto-resolution paths.
- Graph runner aborts if guidance chooses a route not declared by the
  WorkContract.
- Recovery route selection records failure refs and typed recovery kind.

Generated-surface tests:

- Generated host surfaces do not claim direct flow commands bypass guidance.
- Generated flow manifests include or reference WorkContract data needed by
  `contract_refs`.
- Drift checks fail if generated mirrors omit the new trace/runtime contract
  language after the cutover.

## Implementation Order

1. Add Ref and GuidanceDecision schemas.
2. Add RunTrace sequence validation for guidance matching.
3. Add relay guidance recording and matching checks.
4. Add checkpoint guidance recording and matching checks.
5. Add proof/recovery placeholders only as far as needed for sequence tests.
6. Wire generated-surface framing only after runtime truth exists.

Do not implement SafeApply or the full proof model in this slice.

## Still Unsettled

- Exact Claim, Evidence, and ProofAssessment schemas.
- Exact SafeApply trace event names.
- Whether future shared context packets need a separate `context_packet` subject.
- Whether `highest-score` moves to fanout/review policy or stays as a
  guidance-recorded checkpoint decision.
- How operator-authorized policy changes differ from one-run overrides.
- Whether `relay.started` keeps repeating selected connector/selection fields or
  only stores `decision_id` after the cutover.

## Review Record

First pass found four medium risks:

- flow-selection guidance could violate the current bootstrap-first trace rule;
- flow-selection host recommendation state was ambiguous when no host
  recommendation existed;
- context packet handling was still vague;
- proof and safe-apply matching rules were overreaching into later specs.

The spec now treats flow selection as a bootstrap-adjacent exception, folds
host recommendation state under `selected.host_recommendation`, folds worker
context into relay execution for V0, and limits proof/safe-apply to matching
rules plus handoffs to later specs.

Second pass found no medium-or-above findings. Remaining issues are named as
unsettled items or deferred specs.
