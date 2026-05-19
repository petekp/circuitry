# Adversarial Review: Circuit Schema First Principles

Status: adversarial architecture review  
Target: `docs/circuit-schema-first-principles-architecture.md`  
Date: 2026-04-18

## Executive Verdict

Do **not** approve the Layered Circuit Definition as the final architecture yet.

The proposal identifies the right pain: current v2 manifests are strong runtime
topology manifests but weak authoring/control definitions. It is also right that
model, effort, prompt, skill, budget, adapter, checkpoint, retry, and safety
control cannot be solved by only adding a flat `model_policy` to outer manifest
steps.

The overreach is the proposed cure. A general authoring definition with phases,
artifacts, work units, intent, controls, and mode behavior is too broad to
approve before proving three harder facts:

1. Work units are stable enough to model statically.
2. Intent dimensions can stay small and deterministic.
3. The compiler can avoid becoming a second runtime or a second source of truth.

Those are not yet proven. Some current workflows actively disprove the simplest
reading of the proposal: Sweep categories, Migrate batches, Repair diagnostic
paths, and the `workers` loop all create run-time instances whose count and
shape are discovered from evidence, not known up front.

The stronger near-term target is a narrower hybrid:

> **Work-Pattern Policy Compiler**
>
> Keep the v2 runtime manifest as the authoritative outer topology. Add an
> authoring/control layer that describes typed work patterns under dispatch
> steps, not every concrete work-unit instance. Compile or project those
> patterns into v2-compatible manifests, human summaries, prompt contracts, and
> receipt expectations. Runtime work-unit instances are recorded in receipts and
> diagnostics, not canonical runtime events.

This preserves the good parts of the proposal while reducing schema surface,
migration risk, and custom-author burden.

## Sources Reviewed

This review re-read the proposal and checked it against:

- `docs/model-effort-tournament-showdown.md`
- `docs/model-effort-step-selection-architecture.md`
- `schemas/circuit-manifest.schema.json`
- `skills/*/circuit.yaml`
- `skills/*/SKILL.md`
- `docs/workflow-matrix.md`
- `skills/run/references/rigor-profiles.md`
- `ARCHITECTURE.md`
- `CUSTOM-CIRCUITS.md`
- `docs/compile-oriented-architecture-rfc.md`
- `docs/control-plane-ownership.md`
- runtime consumption points under `scripts/runtime/engine/src/`, especially
  `bootstrap.ts`, `manifest-utils.ts`, `dispatch-step.ts`, `resume.ts`,
  `dispatch.ts`, `config.ts`, `command-support.ts`, and
  `runtime-core/types.ts`.

## Review Criteria

I used the following criteria rather than accepting the proposal's own framing:

| Criterion | Adversarial question |
|---|---|
| Human legibility | Does the schema make workflows easier to review, or does it turn readable prose into dense YAML? |
| Agent legibility | Can agents execute from structured facts, or do they still need to infer behavior from prose? |
| Runtime fit | Does the design preserve the strict v2 runtime topology, ledger-derived state, and transport-neutral events? |
| Authorability | Can a custom circuit author still write a simple workflow without learning a compiler DSL? |
| Migration cost | Can existing v2 manifests run unchanged while built-ins migrate gradually? |
| Verification | Is every new field owned, validated, and freshness-checked? |
| Config/provider boundary | Do provider model IDs, effort flags, adapters, and installed skills stay in config/adapters? |
| Failure modes | What happens when generated files drift, mode behavior conflicts, budgets block floors, or dynamic work appears? |
| SKILL prose boundary | Is schema replacing only machine-significant controls, or trying to encode judgment better left in prose? |
| One-owner discipline | Does the design obey the compile-oriented RFC's "one owner per fact" rule? |

## Current-System Reality

The current system has a deliberate split:

| Area | Current owner | Important fact |
|---|---|---|
| Runtime topology | `skills/*/circuit.yaml` | Strict v2 graph of steps, artifacts, gates, routes, and exchange paths. |
| Execution contract | `skills/*/SKILL.md` | The orchestrator follows prose for commands, prompts, rigor behavior, and inner work. |
| Runtime state | ledger events plus projections | `state.json` and `active-run.md` are derived, not authoritative. |
| Dispatch routing | `.circuit/bin/dispatch` plus config | Resolves adapter from override, role, circuit, default, then auto-detect. |
| Inner worker loop | `skills/workers/SKILL.md` | Owns implement -> review -> converge state under a child relay root. |
| Rigor behavior | workflow docs plus SKILL prose | The engine only reads `entry_mode.start_at`; mode-specific behavior lives outside runtime logic. |
| Compiler path | catalog compiler | Current RFC explicitly constrained generation to mechanical public/plugin surfaces. |

