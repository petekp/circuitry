# Circuit Pivot Order Of Operations

Status: source-backed order guide for the contract, guidance, proof, and
recovery pivot. It is future-facing planning, not current runtime behavior.

## Short Answer

Spec the first three gates before touching runtime. Then cut over internal
authority. Then update public generated surfaces. Then build SafeApply and let
Pursue use it.

Do not start by rewriting generated copy, deleting selection fields, or building
SafeApply. Those moves either overclaim current behavior or remove old fields
before their replacement is defined.

## Why This Order

The pivot brief says Flow carries the work contract, guidance makes recorded
decisions inside the rules, proof checks the work, and safe apply handles
proposed changes. Current code has not caught up yet: selection still drives
model, effort, skills, and depth; trace has no `guidance.decision`; step/config
schemas still carry old authority paths; and host surfaces still teach
flow-selection and direct flow bypass.

Current anchors to recheck:

- [Pivot brief](pivot-brief.md)
- [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md)
- [src/schemas/compiled-flow.ts](../../../src/schemas/compiled-flow.ts)
- [src/schemas/step.ts](../../../src/schemas/step.ts)
- [src/schemas/config.ts](../../../src/schemas/config.ts)
- [src/shared/selection-resolver.ts](../../../src/shared/selection-resolver.ts)
- [src/runtime/executors/relay.ts](../../../src/runtime/executors/relay.ts)
- [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts)
- [docs/generated-surfaces.md](../../generated-surfaces.md)
- [src/commands/run.md](../../../src/commands/run.md)
- [docs/flows/pursue.md](../../flows/pursue.md)

## Phase 0: Freeze The Target

Write or refresh the first implementation specs before code changes.

Exit criteria:

- Specs link back to the pivot brief.
- Specs name death tests.
- Specs preserve Circuit vocabulary from `UBIQUITOUS_LANGUAGE.md`.
- Two review passes find no medium-or-above spec-readiness issues.

Verification surface:

- Markdown link check.
- Targeted terminology probes for avoid terms in active product prose.

## Phase 1: Spec The Three Gates

### 1. WorkContract Projection V0

Do this first. Guidance needs to know what the Flow allows before it can choose
how to run the work.

Exit criteria:

- Every relevant current field has one fate: contract authority, guidance input,
  or deleted old authority.
- WorkContract is defined as a generated projection carried by Flow.
- Death tests cover `default_selection`, stage/step/fanout `selection`, relay
  `connector`, `safe_autonomous_choice`, and untyped recovery routes.

Death-test surface:

- `tests/contracts/work-contract-projection.test.ts`
- `tests/contracts/compiled-flow-contract-schema.test.ts`
- `tests/runtime/guidance-route-invariant.test.ts`

### 2. GuidanceDecision Trace Invariant

Do this second. Every consequential runtime choice needs a trace record before
relay, checkpoint, proof, recovery, or safe apply can become accountable.

Exit criteria:

- `Ref` shape is defined.
- Relay, checkpoint, recovery, and safe-apply matching rules are defined.
- Context sent to the worker is either its own artifact or part of the relay
  request hash. The spec must choose one.
- Relay cannot emit `relay.started` without matching guidance.

Death-test surface:

- `tests/contracts/guidance-decision-schema.test.ts`
- `tests/contracts/runtrace-sequence.test.ts`
- `tests/runtime/guidance-relay-invariant.test.ts`

### 3. PolicyEnvelope Config V2 Cutover

Do this third. Guidance needs rules, limits, and preferences, but the policy
shape should not be designed until WorkContract and guidance boundaries are
clear.

Exit criteria:

- Hard constraints compose restrictively.
- Old routing and selection fields can migrate only into policy inputs.
- Config v1 is rejected in the runtime path after cutover.
- `relay.circuits`, `circuits.<flow>.selection`, and `defaults.selection` cannot
  provide final authority.

Death-test surface:

- `tests/contracts/policy-envelope-schema.test.ts`
- `tests/runtime/policy-envelope.test.ts`
- `tests/runtime/policy-memory-conflicts.test.ts`

## Phase 2: Spec The Supporting Cuts

Do these before broad runtime work, but after the first three gates.

