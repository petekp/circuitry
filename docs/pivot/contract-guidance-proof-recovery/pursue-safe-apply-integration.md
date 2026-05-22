# Pursue SafeApply Integration

Status: implementation-spec direction for the Circuit pivot. This is
future-facing. It does not describe current runtime behavior until the matching
Pursue schemas, runtime paths, tests, generated surfaces, and docs change.

`Pursue SafeApply Integration` is the spec name. In product prose, say Pursue
with safe apply, isolated write branches, proposed changes, or applied changes.

## Purpose

Pursue should keep its current restraint until SafeApply exists:

> Before SafeApply, Pursue code-changing work stays serial.

After SafeApply exists, Pursue may run independent code-changing branches in
parallel only when each branch works in isolation, returns a valid ChangePacket,
and Circuit applies or rejects those proposed changes through SafeApply.

The target rule is:

> Pursue coordinates. Branches propose changes. Circuit applies only the
> proposed changes that pass proof, conflict checks, generated-surface checks,
> and final verification.

This spec defines the Pursue-specific integration. It does not redefine
ChangePacket or SafeApply.

## Source Evidence

| Source | Evidence used |
| --- | --- |
| [Pivot brief](pivot-brief.md) | The doctrine says flows carry work contracts, guidance runs them inside rules, trace records decisions, and safe apply turns edits into inspected proposed changes. See `pivot-brief.md:14-32`. The brief says Pursue already has the right V1 restraint, SafeApply is not Pursue-only, and Circuit must refuse parallel write-capable Pursue branches until SafeApply exists. See `pivot-brief.md:678-732` and `pivot-brief.md:769-810`. |
| [Order of operations](order-of-operations.md) | The order guide says SafeApply should follow proof and trace, and Pursue should use SafeApply only after SafeApply exists. See `order-of-operations.md:200-219`. |
| [WorkContract Projection V0](work-contract-projection-v0.md) | WorkContract projection keeps routes, budgets, relay proof inputs, fanout branch shape, and generated surfaces as contract-owned, while writable branches stay serial until SafeApply. See `work-contract-projection-v0.md:48-73` and `work-contract-projection-v0.md:105-130`. |
| [GuidanceDecision Trace Invariant](guidance-decision-trace-invariant.md) | SafeApply decisions, proof policy, and recovery routes require matching `guidance.decision` entries. See `guidance-decision-trace-invariant.md:66-107`, `guidance-decision-trace-invariant.md:270-330`, and `guidance-decision-trace-invariant.md:336-360`. |
| [PolicyEnvelope Config V2 Cutover](policy-envelope-config-v2-cutover.md) | Rules and limits are hard; preferences rank allowed options; defaults fill blanks; overrides cannot loosen hard rules. See `policy-envelope-config-v2-cutover.md:245-265` and `policy-envelope-config-v2-cutover.md:337-371`. |
| [CheckpointBoundary Authority](checkpoint-boundary-authority.md) | Protected files, unsafe apply, proof weakness, and policy boundaries must route through declared checkpoint choices and traced resolution. See `checkpoint-boundary-authority.md:1-32`, `checkpoint-boundary-authority.md:340-352`, and `checkpoint-boundary-authority.md:477-497`. |
| [ProofAssessment And Evidence Adapter](proof-assessment-evidence-adapter.md) | Runtime diff evidence, generated-surface evidence, and write-capable close rules feed proof checks. Agent prose and report shape are not proof. See `proof-assessment-evidence-adapter.md:1-31`, `proof-assessment-evidence-adapter.md:420-456`, and `proof-assessment-evidence-adapter.md:575-595`. |
| [RecoveryRouteKind](recovery-route-kind.md) | A route says where the run can go; typed recovery says why the route is allowed. Safe-apply rejects, weak proof, conflicts, and unsafe stops have typed recovery rules. See `recovery-route-kind.md:1-32`, `recovery-route-kind.md:615-640`, and `recovery-route-kind.md:854-862`. |
| [ChangePacket And SafeApply](change-packet-safe-apply.md) | Agents propose changes, Circuit checks and applies or rejects them. Pursue remains serial until SafeApply exists, and after SafeApply each writer must use an isolated root, return a valid ChangePacket, pass generated-surface/protected-file/proof checks, and pass final verification. See `change-packet-safe-apply.md:1-42`, `change-packet-safe-apply.md:64-118`, `change-packet-safe-apply.md:120-220`, and `change-packet-safe-apply.md:468-620`. |
| [Generated Host Surface Reframing](generated-host-surface-reframing.md) | Generated outputs remain generated data, generated maps and mirrors must stay in sync, and host copy must not promise behavior before runtime can back it. See `generated-host-surface-reframing.md:1-24`, `generated-host-surface-reframing.md:196-226`, and `generated-host-surface-reframing.md:400-410`. |
| [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md) | Use Circuit vocabulary: Flow, Schematic, Block, Stage, Step, Run, Checkpoint, Trace, Report, Evidence, Run folder, Route, Relay, Connector, and Plugin. See `UBIQUITOUS_LANGUAGE.md:1-35` and `UBIQUITOUS_LANGUAGE.md:221-236`. |
| [Pursue docs](../../flows/pursue.md) | Current Pursue is not a free-for-all mode; it serializes code-changing work, keeps read-only discovery separate, treats estimated touch sets as useful but not proof, and says future parallel apply belongs behind runtime-owned safe apply. See `docs/flows/pursue.md:22-67`, `docs/flows/pursue.md:160-215`, and `docs/flows/pursue.md:257-274`. |
| [Pursue current schemas](../../../src/flows/pursue/reports.ts) | Current report schemas require `code_writes: "serial-only"`, `parallel_write_status: "blocked-until-safe-apply"`, serial code-change waves, `serialized_execution: true`, and `serial_code_writes: true`; complete results require passed verification, clean review, and exact counts. See `src/flows/pursue/reports.ts:57-70`, `src/flows/pursue/reports.ts:188-300`, and `src/flows/pursue/reports.ts:390-445`. |
| [Pursue writers](../../../src/flows/pursue/writers/contract-projection.ts) | Current contract projection sets serial-only write policy, marks parallel writes blocked until safe apply, and records generated outputs in estimated touch sets. Graph and wave-plan writers preserve serial code writes. See `src/flows/pursue/writers/contract-projection.ts:40-110`, `src/flows/pursue/writers/graph.ts:1-87`, and `src/flows/pursue/writers/wave-plan.ts:1-42`. |
| [Pursue flow data](../../../src/flows/pursue/data.ts) | Current Pursue flow routes through contract, graph, wave plan, serialized batch relay, verification, review, and close. See `src/flows/pursue/data.ts:46-120`, `src/flows/pursue/data.ts:215-340`. |
| [Pursue relay hints](../../../src/flows/pursue/relay-hints.ts) | Current batch relay hint tells workers to execute code-changing work serially, avoid parallel code-writing agents, keep estimated and actual touch sets separate, and block rather than guess. See `src/flows/pursue/relay-hints.ts:1-24`. |
| [Pursue tests](../../../tests/runner/pursue-runtime-wiring.test.ts) | Current runtime test proves Pursue runs contract, graph, wave plan, batch, verification, review, and close; it asserts serial code-change waves, `serialized_execution: true`, clean review, and `serial_code_writes: true`. See `tests/runner/pursue-runtime-wiring.test.ts:132-211`. |
| [Pursue schema tests](../../../tests/contracts/pursue-report-schemas.test.ts) | Current schema tests accept serial reports, reject parallel code-change waves, reject complete results with failed verification or skipped work, and reject incomplete batch coverage. See `tests/contracts/pursue-report-schemas.test.ts:120-215`, `tests/contracts/pursue-report-schemas.test.ts:248-275`, `tests/contracts/pursue-report-schemas.test.ts:390-445`, and `tests/contracts/pursue-report-schemas.test.ts:480-590`. |
| [Fanout runtime](../../../src/runtime/executors/fanout.ts) | Current fanout serializes writable relay branches because they share the parent checkout, supports sub-run worktrees, collects changed files for `disjoint-merge`, and writes fanout trace entries. See `src/runtime/executors/fanout.ts:1-110` and `src/runtime/executors/fanout.ts:170-330`. |
| [Worktree and join policy](../../../src/runtime/fanout/worktree.ts) | Current worktree support adds/removes git worktrees and lists changed files; current join policy only checks admission, changed-file discovery, and file overlap. See `src/runtime/fanout/worktree.ts:1-41` and `src/shared/fanout-join-policy.ts:1-115`. |
| [Fanout tests](../../../tests/runtime/fanout.test.ts) | Current tests prove worktree cleanup, changed-file conflict rejection, changed-file discovery failure, writable relay branch serialization, and rejection of relay `disjoint-merge`. See `tests/runtime/fanout.test.ts:813-895`, `tests/runtime/fanout.test.ts:1153-1240`, `tests/runtime/fanout.test.ts:1511-1600`, and `tests/runtime/fanout.test.ts:1634-1678`. |
| [Generated surfaces](../../generated-surfaces.md) | Generated flow manifests and host mirrors are source-owned and drift-checked; Pursue is public but has no command source or host command today. See `docs/generated-surfaces.md:1-70`. |
| [Pursue commandless tests](../../../tests/runner/flow-definition-compiler.test.ts) | Current tests assert Pursue has no direct Claude command, Codex command, or Codex skill, and that its runtime/command ownership stays as expected. See `tests/runner/flow-definition-compiler.test.ts:351-358` and `tests/runner/flow-definition-compiler.test.ts:490-508`. |
| [Sandboxed parallel Pursue idea](../../ideas/sandboxed-parallel-pursuits.md) | The older idea doc says parallel pursuit should be runtime-owned, not prompt-only; branches work in isolated roots; Circuit applies verified packets to the parent; and existing `disjoint-merge` is not enough because it does not collect packets, apply, and verify the composed checkout. See `docs/ideas/sandboxed-parallel-pursuits.md:1-30`, `docs/ideas/sandboxed-parallel-pursuits.md:34-60`, `docs/ideas/sandboxed-parallel-pursuits.md:83-99`, and `docs/ideas/sandboxed-parallel-pursuits.md:156-188`. |