That reality matters because the Layered Definition proposes to move some of
the richest SKILL-owned behavior into schema. That may be right, but it is not a
small extension of the current architecture. It changes the ownership model.

## Strongest Objections

### 1. The proposal over-models before proving the stable primitive

The proposal says the hidden controllable unit is the work unit. That is only
half true.

For Explore Tournament, "work unit" is a plausible static concept:

- `diverge.a`
- `diverge.b`
- `diverge.c`
- `adversarial-review.a`
- `revise.a`
- `stress-test.a`

For Sweep and Migrate, the true primitive is not a static work unit. It is a
work pattern:

- Sweep survey creates one worker per selected category.
- Sweep execute creates one batch per triaged queue group.
- Migrate execute creates one batch per approved migration slice.
- `workers` creates slices from a child `CHARTER.md` and then creates repair
  slices when review fails.

If the schema tries to list every unit statically, it will lie. If it accepts
arbitrary dynamic units, the runtime must learn a job scheduler. The safer
middle is to model pattern templates plus constraints, then record actual
instances in receipts.

### 2. "Intent before compute" is under-specified as the policy root

Portable intent is valuable, but pure intent is not enough for deterministic
model/effort control.

Fields such as `purpose`, `consequence`, `context`, `mutation`, `independence`,
and `latency` are expressive but subjective. Two authors can describe the same
work differently and accidentally select different models. Worse, local config
would become a hidden rules engine that translates a taxonomy into concrete
profiles.

The earlier model/effort tournament's Bounded Adaptive Profile Stack is more
operationally precise:

- default profile
- floor profile
- allowed profiles
- ensemble eligibility
- rigor multiplier
- deterministic escalation rules
- budget behavior
- adapter binding
- receipt diagnostics

Intent should inform that stack. It should not replace explicit floor/default
profiles where safety, cost, and determinism matter.

### 3. Mode behavior in schema conflicts with current runtime semantics

Current architecture says each workflow has one maximum topology and the engine
uses only `entry_mode.start_at`. Profile behavior such as Lite skipping review
or Autonomous auto-resolving checkpoints is SKILL-owned procedure.

The proposal's examples include:

- `skip_phases`
- `add_work_units`
- `checkpoint_policy`
- `stop_conditions`
- `intent_adjustments`

Those are useful concepts, but they are not merely authoring fields. If they
change routes, gates, required reads, or artifact optionality, they affect the
runtime manifest. That means one of two things must happen:

1. Compile a selected-mode-specific runtime snapshot at bootstrap.
2. Teach runtime core to understand mode deltas.

The second option violates the desired runtime boundary. The first option is
promising but must be named explicitly as per-run static compilation, with
freshness and "do not edit generated" rules.

### 4. The compiler can easily become a hidden runtime

The compile-oriented RFC allowed a narrow compiler for mechanical public/plugin
surfaces and explicitly rejected a full workflow authoring DSL for that pilot.
The proposal reopens that question, which is allowed, but it must clear a
higher bar.

A safe compiler can normalize static definitions into a v2 snapshot. An unsafe
compiler starts doing runtime work:

- reading SKILL prose to infer hidden policy
- deciding dynamic worker counts from repo state
- applying local config to shipped workflow definitions
- generating mode-specific behavior from ambiguous deltas
- materializing run facts before the run has evidence

The review red line is simple: the compiler may normalize static authoring
facts. It must not inspect runtime evidence or local provider availability to
change workflow topology.

### 5. The proposal weakens custom circuit authoring unless it has a strict minimal form

`CUSTOM-CIRCUITS.md` currently teaches a two-file model:

- `circuit.yaml` for topology
- `SKILL.md` for execution contract

That is approachable. The proposal's advanced v3 examples are not.

Artifact registries, phase kinds, work-unit patterns, intent, skill policy,
prompt contracts, budget merges, checkpoint policies, safety boundaries, and
mode deltas may all be legitimate for built-ins. They are too much as the entry
price for a custom two-step research workflow.

Any v3 direction must preserve:

- v2 manifest support indefinitely or for a long staged period
- a compact authoring subset
- generated validation messages that teach, not merely reject
- examples that start with simple single-dispatch workflows

Without that, the architecture optimizes built-in workflow power at the expense
of custom circuit authors.

### 6. SKILL prose is not just missing structure; it is carrying judgment

The proposal treats many prose-owned facts as hidden machine policy. Some are.
Examples that deserve structure:

- "max two domain skills"
- "review is diagnose-only"
- "cutover review must not downgrade"
- "Autonomous stops after three Sweep batches"
- "workers is an internal adapter, not a skill to inject"

But other SKILL sections are judgment protocols:

- how to choose tournament stances
- how to revise a migration plan after an `adjust` checkpoint
- when Sweep PROVE evidence is sufficient
- when Repair's diagnostic path is justified despite no repro
- how to synthesize contradictory external/internal evidence

Those should remain prose, perhaps with structured guardrails. Encoding them in
schema would create a brittle pseudo-program that is less legible than prose and
less executable than code.

### 7. Runtime event neutrality is easy to violate

The proposal correctly says model, effort, adapter, skill, and budget resolution
belong in receipts or diagnostics, not canonical runtime events.

The current repo is in a transitional state: schema regressions already accept a
transport-neutral dispatch receipt observation with `exchange_id`, while legacy
receipt observations can still carry `adapter`, `transport`, and
`resolved_from`. Any new work-unit policy must push further toward neutral
exchange facts, not add more policy to planner-visible facts.

Red line: no `model`, `effort`, `profile`, `skills`, `budget_decision`, or
provider binding fields in canonical runtime event payloads or runtime-core
facts.

### 8. Checkpoint auto-resolution is not just schema

Autonomous checkpoint behavior has three different concerns:

- Is a checkpoint present in topology?
- Is this kind of checkpoint eligible for auto-resolution?
- Does the current evidence justify auto-resolution?

The proposal can model the first two. The third remains judgment over current
artifacts. If schema claims it can auto-resolve without a receipt explaining
evidence, it creates silent consent.

Auto-resolution should therefore be:

- policy eligibility in schema
- evidence decision in the orchestrator/adapter
- explanation in checkpoint response or diagnostics
- never a hidden compiler decision

## Disqualifiers For The Current Proposal

The Layered Definition should be rejected or paused if any of these become true:

- Runtime core must consume authoring-only fields to execute a run.
- The compiler reads `SKILL.md` prose to infer machine-owned facts.
- Generated runtime manifests are not stable, checked, and clearly marked.
- Custom circuits must migrate to advanced v3 before v2 support remains solid.
- Work-unit instances must be listed statically for dynamic workflows.
- Provider model IDs or effort flags appear in shipped workflow definitions.
- Policy resolution details appear in canonical runtime events.
- Mode deltas can skip/add phases without compiling a selected runtime snapshot.
- `workers` internals become parent workflow facts instead of an adapter-owned contract.

## Under-Modeled Areas

The proposal needs more detail in these areas before it can be implementation
guidance:

| Area | Missing detail |
|---|---|
| Dynamic work instances | How to represent units discovered from queue, inventory, or batch state. |
| Pattern vs instance | Which fields describe a reusable pattern and which describe a concrete dispatch. |
| Orchestrator mutation | Repair Analyze can contain containment/instrumentation; mutation policy is not only for worker dispatch. |
| Receipt schema | Exact location and shape for work-unit policy resolution, skill selection, budget decisions, and adapter binding. |
| Mode compilation | Whether mode deltas compile into per-run manifests or remain advisory. |
| Prompt contracts | How template names map to existing `compose-prompt` behavior and worker report protocols. |
| Skill identity | Whether built-in skill slugs, domain-skill categories, or capabilities are the stable schema primitive. |
| Budget precedence | Exact merge order across workflow defaults, mode, phase, work pattern, user config, and run cap. |
| Freshness checks | How generated manifests and summaries prove they match the authoring source. |

## Over-Modeled Areas

The proposal should cut or defer these:

| Area | Why it is risky |
|---|---|
| Full artifact registry for all workflows | Useful, but not necessary to solve compute/skill/prompt control first. |
| Arbitrary `add_work_units` mode deltas | Easy to create mode-specific graphs the runtime cannot explain. |
| Rich semantic gate contracts | Better gates are good, but semantic gates can become unenforceable promises. |
| Programmatic DSL option | The repo's human-authoring goals make this a distraction unless limited to internal tests. |
| Broad intent taxonomy | Taxonomy sprawl can hide compute selection logic in config. |
| Replacing `model_policy` with intent entirely | Removes a deterministic safety floor that reviews and migrations need. |

