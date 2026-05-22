# Contract, guidance, proof, and recovery pivot

Date: 2026-05-21

Status: Future-facing pivot brief. This is not current runtime behavior unless
the linked code, tests, contracts, and generated surfaces have been changed to
match it.

This brief captures the current product and architecture direction for the
Circuit pivot. It is meant to help future sessions continue from the same
doctrine without re-litigating the vocabulary or accidentally preserving old
flow-runner assumptions.

## Doctrine

Circuit should help coding agents do delegated work by giving them a clear
contract, recording the important decisions, checking the evidence, and choosing
a recovery path when proof is weak.

The stable doctrine:

> Flows carry work contracts. Guidance runs those contracts within the rules.
> Trace proves what happened. Safe apply turns agent-written edits into inspected
> proposed changes.

The north-star rule:

> No agent action gets authority unless a contract allows it, a guidance
> decision traces it, and proof can verify or recover from it.

This does not mean deleting Flow. It means Flow stops being the product
category and becomes the runnable carrier for the work contract.

## Language rules

Use simple product language first. Introduce formal names only when a spec,
schema, trace event, or test needs a stable name.

These rules extend the repo glossary, which already treats Flow, Block, Route,
Relay, Trace, Report, Evidence, and Checkpoint as canonical product words. See
[UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md).

Product-facing explanation:

> Circuit gives agents a clear contract, records the important decisions, checks
> the evidence, recovers when proof is weak, and applies changes safely.

Plain framing:

- A flow tells Circuit what kind of work this is.
- A contract says what the agent is allowed to do.
- Circuit records each important decision.
- Evidence shows whether the work is actually done.
- If proof is weak, Circuit retries, asks, narrows the work, or stops.
- Agents propose changes; Circuit applies them safely.

Use these plain names in product prose and the formal names in implementation
specs:

| Formal spec name | Plain wording to use first |
| --- | --- |
| WorkContract | work contract, contract |
| GuidanceDecision | recorded decision |
| PolicyEnvelope | rules, limits, preferences |
| MemoryInput | memory hint |
| CheckpointBoundary | checkpoint, decision point |
| ProofAssessment | proof check, evidence check |
| ChangePacket | proposed change |
| SafeApply | apply safely, safe apply |
| RecoveryRouteKind | recovery path |
| context packet | context sent to the worker |

Do not make simple ideas sound larger than they are. Avoid "workflow" in active
Circuit prose; use "flow". Avoid "envelope" in product prose; use "rules",
"limits", or "preferences". Avoid "substrate", "primitive", "orchestration",
"governance", and "framework" unless the text is about another system that uses
those words. Avoid language that makes Circuit sound magical, such as "brain",
"intelligent layer", or "operating environment".

When a formal name contains a heavier word, keep that word inside the spec name
and explain it plainly around the name. For example, `PolicyEnvelope` can remain
a proposed schema name, but product copy should say "rules, limits, and
preferences".

## Current repo reality

Circuit already has useful structure for this pivot.

The runtime is explicitly the engine layer for compiled flows, not the place
for flow-specific product behavior. See
[src/runtime/README.md](../../../src/runtime/README.md) and
[docs/architecture/runtime.md](../../architecture/runtime.md). The graph runner
already walks steps, evaluates routes, appends trace, and aborts when a selected
route is not declared by the compiled flow. See
[src/runtime/run/graph-runner.ts](../../../src/runtime/run/graph-runner.ts).

Today, selection is still the main decision path. Config, flow defaults, stage
and step metadata, and invocation layers can all influence model, effort,
skills, depth, and invocation options. See [src/schemas/config.ts](../../../src/schemas/config.ts),
[src/schemas/selection-policy.ts](../../../src/schemas/selection-policy.ts),
and [src/shared/selection-resolver.ts](../../../src/shared/selection-resolver.ts).
That machinery tracks where decisions came from, but it is too narrow to stay
in charge.

Trace already records runs, steps, checks, checkpoints, relays, skills, sub-runs,
fanout, reports, and evidence. See
[UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md) and
[src/schemas/trace-entry.ts](../../../src/schemas/trace-entry.ts). It does not yet
have a first-class `guidance.decision` event.

The current flow authoring model also puts model, effort, skills, depth, and
connector behavior inside authored flow selection layers. See
[docs/flows/authoring-model.md](../../flows/authoring-model.md). The pivot should
move final execution choice out of authored flow selection and into guidance
kept inside a work contract and policy rules.