- Generated Host Surface Reframing: decide how public host surfaces say "give
  Circuit an intent" without claiming runtime behavior too early.
- CheckpointBoundary: replace hidden auto-resolution with declared defaults plus
  recorded decisions.
- ProofAssessment and Evidence adapter: make acceptance criteria produce
  Evidence and feed proof checks.
- RecoveryRouteKind: make recovery paths typed enough for implementation.
- ChangePacket and SafeApply: define proposed changes, base checks, patch
  application, and final verification.

Exit criteria:

- Each spec has schema, runtime, trace, docs, and generated-surface death tests
  where relevant.
- Each spec names what remains unsettled.

## Phase 3: Implement Core Authority Cutover

Implementation order:

1. Add WorkContract projection schema, generator, and tests.
2. Add `guidance.decision` trace schema and sequence validation.
3. Add PolicyEnvelope v2 parser and config death tests.
4. Cut relay execution over to guidance-owned decisions.
5. Remove final authority from old selection paths.

Exit criteria:

- Relay cannot start without matching guidance.
- Guidance cannot choose undeclared routes.
- Old selection code is gone from final authority paths or nested under
  `GuidanceDecision.selected`.
- Config v1 is not accepted by runtime execution.

Verification:

- Focused schema/runtime tests.
- `npm run verify:fast` during iteration.
- Full `npm run verify` before claiming the slice done.

## Phase 4: Checkpoint, Proof, And Recovery

Implement checkpoint replacement and proof/recovery before public product-surface
rewrites.

Exit criteria:

- `safe_autonomous_choice` cannot parse.
- `safe-autonomous` cannot appear as a checkpoint resolution source.
- Old `auto_resolution` policies cannot resolve checkpoints without matching
  guidance.
- Acceptance criteria produce Evidence.
- Weak or unproved proof cannot close write-capable work as complete.
- Recovery routes are typed.

Verification:

- Checkpoint schema and runtime tests.
- Proof closure tests.
- Trace sequence tests.

## Phase 5: Generated Surfaces And Docs

Update public docs and generated host surfaces only after the runtime can back
the new story.

Exit criteria:

- `src/commands/run.md` and generated host mirrors no longer teach the old
  product story.
- Direct flow commands, if kept, are expert/dev controls and still run
  guidance, proof, recovery, and trace.
- Generated surfaces are regenerated from source.

Verification:

- `npm run build && npm run emit-flows`
- `node scripts/flows/emit.ts --check`
- Generated-surface framing tests.
- Full `npm run verify`.

## Phase 6: SafeApply, Then Pursue

SafeApply should follow proof and trace. Pursue should use SafeApply only after
SafeApply exists.

Exit criteria:

- ChangePacket includes base, patch, touched files, proof refs, risks, commands,
  and apply recommendation.
- SafeApply rejects mismatched base refs, protected-file drift,
  generated-surface drift without proof, patch conflicts, and final verification
  failure.
- Pursue rejects parallel code-changing branches until SafeApply is enabled.

Verification:

- `tests/runtime/safe-apply.test.ts`
- `tests/runtime/safe-apply-generated-surfaces.test.ts`
- `tests/runner/pursue-runtime.test.ts`

## Do Not Do First

- Do not rewrite generated public copy before runtime can back it.
- Do not delete selection fields before WorkContract Projection V0 classifies
  them.
- Do not build SafeApply before ProofAssessment.
- Do not let `ResolvedSelection` remain final relay authority.
- Do not make memory central. MemoryInput is out of the first cutover except
  optional memory refs.

## Still Unsettled

- Exact `Ref` shape.
- Exact WorkContract schema location.
- Direct flow commands: public expert tools or dev-only controls.
- Exact claim and evidence taxonomy.
- Operator policy change vs one-run override.
- Fate of `highest-score`.
- Dirty parent checkout policy for SafeApply.

## Review Record

First pass found two ordering issues: generated-surface copy changes were too
early, and SafeApply was too close to proof work. The sequence now separates
generated-surface spec work from generated-surface implementation, and moves
SafeApply after proof.

Second pass found no medium-or-above ordering issues. Remaining items are named
spec decisions, not blockers to the sequence.