## Plain Terms

Use the formal names in schemas, tests, trace validators, and implementation
specs. Use the plain words in operator-facing text.

| Formal name | Plain wording |
| --- | --- |
| `ChangePacket` | proposed change |
| `SafeApply` | safe apply, check and apply path |
| `PursuitSafeApplyReport` | apply report |
| `parallel-isolated-safe-apply` | isolated parallel write path |
| `runtime_touched_files` | files Circuit saw change |
| `final_verification_ref` | final verification proof |
| `generated_surface_evidence` | generated-surface proof |

## Boundary Rule

Pursue owns coordination. SafeApply owns applying changes.

| Object | Owns | Must not own |
| --- | --- | --- |
| Pursue | Naming pursuits, estimating touch sets, grouping work, deciding serial vs candidate parallel branches, reporting applied/rejected/blocked pursuit outcomes. | Applying branch patches, trusting estimated touch sets as proof, or closing rejected packets as complete. |
| WorkContract | Allowed write scope, recovery routes, proof requirements, checkpoint boundaries, SafeApply requirements. | Final branch apply approval. |
| PolicyEnvelope | Hard limits such as max branches, dirty-parent rules, protected-file rules, generated-surface rules, and budgets. | Loosening WorkContract limits or final apply approval by preference. |
| GuidanceDecision | Recorded decisions for branch execution, proof policy, safe apply, and recovery. | Undeclared routes, skipped proof, or hidden parallel-write permission. |
| ChangePacket | Proposed change from an isolated branch, with refs, hashes, runtime touched files, claims, evidence, proof, risks, and recommendation. | Permission to mutate the parent checkout by itself. |
| SafeApply | Accept/reject/apply path, conflict checks, protected-file checks, generated-surface checks, final verification, and apply result. | Pursue-only behavior or prompt-only safety. |