The current step and config schemas make the implementation risk concrete:
`StepBase` still carries `selection`, `skill_slots`, `routes`,
`route_from_report`, and `budgets`; relay steps still carry optional connector
and acceptance criteria; checkpoint steps still carry checkpoint policy. See
[src/schemas/step.ts](../../../src/schemas/step.ts). Config v1 still carries
selection-shaped defaults, per-flow overrides, relay circuit routing, role
routing, skill bindings, and variant models. See
[src/schemas/config.ts](../../../src/schemas/config.ts) and
[docs/contracts/config.md](../../contracts/config.md). The pivot cannot be
implemented safely until these current authority paths are mapped, replaced, or
deleted.

Current host surfaces also still teach host-side flow selection and direct flow
bypass. See [src/commands/run.md](../../../src/commands/run.md) and
[plugins/codex/skills/run/SKILL.md](../../../plugins/codex/skills/run/SKILL.md).
Those surfaces are useful evidence for the cutover, not target behavior.

## Product thesis

The product promise should become:

> Give Circuit an intent. Circuit selects the right flow, loads its work
> contract, gives agents clear limits and context, checks the proof, recovers
> from failures, and only asks when authority or judgment is actually needed.

This keeps Circuit focused on agent effectiveness rather than human-facing
knobs. The user becomes more effective because the agents get better contracts,
context, boundaries, proof expectations, and recovery paths.

Circuit should not become a broad platform for every agent task, a generic graph
runtime, a model router, a generic flow builder, a skill marketplace, or a broad
memory system. Those are adjacent temptations. The useful product promise is
delegated agent work that Circuit can check, recover, and apply safely.

## Core boundaries

### Flow

Flow is the runnable shape and authoring unit.

Flow owns stages, steps, blocks, routes, relays, reports, generated manifests,
and host surfaces.

Flow should remain part of Circuit vocabulary. The pivot should demote Flow as
the public product category, not delete it from the architecture.

### WorkContract

WorkContract is the proposed spec name for the contract carried by a Flow.

It owns:

- allowed actions;
- required proof;
- checkpoint boundaries;
- recovery routes;
- write authority;
- close conditions.

The WorkContract says what is allowed and what must be proven. It should not
say which model, effort, connector, or skill should be used as final execution
authority.

### WorkContract Projection V0

The first implementation spec must define how WorkContract projects from
today's Flow, stage, step, block, route, relay, checkpoint, report, and
acceptance-criteria surfaces.

Projection V0 should classify every relevant current field into exactly one
bucket:

| Current surface | Projection decision |
| --- | --- |
| Flow id, stage graph, step ids, block kinds, route map, terminal targets | Contract-owned runnable shape. |
| Step `routes`, `route_from_report`, and terminal close paths | Contract-owned allowed transitions, with recovery route kind metadata added. |
| Step `budgets.max_attempts` and `budgets.wall_clock_ms` | Contract-owned execution limit, also visible to PolicyEnvelope as a hard cap. |
| Relay `role`, report schema, writes paths, and acceptance criteria | Contract-owned work role and required proof inputs, not final model/connector authority. |
| Checkpoint choices, choice sources, route consequences, and declared defaults | Contract-owned authority boundary. |
| Flow, stage, step, fanout branch, or config `selection` | Guidance-owned or deleted; never final contract authority. |
| Relay `connector` | Guidance-owned preference or constraint input; not final authority unless the PolicyEnvelope makes it a hard constraint. |
| `skill_slots` and skill bindings | Capability requirements or preferences that guidance resolves; not direct worker activation authority. |

Projection V0 must answer whether WorkContract is a persisted schema, a
generated compiled-flow projection, or a runtime projection. Until that is
settled, implementation work should not delete selection fields blindly.

### GuidanceDecision

GuidanceDecision is the proposed trace record for an important runtime choice
made inside the contract and policy rules.

It owns decisions such as:

- flow selection;
- relay connector, model, effort, skills, and context packet;
- proof policy;
- checkpoint resolution;
- recovery route;
- safe apply accept, reject, or apply order.

Guidance may recommend and choose among allowed options. It may not invent
authority, choose undeclared routes, skip proof, or silently loosen policy.