## Alternatives

### Option A: Smaller v2 Dispatch Policy Extension

Add optional policy only to v2 dispatch steps:

```yaml
model_policy:
  default_profile: review-high
  floor_profile: review-standard
  allowed_profiles: [review-standard, review-high, review-critical]
skills:
  max: 2
  domain_selected: true
prompt:
  template: ship-review
safety:
  mutation: read_only
```

Strengths:

- Lowest migration cost.
- Directly helps model, effort, skills, prompts, and safety.
- Existing manifests remain recognizable.

Weaknesses:

- Does not expose hidden fanout or inner loops.
- Still makes the outer step carry too much meaning.
- Likely becomes a bridge, not the final architecture.

Use when: the immediate goal is dispatch policy and receipt visibility.

### Option B: Policy Overlay

Keep v2 manifests unchanged and add a separate policy file keyed by workflow and
step.

Strengths:

- Avoids strict manifest churn.
- Easy for local override experiments.
- Useful for provider/profile config.

Weaknesses:

- Splits the workflow contract.
- Raises drift risk on step rename.
- Hurts human and agent legibility unless tooling always presents a merged view.

Use when: project-local overrides are more important than shipped authoring clarity.

### Option C: Full Layered Circuit Definition

The proposal's main option: author phases, artifacts, work units, intent,
controls, and modes, then compile a runtime manifest.

Strengths:

- Best long-term legibility if it stays disciplined.
- Gives every policy a structured home.
- Keeps runtime strict if compilation is clean.

Weaknesses:

- Too broad before pattern/instance boundaries are proven.
- High custom-author burden.
- High compiler ownership risk.
- Easy to encode judgment as brittle YAML.

Use when: after a real workflow rewrite proves it is clearer than v2 YAML plus
SKILL prose.

### Option D: Work-Pattern Policy Compiler

Model typed patterns under outer steps instead of concrete work-unit instances.

Example shape:

```yaml
steps:
  - id: survey
    kind: dispatch
    work_patterns:
      - id: category-survey
        pattern: dynamic_fanout
        unit_id: "survey.{category}"
        dynamic_from: sweep.category_set
        role: researcher
        prompt: { template: research }
        skills: { max: 2, domain_selected: true }
        model_policy:
          default_profile: scan-fast
          floor_profile: scan-fast
          allowed_profiles: [scan-fast, research-standard, research-high]
        budget:
          max_parallel: 5
        output_contract: category-findings@v1
```

The actual runtime can record instances in receipts:

```json
{
  "work_unit_instance": {
    "pattern_id": "category-survey",
    "unit_id": "survey.dead-code",
    "selected_profile": "scan-fast",
    "skills_included": ["tdd"],
    "budget_decision": "allowed"
  }
}
```

Strengths:

- Captures hidden fanout without pretending all instances are static.
- Keeps parent workflows out of `workers` internals.
- Supports compute/skill/prompt/budget policy at the real control point.
- Can compile to current v2 outer graph while adding summaries and receipts.

Weaknesses:

- Still needs a new schema or v2 extension.
- Requires precise pattern vocabulary.
- Does not fully solve mid-pattern resume unless the runtime later tracks instances.

Use when: the goal is strong control without turning Circuit into a job scheduler.

### Option E: Work-Unit-First Runtime

Make runtime state track work units directly and treat phases as labels.

Strengths:

- Cleanest operational model for retries, fanout, and scheduling.
- Natural fit for work-unit receipts and compute selection.

Weaknesses:

- Biggest runtime migration.
- Poor top-level human authoring model.
- Checkpoints and synthesis become awkward special units.

Use when: only after the product chooses a scheduler-like runtime. That is not
the current Circuit shape.

### Option F: Prose Plus Receipts Only

Do not add schema yet. Instrument existing dispatches and worker loops with
policy receipts.

Strengths:

- Minimal authoring churn.
- Reveals real policy needs before schema hardens.
- Good way to discover work-unit instance shapes.

Weaknesses:

- Does not improve source legibility enough.
- Agents still rely on prose for policy.
- Harder to review dangerous workflow changes.

