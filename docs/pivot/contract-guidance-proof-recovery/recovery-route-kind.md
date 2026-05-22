# RecoveryRouteKind

Status: implementation spec direction. This is future-facing. It describes the
target model for typed recovery routes; it is not current runtime truth until the
matching schemas, runtime checks, tests, and generated surfaces exist.

## Purpose

Circuit already has routes such as `retry`, `revise`, `ask`, `stop`, `handoff`,
and `escalate`. Those names are useful and should stay.

The missing piece is typed recovery.

Today a route string can mean too many things:

- retry the same relay because acceptance criteria failed;
- revise work because proof is weak;
- ask the operator because authority is missing;
- stop because evidence contradicts the claim;
- hand off because Circuit cannot continue safely.

`RecoveryRouteKind` gives Circuit a plain, typed reason for using a route after
something goes wrong.

Rule:

> A route says where the run can go. `RecoveryRouteKind` says why that route is
> allowed after a failure.

This keeps Flow vocabulary simple while removing freeform recovery meaning.

## Source Evidence

This spec is grounded in the current pivot docs and local repo evidence:

- The pivot brief says recovery routes should bind a declared route id,
  `RecoveryRouteKind`, allowed failure causes, evidence refs, operator authority,
  and retry-budget behavior. See [pivot-brief.md](pivot-brief.md#typed-recovery-expectations).
- WorkContract Projection V0 says routes and recovery routes are contract-owned,
  while current string labels are too thin. See
  [work-contract-projection-v0.md](work-contract-projection-v0.md#projection-map).
- GuidanceDecision Trace Invariant requires a `guidance.decision` with
  `subject: "recovery_route"` before a recovery route is recorded. See
  [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#recovery-route).
- PolicyEnvelope Config V2 Cutover says budgets are contract hard caps that
  policy may only tighten. See
  [policy-envelope-config-v2-cutover.md](policy-envelope-config-v2-cutover.md#current-budget-and-limit-fields).
- CheckpointBoundary Authority says selected checkpoint choices must map to
  declared routes, and old untraced auto-resolution paths must go away. See
  [checkpoint-boundary-authority.md](checkpoint-boundary-authority.md#anti-cruft-probes).
- ProofAssessment and Evidence Adapter says weak proof is not success and must
  use declared WorkContract routes with typed recovery kinds. See
  [proof-assessment-evidence-adapter.md](proof-assessment-evidence-adapter.md#weak-proof-recovery).
- The canonical vocabulary keeps `route`, `relay`, `trace`, `report`,
  `evidence`, and `checkpoint` as product terms. See
  [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md).
- Current flow authoring lists common route outcomes and says acceptance
  `retry-with-feedback` uses the existing `retry` route and
  `budgets.max_attempts`. See
  [docs/flows/authoring-model.md](../../flows/authoring-model.md#routes).
- Current step schemas put `routes`, `route_from_report`, `budgets`,
  checkpoint policy, relay connector, and acceptance criteria on steps. See
  [src/schemas/step.ts](../../../src/schemas/step.ts).
- Current acceptance criteria know only command and report-field checks with
  `hard-fail` or `retry-with-feedback`. See
  [src/schemas/acceptance-criteria.ts](../../../src/schemas/acceptance-criteria.ts).
- Current recovery selection has a shared priority list:
  `retry`, `revise`, `ask`, `stop`, `handoff`, `escalate`. See
  [src/shared/recovery-route.ts](../../../src/shared/recovery-route.ts) and
  [tests/runner/recovery-route.test.ts](../../../tests/runner/recovery-route.test.ts).
- Current runtime tests cover acceptance retry feedback, retry budget exhaustion,
  failed relay checks through declared recovery, connector failure with and
  without recovery, and cycle handling. See
  [tests/runtime/control-loop.test.ts](../../../tests/runtime/control-loop.test.ts),
  [tests/runner/terminal-outcome-mapping.test.ts](../../../tests/runner/terminal-outcome-mapping.test.ts),
  and [tests/runtime/runtime-baseline.test.ts](../../../tests/runtime/runtime-baseline.test.ts).
- Current Fix tests show a reviewer connector failure taking a declared
  `connector-failed` route. See
  [tests/runner/fix-runtime-wiring.test.ts](../../../tests/runner/fix-runtime-wiring.test.ts).
- Current schema tests cover acceptance criteria placement, route override
  validation, and trace entry shape. See
  [tests/contracts/step-schema.test.ts](../../../tests/contracts/step-schema.test.ts),
  [tests/contracts/flow-schematic.test.ts](../../../tests/contracts/flow-schematic.test.ts),
  and [tests/contracts/runtrace-schema.test.ts](../../../tests/contracts/runtrace-schema.test.ts).
- Current graph running only treats `retry` and `revise` as recovery route
  labels for loop and attempt handling, and aborts undeclared routes. See
  [src/runtime/run/graph-runner.ts](../../../src/runtime/run/graph-runner.ts).
- Current relay execution uses `connector-failed` if declared, otherwise falls
  back to the shared recovery route helper, and acceptance
  `retry-with-feedback` requires `retry` to re-enter the same step. See
  [src/runtime/executors/relay.ts](../../../src/runtime/executors/relay.ts).
- Current verification execution falls back to the shared recovery route helper
  after failed commands. See
  [src/runtime/executors/verification.ts](../../../src/runtime/executors/verification.ts).
- Current checkpoint execution records `safe-default` and `safe-autonomous`
  resolution sources and may resolve through `accept-as-is`, `first-acceptable`,
  or `highest-score`. This spec replaces that untraced path. See
  [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts).
- Current trace has `check.evaluated`, `checkpoint.resolved`,
  `step.completed`, and `run.closed`, but not `guidance.decision` or typed
  recovery refs yet. See [src/schemas/trace-entry.ts](../../../src/schemas/trace-entry.ts).
- Current Goal reports already have local recovery route ideas such as
  `retry-selected-flow`, `checkpoint`, `handoff`, and `blocked`. They are useful
  product precedent, not the shared runtime type. See
  [src/flows/goal/reports.ts](../../../src/flows/goal/reports.ts) and
  [tests/contracts/goal-report-schemas.test.ts](../../../tests/contracts/goal-report-schemas.test.ts).
- Generated surfaces are owned by source files and drift checks. Recovery route
  docs and generated host mirrors must move through those sources, not by
  hand-editing generated outputs. See
  [docs/generated-surfaces.md](../../generated-surfaces.md).

## Language Rule

Use plain route names in product prose.

| Formal spec name | Plain wording |
| --- | --- |
| `RecoveryRouteKind` | recovery path type |
| `RecoveryFailureCause` | failure reason |
| `RecoveryRouteBinding` | declared recovery route |
| `retry_same_step_with_feedback` | retry this step with feedback |
| `narrow_scope` | narrow the work |
| `run_verification` | run verification |
| `run_independent_review` | run independent review |
| `checkpoint_authority` | ask or use a declared default |
| `safe_apply_reject` | reject the proposed change |
| `stop_unsafe` | stop because continuing is unsafe |
| `escalate` | escalate |
| `handoff` | hand off |

Do not teach operators to think in enum names. Use enum names in schemas,
tests, trace validators, and implementation specs.

## Core Distinction

### Route Id

A route id is the Flow-owned key in `step.routes`.

Examples:

- `pass`;
- `continue`;
- `retry`;
- `revise`;
- `connector-failed`;
- `checkpoint`;
- `blocked`;
- `handoff`;
- `stop`.

Route ids stay flow vocabulary. They are authored by a Flow and validated by
the WorkContract.

### RecoveryRouteKind

`RecoveryRouteKind` is the typed reason Circuit may take a route after a
failure.

Examples:

- `retry` route id with `retry_same_step_with_feedback`;
- `revise` route id with `narrow_scope`;
- `review` route id with `run_independent_review`;
- `checkpoint` route id with `checkpoint_authority`;
- `blocked` route id with `stop_unsafe`;
- `connector-failed` route id with `escalate` or `handoff`.

The same route id can have only one recovery kind for a given step in V0. If a
step needs two meanings, author two route ids.

## Proposed V0 Types

```ts
type RecoveryRouteKind =
  | 'retry_same_step_with_feedback'
  | 'narrow_scope'
  | 'run_verification'
  | 'run_independent_review'
  | 'checkpoint_authority'
  | 'safe_apply_reject'
  | 'stop_unsafe'
  | 'escalate'
  | 'handoff';

type RecoveryFailureCause =
  | 'failed_check'
  | 'failed_acceptance_criteria'
  | 'weak_proof'
  | 'unproved_claim'
  | 'contradicted_evidence'
  | 'scope_drift'
  | 'checkpoint_boundary'
  | 'relay_connector_failed'
  | 'relay_result_invalid'
  | 'apply_conflict'
  | 'budget_exceeded'
  | 'protected_file_touched'
  | 'generated_surface_drift'
  | 'unknown_failure';

type RecoveryRouteBindingV0 = {
  schema_version: 1;

  route_id: string;
  route_target_ref: Ref;

  kind: RecoveryRouteKind;
  allowed_causes: RecoveryFailureCause[];

  required_refs: Array<
    | 'failed_check'
    | 'proof_assessment'
    | 'runtime_diff'
    | 'relay_result'
    | 'checkpoint_request'
    | 'safe_apply_result'
    | 'budget_state'
  >;

  operator_authority:
    | 'not_required'
    | 'required_before_route'
    | 'required_to_continue_after_route';

  attempt_budget: {
    consumes_step_attempt: boolean;
    must_respect_max_attempts: boolean;
    retry_target?: 'same_step' | 'declared_step';
  };

  guidance: {
    subject: 'recovery_route';
    must_match_step_completed: true;
  };
};
```

V0 should live in the WorkContract projection. Do not add a separate recovery
registry that competes with Flow routes.

## Ownership

| Object | Owns | Must not own |
| --- | --- | --- |
| Flow | Route ids and route targets. | Freeform recovery meaning. |
| WorkContract | Recovery route bindings: route id, kind, causes, refs, authority, budgets. | Connector/model/effort/skill choice. |
| GuidanceDecision | The selected recovery route for this failed attempt. | New route ids or undeclared recovery kinds. |
| PolicyEnvelope | Stricter limits and defaults for when recovery may proceed. | Loosening WorkContract route or budget limits. |
| ProofAssessment | Whether a claim is proven, weak, contradicted, or unproved; recommended recovery. | Taking a route by itself. |
| CheckpointBoundary | Operator or policy authority boundary and declared route consequences. | Hidden auto-resolution without guidance. |
| SafeApply | Apply/reject result and conflict evidence. | Retrying or applying without a declared recovery path. |
| MemoryInput | Hints only. | Permission to recover, retry, apply, or skip proof. |

## Required Matching Rules

Every recovery route selection must satisfy all of these rules.

1. The selected route id exists in the current step's declared `routes`.
2. The WorkContract has exactly one `RecoveryRouteBindingV0` for that
   `step_id + route_id`.
3. The binding's `kind` equals `guidance.decision.selected.recovery_kind`.
4. The failure cause is in the binding's `allowed_causes`.
5. Every required ref is present and points to a trace entry, report, evidence
   file, or safe-apply result in the same run scope.
6. Any route that consumes an attempt respects `budgets.max_attempts` and any
   stricter PolicyEnvelope limit.
7. If operator authority is required, the run must stop at a checkpoint or
   resume from a saved checkpoint decision before taking the route.
8. `step.completed.route_taken` must equal
   `guidance.decision.selected.route_id`.

No matching `guidance.decision` means no recovery route. Circuit should fail
closed with a stop or escalation route only if that route is declared and
matched.

## Failure Causes

### `failed_check`

Use when a runtime check failed.

Current examples:

- `check.evaluated` with `check_kind: "schema_sections"` and `outcome: "fail"`;
- `check.evaluated` with `check_kind: "result_verdict"` and
  `outcome: "fail"`;
- verification command checks that fail.

Allowed recovery kinds:

- `retry_same_step_with_feedback`;
- `run_verification`;
- `run_independent_review`;
- `checkpoint_authority`;
- `stop_unsafe`;
- `escalate`.

The failure ref must point to the failed `check.evaluated` entry.

### `failed_acceptance_criteria`

Use when relay acceptance criteria fail.

Current runtime already supports `retry-with-feedback` when a step declares a
`retry` route that re-enters the same step. V0 keeps that behavior but types it:

- route id: usually `retry`;
- kind: `retry_same_step_with_feedback`;
- target: same step;
- required refs: failed `check.evaluated` entry and acceptance feedback;
- budget: consumes the step attempt budget.

This is the only V0 kind that may require same-step retry.

Normalize older prose that says `retry_with_feedback` to
`retry_same_step_with_feedback`.

### `weak_proof`

Use when evidence exists but is not strong enough.

Examples:

- report field exists but no runtime command ref;
- self-review where independent review is required;
- diff evidence missing for a write-capable claim;
- generated surface proof missing.

Allowed recovery kinds:

- `run_verification`;
- `run_independent_review`;
- `checkpoint_authority`;
- `narrow_scope`;
- `stop_unsafe` after repeated weak proof.

Weak proof cannot close write-capable work as complete.

### `unproved_claim`

Use when no relevant evidence covers a required claim.

Allowed recovery kinds:

- `run_verification`;
- `run_independent_review`;
- `checkpoint_authority`;
- `narrow_scope`;
- `stop_unsafe`;
- `escalate`.

The proof assessment must point to the missing claim ids.

### `contradicted_evidence`

Use when evidence conflicts with the claim.

Examples:

- runtime diff disagrees with worker-reported `changed_files`;
- a required command fails after a worker says it passed;
- generated surface drift exists after the worker says generated surfaces were
  synced;
- review rejects an implementation claim.

Allowed recovery kinds:

- `retry_same_step_with_feedback`;
- `run_verification`;
- `run_independent_review`;
- `safe_apply_reject`;
- `checkpoint_authority`;
- `stop_unsafe`;
- `escalate`.

Contradicted evidence should not silently retry forever. After the declared
attempt budget is exhausted, it must route to `stop_unsafe`,
`checkpoint_authority`, `handoff`, or `escalate`.

### `scope_drift`

Use when work leaves the declared scope.

Examples:

- runtime diff touches protected files;
- changed files are outside the allowed path set;
- a worker expands the task without operator authority.

Allowed recovery kinds:

- `narrow_scope`;
- `checkpoint_authority`;
- `safe_apply_reject`;
- `stop_unsafe`;
- `escalate`.

Scope drift requires runtime evidence. Worker prose is not enough.

### `checkpoint_boundary`

Use when Circuit lacks authority to continue without a checkpoint decision.

Examples:

- protected files touched;
- budget extension needed;
- ambiguous intent;
- weak proof with risk;
- unsafe apply.

Allowed recovery kinds:

- `checkpoint_authority`;
- `stop_unsafe`;
- `handoff`;
- `escalate`.

A checkpoint route must also satisfy the CheckpointBoundary spec:

- declared choices;
- route consequences;
- declared default only when policy can cross the boundary;
- `guidance.decision` for any automatic resolution.

### `relay_connector_failed`

Use when a connector cannot run or returns a connector-level failure.

Current runtime prefers an explicit `connector-failed` route if present, then
falls back to the shared recovery route helper. V0 keeps `connector-failed` as a
valid route id, but it needs a typed binding.

Allowed recovery kinds:

- `retry_same_step_with_feedback` only if the WorkContract says retrying the
  same step is safe for that connector failure;
- `handoff`;
- `checkpoint_authority`;
- `escalate`;
- `stop_unsafe`.

Do not treat `connector-failed` as success. It is a failure-handling route.

### `relay_result_invalid`

Use when a relay returns a result that does not pass schema, verdict, report, or
acceptance requirements.

Allowed recovery kinds:

- `retry_same_step_with_feedback`;
- `run_independent_review`;
- `checkpoint_authority`;
- `stop_unsafe`;
- `escalate`.

If the invalid result still wrote raw relay output, that raw output can be
evidence of failure. It is not an accepted report.

### `apply_conflict`

Use when SafeApply cannot apply a proposed change cleanly.

Examples:

- base ref mismatch;
- patch conflict;
- protected-file conflict;
- generated-surface drift;
- final composed verification failure.

Allowed recovery kinds:

- `safe_apply_reject`;
- `run_verification`;
- `checkpoint_authority`;
- `stop_unsafe`;
- `escalate`.

SafeApply conflicts must not mutate the parent checkout partially.

### `budget_exceeded`

Use when a step, run, policy limit, or operator limit is exhausted.

Allowed recovery kinds:

- `checkpoint_authority` if policy allows asking for more budget;
- `stop_unsafe`;
- `handoff`;
- `escalate`.

Budget exhaustion must not be bypassed by choosing another retry route. Policy
can tighten budgets; it cannot loosen WorkContract caps without an explicit
policy-change path.

### `protected_file_touched`

Use when runtime diff or ChangePacket data shows protected files were touched.

Allowed recovery kinds:

- `checkpoint_authority`;
- `safe_apply_reject`;
- `stop_unsafe`;
- `escalate`.

This cause requires runtime diff or ChangePacket refs.

### `generated_surface_drift`

Use when generated surfaces changed without the required drift proof, or when a
generated-surface check fails.

Allowed recovery kinds:

- `run_verification`;
- `safe_apply_reject`;
- `checkpoint_authority`;
- `stop_unsafe`;
- `escalate`.

Generated-surface proof must come from the generator or drift check, not from
agent prose.

### `unknown_failure`

Use when Circuit cannot classify the failure.

Allowed recovery kinds:

- `stop_unsafe`;
- `escalate`;
- `handoff`.

Unknown failure cannot retry work. If Circuit does not know what failed, it does
not know what feedback to send.

## Recovery Kind Rules

### `retry_same_step_with_feedback`

Use when the same step can safely run again with specific feedback.

Rules:

- target must be the same step;
- route id is usually `retry`;
- cause must be `failed_acceptance_criteria`, `failed_check`,
  `contradicted_evidence`, `relay_result_invalid`, or a declared safe
  `relay_connector_failed`;
- feedback ref is required;
- consumes attempt budget;
- cannot run after budget exhaustion;
- cannot cross protected-file or apply-conflict boundaries by itself.

This kind should not be used for broad "try again" behavior. If feedback is not
specific, use `checkpoint_authority`, `stop_unsafe`, `handoff`, or `escalate`.

### `narrow_scope`

Use when the next step should reduce the work scope.

Rules:

- cause must be `scope_drift`, `weak_proof`, `unproved_claim`, or
  `contradicted_evidence`;
- target should be a step that rewrites scope, plan, or contract;
- requires a proof or diff ref explaining the drift or gap;
- cannot silently discard user-requested work. If narrowing changes the
  operator goal, use `checkpoint_authority`.

### `run_verification`

Use when Circuit needs runtime proof.

Rules:

- target should be a verification step or equivalent proof-producing step;
- cause must be `failed_check`, `weak_proof`, `unproved_claim`,
  `contradicted_evidence`, `generated_surface_drift`, or `apply_conflict`;
- required refs must name what needs verification;
- verification failure must produce evidence and another declared recovery
  route, not a freeform retry.

### `run_independent_review`

Use when judgment is needed from an independent worker.

Rules:

- target should be a reviewer relay or review step;
- cause must be `weak_proof`, `unproved_claim`, `contradicted_evidence`, or a
  policy rule requiring review;
- review evidence must mark independence;
- self-review cannot satisfy this kind.

### `checkpoint_authority`

Use when the next step needs operator or policy authority.

Rules:

- target must be a checkpoint step or a step that writes a checkpoint request;
- cause must be `checkpoint_boundary`, `scope_drift`, `weak_proof`,
  `unproved_claim`, `contradicted_evidence`, `budget_exceeded`,
  `protected_file_touched`, `apply_conflict`, or `relay_connector_failed`;
- selected checkpoint choice must map to a declared route consequence;
- automatic default requires a declared default, policy permission, and a
  `guidance.decision`;
- old `safe-autonomous` trace sources are invalid.

### `safe_apply_reject`

Use when proposed changes must not be applied.

Rules:

- target should close, stop, or move to a repair path without mutating the
  parent checkout;
- cause must be `apply_conflict`, `scope_drift`, `protected_file_touched`,
  `generated_surface_drift`, `weak_proof`, or `contradicted_evidence`;
- requires SafeApply result refs or runtime diff refs;
- cannot be followed by complete unless a later declared route produces new
  proof and a successful safe apply.

### `stop_unsafe`

Use when Circuit should stop because continuing would be unsafe or dishonest.

Rules:

- target should be `@stop`, `@abort`, `blocked`, or a close step whose outcome is
  not clean success;
- allowed for any high-risk failure cause;
- required when repeated weak proof or contradictions exhaust the recovery
  budget and no checkpoint/handoff route is allowed;
- cannot produce `run.closed: complete`.

### `escalate`

Use when Circuit needs a higher-level handling path.

Rules:

- target can be an escalation route, checkpoint, or close step that reports the
  unresolved failure;
- allowed for `unknown_failure`, `budget_exceeded`, `relay_connector_failed`,
  `scope_drift`, `apply_conflict`, and repeated proof failure;
- must include the failure ref and a concise reason;
- cannot become an unbounded retry loop.

### `handoff`

Use when Circuit should package the state for another operator, host, or run.

Rules:

- target should write a handoff report or close with a handoff outcome;
- allowed for `unknown_failure`, `budget_exceeded`, `relay_connector_failed`,
  or operator-requested transfer;
- must include trace refs and current proof/recovery state;
- cannot claim the work is complete.

## Mapping Current Route Names

Current route names remain useful. V0 maps them by binding, not by name alone.

| Current route id | Common V0 kind | Notes |
| --- | --- | --- |
| `retry` | `retry_same_step_with_feedback` | Only when target is same step and feedback is specific. |
| `revise` | `narrow_scope`, `run_verification`, or `run_independent_review` | The Flow must say which one. Do not infer from the word. |
| `ask` | `checkpoint_authority` | Use when the route crosses an authority boundary. |
| `checkpoint` | `checkpoint_authority` | Common in Goal-style recovery. |
| `connector-failed` | `handoff`, `escalate`, `checkpoint_authority`, or `stop_unsafe` | A failure route, not success. |
| `blocked` | `stop_unsafe` or `handoff` | Must close honestly. |
| `stop` | `stop_unsafe` | Does not close as complete. |
| `handoff` | `handoff` | Requires state package refs. |
| `escalate` | `escalate` | Requires failure refs. |
| `pass`, `continue` | Not recovery by default | May follow a recovered state only after the recovery is complete. |

Death tests should fail if implementation infers recovery kind from route id
without a WorkContract binding.

## Current Field Projection

| Current field or behavior | V0 fate | Rule |
| --- | --- | --- |
| `step.routes` | Contract-owned | Declares possible route ids and targets. |
| `route_from_report` | Contract-owned with guard | Selected route must be declared and cannot carry recovery meaning without binding. |
| `budgets.max_attempts` | Contract hard cap | Recovery retries must respect it. Policy may tighten. |
| `budgets.wall_clock_ms` | Contract hard cap | Recovery cannot bypass wall-clock limit. |
| `AcceptanceCriteria.on_failure: "retry-with-feedback"` | Recovery input | Becomes `retry_same_step_with_feedback` when same-step retry is declared. |
| `recoveryRouteForStep` helper | Replace as authority | Useful priority precedent, but V0 must use WorkContract bindings. |
| `RECOVERY_ROUTE_LABELS = retry/revise` | Replace | Recovery handling must be kind-based, not label-based. |
| `connector-failed` route | Keep as route id | Needs a RecoveryRouteKind binding. |
| `checkpoint.selection` route fallback to `pass` | Replace with stricter route consequence | A selected checkpoint choice must map to a declared route or declared non-route outcome. |
| Goal local `GoalRecoveryRoute` | Keep as flow-local report schema | Does not replace shared `RecoveryRouteKind`. |
| Generated flow manifests | Generated output | Must include recovery bindings after cutover and pass drift checks. |

## Trace Shape

Recovery uses GuidanceDecision for the decision, then normal trace entries for
what happened.

Target sequence:

```text
failed check / relay / proof / checkpoint / safe apply
-> guidance.decision subject=recovery_route
-> step.completed route_taken=<selected route id>
-> next step, checkpoint, stop, handoff, or close
```

Guidance selected shape:

```ts
selected: {
  route_id: string;
  recovery_kind: RecoveryRouteKind;
  failure_cause: RecoveryFailureCause;
  failure_ref: Ref;
  binding_ref: Ref;
}
```

Sequence rules:

- `failure_ref` must point to the event or proof result that caused recovery.
- `binding_ref` must point to the WorkContract recovery binding.
- `selected.route_id` must equal the next `step.completed.route_taken` for the
  same `run_id`, `flow_id`, `step_id`, and `attempt`.
- If the route leads to a checkpoint, the checkpoint resolution needs its own
  checkpoint GuidanceDecision.
- If the route leads to proof assessment, that proof assessment needs its own
  proof-policy GuidanceDecision.
- If the route leads to SafeApply, SafeApply accept/reject/order needs its own
  safe-apply GuidanceDecision.

## Close Rules

Recovery cannot hide failure.

- A run with unresolved `weak`, `unproved`, or `contradicted` proof cannot close
  as complete.
- `stop_unsafe`, `handoff`, and unresolved `escalate` routes cannot close as
  complete.
- `safe_apply_reject` cannot close as complete unless later declared routes
  produce a new accepted change and proof.
- `retry_same_step_with_feedback` cannot close as complete until the later
  attempt proves the required claims.
- `checkpoint_authority` can close as complete only if the operator or declared
  policy choice authorizes continuation and later proof is clean.

## Death Tests

### Schema And Projection

- WorkContract projection rejects a recovery route without `route_id`,
  `RecoveryRouteKind`, `allowed_causes`, required refs, authority rule, and
  budget rule.
- `RecoveryRouteKind` schema rejects freeform recovery strings.
- A route id string such as `retry`, `revise`, or `connector-failed` cannot
  stand in for `RecoveryRouteKind`.
- WorkContract projection rejects a recovery binding whose `route_id` is not in
  the step's declared `routes`.
- WorkContract projection rejects duplicate bindings for the same
  `step_id + route_id`.
- WorkContract projection rejects `retry_same_step_with_feedback` if the route
  target is not the same step.
- WorkContract projection rejects `retry_same_step_with_feedback` without a
  feedback ref requirement.
- WorkContract projection rejects `unknown_failure` bindings that route to
  retry, verification, or independent review.
- WorkContract projection rejects `safe_apply_reject` without safe-apply or
  runtime diff refs.
- WorkContract projection rejects `generated_surface_drift` recovery without a
  generated-surface evidence requirement.
- WorkContract projection rejects `protected_file_touched` recovery without
  runtime diff or ChangePacket refs.

### Guidance And Trace

- Trace validation rejects `step.completed.route_taken` for a recovery route
  unless a matching `guidance.decision` with `subject: "recovery_route"` appears
  first.
- Trace validation rejects untraced recovery decisions. Runtime fallback,
  report-selected routes, checkpoint-selected routes, and connector failure
  routes all need the same recovery GuidanceDecision.
- Trace validation rejects a recovery GuidanceDecision whose selected route id
  is undeclared.
- Trace validation rejects a recovery GuidanceDecision whose recovery kind does
  not match the WorkContract binding.
- Trace validation rejects recovery without a failure ref.
- Trace validation rejects unknown failure routed to retry.
- Trace validation rejects checkpoint recovery without a later checkpoint
  GuidanceDecision when checkpoint auto-resolution occurs.
- Trace validation rejects proof recovery without a later proof-policy
  GuidanceDecision when proof assessment runs.
- Trace validation rejects SafeApply recovery without safe-apply guidance.

### Runtime

- Relay acceptance criteria failure with `retry-with-feedback` can retry only
  through a declared same-step route with
  `retry_same_step_with_feedback`.
- Relay acceptance criteria failure cannot retry after `max_attempts`.
- Relay connector failure on `connector-failed` must be typed and traced; it
  cannot be treated as successful review or proof.
- Verification failure must choose a declared typed route or stop; it cannot use
  shared priority fallback without WorkContract binding.
- `route_from_report` cannot select an undeclared route.
- `route_from_report` cannot select a recovery route without recovery guidance.
- A non-recovery route to an already completed step remains a cycle failure.
- Recovery route to an already completed step is allowed only when the binding
  and budget allow it.
- Budget exhaustion cannot be bypassed by switching from `retry` to `revise`.
- Unknown failure cannot trigger retry.

### Proof And Close

- Weak proof cannot close write-capable work as complete.
- Contradicted evidence cannot close as complete.
- Report prose cannot create a recovery route without proof or failure refs.
- Report shape cannot satisfy `failure_ref`.
- A worker saying "retry is safe" does not authorize retry.
- `safe_apply_reject` cannot be followed by clean completion without new proof
  and an accepted safe apply.
- Generated-surface drift cannot recover through success prose; it must route to
  verification, reject, checkpoint, stop, or escalation.

### Checkpoint

- `safe_autonomous_choice` cannot parse in the cutover schema.
- `resolution_source: "safe-autonomous"` cannot parse in the cutover trace.
- `auto_resolution.highest-score`, `first-acceptable`, and `accept-as-is` cannot
  resolve a checkpoint without checkpoint guidance.
- A checkpoint selected choice with no route consequence cannot act as recovery.
- Resume fails if the saved checkpoint choice no longer maps to the declared
  recovery route binding.

### Generated Surfaces

- Generated flow manifests include recovery bindings after cutover.
- Generated host docs do not teach "just retry" or "run this route" as an
  untyped recovery action.
- Direct flow commands, if kept, state that recovery still uses the same
  WorkContract, GuidanceDecision, proof, checkpoint, and trace rules.
- Drift checks fail if generated mirrors omit recovery binding data present in
  source flow packages.

### Pursue And SafeApply

- Pursue cannot enable parallel code-writing recovery before SafeApply exists.
- SafeApply rejects mismatched base refs before any retry or apply route.
- File-disjoint apply conflicts cannot be recovered by retry alone; final
  composed verification is required.
- Rejected ChangePackets cannot be converted into completed pursuits without a
  later accepted ChangePacket and proof.

## Anti-Cruft Probes

Run these in the implementation branch. Some should fail until the cutover is
done.

```bash
rg -n "RECOVERY_ROUTE_LABELS|RECOVERY_ROUTE_PRIORITY|recoveryRouteForStep|isRecoveryRoute" \
  src tests docs/pivot/contract-guidance-proof-recovery
```

Expected hard-cut state: helper use is gone from final runtime authority or
wrapped by WorkContract recovery bindings.

```bash
rg -n "retry_with_feedback|retry-with-feedback|retry_same_step_with_feedback" \
  src docs tests generated plugins
```

Expected hard-cut state: acceptance `retry-with-feedback` is mapped to
`retry_same_step_with_feedback`; loose `retry_with_feedback` prose appears only
in migration notes or this normalization rule.

```bash
rg -n "connector-failed|relay_connector_failed|connector failed" \
  src docs tests generated plugins
```

Expected hard-cut state: `connector-failed` may remain as a route id, but any
runtime recovery use has a typed binding and recovery GuidanceDecision.

```bash
rg -n "route_from_report|selected undeclared route|route_taken" \
  src tests docs/pivot/contract-guidance-proof-recovery
```

Expected hard-cut state: dynamic route selection validates declared routes and
requires recovery guidance when selecting a recovery route.

```bash
rg -n "safe_autonomous_choice|safe-autonomous|auto_resolution|highest-score|first-acceptable|accept-as-is" \
  src docs generated plugins tests
```

Expected hard-cut state: old checkpoint auto-resolution is rejected or converted
into declared-default policy plus GuidanceDecision.

```bash
rg -n "weak|unproved|contradicted|ProofAssessment|proof\\.assessed|run\\.closed" \
  src tests docs/pivot/contract-guidance-proof-recovery
```

Expected hard-cut state: weak or contradicted proof cannot close write-capable
work as complete.

## Implementation Order

1. Add `RecoveryRouteKind`, `RecoveryFailureCause`, and
   `RecoveryRouteBindingV0` schema in the WorkContract projection layer.
2. Project current `retry`, `revise`, `ask`, `stop`, `handoff`, `escalate`,
   `checkpoint`, `blocked`, and `connector-failed` routes into typed recovery
   bindings where they are used for recovery.
3. Add projection death tests before changing the graph runner.
4. Add GuidanceDecision schema coverage for `subject: "recovery_route"`.
5. Add trace sequence validation for matching recovery decisions.
6. Replace graph-runner label-based recovery handling with kind-based binding
   checks.
7. Update relay, verification, checkpoint, proof, and SafeApply paths to select
   recovery through GuidanceDecision.
8. Update generated manifests and host surfaces through source files and emit
   scripts.

Do not start with broad runtime changes. Start with projection and tests.

## Still Unsettled

- Exact storage location for `RecoveryRouteBindingV0` in generated flow
  manifests.
- Whether `RecoveryRouteKind` should live in `src/schemas/` or a
  WorkContract-specific schema package after the projection layer exists.
- Whether V0 needs a separate `repair_then_retry` kind. For now, use
  `narrow_scope`, `run_verification`, or `run_independent_review` followed by a
  declared route, instead of adding a vague retry kind.
- Whether Goal's local `retry-selected-flow`, `blocked`, and `checkpoint`
  routes should migrate directly to shared recovery bindings or stay local
  report vocabulary with a projection adapter.
- Exact terminal outcome names for `stop_unsafe`, `handoff`, and `escalate`
  close paths.
- Exact failure refs for SafeApply before the SafeApply spec exists.

## Review Record

Draft pass resolved these medium-or-above risks before completion:

- Route id and recovery kind were separated so current Flow vocabulary remains
  intact.
- Older `retry_with_feedback` wording was normalized to
  `retry_same_step_with_feedback`.
- Unknown failure was blocked from retry.
- `connector-failed` was kept as a route id but denied success semantics.
- Budget behavior was tied to WorkContract and PolicyEnvelope limits.
- Checkpoint and SafeApply recovery were linked back to their own guidance
  decisions instead of using recovery as a bypass.

Final completion requires two clean adversarial reviews with no
medium-or-above findings.