## Current State Versus Target

| Area | Current repo evidence | Target rule |
| --- | --- | --- |
| Pursue write policy | Current docs and schemas require serial code writes. See `docs/flows/pursue.md:43-67` and `src/flows/pursue/reports.ts:57-70`. | Keep serial writes until SafeApply exists. |
| Estimated touch sets | Pursue records estimated touch sets, including generated outputs. See `docs/flows/pursue.md:78-89` and `src/flows/pursue/writers/contract-projection.ts:40-57`. | Estimated touch sets are planning inputs. Runtime touched files from ChangePacket decide proof and apply safety. |
| Wave plan | Current wave plan allows read-only parallel waves and forces code-change waves to serial. See `src/flows/pursue/reports.ts:188-218` and `src/flows/pursue/writers/wave-plan.ts:18-40`. | Parallel code-change waves require SafeApply gates and isolated roots. |
| Batch report | Current batch report requires `serialized_execution: true`. See `src/flows/pursue/reports.ts:220-300`. | Do not overload this V1 serial batch shape for parallel apply. Add a separate apply report or report version. |
| Result report | Current result requires `serial_code_writes: true` and complete results require passed verification, clean review, and exact counts. See `src/flows/pursue/reports.ts:390-445`. | Add write-execution and packet counts when SafeApply is active. Rejected or blocked required packets prevent `complete`. |
| Fanout | Current fanout serializes writable relay branches and only allows `disjoint-merge` for sub-runs with worktrees. See `src/runtime/executors/fanout.ts:63-95`, `src/runtime/executors/fanout.ts:170-183`, and `tests/runtime/fanout.test.ts:1511-1678`. | Isolated write branches need ChangePackets and SafeApply, not only `disjoint-merge`. |
| Worktrees | Current worktree runner can add, remove, and list changed files. See `src/runtime/fanout/worktree.ts:1-41`. | Worktree branches must also produce patch refs, hashes, proof refs, generated-surface status, and SafeApply results. |
| Generated surfaces | Pursue has generated flow manifests but no host command today. See `docs/generated-surfaces.md:44-65` and `tests/runner/flow-definition-compiler.test.ts:351-358`. | Keep Pursue commandless unless a separate surface decision adds one. Generated manifests must mirror any new reports or WorkContract projection. |