Use when: evidence gathering is more valuable than schema commitment.

## Tradeoff Matrix

| Dimension | A: v2 policy | B: overlay | C: full layered | D: work-pattern compiler | E: unit runtime | F: receipts only |
|---|---|---|---|---|---|---|
| Human legibility | Medium | Low | High if disciplined | High for built-ins, medium for custom | Low-medium | Low |
| Agent legibility | Medium | Medium | High | High for controls, medium for procedure | High | Medium |
| Runtime fit | High | High | Medium-high if compiled | High | Low-medium | High |
| Work-unit control | Low-medium | Medium | High | High | High | Medium |
| Dynamic unit fit | Low | Medium | Medium unless templates exist | High | High | Medium |
| Authorability | Medium-high | Low-medium | Medium-low | Medium with minimal subset | Low | High |
| Migration cost | Low | Low | Medium-high | Medium | High | Low |
| Verification | Medium | Medium | High but expensive | High and scoped | High but expensive | Medium |
| Provider boundary | High | High | High if disciplined | High | High | High |
| Cleanup burden | Medium | High | Medium | Low-medium | Medium-high | Medium |

Recommendation: pursue Option D, with Option A as the first implementation
slice and Option F as the evidence-gathering fallback.

## Stress Tests

### Explore Tournament

Full Layered Definition mostly fits, because the tournament has a bounded
sequence and known rounds. The risk is that the proposal wants to model the
tournament inside `decide`, while the current manifest exposes `decide` as
orchestrator synthesis. If tournament workers are structured but runtime only
sees the outer synthesis step, resume and receipts remain partial.

Better fit: define a `tournament` work pattern under `decide`, with static round
templates and receipt instances. Do not split it into top-level runtime steps
until there is a per-run compiled manifest story.

### Sweep

Static work units fail here. Categories depend on sweep type. Batches depend on
triage output. Autonomous stops after three batches or a time budget. PROVE
adjudication is conditional.

Better fit: dynamic fanout patterns:

- survey category template
- PROVE evidence template
- batch execution template
- final diagnose-only audit template

Receipts record actual categories and batches. Schema owns policy ceilings,
mutation rules, prompt templates, and compute floors.

### Migrate

Inventory fanout can be static. Batch execution cannot. Batch count, order, and
rollback boundaries are created by `plan.md`. The mandatory re-evaluation after
each batch is also judgment over new evidence, not static topology.

Better fit: static inventory pattern plus dynamic batch execution pattern.
Cutover review should have an explicit `review-critical` floor or equivalent
policy, but plan adjustment remains SKILL-guided procedure.

### Build

Build exposes a sharp ownership boundary. The parent Build workflow owns the
outer `act` dispatch step. The `workers` adapter owns implement -> review ->
converge under the child relay root.

A parent v3 definition must not reach into `workers` internals. It can declare:

- this step delegates to `workers_loop`
- parent-readable contract files
- profile floors for implementation/review/converge roles
- mutation and verification expectations
- outer result mapping

The `workers` adapter should own its own internal pattern schema if needed.

### Repair

Repair reveals an under-modeled issue: the Analyze phase can recommend
containment or instrumentation when no repro is available. That can be mutating
work inside a phase that the v2 manifest calls orchestrator synthesis.

Any safety/mutation policy limited to worker dispatch is incomplete. The schema
needs a way to say an orchestrator phase is normally read-only but may perform a
bounded diagnostic mutation under explicit conditions, or it should force that
mutation through a dispatch/workers pattern.

### Custom Circuits

The full proposal risks making a two-step research workflow too expensive to
author. A custom author should not need a work-pattern schema unless they are
using fanout, workers, tournament, or nontrivial policy.

Required minimal path:

```yaml
schema_version: "2"
circuit:
  steps:
    - id: frame
      kind: synthesis
    - id: investigate
      kind: dispatch
      # optional policy only when needed
```

Advanced patterns should be opt-in.

### Model, Effort, Skills, Prompts, Adapters

The original model/effort tournament remains stronger than pure intent. The
first policy implementation should use explicit logical profiles with floors
and allowed ranges, then optionally include broader intent metadata.

Provider IDs stay in config. Adapter constraints can be schema-owned only as
portable capability constraints, not provider choices.

### Autonomous

Autonomous is not a single behavior. It is a bundle:

- checkpoint auto-resolution eligibility
- evidence threshold
- stop conditions
- final audit floors
- deferred finding rules
- budget caps

