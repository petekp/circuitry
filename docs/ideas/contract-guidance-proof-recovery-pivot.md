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

Circuit should be framed as the contract, guidance, proof, and recovery runtime
for coding-agent work.

The stable doctrine:

> Flows carry work contracts. Guidance executes those contracts under policy.
> Trace proves consequential decisions. Safe apply turns autonomous edits into
> inspected change packets.

The north-star rule:

> No agent action gets authority unless a contract allows it, a guidance
> decision traces it, and proof can verify or recover from it.

This does not mean deleting Flow. It means Flow stops being the product
category and becomes the runnable carrier for the work contract.

## Current repo reality

Circuit already has useful structure for this pivot.

The runtime is explicitly the engine layer for compiled flows, not the place
for flow-specific product behavior. See
[src/runtime/README.md](../../src/runtime/README.md) and
[docs/architecture/runtime.md](../architecture/runtime.md). The graph runner
already walks steps, evaluates routes, appends trace, and aborts when a selected
route is not declared by the compiled flow. See
[src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts).

The current old-world center is selection. Config, flow defaults, stage and step
metadata, and invocation layers can all influence model, effort, skills, depth,
and invocation options. See [src/schemas/config.ts](../../src/schemas/config.ts),
[src/schemas/selection-policy.ts](../../src/schemas/selection-policy.ts),
and [src/shared/selection-resolver.ts](../../src/shared/selection-resolver.ts).
That machinery is rigorous, especially around provenance, but it is too narrow
to remain the authority center.

Trace already records runs, steps, checks, checkpoints, relays, skills, sub-runs,
fanout, reports, and evidence. See
[UBIQUITOUS_LANGUAGE.md](../../UBIQUITOUS_LANGUAGE.md) and
[src/schemas/trace-entry.ts](../../src/schemas/trace-entry.ts). It does not yet
have a first-class `guidance.decision` event.

The current flow authoring model also puts model, effort, skills, depth, and
connector behavior inside authored flow selection layers. See
[docs/flows/authoring-model.md](../flows/authoring-model.md). The pivot should
move final execution choice out of authored flow selection and into guidance
bounded by a work contract and policy envelope.

## Product thesis

The product promise should become:

> Give Circuit an intent. Circuit selects the right flow, loads its work
> contract, gives agents bounded working conditions, verifies the proof,
> recovers from failures, and only asks when authority or judgment is actually
> needed.

This keeps Circuit focused on agent effectiveness rather than human-facing
knobs. The user becomes more effective because the agents get better contracts,
context, boundaries, proof expectations, and recovery paths.

Circuit should not become a broad "agent OS", a generic graph runtime, a model
router, a workflow builder, a skill marketplace, or a memory brain. Those are
adjacent temptations. The durable wedge is contracted agent work with
accountable execution.

## Core boundaries

### Flow

Flow is the runnable shape and authoring unit.

Flow owns stages, steps, blocks, routes, relays, reports, generated manifests,
and host surfaces.

Flow should remain part of Circuit vocabulary. The pivot should demote Flow as
the public product category, not delete it from the architecture.

### WorkContract

WorkContract is the authority layer carried by a Flow.

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

### GuidanceDecision

GuidanceDecision is a traced runtime choice inside WorkContract and
PolicyEnvelope bounds.

It owns decisions such as:

- flow selection;
- relay connector, model, effort, skills, and context packet;
- proof policy;
- checkpoint resolution;
- recovery route;
- safe apply accept, reject, or apply order.

Guidance may recommend and choose among allowed options. It may not invent
authority, choose undeclared routes, skip proof, or silently loosen policy.

### PolicyEnvelope

PolicyEnvelope replaces selection-centered config as the runtime policy center.

It owns:

- hard constraints;
- soft preferences;
- budgets;
- defaults;
- explicit invocation overrides.

Hard constraints compose restrictively. A later layer should not simply win if
it would loosen a stricter safety rule.

### MemoryInput

MemoryInput is informational only.

Memory can suggest repo commands, user preferences, prior failures, and useful
context. It cannot permit writes, override a WorkContract, relax policy, skip
proof, or change checkpoint authority.

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
authority. Their provenance discipline is valuable and should be reused inside
GuidanceDecision, but model, effort, skills, and depth are not enough to
describe authority.

Replace config schema v1's selection-centered shape with PolicyEnvelope.