If a host recommends a flow before Circuit runs, guidance should treat that as a
host recommendation and validate it against the same contract and policy rules.
Circuit should not pretend host preselection originated inside the runtime.

### PolicyEnvelope

PolicyEnvelope is the proposed config shape for rules, limits, preferences, and
defaults. It replaces selection-centered config as the main runtime config
shape.

It owns:

- hard constraints;
- soft preferences;
- budgets;
- defaults;
- explicit invocation overrides.

Hard constraints compose restrictively. A later layer should not simply win if
it would loosen a stricter safety rule.

### MemoryInput

MemoryInput is the proposed spec name for memory hints. It is informational
only.

Memory can suggest repo commands, user preferences, prior failures, and useful
context. It cannot permit writes, override a WorkContract, relax policy, skip
proof, or change checkpoint authority.

MemoryInput is out of the first runtime cutover except for optional
`memory_refs` on recorded decisions. Do not build memory behavior before
WorkContract, GuidanceDecision, and PolicyEnvelope exist.

## Runtime sequence

The target runtime sequence is:

```text
Intent
-> Flow selection
-> WorkContract loaded from the Flow
-> GuidanceDecision
-> Relay or orchestrator action
-> Claim, Evidence, and ProofAssessment
-> Recovery, checkpoint, safe apply, or close
```

A short rule for future agents:

> Flow defines what can run. WorkContract defines what is allowed. Guidance
> decides how to run it now.

## Deleted or replaced concepts

Replace "flow runner" as the product story. It is too easy for host tools to
absorb and too focused on human-selected recipes.

Replace `SelectionOverride` and `ResolvedSelection` as the central execution
authority. Their source tracking is valuable and should be reused inside
GuidanceDecision, but model, effort, skills, and depth are not enough to
describe authority.

Replace config schema v1's selection-centered shape with PolicyEnvelope.

Replace acceptance-criteria-only proof with Claim, Evidence, and
ProofAssessment. Acceptance criteria can remain as one low-level proof input,
but they are not the whole proof model.

Delete `safe_autonomous_choice`. It implies a separate automatic mode. Keep and
rename or reframe `safe_default_choice` as a declared default resolution that
must be allowed by policy and traced.

Replace direct flow commands as the default product surface. They may survive as
expert or developer paths if they go through the same guidance, proof, recovery,
and trace runtime as the intent front door.

Replace Pursue as a planner-only concept with Pursue as a coordinator of
contracts, proof, touch sets, recovery, and safe apply.

## Hard-cut anti-cruft rules

This pivot should be a hard cutover. No runtime shims. No dual mode. No
compatibility parser in the runtime path. No legacy aliases that future agents
can accidentally use.

Temporary scaffolding is acceptable only inside the branch and only if removed
before the pivot is complete.

The final codebase should make old authority paths impossible, not merely
undocumented.

Hard-cut rule:

> If a relay can start without a matching `guidance.decision`, the pivot failed.

## Guidance decision shape

Use structured accountability, not prose explanation.

```ts
type GuidanceDecision = {
  kind: "guidance.decision";
  subject:
    | "flow_selection"
    | "relay_execution"
    | "context_packet"
    | "checkpoint_resolution"
    | "proof_policy"
    | "recovery_route"
    | "safe_apply";
  scope: {
    run_id: string;
    flow_id?: string;
    step_id?: string;
    attempt?: number;
  };
  source:
    | "deterministic"
    | "heuristic"
    | "model_recommended"
    | "host_recommended"
    | "operator_override";
  selected: JsonObject;
  input_refs: Ref[];
  constraint_refs: Ref[];
  contract_refs: Ref[];
  policy_refs: Ref[];
  memory_refs?: Ref[];
  evidence_refs?: Ref[];
  reason_codes: string[];
  rejected_options?: Array<{
    option: JsonObject;
    reason_code: string;
    blocked_by?: Ref;
  }>;
};
```

Do not add `confidence` until Circuit has eval-calibrated confidence. Do not
make a freeform rationale required. Use references and reason codes.

### Guidance matching invariants

The implementation spec must define "matching" precisely before runtime work
starts.

Define `Ref` first. If `input_refs`, `constraint_refs`, `contract_refs`,
`policy_refs`, `memory_refs`, and `evidence_refs` do not share a stable shape,
the trace cannot connect a decision to the files, reports, evidence, or rules
that informed it.