## Pre-SafeApply Behavior

Until SafeApply is implemented and enabled:

- Pursue keeps `execution_policy.code_writes: "serial-only"`.
- Pursue keeps `parallel_write_status: "blocked-until-safe-apply"`.
- Code-change waves must execute `serial`.
- Batch reports must keep `serialized_execution: true`.
- Result reports must keep `serial_code_writes: true`.
- Read-only discovery may be identified as parallel-safe in reports, but that
  does not permit parallel write branches.
- If a worker says it needs parallel code writes, Pursue marks that pursuit
  blocked instead of guessing.

Any implementation that changes those rules before SafeApply gates exist is a
regression.

## SafeApply Entry Gates

Pursue may enter the isolated parallel write path only when every gate passes.

### Gate 1: Feature And Contract

- SafeApply runtime is enabled for the run.
- WorkContract allows `code_writes: "parallel-isolated-safe-apply"` or an
  equivalent explicit write policy.
- WorkContract declares branch write scope, required proof, recovery routes,
  checkpoint boundaries, and close rules.
- WorkContract declares generated-surface requirements when generated outputs
  might be touched.

If any item is missing, Pursue stays serial.

### Gate 2: Policy

PolicyEnvelope must allow:

- maximum parallel write branch count;
- isolated write root kind, initially `isolated_worktree`;
- dirty-parent policy;
- protected-file behavior;
- generated-surface behavior;
- required independent review, if risk or policy requires it;
- final verification requirements.

Policy may tighten WorkContract limits. It may not loosen them.

### Gate 3: Branch Plan

Pursue must produce a branch plan from the pursuit graph and wave plan.

Each candidate branch must include:

- pursuit id;
- branch id;
- source pursuit contract ref;
- estimated touch set;
- expected generated outputs;
- risk;
- required claims;
- required verification commands;
- allowed recovery routes;
- chosen child flow or relay kind;
- proof policy ref;
- expected ChangePacket ref location.

Branches with unclear scope, overlapping estimated high-risk files, protected
files that require operator authority, or missing proof policy stay serial or
route to checkpoint. They do not enter parallel apply by default.

### Gate 4: Guidance

Before branch work starts, Circuit records GuidanceDecision entries for:

- branch relay or child-flow execution;
- proof policy;
- any checkpoint resolution;
- any recovery route;
- safe-apply accept, reject, or apply.

The selected branch plan, proof policy, and SafeApply action must match the
recorded decisions.

### Gate 5: Isolation

Each write branch must run outside the parent checkout.

V0 target:

- `work_root_kind: "isolated_worktree"`;
- same base ref and tree hash for every branch in the group;
- parent checkout untouched before SafeApply;
- branch cleanup recorded even when a branch fails.

`parent_checkout_diff_capture` and `pre_safe_apply_trusted_write` are transition
write modes from the SafeApply spec. They do not unlock parallel Pursue writes.

### Gate 6: ChangePacket

Each completed branch must return a valid ChangePacket.

The packet must include:

- packet id;
- pursuit id and branch id;
- base ref and tree hash;
- parent dirty-state policy result;
- patch ref and hash;
- runtime-computed touched files;
- claims and evidence refs;
- proof assessment refs;
- generated-surface status;
- protected-file decision;
- risks;
- apply recommendation.

Worker-declared files are not enough. Circuit computes the touched files.

### Gate 7: SafeApply

SafeApply must reject before parent mutation when:

- base ref or tree hash does not match;
- parent checkout is dirty and policy does not allow it;
- patch hash does not match;
- patch does not apply;
- runtime touched files differ from the worker claim in an unsafe way;
- protected files lack policy or checkpoint authority;
- generated surfaces are touched without generated-surface evidence;
- required proof is weak, contradicted, or unproved;
- final verification is missing or failed.

### Gate 8: Final Verification

Pursue parallel apply must run final verification on the composed result.

Preferred V0 path:

1. apply accepted packets to a compose root;
2. run final verification there;
3. apply the verified composed patch to the parent checkout;
4. prove the parent has no partial mutation.

If implementation applies to the parent before final verification, it must prove
rollback or route to `stop_unsafe` when rollback cannot be proven.

## Target Report Shape

Do not overload `pursuit.batch@v1`, which is explicitly serial. Add a new report
or a new version.

Proposed report name:

```text
pursuit.safe_apply@v1
```

Required shape:

```ts
type PursuitSafeApplyReportV0 = {
  schema_version: 1;
  mode: "parallel-isolated-safe-apply";

  base: {
    ref: string;
    tree_hash: string;
    dirty_parent_state: "clean" | "dirty_allowed" | "dirty_rejected";
    policy_ref: Ref;
  };

  branch_plan_ref: Ref;
  proof_policy_decision_ref: Ref;

  packets: Array<{
    pursuit_id: string;
    branch_id: string;
    change_packet_ref?: Ref;
    status:
      | "applied"
      | "rejected"
      | "blocked"
      | "failed_before_packet"
      | "serial_fallback";
    safe_apply_decision_ref?: Ref;
    safe_apply_result_ref?: Ref;
    proof_assessment_refs: Ref[];
    final_verification_ref?: Ref;
    recovery_route_ref?: Ref;
    reason_codes: string[];
  }>;

  applied_order: string[];

  counts: {
    applied: number;
    rejected: number;
    blocked: number;
    failed_before_packet: number;
    serial_fallback: number;
  };

  touch_set_reconciliation: Array<{
    pursuit_id: string;
    estimated_touch_set_ref: Ref;
    runtime_touched_files_ref?: Ref;
    generated_surface_status:
      | "not_touched"
      | "synced"
      | "drift_detected"
      | "unknown";
    scope_status: "inside_estimate" | "expanded" | "unknown";
  }>;

  generated_surfaces: {
    status: "not_touched" | "synced" | "drift_detected" | "unknown";
    source_refs: Ref[];
    output_refs: Ref[];
    drift_check_ref?: Ref;
  };

  final_verification: {
    status: "passed" | "failed" | "skipped";
    ref?: Ref;
  };
};
```

Plain rule:

> A pursuit is complete only when its required packet is applied and its proof
> passes. Rejected packets are not completed work.

## Pursue Result Changes

Current `pursuit.result@v1` has `serial_code_writes: true`. That should remain
for pre-SafeApply Pursue.

When the parallel SafeApply path ships, use either `pursuit.result@v2` or a
strictly versioned extension. The target result needs:

- `write_execution: "serial" | "parallel-isolated-safe-apply"`;
- `safe_apply_report_ref` when `write_execution` is parallel;
- applied packet count;
- rejected packet count;
- blocked packet count;
- serial fallback count;
- final verification ref;
- generated-surface proof refs when generated outputs were touched.

Completion rule:

`outcome: "complete"` is allowed only when:

1. every required pursuit is accounted for;
2. every required parallel pursuit has `status: "applied"`;
3. rejected, blocked, and failed-before-packet counts are zero for required
   pursuits;
4. all required claims are proven;
5. final verification passed;
6. generated surfaces are synced or not touched;
7. independent review is clean when required;
8. SafeApply results prove no partial parent mutation.

Optional pursuits are unsettled. Until WorkContract defines optional pursuit
semantics, treat every pursuit in the contract as required.

## Touch-Set Reconciliation

Pursue has three touch-set layers:

1. estimated touch set from the contract;
2. worker claim from the branch or packet;
3. runtime touched files from ChangePacket and SafeApply.

Only the third layer is proof.

Rules:

- Estimated touch sets guide branch grouping. They do not prove isolation.
- Worker claims are inputs. They do not prove touched files.
- Runtime touched files override worker claims.
- Generated outputs must be tracked separately from ordinary source files.
- A runtime touch outside the estimate is `scope_status: "expanded"`.
- Expanded scope routes to checkpoint, narrow scope, independent review, or
  SafeApply reject unless WorkContract and policy allow it.
- File-disjoint runtime touched files are not enough. Circuit must still run
  final verification on the composed result.