Replace acceptance-criteria-only proof with Claim, Evidence, and
ProofAssessment. Acceptance criteria can remain as one low-level proof input,
but they are not the whole proof model.

Delete `safe_autonomous_choice`. It implies a hidden autonomy mode. Keep and
rename or reframe `safe_default_choice` as a declared default resolution that
must be policy-bounded and traced.

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

## Config as envelope

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

Auto-resolution is allowed only when declared, policy-bounded, and traced as a
GuidanceDecision.

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

## Pursue and safe apply

Pursue already documents the right V1 restraint: code-changing work is serial
until runtime-owned safe apply exists. See [docs/flows/pursue.md](../flows/pursue.md).
Current writable relay fanout is also serialized because branches share the
parent checkout. See [src/runtime/executors/fanout.ts](../../src/runtime/executors/fanout.ts).

Target rule:

> Agents propose. Circuit applies.

A future ChangePacket should include:

- base ref;
- patch ref and hash;
- runtime-computed touched files;
- claims;
- evidence;
- commands run;
- risks;
- apply recommendation.

Safe apply must reject mismatched bases, protected-file drift, weak proof,
generated-surface drift, and final verification failure. The future worktree and
change-packet direction is sketched in
[docs/ideas/sandboxed-parallel-pursuits.md](sandboxed-parallel-pursuits.md).

## Generated surface implications

Generated surfaces are an asset, not cruft. Circuit already treats Claude and
Codex surfaces, manifests, schematics, and flow output as generated from source.
See [docs/generated-surfaces.md](../generated-surfaces.md).

But the current generated host surfaces still teach host-side flow selection and
direct flow commands. See [src/commands/run.md](../../src/commands/run.md) and
[plugins/codex/skills/run/SKILL.md](../../plugins/codex/skills/run/SKILL.md).

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
- Config v1 and old selection fields cannot be used in the runtime path.
- Generated docs cannot describe Circuit primarily as a flow runner.

## Roadmap

1. Add a WorkContract projection carried by existing flows.
2. Add `guidance.decision` trace entries while behavior mostly mirrors current
   selection.
3. Move relay execution through GuidanceDecision.
4. Introduce PolicyEnvelope and remove selection-centered runtime authority.
5. Rework checkpoints as authority boundaries.
6. Add Claim, Evidence, ProofAssessment, and typed recovery.
7. Update generated surfaces to intent-first product framing.
8. Build ChangePacket and SafeApply.
9. Let Pursue use SafeApply before enabling parallel write autonomy.

## Unsettled items

These are intentionally not resolved by this brief:

- Exact WorkContract schema: separate file or projection from existing FlowData.
- Whether direct flow commands remain public expert tools or dev-only.
- Exact names for PolicyEnvelope, WorkContract, GuidanceDecision, and
  ProofAssessment.
- How much SelectionResolution provenance code can be reused.
- Exact claim and evidence taxonomy.
- How memory refs are represented and stale memory is downweighted.
- Whether context packet selection is its own decision or folded into relay
  execution.
- How an operator-authorized policy change differs from a one-run override.
- Safe apply baseline cleanliness rules for dirty parent checkouts.

## Future LLM review prompts

Use these prompts to sharpen the pivot:

1. Attack this pivot for contradictions with the current Circuit runtime,
   schemas, generated surfaces, and Pursue docs. Separate confirmed fact,
   inference, and speculation.
2. Design the smallest WorkContract schema that can replace current selection,
   checkpoint, and proof authority without inventing a second runtime.
3. Find every old authority path that could survive the hard cutover. Give grep
   probes and death tests.
4. Design a `guidance.decision` schema that is auditable without becoming prose
   theater.
5. Design a proof model that agents cannot satisfy by writing plausible reports.
6. Review generated Claude and Codex surfaces for old flow-runner mental model
   leaks.
7. Design SafeApply so it improves autonomy without overclaiming sandboxing or
   semantic merge safety.

## Adversarial review record

Review pass 1 found four medium risks:

- over-deleting Flow rather than demoting it;
- letting `guidance.decision` become explanation prose;
- contradicting the latest stance on direct flow commands;
- deleting safe defaults too broadly.

Those risks are resolved in this brief.

Review pass 2 found no medium-or-above issues. Remaining low risks are naming
and exact schema shape, both listed as unsettled items.
