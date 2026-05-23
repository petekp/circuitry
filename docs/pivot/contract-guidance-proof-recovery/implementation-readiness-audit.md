# Implementation Readiness Audit

Status: historical cross-spec audit for the first implementation slice of the
contract, guidance, proof, and recovery pivot. The "current repo evidence"
section below records the repo state at audit time; some of those facts have
changed on the pivot branch as foundation slices landed.

Date: 2026-05-21

## Verdict

The spec set is ready to start the first narrow implementation slice.

It is not ready for a broad runtime cutover. The safest next move is a
schema-and-test foundation:

1. define the shared `Ref` shape;
2. add `WorkContractProjectionV0` schema and projection tests;
3. add the first `guidance.decision` schema tests that depend on those refs;
4. do not change relay, checkpoint, config, generated host copy, proof close, or
   SafeApply behavior yet.

This keeps the order guide intact: WorkContract comes first, but the shared ref
shape must be settled at the same time because WorkContract, GuidanceDecision,
ProofAssessment, ChangePacket, and MemoryInput all point at the same evidence,
contract, policy, and trace records.

No critical or high spec-readiness blockers remain after this audit. Medium gaps
found during the audit are resolved below into concrete first-slice gates or
docs fixes.

## Progress Since This Audit

On the pivot foundation branch, the first narrow slices have started landing.
The repo now has shared `Ref` handling, WorkContract projection artifacts,
`guidance.decision` trace support, PolicyEnvelope v2 projection, CheckpointBoundary
projection, ProofAssessment and Evidence schemas, RecoveryRouteKind,
ChangePacket schema, Pursue SafeApply reporting, MemoryInput hints, and
generated host surface framing tests. The SafeApply foundation also has a
runtime touched-file adapter that projects before/after git-state snapshots
into the runtime-observed files a ChangePacket must use, plus relay write-mode
classification that marks current write-capable built-ins as
`pre_safe_apply_trusted_write`. SafeApply remains schema/trace boundary work for
now; runtime reject/apply helpers are future implementation slices.
RunTrace sequence validation now blocks clean complete closes when a proof
policy requires proven claims but no passing ProofAssessment is present, and
when SafeApply was selected but no passing final-verified SafeApply result was
recorded.

Those changes do not mean the broad runtime cutover is done. These items remain
future work unless a later implementation slice explicitly completes them:

- config v2 as the runtime config path;
- removal of old selection as final relay authority;
- checkpoint execution without old safe-autonomous and auto-resolution paths;
- runtime SafeApply with isolated proposed changes;
- Pursue parallel code-changing branches after SafeApply exists.

## Evidence Checked

Core pivot docs:

- The pivot doctrine says Flow carries the work contract, guidance records
  important choices, proof checks evidence, and safe apply turns edits into
  inspected proposed changes. See [pivot-brief.md](pivot-brief.md#L14).
- The first readiness gates are WorkContract Projection V0, GuidanceDecision
  Trace Invariant, and PolicyEnvelope Config V2 Cutover. See
  [pivot-brief.md](pivot-brief.md#L812) and
  [order-of-operations.md](order-of-operations.md#L55).
- The order guide says not to start by rewriting generated copy, deleting
  selection fields, or building SafeApply. See
  [order-of-operations.md](order-of-operations.md#L6) and
  [order-of-operations.md](order-of-operations.md#L220).
- The pivot README keeps these docs canonical but future-facing. See
  [README.md](README.md#L3) and [README.md](README.md#L87).

Implementation specs:

- WorkContract Projection V0 uses three buckets: `work_contract`,
  `guidance_seed`, and `rejected_authority`. See
  [work-contract-projection-v0.md](work-contract-projection-v0.md#L7).
- GuidanceDecision defines the target trace entry, shared refs, matching rules,
  and sequence checks. See
  [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#L66)
  and
  [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#L128).
- PolicyEnvelope replaces selection-centered config authority with rules, limits,
  preferences, and defaults. See
  [policy-envelope-config-v2-cutover.md](policy-envelope-config-v2-cutover.md#L10)
  and
  [policy-envelope-config-v2-cutover.md](policy-envelope-config-v2-cutover.md#L134).
- CheckpointBoundary replaces hidden automatic checkpoint paths with declared
  defaults, operator choice, or traced policy decisions. See
  [checkpoint-boundary-authority.md](checkpoint-boundary-authority.md#L10) and
  [checkpoint-boundary-authority.md](checkpoint-boundary-authority.md#L138).
- ProofAssessment says agent prose and report shape are not proof. See
  [proof-assessment-evidence-adapter.md](proof-assessment-evidence-adapter.md#L10)
  and
  [proof-assessment-evidence-adapter.md](proof-assessment-evidence-adapter.md#L575).
- RecoveryRouteKind separates route ids from typed recovery meaning. See
  [recovery-route-kind.md](recovery-route-kind.md#L7),
  [recovery-route-kind.md](recovery-route-kind.md#L134), and
  [recovery-route-kind.md](recovery-route-kind.md#L242).
- ChangePacket and SafeApply say agents propose changes and Circuit checks,
  applies, or rejects them. See
  [change-packet-safe-apply.md](change-packet-safe-apply.md#L1),
  [change-packet-safe-apply.md](change-packet-safe-apply.md#L120), and
  [change-packet-safe-apply.md](change-packet-safe-apply.md#L313).
- Generated Host Surface Reframing keeps direct flow controls as expert
  controls, not bypasses. See
  [generated-host-surface-reframing.md](generated-host-surface-reframing.md#L10)
  and
  [generated-host-surface-reframing.md](generated-host-surface-reframing.md#L107).
- Pursue SafeApply Integration keeps code-changing work serial until SafeApply
  exists. See
  [pursue-safe-apply-integration.md](pursue-safe-apply-integration.md#L10) and
  [pursue-safe-apply-integration.md](pursue-safe-apply-integration.md#L99).
- MemoryInput Boundary keeps memory as hints only. See
  [memory-input-boundary.md](memory-input-boundary.md#L9),
  [memory-input-boundary.md](memory-input-boundary.md#L150), and
  [memory-input-boundary.md](memory-input-boundary.md#L328).

Current repo evidence:

- Current vocabulary still centers Flow, Block, Route, Relay, Checkpoint, Trace,
  Report, Evidence, and Run folder. See
  [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md#L12),
  [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md#L89), and
  [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md#L221).
- Current trace includes `guidance.decision` alongside run, step, check,
  checkpoint, relay, skills, sub-run, fanout, proof, safe-apply, and close
  entries. See
  [src/schemas/trace-entry.ts](../../../src/schemas/trace-entry.ts#L383).
- Current relay trace still repeats `resolved_selection` for compatibility, but
  relay execution now requires matching relay guidance before `relay.started`.
  See
  [src/schemas/trace-entry.ts](../../../src/schemas/trace-entry.ts#L111) and
  [src/runtime/executors/relay.ts](../../../src/runtime/executors/relay.ts#L380).
- Current config is `schema_version: 1` and includes relay routing,
  per-flow selection, skill bindings, variant models, and defaults selection. See
  [src/schemas/config.ts](../../../src/schemas/config.ts#L35),
  [src/schemas/config.ts](../../../src/schemas/config.ts#L170), and
  [src/schemas/config.ts](../../../src/schemas/config.ts#L185).
- Current step schemas still carry `selection`, `skill_slots`, routes, budgets,
  checkpoint defaults and policy auto-resolution, relay connector, and acceptance
  criteria. See
  [src/schemas/step.ts](../../../src/schemas/step.ts#L38),
  [src/schemas/step.ts](../../../src/schemas/step.ts#L83),
  [src/schemas/step.ts](../../../src/schemas/step.ts#L99), and
  [src/schemas/step.ts](../../../src/schemas/step.ts#L174).
- Current checkpoint runtime can resolve through safe defaults,
  policy-controlled scoring-style auto-resolution, or operator resume. See
  [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts#L91),
  [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts#L125),
  and
  [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts#L381).
- Current graph execution already aborts undeclared routes, which is a good base
  for WorkContract route enforcement. See
  [src/runtime/run/graph-runner.ts](../../../src/runtime/run/graph-runner.ts#L483).
- Generated host surfaces are generated from source and drift-checked. See
  [docs/generated-surfaces.md](../../generated-surfaces.md#L7) and
  [docs/generated-surfaces.md](../../generated-surfaces.md#L67).
- Current `run` command still teaches flow selection and direct flow bypass. See
  [src/commands/run.md](../../../src/commands/run.md#L13) and
  [src/commands/run.md](../../../src/commands/run.md#L214).
- Pursue currently serializes code-changing work and says future parallel apply
  belongs behind a runtime-owned safe apply path. See
  [docs/flows/pursue.md](../../flows/pursue.md#L22),
  [docs/flows/pursue.md](../../flows/pursue.md#L43), and
  [docs/flows/pursue.md](../../flows/pursue.md#L257).

## Cross-Spec Consistency

| Area | Readiness call | Evidence |
| --- | --- | --- |
| Product thesis | Consistent. The docs say intent -> flow -> work contract -> recorded decisions -> proof/recovery/safe apply. | [pivot-brief.md](pivot-brief.md#L255), [generated-host-surface-reframing.md](generated-host-surface-reframing.md#L10) |
| Flow vocabulary | Consistent. The specs demote Flow as the product story but keep Flow as runnable shape. | [pivot-brief.md](pivot-brief.md#L153), [work-contract-projection-v0.md](work-contract-projection-v0.md#L41), [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md#L12) |
| WorkContract ownership | Mostly ready. The projection map is concrete enough for schema tests, but exact generated manifest placement is still open. | [work-contract-projection-v0.md](work-contract-projection-v0.md#L48), [work-contract-projection-v0.md](work-contract-projection-v0.md#L133) |
| GuidanceDecision | Ready for schema and trace tests. Runtime enforcement waits for WorkContract refs and policy refs. | [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#L66), [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#L336) |
| PolicyEnvelope | Ready for config spec tests after WorkContract and guidance refs exist. Do not cut relay over first. | [policy-envelope-config-v2-cutover.md](policy-envelope-config-v2-cutover.md#L70), [policy-envelope-config-v2-cutover.md](policy-envelope-config-v2-cutover.md#L348) |
| CheckpointBoundary | Ready for a later checkpoint slice. Current runtime still has hidden automatic resolution paths. | [checkpoint-boundary-authority.md](checkpoint-boundary-authority.md#L138), [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts#L91) |
| ProofAssessment | Ready for a later proof slice. Current acceptance criteria are proof inputs, not final proof. | [proof-assessment-evidence-adapter.md](proof-assessment-evidence-adapter.md#L302), [src/schemas/acceptance-criteria.ts](../../../src/schemas/acceptance-criteria.ts#L12) |
| RecoveryRouteKind | Ready after one docs correction in this audit. Route ids and recovery kinds are now distinct across the spec set. | [recovery-route-kind.md](recovery-route-kind.md#L134), [recovery-route-kind.md](recovery-route-kind.md#L757) |
| SafeApply and Pursue | Not first-slice work. Specs are strong enough to prevent premature parallel writes. | [change-packet-safe-apply.md](change-packet-safe-apply.md#L526), [pursue-safe-apply-integration.md](pursue-safe-apply-integration.md#L99) |
| Generated host surfaces | Not first-slice work. Specs correctly say generated public copy changes should wait until runtime can back the story. | [order-of-operations.md](order-of-operations.md#L180), [generated-host-surface-reframing.md](generated-host-surface-reframing.md#L334) |
| MemoryInput | Deferred correctly. First cutover needs only `memory_refs` and tests that memory is not authority. | [memory-input-boundary.md](memory-input-boundary.md#L328), [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#L175) |

## Findings

### Critical

None.

### High

None.

### Medium, Resolved

| Finding | Evidence | Risk | Resolution |
| --- | --- | --- | --- |
| Recovery wording drifted across specs. `run_generated_surface_sync` appeared in supporting specs but was not a `RecoveryRouteKind`. Some text also used older `retry_with_feedback` wording. | `RecoveryRouteKind` defines the enum in [recovery-route-kind.md](recovery-route-kind.md#L172), and explicitly normalizes older retry wording in [recovery-route-kind.md](recovery-route-kind.md#L301). | Future agents could add an undeclared recovery kind or implement two names for the same recovery path. | This audit changed the affected specs to use `run_verification` with generated-surface evidence and `retry_same_step_with_feedback`. Add an enum-consistency death test in the first recovery implementation slice. |
| `Ref` shape ownership could split between GuidanceDecision and ChangePacket. | GuidanceDecision owns the full ref shape in [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#L128). ChangePacket lists a smaller minimum shape but says GuidanceDecision owns the final enum in [change-packet-safe-apply.md](change-packet-safe-apply.md#L240). | Two ref schemas would make trace, proof, safe apply, and memory citations disagree. | First implementation slice must create one shared `Ref` schema and make GuidanceDecision, WorkContract refs, ProofAssessment, ChangePacket, and MemoryInput depend on it. |
| WorkContract exact placement is still open. | WorkContract V0 says it should be a generated projection carried by Flow, but exact placement remains unsettled in [work-contract-projection-v0.md](work-contract-projection-v0.md#L41) and [work-contract-projection-v0.md](work-contract-projection-v0.md#L133). | Starting with relay/runtime changes would force agents to guess where contract refs live. | First slice must be projection/schema/test-first. Do not change relay, checkpoint, config, or generated host copy until projection refs exist and are tested. |
| Generated-surface copy could overpromise SafeApply. | Generated surface spec says host copy must not promise behavior before runtime can back it in [generated-host-surface-reframing.md](generated-host-surface-reframing.md#L180), while SafeApply is later work in [order-of-operations.md](order-of-operations.md#L200). | Public copy could claim safe apply while current connectors still write directly to the parent checkout. | Generated-surface implementation must happen after core authority and proof gates. Any SafeApply copy before SafeApply ships must be future-facing or omitted from public host surfaces. |

### Low, Track During Implementation

| Finding | Why it is low | Next check |
| --- | --- | --- |
| `UBIQUITOUS_LANGUAGE.md` still defines checkpoint as a pause/input/default surface, while the pivot specs define checkpoint as an authority boundary. | The glossary is current-runtime vocabulary; the pivot docs are future-facing and cite the planned change. | Update the glossary only with the checkpoint implementation slice. Add docs death tests then. |
| Direct flow controls remain public expert controls in V0. | The generated-surface spec makes this explicit and says they are not bypasses. | Future generated-surface tests must reject bypass wording. |
| Context packet remains folded into relay execution for V0. | GuidanceDecision made a concrete V0 choice: request hash plus context ref, no separate subject yet. | Revisit only if one context packet is reused across relays. |
| Memory is deliberately thin. | MemoryInput is out of the first cutover except `memory_refs`. | Do not build memory store, scoring, or UI in early slices. |

## Missing Or Extra Death Tests

Most death-test coverage is strong. Add these cross-spec tests to prevent drift
between specs once implementation starts:

| Gap | Add this death test | Likely place |
| --- | --- | --- |
| Cross-spec enum drift | All recovery kinds named in proof, SafeApply, Pursue, and generated-surface specs must exist in `RecoveryRouteKind`. | `tests/contracts/recovery-route-kind.test.ts` or a docs/schema audit |
| Shared ref ownership | No pivot schema may define a second incompatible `Ref` shape after the shared `Ref` schema exists. | `tests/contracts/ref-schema.test.ts` |
| WorkContract projection completeness | Projection fails when a current flow/step/config authority field is unclassified. | `tests/contracts/work-contract-projection.test.ts` |
| Old authority in contract output | Generated WorkContract projection rejects `selection`, final relay `connector`, concrete skill activation, and old checkpoint auto-resolution as contract authority. | `tests/contracts/work-contract-projection.test.ts` |
| Trace sequence before runtime cutover | `guidance.decision` schema can exist without being wired to relay, but sequence validator fixtures must reject relay/checkpoint/proof/recovery/safe-apply actions without matching decisions. | `tests/contracts/runtrace-sequence.test.ts` |
| Docs/read-order drift | Pivot README must link every spec and this audit. | `tests/docs/pivot-readme-links.test.ts` or Markdown link check |
| Product wording drift | Avoid terms remain allow-listed: no active product use of "workflow", "substrate", "primitive", "orchestration", "governance", "framework", "brain", or "operating environment." | docs audit or release public-doc audit |

## Ownership Boundaries

| Object | Ready boundary | Do not let it own |
| --- | --- | --- |
| Flow | Runnable shape, stages, blocks, steps, routes, relays, reports, generated surfaces. | Final connector/model/effort/skill choice. |
| WorkContract | Allowed actions, route map, proof needs, checkpoint boundaries, recovery bindings, write authority, close rules. | Preferences as final authority. |
| GuidanceDecision | The recorded runtime choice inside WorkContract and policy rules. | New authority, undeclared routes, skipped proof, or silent policy relaxation. |
| PolicyEnvelope | Rules, limits, preferences, defaults, and explicit overrides. | Direct final relay selection or right-biased safety loosening. |
| ProofAssessment | Claim and evidence judgment. | Agent prose or report shape as proof. |
| RecoveryRouteKind | Typed reason a declared route can be used after failure. | Route ids or new route targets. |
| ChangePacket | A proposed change with base, patch, touched files, proof refs, risks, and recommendation. | Permission to mutate the parent checkout. |
| SafeApply | Apply/reject checks, conflict handling, proof gate, and final verification. | Pursue-only behavior or prompt-only safety. |
| Pursue | Coordination, serial writes before SafeApply, isolated branch reporting after SafeApply. | Applying patches directly or counting rejected packets as complete. |
| MemoryInput | Hints and context refs. | Permission, policy changes, proof, checkpoint crossing, route declaration, or apply approval. |

## Safest First Slice

Start with **WorkContract Projection And Shared Ref Foundation**.

This slice is intentionally small. It should add the schemas and tests that
later runtime work needs, without changing how relays run.

Scope:

1. Add a shared `Ref` schema.
2. Add `WorkContractProjectionV0` schema with the three buckets from the spec:
   `work_contract`, `guidance_seed`, and `rejected_authority`.
3. Add a projection builder over current compiled Flow data that classifies
   current flow, stage, step, route, relay, checkpoint, report, evidence, budget,
   acceptance-criteria, selection, skill, and connector fields.
4. Add tests that fail when any current authority field is unclassified.
5. Add death tests that prevent selection, connector, concrete skill bindings,
   `safe_autonomous_choice`, and old checkpoint `auto_resolution` from appearing
   as contract authority.
6. Add minimal `guidance.decision` schema tests that validate refs, required ref
   arrays, reason codes, and the ban on `confidence` and required prose.

Out of scope for this first slice:

- no relay executor cutover;
- no config v2 runtime parser;
- no checkpoint behavior change;
- no ProofAssessment close gate;
- no SafeApply;
- no Pursue parallel writes;
- no generated host copy rewrite;
- no memory store.

Exit criteria:

- `WorkContractProjectionV0` classifies every currently relevant authority field.
- Shared `Ref` is exported from one schema owner and reused by the new guidance
  and projection tests.
- Projection tests pass against current public flows.
- Old authority fields are allowed only as `guidance_seed` or
  `rejected_authority`, never as `work_contract` final authority.
- The first `guidance.decision` schema tests pass with real `work_contract`,
  `policy`, `trace`, `report`, and `memory` refs.
- No generated host mirror is hand-edited.

Focused checks for that slice:

```bash
npm run test -- \
  tests/contracts/work-contract-projection.test.ts \
  tests/contracts/guidance-decision-schema.test.ts
node scripts/flows/emit.ts --check
git diff --check
```

Run `npm run verify:fast` before calling the implementation slice done. Run full
`npm run verify` before merging a runtime cutover.

## Do Not Start Next

These are still premature:

- cutting relay execution over to GuidanceDecision before WorkContract refs exist;
- deleting `SelectionOverride` or `ResolvedSelection` before the projection and
  policy migration tests classify them;
- replacing public generated host copy before runtime can back the new story;
- implementing CheckpointBoundary before guidance matching exists;
- implementing ProofAssessment close gates before Claim/Evidence schemas exist;
- building SafeApply before proof refs and ChangePacket schema exist;
- enabling Pursue parallel code-changing branches before SafeApply death tests
  pass;
- building memory behavior beyond optional `memory_refs`.

## Unsettled, Not Blocking First Slice

These remain real decisions, but they should not block the first foundation slice:

- exact generated manifest location for WorkContract projection;
- whether `safe_apply.result` also gets a durable report mirror;
- exact path for durable ProofAssessment records;
- exact PolicyEnvelope connector registry shape;
- operator policy-change event name;
- whether direct flow controls stay public expert controls long-term;
- exact future glossary update for checkpoint as authority boundary;
- exact memory storage location, if MemoryInput ever becomes stored data.

## Review Record

Audit pass found one medium issue and three medium implementation-order risks:

- `run_generated_surface_sync` and `retry_with_feedback` drifted from the
  `RecoveryRouteKind` enum;
- `Ref` ownership could split between GuidanceDecision and ChangePacket;
- WorkContract placement is not settled enough for broad runtime changes;
- generated host copy could overpromise SafeApply.

Resolution:

- the recovery wording drift was fixed in this docs pass;
- shared `Ref` ownership is now an explicit first-slice gate;
- WorkContract placement is limited to projection/schema/tests before runtime
  cutover;
- generated public copy remains later than runtime proof and must not promise
  SafeApply early.

Final checks run for this audit:

- Markdown link and line-anchor check across the pivot directory, doc indexes,
  and `UBIQUITOUS_LANGUAGE.md`;
- targeted terminology probe for avoided product words;
- targeted recovery-name probe for `run_generated_surface_sync` and
  `retry_with_feedback`;
- `git diff --check`;
- `npm run check-flow-drift`.

Adversarial review pass 1 after fixes:

- reviewed source links, README coverage, recovery naming, first-slice scope, and
  generated-surface timing;
- no medium-or-above findings remained.

Adversarial review pass 2 after pass 1:

- rechecked the safest first slice against the pivot doctrine and current runtime
  evidence;
- no medium-or-above findings remained.