- Missing runtime touched files block apply. Circuit does not infer touched files
  from report prose.

## Applied, Rejected, And Blocked Packets

Use these meanings exactly:

| Status | Meaning | Counts as completed pursuit? |
| --- | --- | --- |
| `applied` | Packet passed SafeApply and final verification includes it. | Yes, if required claims are proven. |
| `rejected` | Packet exists but SafeApply rejected it. | No. |
| `blocked` | Pursuit could not produce an allowed packet or needed authority. | No. |
| `failed_before_packet` | Branch failed before producing a valid packet. | No. |
| `serial_fallback` | Pursuit was removed from parallel apply and handled through the serial path. | Only if the serial path later proves completion. |

Rejected and blocked packets must stay visible in the final Pursue result. They
must not disappear into a vague "partial" summary.

## Recovery Behavior

Pursue uses declared recovery routes. It must not invent a recovery path because
parallelism failed.

| Failure | Required behavior |
| --- | --- |
| Branch cannot produce a ChangePacket | Retry within budget, fall back to serial, checkpoint, or stop. |
| ChangePacket schema invalid | `safe_apply_reject` or retry with feedback if budget allows. |
| Base ref or tree hash mismatch | Reject before parent mutation and route through `safe_apply_reject`. |
| Dirty parent not allowed | Reject before parent mutation or checkpoint if WorkContract declares that boundary. |
| Runtime touched files missing | Reject; worker claim cannot replace runtime diff. |
| Runtime touched files exceed estimate | Checkpoint, narrow scope, independent review, or reject depending on policy and contract. |
| Protected file touched | Checkpoint or reject unless policy explicitly allows it. |
| Generated-surface drift | Run generated-surface sync/verification, reject, checkpoint, or stop. |
| Packet proof weak or unproved | Run verification, independent review, retry, narrow scope, checkpoint, or reject. |
| Packet evidence contradicted | Reject or stop unsafe. |
| Patch conflict | Reject before parent mutation. |
| Final composed verification fails | Reject the composed apply or roll back; cannot close complete. |
| Repeated unknown failure | Escalate, hand off, or stop unsafe. |

No recovery route may bypass max attempts, proof requirements, policy limits, or
SafeApply trace matching.

## Generated-Surface Handling

If any branch touches generated outputs:

- the branch ChangePacket must mark those paths as generated surfaces;
- the packet must include source refs and output refs;
- generated-surface evidence must include the drift-check command ref;
- `generated_surfaces.status === "unknown"` blocks apply;
- `generated_surfaces.status === "drift_detected"` blocks complete unless a
  declared recovery route runs sync/verification and produces passing evidence;
- hand edits to generated mirrors without source refs are rejected unless the
  WorkContract explicitly allows maintenance of generated outputs.

For this repo, generated-surface verification includes `npm run check-flow-drift`
or the narrower emit check when the implementation slice declares it.

## Implementation Order

1. Keep current Pursue serial-write behavior and tests.
2. Add a versioned Pursue SafeApply report schema and schema death tests.
3. Add branch-plan report support without enabling parallel writes.
4. Add ChangePacket collection for isolated write branches.
5. Add SafeApply result aggregation for Pursue.
6. Add touch-set reconciliation from estimated, worker-claimed, and runtime
   touched files.
7. Add generated-surface evidence handling.
8. Add final composed verification.
9. Add Pursue result v2 or versioned extension with applied/rejected/blocked
   packet counts.
10. Only then allow `code_writes: "parallel-isolated-safe-apply"` behind
    WorkContract and PolicyEnvelope gates.
11. Regenerate manifests and run generated-surface drift checks.

Do not start by enabling parallel code-changing waves.

## Death Tests

### Pre-SafeApply Death Tests

| Death test | Likely test file |
| --- | --- |
| `pursuit.contract@v1` rejects anything except `code_writes: "serial-only"`. | `tests/contracts/pursue-report-schemas.test.ts` |
| `pursuit.wave-plan@v1` rejects premature parallel code-change waves, including `kind: "code-change"` with `execution: "parallel"`. | existing `tests/contracts/pursue-report-schemas.test.ts` |
| `pursuit.batch@v1` rejects `serialized_execution: false`. | `tests/contracts/pursue-report-schemas.test.ts` |
| `pursuit.result@v1` rejects `serial_code_writes: false`. | `tests/contracts/pursue-report-schemas.test.ts` |
| Pursue runtime keeps code-changing execution serial before SafeApply. | `tests/runner/pursue-runtime-wiring.test.ts` |
| Writable relay fanout remains serialized without branch-local write roots. | existing `tests/runtime/fanout.test.ts` |
| Direct or classified Pursue cannot enable parallel writes with `--autonomous`. | `tests/runner/cli-router.test.ts` |