Schema can own eligibility, stop caps, and required receipts. It should not hide
evidence judgments in a compiler or profile name.

## Recommended Architecture

Adopt a constrained version of the Layered Definition:

```text
Authoring/control layer
  - outer v2 step identity
  - optional work-pattern contracts
  - prompt/skill/compute/safety/budget/checkpoint policy
  - mode policy only where it compiles statically
        |
        v
Compiled/projected runtime manifest
  - strict v2-compatible steps
  - paths, gates, routes, protocols
  - no provider IDs
        |
        v
Runtime ledger/events
  - transport-neutral facts
  - outer step state
        |
        v
Receipts/diagnostics
  - work-unit instances
  - selected profiles
  - concrete adapter/model/effort bindings
  - skill inclusion/omission
  - budget and fallback decisions
```

Name the main primitive **work pattern**, not work unit. Work units are runtime
instances of patterns.

## First Slice

Do not start by rewriting all workflows or runtime core.

1. Define an experimental `WorkPatternIR` type in docs or tests:
   - `id`
   - `parent_step_id`
   - `pattern`: `single`, `static_fanout`, `dynamic_fanout`, `workers_loop`,
     `tournament`, `audit`
   - `unit_id_template`
   - `dynamic_from`
   - `role`
   - `prompt_template`
   - `skill_policy`
   - `model_policy`
   - `budget`
   - `safety`
   - `output_contract`
2. Rewrite **Sweep** as the first experimental definition, because it is the
   hardest case for static work units.
3. Rewrite **Explore Tournament** second, because it is the easiest case for
   static tournament rounds.
4. Generate a human summary from the definitions:
   - expensive/critical work
   - max fanout/concurrency
   - diagnose-only work
   - mode differences
   - checkpoints and auto-resolution eligibility
5. Compile or project to the current v2 manifest without changing runtime core.
6. Add resolver fixtures for model/skill/prompt/budget decisions.
7. Add receipt examples for actual work-unit instances.
8. Only after those pass, decide whether the authoring source replaces
   `skills/<slug>/circuit.yaml` or lives beside it.

## Red Lines For Implementation

- Do not introduce a second compiler path unless an ownership RFC explicitly
  supersedes the catalog compiler rule.
- Do not parse SKILL prose for machine-owned facts.
- Do not make generated manifests editable.
- Do not require provider model IDs in workflow definitions.
- Do not let custom circuits lose the v2 minimal path.
- Do not put policy details in runtime-core facts or canonical event payloads.
- Do not let parent workflows depend on `workers` private files such as
  `batch.json`.
- Do not use `mode.skip_phases` or `mode.add_work_units` unless it compiles to a
  selected manifest snapshot with deterministic reads/writes/routes.

## What To Change In The Proposal

1. Downgrade the recommendation from "choose Layered Circuit Definition" to
   "prove a constrained Work-Pattern Policy Compiler."
2. Replace static `work_units` language with `work_patterns` plus runtime
   `work_unit_instances`.
3. Keep the Bounded Adaptive Profile Stack as the primary compute-control
   mechanism; let `intent` supplement it.
4. Add an explicit SKILL prose boundary: schema owns machine-significant
   controls, prose owns judgment protocols and examples.
5. Add a mode-compilation section that explains whether mode deltas produce a
   selected runtime snapshot.
6. Add a custom-authoring minimal subset before any advanced v3 examples.
7. Add disqualifiers and red lines from this review.
8. Use Sweep as the first proof, not Migrate or Build. Sweep is the best
   falsification test for static work-unit modeling.

## Decision

The proposal is directionally right but not decision-ready as written.

Approve the following:

- v2 manifests remain the runtime source for existing circuits.
- Provider details remain in config/adapters.
- Runtime events remain transport-neutral.
- Receipts/diagnostics carry policy resolution.
- Work patterns become the experimental authoring/control primitive.
- Static logical profiles with floors/defaults/allowed ranges remain the first
  compute-control primitive.

Do not approve yet:

- replacing `skills/*/circuit.yaml` with a broad v3 definition
- requiring custom authors to learn advanced work-unit schema
- compiling dynamic evidence-dependent behavior into topology
- treating free-form intent as sufficient for model/effort control

The next architecture step should be a proof artifact, not a migration plan.
That proof plan now lives in `docs/work-pattern-policy-compiler-proof-slice.md`.