A relay may emit `relay.started` only after a matching
`guidance.decision` with:

- `subject === "relay_execution"`;
- the same `run_id`, `flow_id`, `step_id`, and `attempt`;
- selected connector equal to the connector used by the relay;
- selected model, effort, skills, depth, and invocation options equal to the
  values passed to the connector;
- context packet or relay request reference and hash equal to the prompt or
  request payload submitted to the connector;
- contract and policy refs present.

A checkpoint may emit `checkpoint.resolved` with `auto_resolved: true` only
after a matching `guidance.decision` with
`subject === "checkpoint_resolution"`.

A recovery route may be selected only after a matching `guidance.decision` with
`subject === "recovery_route"`, and the selected route must be declared by the
WorkContract.

Safe apply may accept, reject, or order patches only after a matching
`guidance.decision` with `subject === "safe_apply"` and evidence refs for the
ChangePacket and proof assessment.

Context packet handling is still unsettled. The spec must decide whether the
context packet is a separate file, a separate record, or the relay request
itself. Until then, context packet behavior is not implementation-ready.

## Config as rules, limits, and preferences

Config should stop saying "use this exact model, effort, skill, or connector" as
final authority.

It should instead define:

- `constraints`: what must never happen;
- `preferences`: what to prefer among allowed options;
- `budgets`: attempts, time, cost, effort, and similar limits;
- `defaults`: fallback behavior;
- `overrides`: explicit operator intent that cannot loosen hard constraints
  unless modeled as an authorized policy change.

Example shape:

```yaml
schema_version: 2

policy:
  constraints:
    writes:
      auto_apply: false
      require_checkpoint_globs:
        - "src/runtime/**"
        - "scripts/release/**"
    models:
      max_effort: high
      denied_providers:
        - custom
    proof:
      require_independent_review_for:
        - runtime
        - generated-surfaces

  preferences:
    relay:
      reviewer:
        prefer_connector: codex
      implementer:
        prefer_connector: claude-code
    effort_by_risk:
      low: low
      medium: medium
      high: high

  budgets:
    max_attempts_per_step: 3
    max_wall_clock_ms: 900000

  defaults:
    proof_profile: standard
```

### PolicyEnvelope v2 cutover rules

`PolicyEnvelope` is the proposed spec name. In product prose, describe it as
rules, limits, preferences, and defaults.

Config v1 is current runtime truth, but it must not survive the hard cutover as
runtime authority.

PolicyEnvelope v2 should make these old config paths impossible in runtime:

- `relay.circuits`;
- `circuits.<flow>.selection`;
- `defaults.selection`;
- `variant_models[*].selection` as final authority;
- role or relay routing as final connector authority;
- skill bindings that directly activate worker skills without a guidance
  decision.

Old routing and selection fields may migrate into policy inputs only. They must
never directly determine connector, model, effort, or skills without a matching
GuidanceDecision.

The v2 parser may have temporary branch-local migration helpers, but runtime
execution should reject config v1 once the cutover lands. Tests and probes
should target config runtime paths specifically; broad `schema_version: 1`
searches are too noisy because many non-config schemas legitimately remain at
version 1.

Hard constraints are not ordinary precedence. They compose by intersection or
the most restrictive rule. Invocation overrides can express operator intent,
but they cannot loosen project or contract safety unless the override is itself
an explicit, traced policy change.

`ResolvedSelection` may survive only as a temporary implementation detail or as
a nested value inside `GuidanceDecision.selected`. It must not remain the final
authority emitted directly by relay execution.

## Memory boundaries

Memory may inform guidance. It never grants authority.

Allowed:

- suggest the repo's normal verification command;
- suggest prior user preferences;
- flag known recurring failures;
- provide context refs for guidance.

Forbidden:

- permit writes;
- override hard policy;
- override WorkContract authority;
- skip proof;
- silently change checkpoint behavior;
- loosen model, connector, or effort constraints.

If memory conflicts with hard policy or WorkContract authority, ignore the
memory and trace the ignored memory ref.

## Checkpoint semantics

A checkpoint is not just a pause for input. It is an authority boundary.

Target shape:

```ts
type CheckpointBoundary = {
  reason_code:
    | "scope_expansion"
    | "protected_files"
    | "weak_proof"
    | "unsafe_apply"
    | "budget_exceeded"
    | "ambiguous_intent";
  authority_required: "operator" | "policy";
  choices: Array<{
    id: string;
    route: DeclaredRouteId;
    consequence: string;
  }>;
  declared_default?: {
    choice_id: string;
    allowed_when: PolicyRef[];
  };
};
```

Auto-resolution is allowed only when declared, allowed by policy, and traced as a
GuidanceDecision.

### Checkpoint auto-resolution replacement

Deleting `safe_autonomous_choice` is necessary but not sufficient. Current
checkpoint behavior also has `auto_resolution` policies such as `accept-as-is`,
`highest-score`, `first-acceptable`, and `refuse`. In the pivot, all automatic
checkpoint resolution paths must become one of:

- a declared default resolution, resolved by `guidance.decision`;
- a typed guidance policy decision, resolved by `guidance.decision`;
- a checkpoint wait;
- a stop or escalation route.

`highest-score` may survive as a scoring policy for tournament or fanout
decisions, but it must not resolve checkpoints without a trace. If it resolves an
authority boundary, the selected option, rejected options, source report,
rubric refs, and blocking constraints must appear in trace or evidence.

`safe-autonomous` should disappear as a checkpoint trace resolution source.
Trace should distinguish operator resolution, declared default resolution, and
guidance policy resolution.

## Proof and recovery model

Minimum proof objects:

```ts
type Claim = {
  id: string;
  kind:
    | "bug_fixed"
    | "behavior_changed"
    | "test_added"
    | "docs_changed"
    | "refactor_only"
    | "generated_surface_synced"
    | "absence_of_change";
  statement: string;
  scope_refs: Ref[];
  risk: "low" | "medium" | "high";
};

type Evidence = {
  id: string;
  kind:
    | "command"
    | "diff"
    | "source_citation"
    | "generated_surface"
    | "review"
    | "absence_of_change"
    | "trace";
  producer:
    | "runtime"
    | "worker"
    | "independent_worker"
    | "operator";
  ref: Ref;
  covers_claims: string[];
  result: "pass" | "fail" | "unknown";
};

type ProofAssessment = {
  claim_id: string;
  status: "proven" | "weak" | "contradicted" | "unproved";
  evidence_refs: Ref[];
  missing: string[];
  recovery_route: DeclaredRouteId;
};
```

Agent prose is not proof. Runtime-captured evidence is proof.

Weak proof must not cleanly close write-capable work. It should route to one of:

- retry with feedback;
- narrow scope;
- run verification;
- run independent review;
- checkpoint;
- safe apply reject;
- stop unsafe;
- escalate.

### AcceptanceCriteria to Evidence adapter

Acceptance criteria should not remain a second proof system.

Each acceptance criterion result should become Evidence:

- command criteria become command evidence with command ref, exit code, output
  summary or output ref, producer `runtime`, and covered claim ids;
- report-field criteria become report evidence with report ref, path checked,
  predicate, result, and covered claim ids;
- failed criteria produce failed evidence and a ProofAssessment status of
  `weak`, `contradicted`, or `unproved`;
- passing acceptance criteria may support a claim but cannot by themselves
  close write-capable work unless the WorkContract's proof policy says the
  claim is fully covered.

Claim coverage may come from the WorkContract's proof policy. It does not have
to come from each old acceptance criterion. Do not force `covered_claims` into
the old acceptance schema without a proof-spec decision.

The first proof spec should define how existing `check.evaluated` trace entries
map to Evidence without letting agents satisfy proof by writing plausible
reports.

### Typed recovery expectations

Recovery routes should not remain freeform route strings.

WorkContract should bind each recovery route to:

- a route id declared by the Flow;
- a `RecoveryRouteKind`;
- allowed failure causes;
- required proof or evidence refs;
- whether operator authority is required;
- retry or attempt budget interaction.

Initial `RecoveryRouteKind` values should include:

- `retry_same_step_with_feedback`;
- `narrow_scope`;
- `run_verification`;
- `run_independent_review`;
- `checkpoint_authority`;
- `safe_apply_reject`;
- `stop_unsafe`;
- `escalate`;
- `handoff`.

## Pursue and safe apply