### SafeApply Entry Death Tests

| Death test | Likely test file |
| --- | --- |
| Parallel write branch fails when SafeApply feature gate is off. | `tests/runner/pursue-safe-apply.test.ts` |
| Parallel write branch fails when WorkContract does not allow isolated parallel apply. | `tests/runner/pursue-safe-apply.test.ts` |
| Parallel write branch fails when policy max branch count is exceeded. | `tests/runtime/policy-envelope.test.ts` |
| Parallel write branch fails when proof policy guidance is missing. | `tests/contracts/runtrace-sequence.test.ts` |
| Parallel write branch fails when safe-apply guidance is missing. | `tests/contracts/runtrace-sequence.test.ts` |
| Parallel write branch using parent checkout diff capture is rejected for Pursue. | `tests/runner/pursue-safe-apply.test.ts` |
| Pre-SafeApply trusted write cannot unlock parallel Pursue. | `tests/runner/pursue-safe-apply.test.ts` |

### ChangePacket And SafeApply Death Tests

| Death test | Likely test file |
| --- | --- |
| Missing ChangePacket rejects the branch. | `tests/runner/pursue-safe-apply.test.ts` |
| Missing base ref or tree hash rejects the packet. | `tests/contracts/change-packet-schema.test.ts` |
| Base ref mismatch rejects before parent mutation. | `tests/runtime/safe-apply.test.ts` |
| Dirty parent checkout rejects unless policy allows it and baseline evidence exists. | `tests/runtime/safe-apply.test.ts` |
| Worker touched files cannot replace runtime touched files. | `tests/runtime/safe-apply.test.ts` |
| Packet with weak, contradicted, or unproved required claims is rejected. | `tests/runtime/safe-apply.test.ts` |
| Protected-file touch without policy or checkpoint authority is rejected. | `tests/runtime/safe-apply.test.ts` |
| Generated-surface touch without source refs, output refs, and drift-check evidence is rejected. | `tests/runtime/safe-apply-generated-surfaces.test.ts` |
| Patch conflict rejects before parent mutation. | `tests/runtime/safe-apply.test.ts` |
| File-disjoint packets still require final composed verification. | `tests/runtime/safe-apply.test.ts` |

### Pursue Reporting Death Tests

| Death test | Likely test file |
| --- | --- |
| Rejected ChangePacket does not count as completed pursuit. | `tests/runner/pursue-safe-apply.test.ts` |
| Blocked branch does not count as completed pursuit. | `tests/runner/pursue-safe-apply.test.ts` |
| Missing packet for required pursuit prevents complete result. | `tests/runner/pursue-safe-apply.test.ts` |
| Final Pursue result reports applied, rejected, blocked, failed-before-packet, and serial-fallback counts. | `tests/contracts/pursue-report-schemas.test.ts` |
| Complete Pursue result rejects rejected or blocked required packets. | `tests/contracts/pursue-report-schemas.test.ts` |
| Complete Pursue result rejects missing final verification ref. | `tests/contracts/pursue-report-schemas.test.ts` |
| Complete Pursue result rejects generated-surface drift. | `tests/contracts/pursue-report-schemas.test.ts` |
| Incomplete batch or packet coverage fails close. | existing `tests/contracts/pursue-report-schemas.test.ts` plus new SafeApply case |

### Fanout And Worktree Death Tests

| Death test | Likely test file |
| --- | --- |
| Sub-run worktree branch produces packet refs and hashes before SafeApply. | `tests/runtime/fanout-safe-apply.test.ts` |
| Parent checkout remains untouched before SafeApply. | `tests/runtime/fanout-safe-apply.test.ts` |
| Worktree cleanup still runs on branch failure, packet rejection, and apply conflict. | `tests/runtime/fanout-safe-apply.test.ts` |
| Current `disjoint-merge` alone cannot enable Pursue parallel apply. | `tests/runtime/fanout-safe-apply.test.ts` |
| Changed-file discovery failure blocks apply. | existing `tests/runtime/fanout.test.ts` plus SafeApply case |
| Overlapping runtime touched files reject before apply. | `tests/runtime/fanout-safe-apply.test.ts` |

### Trace And Recovery Death Tests