Pursue already documents the right V1 restraint: code-changing work is serial
until runtime-owned safe apply exists. See [docs/flows/pursue.md](../../flows/pursue.md).
Current writable relay fanout is also serialized because branches share the
parent checkout. See [src/runtime/executors/fanout.ts](../../../src/runtime/executors/fanout.ts).

Target rule:

> Agents propose. Circuit applies.

A future ChangePacket should include:

- base ref;
- base tree hash;
- parent dirty-state policy;
- patch ref and hash;
- runtime-computed touched files;
- claims;
- evidence;
- proof assessment refs;
- commands run;
- risks;
- protected-file decision;
- generated-surface status;
- patch apply preconditions;
- patch apply status;
- final composed verification ref;
- apply recommendation.

Safe apply must reject mismatched bases, protected-file drift, weak proof,
generated-surface drift, and final verification failure. The future worktree and
change-packet direction is sketched in
[docs/ideas/sandboxed-parallel-pursuits.md](../../ideas/sandboxed-parallel-pursuits.md).

SafeApply must remain a runtime boundary, not a Pursue-only feature and not a
prompt instruction. Pursue is where the need becomes obvious, but every
write-capable relay should eventually return a ChangePacket or run behind an
equivalent safe-apply boundary.

During the transition, every write-capable relay must be classified as one of
three cases: isolated work, diff captured before and after the relay, or
pre-SafeApply trusted write. The trusted-write case must not unlock more
unattended work; it is only a label for current behavior until SafeApply exists.

Circuit should refuse these capabilities until SafeApply exists:

- parallel write-capable Pursue branches;
- auto-merging tournament variants;
- broad repo edits by multiple writers across work roots;
- applying patches when final composed verification fails;
- applying patches when generated surfaces drift without proof;
- applying patches from a mismatched base or dirty-parent state that policy has
  not explicitly allowed.

## Generated surface implications

Generated surfaces are an asset, not cruft. Circuit already treats Claude and
Codex surfaces, manifests, schematics, and flow output as generated from source.
See [docs/generated-surfaces.md](../../generated-surfaces.md).

But the current generated host surfaces still teach host-side flow selection and
direct flow commands. See [src/commands/run.md](../../../src/commands/run.md) and
[plugins/codex/skills/run/SKILL.md](../../../plugins/codex/skills/run/SKILL.md).

The new default should be intent-first:

```text
operator intent
-> Circuit selects Flow
-> Circuit loads WorkContract
-> Circuit emits GuidanceDecision
-> Circuit proves, recovers, checkpoints, or applies
```

Direct flow commands may remain only if clearly marked expert or developer
surfaces and only if they invoke the same contract, guidance, proof, recovery,
and trace runtime.

### Generated-surface acceptance rules

- the default host story is intent-first, not "choose a flow recipe";
- generated public docs must not describe Circuit primarily as a flow runner;
- direct flow commands, if emitted, must be marked expert or developer surfaces;
- direct flow commands must not say they bypass guidance, proof, recovery, or
  trace;
- host-recommended flow selection must be traced as a recommendation accepted or
  rejected by Circuit;
- command, skill, manifest, schematic, and plugin mirrors must stay generated
  from source and drift-checked together.

## Death tests

The pivot is not complete unless tests prove these old paths are gone:

- A relay cannot start without a prior matching `guidance.decision`.
- A direct flow command cannot bypass guidance.
- A direct flow command cannot bypass proof assessment.
- A flow-authored model, effort, connector, or skill choice cannot be final
  runtime authority.
- Guidance cannot choose an undeclared route.
- Memory conflict with hard policy is ignored and traced.
- Weak proof cannot close write-capable work as clean success.
- Runtime diff overrides worker-reported touched files.
- `safe_autonomous_choice` cannot parse.
- `safe-autonomous` cannot appear as a checkpoint resolution source.
- `auto_resolution.highest-score`, `accept-as-is`, and `first-acceptable` cannot
  resolve checkpoints without a matching `guidance.decision`.
- Config v1 and old selection fields cannot be used in the config runtime path.
- `relay.circuits`, `circuits.<flow>.selection`, `defaults.selection`, and
  `variant_models[*].selection` cannot provide final runtime authority.
- `ResolvedSelection` cannot be emitted as final relay authority without being
  nested under `GuidanceDecision.selected`.
- Acceptance criteria must produce Evidence and feed ProofAssessment.
- A write-capable run cannot close complete without proof assessment refs.
- A direct flow command must still emit flow-selection or host-recommendation
  guidance plus relay/proof guidance.