| Death test | Likely test file |
| --- | --- |
| Every SafeApply accept/reject/apply has matching prior `guidance.decision`. | `tests/contracts/runtrace-sequence.test.ts` |
| Every recovery route after packet rejection has matching recovery guidance. | `tests/contracts/runtrace-sequence.test.ts` |
| Recovery route not declared by WorkContract fails. | `tests/runtime/guidance-route-invariant.test.ts` |
| Packet rejection cannot route directly to complete. | `tests/runtime/recovery-route-kind.test.ts` |
| Final verification failure cannot close as complete. | `tests/runtime/proof-closure.test.ts` |

### Generated-Surface Death Tests

| Death test | Likely test or command |
| --- | --- |
| Generated Pursue manifests include new SafeApply report declarations once enabled. | `tests/generated/generated-contract-manifests.test.ts` |
| Host generated surfaces do not claim Pursue parallel writes before runtime support. | `tests/generated/generated-surface-framing.test.ts` |
| Pursue remains commandless unless a separate surface spec changes it. | existing `tests/runner/flow-definition-compiler.test.ts` |
| Generated mirrors stay drift-checked after schema/report changes. | `npm run check-flow-drift` |

## Anti-Cruft Probes

Run these during implementation. Some should fail until the cutover lands.

```bash
rg -n "parallel.*code|parallel.*write|code_writes|serial-only|blocked-until-safe-apply|parallel-isolated" \
  docs src tests generated plugins
```

Expected hard-cut state: any parallel write wording is paired with SafeApply,
ChangePacket, WorkContract, PolicyEnvelope, proof, and final verification gates.

```bash
rg -n "serialized_execution|serial_code_writes|pursuit.safe_apply|pursuit.parallel_apply|ChangePacket|SafeApply" \
  src/flows/pursue tests/runner tests/contracts docs/pivot/contract-guidance-proof-recovery
```

Expected hard-cut state: V1 serial reports remain strict, and any new parallel
path uses explicit SafeApply reports and packet counts.

```bash
rg -n "disjoint-merge|changedFiles|worktree|partial_mutation|base_mismatch|dirty_parent" \
  src/runtime tests/runtime docs/pivot/contract-guidance-proof-recovery
```

Expected hard-cut state: file-disjoint checks are treated as prechecks, not proof
of safe apply.

```bash
rg -n "generated_surface|generated surface|check-flow-drift|emit\\.ts --check" \
  src tests docs generated plugins
```

Expected hard-cut state: generated-surface changes in Pursue packets require
source refs, output refs, and command-backed drift evidence.

## Verification Plan

For this docs-only spec:

1. Check Markdown links.
2. Check source line citations.
3. Run `git diff --check`.
4. Run `npm run check-flow-drift`.
5. Run focused Pursue and fanout tests:

   ```bash
   npm run test -- \
     tests/contracts/pursue-report-schemas.test.ts \
     tests/runner/pursue-runtime-wiring.test.ts \
     tests/runtime/fanout.test.ts \
     tests/runner/flow-definition-compiler.test.ts
   ```

For implementation slices, also run:

- `tests/runtime/safe-apply.test.ts`;
- `tests/runtime/safe-apply-generated-surfaces.test.ts`;
- new Pursue SafeApply tests;
- full `npm run verify`.

## Still Unsettled

- Exact report name: `pursuit.safe_apply@v1`, `pursuit.parallel_apply@v1`, or
  `pursuit.apply@v1`.
- Whether Pursue result changes use `pursuit.result@v2` or a strict extension.
- Whether final verification runs in a compose root first, then parent, or
  directly in the parent with rollback proof.
- Exact semantics for optional pursuits. Until defined, all pursuit items are
  required.
- Whether branch work uses child Build/Fix flows, relay branches, or both.
- Whether ChangePackets are produced by workers, runtime wrappers, or both.
- Exact PolicyEnvelope names for max parallel branch count and dirty-parent
  allowance.
- Exact generated manifest shape for new Pursue SafeApply reports.
- Whether Pursue ever gets a direct host command. This spec does not add one.

## Review Checklist

Before implementing this spec, attack these risks:

- Parallel write wording appears without SafeApply gates.
- Current serial Pursue behavior is weakened before replacement tests exist.
- Estimated touch sets are treated as proof.
- Rejected packets disappear from final reporting.
- Weak proof or missing final verification can still close complete.
- Generated-surface drift can be waved through by report prose.
- A dirty parent checkout can receive packets without explicit policy and
  baseline evidence.
- File-disjoint branches skip final composed verification.
- Recovery routes after rejected packets are freeform or untraced.