- Pursue cannot run parallel code-changing branches until SafeApply is enabled.
- SafeApply rejects mismatched base refs, protected-file drift, generated-surface
  drift without proof, and final verification failure.
- Generated docs cannot describe Circuit primarily as a flow runner.

## Roadmap

1. Specify WorkContract Projection V0.
2. Specify GuidanceDecision trace schema and matching invariants.
3. Specify PolicyEnvelope v2 cutover and config v1 death tests.
4. Specify CheckpointBoundary authority and auto-resolution replacement.
5. Specify Claim, Evidence, ProofAssessment, AcceptanceCriteria-to-Evidence, and
   typed recovery.
6. Update generated surfaces to intent-first product framing.
7. Specify ChangePacket and SafeApply.
8. Let Pursue use SafeApply before enabling parallel code-changing work.

## Implementation-spec readiness gates

Do not start runtime implementation until the first three specs have crisp
answers and death tests:

1. **WorkContract Projection V0** - maps current Flow, block, route, relay,
   checkpoint, report, evidence, and acceptance-criteria fields into contract
   authority, guidance-owned inputs, or deleted old authority.
2. **GuidanceDecision Trace Invariant** - defines event schema, matching rules,
   relay/checkpoint/recovery/safe-apply sequence rules, and context packet
   semantics.
3. **PolicyEnvelope Config V2 Cutover** - defines hard-constraint composition,
   v1 rejection in runtime, and the fate of current selection and relay-routing
   fields.

The next specs are CheckpointBoundary, ProofAssessment and Evidence adapter,
Generated Host Surface Reframing, ChangePacket and SafeApply, and Pursue
SafeApply integration.

## Unsettled items

These are intentionally not resolved by this brief:

- Exact WorkContract schema: separate file or projection from existing FlowData.
- Whether direct flow commands remain public expert tools or dev-only.
- Exact names for PolicyEnvelope, WorkContract, GuidanceDecision, and
  ProofAssessment.
- How much SelectionResolution source-tracking code can be reused.
- Exact claim and evidence taxonomy.
- How memory refs are represented and stale memory is downweighted.
- Whether context packet selection is its own decision or folded into relay
  execution.
- How an operator-authorized policy change differs from a one-run override.
- Safe apply baseline cleanliness rules for dirty parent checkouts.
- Whether `highest-score` remains a checkpoint policy, moves to fanout/review
  policy, or becomes a guidance-scored recovery decision.
- Which generated direct flow surfaces remain public expert controls versus
  dev-only controls.

## Future LLM review prompts

Use these prompts to sharpen the pivot:

1. Attack this pivot for contradictions with the current Circuit runtime,
   schemas, generated surfaces, and Pursue docs. Separate confirmed fact,
   inference, and speculation.
2. Design the smallest WorkContract schema that can replace current selection,
   checkpoint, and proof authority without inventing a second runtime.
3. Find every old authority path that could survive the hard cutover. Give grep
   probes and death tests.
4. Design a `guidance.decision` schema that is reviewable without relying on
   prose explanations.
5. Design a proof model that agents cannot satisfy by writing plausible reports.
6. Review generated Claude and Codex surfaces for old flow-runner mental model
   leaks.
7. Design SafeApply so it allows more unattended work without overclaiming
   sandboxing or semantic merge safety.

## Adversarial review record

Review before the implementation-spec phase found real implementation risks:

- WorkContract projection was not precise enough.
- `guidance.decision` matching invariants were not defined.
- PolicyEnvelope v2 cutover rules were too thin.
- Selection authority remained deeply embedded in current relay execution.
- Checkpoint auto-resolution replacement covered `safe_autonomous_choice` but
  not all auto-resolution policies.
- Acceptance criteria were not integrated into the proof model.
- Generated surfaces still reinforced host-side flow selection and direct flow
  bypass.
- ChangePacket and SafeApply requirements were too thin for implementation.

This brief now records those risks as spec-readiness gates. It is still a
future-facing pivot brief, not current runtime truth and not a substitute for
the implementation specs above.

Two clean adversarial reviews should be rerun after the implementation specs
exist, because the critical risk shifts from doctrine ambiguity to stale
authority paths surviving in code, schemas, tests, docs, and generated surfaces.
