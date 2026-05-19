# Tournament Showdown: Model And Effort Strategy For Circuit

## Goal

Find the strongest architecture for letting Circuit spend model capability where
it matters: fast and cheap for routine scans or small edits, stronger for
implementation and diagnosis, and deliberately high-rigor for architecture
decisions, migrations, high-risk diffs, and independent review.

This is a tournament over Circuit policy shapes, not a ranking of Claude, Codex,
Cursor, or any single model vendor.

## Decision Frame

Circuit currently chooses *transport* for worker dispatch: adapter override,
semantic role, circuit override, default adapter, then auto-detection. That is
useful, but it does not answer the harder question:

> Given this workflow, step, rigor profile, attempt number, risk signal, adapter,
> and user budget, what logical compute profile should this dispatch use, and how
> should that profile bind to Claude Code, Codex, Cursor Agent, or custom
> wrappers?

The decision horizon is the next year of Circuit development. The first slice
must be small enough to land in the existing runtime, but the architecture must
not paint Circuit into static adapter aliases or provider-specific manifests.

## Invariants

- Built-in workflow manifests express task intent, not provider model IDs.
- Provider-specific model IDs and effort flags live in config or adapter
  bindings, not shipped workflow manifests.
- Existing `dispatch.roles`, `dispatch.circuits`, `dispatch.default`, adapter
  override, and auto-detect behavior continue to work when no compute policy is
  configured.
- Canonical runtime events stay transport-neutral. Adapter, argv, fallback,
  model, effort, diagnostics, and selection explanations belong in dispatch
  receipts or diagnostics.
- Dynamic selection is bounded, deterministic, explainable, and budget-governed.
- Static custom wrappers remain supported.
- Missing model mappings must degrade explicitly: inherit/default when safe,
  checkpoint/escalate when the step floor cannot be honored.
- Circuit should not spend premium profiles on routine work by default.
- Circuit should not use weak profiles for cutover reviews, security/data/runtime
  boundaries, irreversible decisions, or high-risk code edits.

## Non-Goals

- Replacing the adapter system.
- Making manifests depend on a user's local paid model catalog.
- Building an AI-assisted cost optimizer in the first implementation.
- Normalizing every provider into identical model and effort semantics.
- Changing orchestrator synthesis model selection in the first slice. Worker
  dispatch is the first target; orchestrator subprocess control can follow after
  the policy vocabulary proves itself.

## Constraints

- `schemas/circuit-manifest.schema.json` has `additionalProperties: false` on
  steps. A step-level policy requires a schema migration and fixtures.
- Step manifests currently allow `id`, `title`, `executor`, `kind`, `protocol`,
  `reads`, `writes`, `gate`, `routes`, optional `budgets`, optional
  `capabilities`, and optional checkpoint metadata. There is no
  `model_policy`.
- `.circuit/bin/dispatch` currently accepts `--prompt`, `--output`, `--adapter`,
  `--circuit`, `--config`, and `--role`. It explicitly rejects `--step`.
- `dispatch.ts` resolves adapter transport only. It has no step, rigor, attempt,
  diff, budget, model, or effort input.
- Built-in Codex dispatch currently launches
  `codex exec --full-auto --ephemeral -C WORKSPACE -o OUTPUT -`.
- `codex-runtime.ts` writes an isolated `CODEX_HOME/config.toml` containing only
  project trust configuration, so ambient Codex model or effort config does not
  carry through.
- The built-in `agent` adapter returns a structured Agent receipt for the Claude
  Code host. Whether that in-process Agent path can honor model/effort metadata
  remains unproven.
- Custom process adapters are static argv arrays. Circuit appends
  `PROMPT_FILE OUTPUT_FILE`; wrapper internals are opaque unless Circuit adds a
  typed profile binding layer.
- Current runtime-core work is actively hardening the rule that worker facts are
  transport-neutral. New compute details must stay outside planner-visible facts.
- Plugin runtime changes under `hooks/`, `skills/`, `scripts/`, or
  `.claude-plugin/` require `./scripts/sync-to-cache.sh`. This document-only
  tournament does not require sync.

## External Surfaces

- `skills/*/circuit.yaml`
- workflow SKILL prose, especially `skills/run/references/rigor-profiles.md`
- `.circuit/bin/dispatch`
- `.circuit/bin/circuit-engine dispatch-step` and `reconcile-dispatch`
- `scripts/runtime/engine/src/dispatch.ts`
- `scripts/runtime/engine/src/codex-runtime.ts`
- `scripts/runtime/engine/src/cli/dispatch.ts`
- `schemas/circuit-manifest.schema.json`
- `schemas/event.schema.json`
- `scripts/runtime/engine/src/runtime-core/*`
- `circuit.config.yaml`, `~/.claude/circuit.config.yaml`, and
  `circuit.config.example.yaml`
- dispatch request, receipt, result, and diagnostics files under run roots
- README, `ARCHITECTURE.md`, generated surface manifests, and install verifier

## Current System Map

| Area | Current Owner | Inputs | Outputs | Dependencies | Pain |
|------|---------------|--------|---------|--------------|------|
| Workflow topology | `skills/*/circuit.yaml` | Workflow author intent | Strict step graph | Manifest schema | Dispatch steps have no compute policy field |
| Rigor language | `docs/workflow-matrix.md`, `skills/run/references/rigor-profiles.md`, SKILL prose | User/router mode | Budget/checkpoint/review expectations | Human orchestration | Rigor affects behavior in prose, not dispatch compute |
| Adapter routing | `dispatch.ts` + config | adapter override, role, circuit, default | adapter, transport, runtime boundary | config loader | Routes transport, not model/effort |
| Dispatch CLI | `cli/dispatch.ts` | prompt, output, adapter, circuit, role | dispatch receipt | `dispatchTask` | No supported step input; `--step` is rejected |
| Runtime step execution | `circuit-engine dispatch-step` | run root, step | request/receipt observation events | manifest-utils, command-support | Knows step identity but does not execute adapter selection |
| Built-in Codex | `codex-runtime.ts` | prompt, output, cwd, isolated home | process result and diagnostics | Codex CLI | No per-dispatch model or effort flags |
| Built-in Agent | `buildAgentReceipt` | prompt, output | Agent params receipt | Claude Code host Agent tool | Structured but currently inherit-only for model/effort |
| Custom adapters | `dispatch.adapters.*.command` | static argv plus prompt/output | process result | user wrapper | Can bake flags but Circuit cannot reason about them |
| Worker loops | `skills/workers/SKILL.md`, workflow SKILL prose | parent circuit and semantic role | implement/review/converge dispatches | `.circuit/bin/dispatch` | Roles are coarse; same role spans very different risk |
| Runtime events | schema + runtime-core types | observed request/receipt/result files | canonical events/facts | ledger/projection | New provider fields would violate transport-neutral design |

## Local Tool Evidence

Verified locally on 2026-04-17 in the prior evidence pass:

| Tool | Version | Model Control | Effort Control | Architectural Consequence |
|------|---------|---------------|----------------|---------------------------|
| Claude Code | `2.1.113` | `--model` | `--effort low/medium/high/xhigh/max` | A `claude-cli` process adapter can be explicit. The in-process `agent` adapter should stay inherit-only until proven. |
| Codex CLI | `0.118.0` | `--model` | config override such as `model_reasoning_effort` | Built-in Codex can likely bind profiles by adding argv/config to isolated launch. |
| Cursor Agent | `2026.04.14-ee4b43a` | `--model` | effort encoded in model IDs | Cursor needs adapter-specific model ID bindings, not a separate generic effort flag. |
| Custom wrappers | current config surface | arbitrary argv | arbitrary argv | Already powerful, but opaque without profile receipts. |

## Judging Criteria

| Criterion | What It Rewards |
|-----------|-----------------|
| Quality Lift | Better implementation, diagnosis, review, architecture decisions, and migration safety |
| Performance | Lower cost/latency on routine work without weakening high-risk steps |
| Portability | Works across Claude Code, Codex, Cursor Agent, and custom process adapters |
| Explainability | A maintainer can tell why a model/profile was selected |
| Determinism | Same inputs resolve to the same bounded selection |
| Runtime Fit | Respects current adapter, manifest, ledger, and receipt boundaries |
| Migration Cost | Can land incrementally without rewriting Circuit |
| Long-Term Power | Can grow into smarter dynamic routing and selective ensembles |
| Cleanup Burden | Avoids adapter alias sprawl and stale provider pins |

No fake numeric scores are used. Winners advance because they fit the evidence
and survive stronger failure-mode analysis.

## Tournament Contenders

### A. Incumbent Adapter Routing

Keep the current selection order: adapter override, role, circuit, default, auto.

Why it is serious:

- It already exists and is easy to understand.
- It keeps manifests completely portable.
- It is enough for users who only want "reviewers use Agent, implementers use
  Codex."

Where it loses power:

- It cannot express that `migrate.review` and `build.review` both use a reviewer
  role but need different compute floors.
- It cannot escalate on retries, partial results, high-risk diffs, or Deep/Tournament
  rigor.
- Model decisions disappear into wrappers or ambient tool config.

### B. Config-Only Adapter Variants

Leave manifests unchanged and define named adapters such as `codex-high`,
`cursor-review-critical`, or `claude-low` in config. Role and circuit routing
then select those aliases.

Why it is serious:

- It is the smallest usable improvement.
- It gives power users immediate model control through existing wrappers.
- It avoids manifest schema churn.

Failure modes:

- Adapter names proliferate until config becomes a model catalog.
- Per-step selection remains awkward because config routes by role/circuit, not
  workflow phase.
- Dynamic behavior inside wrapper scripts is opaque to Circuit and hard to audit.

### C. Role Tiers

Map semantic worker roles to logical compute tiers:

```yaml
dispatch:
  roles:
    researcher: research-high
    implementer: code-standard
    reviewer: review-high
```

Why it is serious:

- It matches the current dispatch role vocabulary.
- It is easy to explain to users.
- It is better than transport-only routing for many normal runs.

Failure modes:

- Same role does not imply same risk. `sweep.survey`, `migrate.inventory`, and
  `explore.analyze` are all research-shaped but need different defaults.
- It cannot naturally encode workflow-specific floors, e.g. cutover review.
- It misses Lite/Deep/Tournament variation unless another layer is added.

### D. Concrete Provider Pins In Manifests

Add direct step fields such as `model: gpt-5.4` and `effort: xhigh`.

Why it is serious:

- It is obvious in YAML.
- It directly answers "which model should this step use?"
- It is easy to test for a single provider.

Failure modes:

- Built-in manifests become tied to account-scoped and time-varying model IDs.
- Cursor encodes effort in model IDs, Codex uses config override, and Claude CLI
  has separate flags. The fields look portable but are not.
- Provider churn creates manifest churn and false validation failures.

### E. Capability Tags As Compute Policy

Reuse the existing `capabilities` field to say a step requires
`compute.review-critical` or `model.long-context`.

Why it is serious:

- It avoids a new top-level step concept.
- It resembles existing "what the worker needs" language.
- It can be adapter-neutral if capability names are logical.

Failure modes:

- Capability and compute policy are different concepts. A required capability is
  a hard functional constraint; a compute profile is a cost/quality selection
  with defaults, floors, and allowed alternatives.
- It gives no clean place for dynamic escalation, profile ordering, or budget
  decisions.
- It blurs validation: missing a capability should fail differently from missing
  a preferred model mapping.

### F. Step Compute Profiles

Each dispatch-capable step declares adapter-neutral compute intent:

```yaml
model_policy:
  default_profile: review-high
  allowed_profiles: [review-standard, review-high, review-critical]
  floor_profile: review-standard
```

Why it is serious:

- The workflow graph already knows the phase and risk shape.
- It distinguishes `build.act`, `build.review`, `migrate.execute`,
  `migrate.review`, `sweep.survey`, and `sweep.verify`.
- It keeps provider IDs out of manifests if profile names are logical.

Failure modes:

- Static defaults can overpay or underpower edge cases.
- It requires schema, config, dispatch, tests, and docs.
- Profiles can become vague if names are just `low`, `medium`, `high`.

### G. Rigor Multiplier

Use selected rigor (`Lite`, `Standard`, `Deep`, `Tournament`, `Autonomous`) to
raise or lower the step's compute profile.

Why it is serious:

- Rigor is already Circuit's product language for budget and review depth.
- It matches user intent better than asking users to name models.
- It makes `decide:` and Deep runs spend more carefully without provider pins.

Failure modes:

- Rigor alone is too coarse. A Deep run still contains cheap synthesis and
  high-risk review steps.
- Autonomous does not mean "cheap"; it means unattended with guardrails.
- Current rigor rules live mostly in prose, so the runtime needs explicit inputs
  before dispatch can use them deterministically.

### H. Adaptive Escalation Ladder

Start from a step's default/floor, then escalate inside allowed profiles when
context justifies it: retry attempt, partial/blocked result, risky diff, critical
file surface, Deep/Tournament rigor, migration cutover, or prior review failure.

Why it is serious:

- It has the best cost/performance story.
- It spends strong models in response to evidence, not habit.
- It makes retries smarter instead of merely repeated.

Failure modes:

- If unbounded, it becomes untraceable cost drift.
- If rules are vague, replay and tests become hard.
- If risk signals are unavailable at dispatch time, it silently devolves to
  static defaults.

### I. Provider Specialists

Route logical profiles to the provider/tool best suited to the work: Codex for
coding, Claude CLI/Agent for critique or synthesis, Cursor Agent for broad local
model portfolio, custom wrappers for team-specific models.

Why it is serious:

- It acknowledges that providers are not interchangeable at the edges.
- It lets Cursor's model catalog, Codex isolation, and Claude CLI effort flags
  each be used deliberately.
- It keeps model-specific knowledge in config/adapters.

Failure modes:

- Provider "strengths" can become folklore unless encoded as config bindings.
- It cannot choose by itself; it needs logical profiles as the input.
- Availability differs by account and changes over time.

### J. Portfolio Ensemble

Run multiple profiles/models in parallel for selected steps: Explore Tournament
proposals, adversarial review, cutover critique, high-risk security review, or
final architecture synthesis.

Why it is serious:

- It reduces single-model blind spots.
- It makes Tournament rigor real rather than decorative.
- It is appropriate for expensive or irreversible decisions.

Failure modes:

- Too expensive as the general mechanism.
- Needs convergence rules and normalized reports.
- Overkill for most Build, Repair, and Sweep work.

### K. Budget Governor

Put an explicit budget over the whole run:

```yaml
compute_budget:
  max_profile: review-critical
  allow_ensemble: false
  max_ensemble_steps: 0
  max_premium_dispatches: 2
  max_premium_retries_per_step: 1
  on_cap_exceeded: checkpoint
```

Why it is serious:

- It is the trust layer for any dynamic system.
- It makes cost/performance visible and enforceable.
- It protects Autonomous and Tournament from surprising spend.

Failure modes:

- It does not select a profile by itself.
- If too strict, it can block critical review and force human intervention.
- If only advisory, users will not trust dynamic escalation.

### L. Full AI Router

Introduce a model-router component that inspects all run context and asks a model
or heuristic engine to choose adapter, model, effort, and ensemble shape.

Why it is serious:

- It is the most flexible long-term idea.
- It can adapt to complex context without hand-authored rules.
- It can eventually learn from run outcomes.

Failure modes:

- Too much complexity before the policy vocabulary is stable.
- Harder to test deterministically, especially if AI-assisted.
- It risks moving provider-specific decisions into a black box.
- Replay becomes difficult unless every input and reason is captured.

### M. Run Compute Plan

At bootstrap, compile a deterministic compute plan for every dispatch step in
the run from workflow, rigor, config, and budget. Dispatch then executes the
precomputed plan, with limited retry amendments.

Why it is serious:

- It makes the run's intended spend visible early.
- It is highly replayable.
- It can be a good UX for approving Deep, Tournament, or Autonomous work.

Failure modes:

- It cannot know future diff size, result quality, or retry causes.
- It can become stale if the run transfers workflow or reroutes.
- It still needs step profiles, provider bindings, and budget rules underneath.

## Bracket Rounds

### Play-In: Incumbent Adapter Routing vs Config-Only Adapter Variants

**Config-Only Adapter Variants wins.**

The incumbent has maximum simplicity, but it cannot deliberately spend model
quality. Config-only variants are immediately useful: a user can create
`codex-high` or `cursor-review-critical` today and route reviewers there.

The win is narrow. Config variants are not a durable architecture because they
make profile semantics opaque and per-step routing awkward. They advance as the
best "do less" strategy, not as a likely champion.

### Play-In: Concrete Provider Pins vs Capability Tags

**Capability Tags wins, but only as the less harmful dead end.**

Provider pins are direct but violate the central invariant: built-in manifests
would name current vendor IDs. Capability tags at least stay adapter-neutral.

Capability Tags still lose later because compute policy is not the same thing
as functional capability. The bracket keeps the lesson: profile names must be
logical and portable, but they need their own policy field.

### Round 1: Config-Only Adapter Variants vs Role Tiers

**Role Tiers wins.**

Config aliases can choose a model, but they do not tell Circuit why that choice
was made. Role tiers preserve a semantic reason: implementers code, reviewers
critique, researchers gather evidence. That matches existing dispatch calls and
is easier to document.

Role tiers still have a hard ceiling. The tournament keeps their semantic
value but rejects them as the primary selection boundary because role is too
coarse for workflow risk.

### Round 1: Capability Tags vs Step Compute Profiles

**Step Compute Profiles wins.**

Step profiles create the missing policy home:

- `build.act` is implementation.
- `build.review` is independent critique.
- `migrate.review` is cutover risk.
- `sweep.survey` is broad inventory.
- `sweep.verify` is false-positive audit.
- `explore.analyze` may be single or parallel evidence gathering.

Capabilities can say "this worker needs a browser" or "this step requires repo
write access." Profiles say "this step has a `review-critical` floor and may
escalate to ensemble if budget allows." Mixing those would make both concepts
less clear.

### Round 1: Rigor Multiplier vs Run Compute Plan

**Rigor Multiplier wins, while borrowing Run Compute Plan's preview idea.**

Run Compute Plan is excellent for approval and replay, but it is a compiled
artifact rather than the underlying policy. It cannot choose sane defaults
without step profiles and rigor rules. It also has weak answers for retry,
partial result, and unexpected high-risk diff.

Rigor Multiplier wins because it uses an existing user-facing vocabulary:
Lite, Standard, Deep, Tournament, Autonomous. It should not be the only signal,
but it is the right run-level modifier.

The preview idea remains valuable: high-cost runs should be able to show an
estimated compute plan before dispatch.

### Round 1: Adaptive Escalation vs Full AI Router

**Adaptive Escalation wins.**

The AI router is powerful in theory, but too unconstrained as a first
architecture. Circuit needs deterministic fixtures for dispatch resolution.
Adaptive escalation can be rule-based: attempt number, prior completion,
verdict, diff size, critical path tags, rigor, and budget.

The AI router can return later as an advisory rule source only after receipts,
bindings, and profile constraints exist. For now, deterministic escalation is
the safer and more testable form of adaptivity.

### Round 1: Provider Specialists vs Portfolio Ensemble

**Provider Specialists wins for the general bracket. Portfolio Ensemble remains
an elite profile.**

Provider specialists are necessary every day because Codex, Claude, Cursor, and
custom adapters expose model controls differently. Ensemble is excellent but
selective: architecture tournaments, adversarial reviews, migration cutovers,
security/data correctness, and high-risk refactors.

The bracket result is not "no ensemble." It is "ensemble is one high-end profile
or rigor behavior, not the general routing strategy."

### Quarterfinal: Role Tiers vs Step Compute Profiles

**Step Compute Profiles wins, absorbing role as an input.**

Role tiers align with current dispatch calls, but the risk unit in Circuit is
the step. Examples:

| Step | Why Role Alone Is Insufficient |
|------|--------------------------------|
| `explore.analyze` | Standard evidence gathering can be medium, Tournament diverge needs multiple strong profiles |
| `build.act` | Often standard coding, sometimes high for runtime/security/data surfaces |
| `build.review` | Usually stronger than implementation, skipped or lowered only under explicit Lite rules |
| `repair.fix` | Standard when reproduced, high when flaky/no-repro or after failed attempt |
| `migrate.execute` | Implementation, but never cheap because coexistence and rollback matter |
| `migrate.review` | Cutover review needs a critical floor |
| `sweep.survey` | Broad scan can often be cheap/fast |
| `sweep.verify` | False-positive and stale-doc audit needs stronger judgment than survey |

The winning pattern is not role-free. Dispatch role remains part of adapter
resolution and diagnostics. It is simply not enough to select compute.

### Quarterfinal: Rigor Multiplier vs Adaptive Escalation

**Adaptive Escalation wins, absorbing rigor as a multiplier.**

Rigor expresses user intent at run level. Adaptive escalation expresses
evidence at dispatch level. A Deep run should raise analysis and review, but it
should not force every rote synthesis or tiny batch onto the most expensive
profile. A retry after a failed `code-standard` attempt should escalate even in
Standard.

The composition is stronger than either alone:

| Base Step Profile | Lite | Standard | Deep | Tournament | Autonomous |
|-------------------|------|----------|------|------------|------------|
| `scan-fast` | `scan-fast` | `scan-fast` | `research-standard` | n/a | budget-capped `scan-fast` |
| `code-standard` | `code-fast` when allowed | `code-standard` | `code-high` for risky steps | n/a | `code-standard`, escalate on failure |
| `review-high` | `review-standard` when review runs | `review-high` | `review-critical` for risky steps | n/a | `review-high` floor |
| `decision-high` | `decision-standard` if allowed | `decision-high` | `decision-critical` | `ensemble-decision` | checkpoint before tradeoff |

### Quarterfinal: Provider Specialists vs Budget Governor

**Provider Specialists wins as a selector, Budget Governor becomes mandatory
infrastructure.**

Provider specialists answer "which adapter binding is best for this logical
profile?" Budget Governor answers "is this allowed under user/project caps?"
Only the former can select compute. Only the latter can make dynamic selection
trustworthy.

The result is architectural composition: provider bindings are the concrete
translation layer; budget governor is the cap and audit layer.

### Semifinal: Step Profiles + Role Input vs Adaptive Escalation + Rigor

**Step Profiles + Adaptive Escalation + Rigor wins.**

Static step profiles provide floors, defaults, and allowed ranges. Rigor
adjusts those ranges based on user intent. Adaptive escalation reacts to
evidence. None of the three should replace the others:

- Without step profiles, dynamic rules pick arbitrary provider models.
- Without rigor, a Deep or Tournament run cannot express run-level ambition.
- Without adaptive escalation, Circuit overpays early or repeats weak attempts.

This combined contender becomes the first finalist.

### Semifinal: Provider Bindings + Budget Governor vs Config-Only Variants

**Provider Bindings + Budget Governor wins.**

Config-only variants are a useful compatibility layer, but typed profile
bindings are the durable version of the idea:

```yaml
model_profiles:
  code-standard:
    codex:
      model: gpt-5.4
      effort: medium
    cursor-agent:
      model: gpt-5.4-medium
    claude-cli:
      model: sonnet
      effort: medium
```

The typed layer lets Circuit validate, explain, and test mappings. The budget
governor prevents typed mappings from becoming hidden premium spend.

This combined contender becomes the second finalist.

### Final: Policy Stack vs Binding Stack

**The Bounded Adaptive Profile Stack wins.**

The policy stack and binding stack are not true enemies. The winning architecture
is their union with explicit ownership:

| Layer | Owner | Purpose |
|-------|-------|---------|
| Step Intent | Manifest | Declare logical default, floor, allowed profiles, and optional ensemble eligibility |
| Role/Circuit Context | Existing dispatch config | Preserve adapter routing and semantic worker role |
| Rigor Multiplier | Run context/router | Adjust profile preference for Lite, Standard, Deep, Tournament, Autonomous |
| Dynamic Escalation | Dispatch resolver | React to attempts, failures, risk signals, diff shape, and reroutes |
| Provider Binding | Config/adapters | Map logical profiles to Claude, Codex, Cursor, or custom adapter controls |
| Budget Governor | Config/run options | Cap profile ceiling, premium dispatches, retries, ensemble, and cap behavior |
| Receipt/Diagnostics | Dispatch adapter | Record selected profile, concrete model/effort, source, rule, budget decision, and fallback |

It wins because it gives Circuit a portable vocabulary, keeps provider details
out of manifests and canonical events, supports current adapter routing, and
has a deterministic path from static policy to bounded dynamic selection.

## Winning Architecture

### Name

Bounded Adaptive Profile Stack.

### Shape

1. Add optional adapter-neutral `model_policy` only to dispatch-capable steps.
2. Add config-level `model_profiles` that bind logical profiles to adapter-specific
   model and effort settings.
3. Add `compute_budget` caps at project/user/run scope.
4. Pass step identity and run context into dispatch resolution.
5. Resolve a logical profile in this order:
   - step floor/default/allowed profiles
   - config override for circuit/step/profile
   - rigor multiplier
   - deterministic dynamic rules
   - budget cap
   - adapter mapping
   - fallback/checkpoint behavior
6. Record the full decision in receipt/diagnostics, not canonical runtime events.

### First-Slice Principle

Land static logical profile resolution and receipts first. Dynamic escalation
should be implemented only after the profile vocabulary and adapter bindings have
contract tests.

This staging avoids the main trap: building a dynamic router before Circuit has
a stable, portable language for what the router is allowed to choose.

## Recommended Profile Vocabulary

Use job-shaped names, not model-size names.

| Profile | Intended Use |
|---------|--------------|
| `scan-fast` | Broad low-risk surveys, stale-doc scans, initial inventory |
| `research-standard` | Normal Explore Analyze, standard investigation, evidence gathering |
| `research-high` | Deep investigation, long-context inventory, migration risk mapping |
| `code-fast` | Tiny low-risk edits and mechanical fixes |
| `code-standard` | Default implementation for Build, Repair, and Sweep batches |
| `code-high` | Runtime core, multi-file refactors, migration batches, retry after partial result |
| `review-standard` | Lightweight review when review still runs in a low-risk path |
| `review-high` | Default independent review and audit |
| `review-critical` | Cutover, security, data correctness, runtime core, public API review |
| `decision-standard` | Ordinary plan/decision synthesis if delegated |
| `decision-high` | Architecture decision synthesis and tradeoff analysis |
| `decision-critical` | Irreversible decisions, pre-mortems, final migration readiness |
| `ensemble-decision` | Explore Tournament diverge/adversarial/stress-test profiles |
| `synthesis-standard` | Close/result/report synthesis when delegated to a subprocess |

Avoid manifest profiles named only `low`, `medium`, `high`, `xhigh`, `opus`, or
`gpt-5.4-high`. Those are provider/model/effort concepts, not Circuit job
types.

## Workflow Application Matrix

This matrix assigns default intent to the current dispatch steps. Orchestrator
synthesis steps are listed only when they affect policy.

| Workflow Step | Current Executor | Usual Role | Default Profile | Allowed/Floor Guidance | Rigor/Dynamic Behavior |
|---------------|------------------|------------|-----------------|------------------------|------------------------|
| `run.route` | orchestrator | n/a | host/inherit | No first-slice dispatch profile | Later, a cheap classifier profile only if routing moves to subprocess |
| `explore.analyze` | worker dispatch | researcher | `research-standard` | floor `scan-fast`; allow `research-high`, `ensemble-decision` | Deep raises to `research-high`; Tournament runs bounded ensemble proposals/reviews |
| `explore.decide` | orchestrator | n/a | host/inherit | If delegated later, use `decision-high` with Tournament `ensemble-decision` inputs | Tradeoff decision remains human/checkpoint governed |
| `build.act` | worker dispatch | implementer / workers | `code-standard` | floor `code-fast`; allow `code-high` | Lite may use `code-fast`; Deep/risky diff/retry partial raises to `code-high` |
| `build.review` | worker dispatch | reviewer | `review-high` | floor `review-standard`; allow `review-critical` | Risky diff, runtime/security/data/public API raises to `review-critical`; Lite behavior must follow the workflow's active contract |
| `repair.fix` | worker dispatch | implementer | `code-standard` | floor `code-standard`; allow `code-high` | No-repro/flaky root cause, failed attempt, or critical files raises to `code-high` |
| `repair.review` | worker dispatch | reviewer | `review-high` | floor `review-high`; allow `review-critical` | Regression in critical paths raises to `review-critical` |
| `migrate.inventory` | worker dispatch | researcher | `research-high` | floor `research-standard`; allow `research-high` | Deep is default posture; large dependency graph stays high |
| `migrate.execute` | worker dispatch | implementer / workers | `code-high` | floor `code-standard`; prefer `code-high` | Coexistence invalidation retry stays high; never `code-fast` |
| `migrate.verify` | worker dispatch | reviewer/auditor | `review-high` | floor `review-high`; allow `review-critical` | Data/cutover/public API risk raises to `review-critical` |
| `migrate.review` | worker dispatch | reviewer | `review-critical` | floor `review-critical`; optional `ensemble-decision`/critical ensemble if budget allows | Cutover review must not downgrade; cap breach checkpoints rather than silently using weak profile |
| `sweep.survey` | worker dispatch | researcher | `scan-fast` | floor `scan-fast`; allow `research-standard`, `research-high` | Deep raises ambiguous/PROVE categories; large repo may bind to long-context model |
| `sweep.execute` | worker dispatch | implementer / workers | `code-standard` | floor `code-fast`; allow `code-high` | Low-risk batches can use `code-fast`; PROVE/high-risk items defer or raise |
| `sweep.verify` | worker dispatch | reviewer/auditor | `review-high` | floor `review-high`; allow `review-critical` | Autonomous final audit keeps `review-high` floor; critical injections halt |

## Dynamic Rule Set

The first selector should be rule-based. Rules produce a logical profile, never
a provider model ID.

| Rule | Effect | Guardrail |
|------|--------|-----------|
| Step has a floor profile | Never select below floor | If budget max is below floor, checkpoint/escalate |
| Rigor is Lite | Prefer lowest allowed profile | Cannot go below floor; review behavior follows workflow contract |
| Rigor is Deep | Raise analysis/review one tier | Only inside `allowed_profiles` |
| Rigor is Tournament | Permit ensemble profiles for Explore | Requires `allow_ensemble` and max ensemble count |
| Rigor is Autonomous | Prefer bounded cost | Final review/audit floors still apply |
| Attempt > 1 after `partial`, `blocked`, or non-passing verdict | Escalate one tier | Max one premium retry per step by default |
| Review found correctness/security/data issue | Escalate next implementation retry | Within allowed profiles; record prior finding as reason |
| Diff exceeds file/line thresholds | Raise implementation and review | Thresholds configurable and receipt records threshold hit |
| Touched files include runtime core, auth, billing, data migration, security, public API, plugin runtime, or generated surface | Raise to high/critical floor | User budget can checkpoint, not silently downgrade critical review |
| Migrate cutover review | Floor at `review-critical` | Optional ensemble only if allowed |
| Sweep item is ambiguous/high-risk | Defer or raise verification | Do not cheap-execute uncertain destructive cleanup |
| Adapter mapping missing | Use safe inherit/default only if at or above floor is not required | Otherwise checkpoint with missing mapping reason |
| Provider command unavailable | Existing adapter-start fallback may return `agent` | Receipt must retain original compute selection and fallback reason |

## Profile Resolution Precedence

Recommended deterministic order:

1. Read workflow id, step id, step kind, role, attempt, run rigor, and budget.
2. Resolve base policy:
   - step `model_policy` if present
   - config `dispatch.steps.<circuit>.<step>` override if present
   - role/circuit defaults only as backward-compatible fallback
3. Apply rigor multiplier to select a preferred logical profile.
4. Apply dynamic escalation rules, bounded by `allowed_profiles` and
   `floor_profile`.
5. Apply budget governor:
   - if preferred profile is allowed, continue
   - if cap blocks a non-critical escalation, downgrade to highest allowed
     profile and record `budget_decision=clamped`
   - if cap blocks a floor/critical rule, checkpoint/escalate and record
     `budget_decision=blocked_floor`
6. Resolve adapter using existing adapter routing.
7. Resolve concrete adapter binding for the selected logical profile.
8. If mapping is missing:
   - for inherit-safe profiles, use adapter default/inherit with warning
   - for floor-critical profiles, checkpoint/escalate rather than silently
     downgrading
9. Write receipt/diagnostics with all selected and rejected reasoning.

## Config Shape

Provider IDs belong here, not in workflow manifests:

```yaml
model_profiles:
  code-standard:
    codex:
      model: gpt-5.4
      effort: medium
    cursor-agent:
      model: gpt-5.4-medium
    claude-cli:
      model: sonnet
      effort: medium

  review-critical:
    codex:
      model: gpt-5.4
      effort: xhigh
    cursor-agent:
      model: claude-opus-4-7-thinking-high
    claude-cli:
      model: opus
      effort: high

compute_budget:
  max_profile: review-critical
  allow_ensemble: true
  max_ensemble_steps: 1
  max_premium_dispatches: 3
  max_premium_retries_per_step: 1
  on_cap_exceeded: checkpoint

dispatch:
  default: auto
  roles:
    implementer: codex
    reviewer: agent
    researcher: agent
  circuits:
    migrate: codex
  steps:
    migrate:
      review:
        default_profile: review-critical
        allowed_profiles: [review-critical]
```

`dispatch.steps` is shown as an override surface, not a replacement for manifest
intent. The implementation should choose a naming shape that does not collide
with the removed legacy `dispatch.per_step` semantics.

## Manifest Shape

Only dispatch steps should accept compute policy:

```yaml
steps:
  - id: review
    executor: worker
    kind: dispatch
    protocol: migrate-review@v1
    model_policy:
      default_profile: review-critical
      floor_profile: review-critical
      allowed_profiles: [review-critical, ensemble-decision]
      allow_ensemble: true
```

Schema guidance:

- `model_policy` is optional for backward compatibility.
- Profile names should be logical identifiers such as `review-critical`.
- The schema should not enumerate provider IDs.
- For non-dispatch steps, either reject `model_policy` or document it as ignored
  until orchestrator subprocess selection exists. Prefer rejection first.

## Receipt And Debug Contract

Every dispatch receipt should answer: what did Circuit intend, what did it
select, what concrete provider controls were applied, and what was blocked or
fallbacked?

```json
{
  "compute_selection": {
    "profile": "review-critical",
    "profile_source": "manifest:steps.review.model_policy.default_profile",
    "floor_profile": "review-critical",
    "allowed_profiles": ["review-critical", "ensemble-decision"],
    "rigor": "Deep",
    "dynamic_rules": ["migration_cutover_review_floor"],
    "budget_decision": "allowed",
    "adapter": "cursor-agent",
    "adapter_source": "dispatch.circuits.migrate",
    "model": "claude-opus-4-7-thinking-high",
    "effort": null,
    "binding_source": "model_profiles.review-critical.cursor-agent",
    "fallback": null
  }
}
```

This belongs in adapter receipts and/or adapter diagnostics. Runtime-core facts
should continue to expose only transport-neutral request/receipt/result
observations. Diagnostic presenters can read the receipt when humans need model
debugging.

## Stress Tests

### Build

Scenario: a Standard Build touches three React components and tests.

- `build.act` starts at `code-standard`.
- `build.review` runs at `review-high`.
- If review finds a correctness issue, the retry escalates implementation to
  `code-high` within the step's allowed profiles.

Verdict: passes. The stack improves quality without overpaying first attempt.

Scenario: Build Lite for a tiny docs edit.

- `build.act` may choose `code-fast` if allowed.
- Review behavior must follow the active workflow contract. If the workflow says
  Lite skips independent review, no review profile is needed. If current Build
  contract keeps review in the fixed graph, `build.review` can floor at
  `review-standard`.

Verdict: passes, but highlights an existing docs/prose alignment risk. Compute
policy should not be the source of truth for phase skipping.

Scenario: Build touches runtime core and generated surfaces.

- Risk rule raises `build.act` to `code-high`.
- `build.review` raises to `review-critical`.
- If user budget caps below `review-critical`, Circuit checkpoints/escalates
  rather than silently weakening review.

Verdict: passes. Critical floors protect correctness.

### Repair

Scenario: reproducible bug with a regression test.

- `repair.fix` starts `code-standard`.
- `repair.review` uses `review-high`.

Verdict: passes; no premium spend unless risk appears.

Scenario: flaky/no-repro incident after bounded search.

- Dynamic rule raises `repair.fix` to `code-high`.
- If still blocked after the workflow's hypothesis cap, workflow circuit breaker
  escalates to the user; the model selector does not keep spending forever.

Verdict: passes. Escalation helps diagnosis but remains bounded.

### Explore Tournament

Scenario: `decide:` architecture question with several plausible directions.

- `explore.analyze` may spawn multiple researcher perspectives using
  `ensemble-decision` if budget allows.
- Adversarial/stress-test rounds use different profile bindings or provider
  specialists where configured.
- Final synthesis can remain host/orchestrator in the first slice; if delegated
  later, it uses `decision-high` or `decision-critical`.

Verdict: passes. Ensemble is selective and bounded by the Tournament ceiling.

### Migrate

Scenario: framework migration with coexistence plan and cutover review.

- `migrate.inventory` uses `research-high`.
- `migrate.execute` uses `code-high`, never `code-fast`.
- `coexistence_invalidated` reroutes to plan; next execute attempt stays high.
- `migrate.review` floors at `review-critical`.
- If budget disallows `review-critical`, dispatch checkpoints/escalates because
  a weaker cutover review violates the step floor.

Verdict: passes. The architecture favors safety over silent downgrade.

### Sweep

Scenario: Standard cleanup sweep.

- `sweep.survey` uses `scan-fast` or `research-standard` for broad discovery.
- `sweep.execute` uses `code-standard`, with low-risk batches eligible for
  `code-fast`.
- Ambiguous/high-risk items are deferred or adjudicated before execution.
- `sweep.verify` uses `review-high` to protect against false positives.

Verdict: passes. The stack spends cheaply where false positives are less
dangerous and spends review quality where trust matters.

### Autonomous

Scenario: unattended quality run with user cap.

- Budget governor caps premium dispatches and ensemble count.
- Dynamic rules can escalate within caps.
- Final audit/review floors still apply.
- Cap breaches on critical floors halt or write a continuity/deferred record
  according to workflow rules; they do not silently downgrade.

Verdict: passes. Autonomous remains bounded without becoming weak.

### Retries

Scenario: first worker result is `partial`.

- Attempt 2 escalates one tier if allowed.
- Premium retry count limits repeat escalation.
- Receipt records original profile, retry rule, and budget decision.

Verdict: passes. Retrying with the same weak profile is avoided, but runaway
premium loops are blocked.

### Missing Adapter Mapping

Scenario: selected adapter is `agent`, profile is `code-high`, but no
`model_profiles.code-high.agent` binding exists.

- If `agent` is configured as inherit-safe and the step floor does not require
  explicit control, receipt records `binding=inherit`.
- If the step floor is critical, dispatch checkpoints/escalates with a missing
  mapping warning.
- A `claude-cli` process adapter can be recommended when explicit Claude
  model/effort control is required.

Verdict: passes if missing mapping behavior is explicit and tested.

### User Budget Caps

Scenario: user sets `max_profile: code-standard` and starts Migrate.

- `migrate.execute` can run at `code-standard` if that satisfies its floor.
- `migrate.review` requires `review-critical`; budget blocks floor.
- Circuit halts at the review boundary with a clear reason instead of using
  `review-standard`.

Verdict: passes. The design respects budget without pretending a critical review
is optional.

## Tradeoff Matrix

| Dimension | Config Variants | Role Tiers | Step Profiles | Rigor Only | Adaptive Only | Full AI Router | Bounded Adaptive Profile Stack |
|-----------|-----------------|------------|---------------|------------|---------------|----------------|--------------------------------|
| Concept Count | Low | Low | Medium | Low | Medium | High | Medium-High but layered |
| Boundary Clarity | Medium | Medium | High | Medium | Medium | Low-Medium | High |
| Portability | Medium | High | High | High | Medium unless bounded | Medium | High |
| Explainability | Low-Medium | Medium | High | Medium | Medium-High with receipts | Low unless heavily instrumented | High |
| Determinism | Medium | High | High | High | High if rule-based | Low-Medium | High |
| Migration Cost | Low | Low-Medium | Medium | Medium | Medium-High | High | Staged medium |
| Cost Control | Low | Low-Medium | Medium | Medium | Medium | Variable | High with governor |
| Quality Ceiling | Low | Medium | Medium-High | Medium | High | High | High |
| Cleanup Burden | High | Medium | Low | Medium | Medium | High | Low-Medium |
| Long-Term Power | Low | Low-Medium | High | Medium | High | High | High |

## Must-Be-True Assumptions

| Assumption | Why It Matters | How To Verify | Fastest Disproof |
|------------|----------------|---------------|------------------|
| Logical profiles cover all current dispatch steps | Core bet of the architecture | Assign default/floor/allowed profiles to every dispatch step | Many steps need provider-specific IDs |
| Step identity can be passed into dispatch resolution without reviving legacy per-step routing confusion | Needed for step policy | Add a new explicit `--step-id`/context path or repurpose `--step` with tests and docs | Existing tests/users depend on `--step` rejection and semantics are unclear |
| Codex model/effort can be bound in isolated launch | Needed for built-in Codex profiles | Fake-Codex argv/config test plus optional harmless real smoke | Codex rejects/ignores `-m` or `model_reasoning_effort` |
| Cursor Agent wrapper can satisfy prompt/output contract | Needed for first-class Cursor profiles | Wrapper spike with `cursor-agent --print --model MODEL` writing output file | Cursor requires interactivity or cannot normalize output |
| Claude Agent can either remain inherit-only or prove metadata support | Needed for honest Claude support | Controlled Agent receipt spike | Host ignores model/effort metadata |
| Budget caps can be enforced before provider launch | Prevents surprise spend | Resolver fixture with cap blocked/allowed outcomes | Cap is only written after dispatch |
| Receipts can carry compute diagnostics without runtime event pollution | Maintains runtime-core invariants | Runtime-core tests reject provider fields in facts/events while dispatch receipts include `compute_selection` | Planner-visible facts need model fields |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Profiles become vague synonyms for model size | Medium | High | Use job-shaped names and maintain workflow matrix |
| Provider model IDs churn | High | Medium | Keep IDs in config/adapters; validate mappings at dispatch |
| Dynamic selector overspends | Medium | High | Budget governor, conservative defaults, receipt visibility |
| Dynamic selector underpowers critical review | Medium | High | Step floors and checkpoint-on-blocked-floor behavior |
| `--step` reintroduction conflicts with removed legacy behavior | Medium | Medium | Use a new context flag or document new semantics with compatibility tests |
| Agent transport cannot honor model metadata | Medium | Medium | Keep `agent` inherit-only; add `claude-cli` for explicit control |
| Cursor output contract is brittle | Medium | Medium | First-class wrapper spike and normalized output/report contract |
| Runtime events gain provider details | Low-Medium | High | Keep `compute_selection` in receipts/diagnostics; runtime-core ratchets |
| Config becomes verbose | Medium | Medium | Ship default logical profiles; allow sparse overrides |
| Budget cap blocks necessary critical work | Medium | Medium | Checkpoint/escalate with exact reason, never silently downgrade floors |

## Validation Spikes

| Spike | Question Answered | Cost | Success Signal | Failure Signal |
|-------|-------------------|------|----------------|----------------|
| Profile assignment fixture | Does the vocabulary cover real workflows? | Low | Every dispatch step has default, floor, allowed profiles without provider IDs | Provider-specific exceptions are required |
| Manifest schema fixture | Can optional `model_policy` fit strict steps? | Low | Existing manifests validate unchanged; fixture validates policy; non-dispatch rejection tested | Schema becomes permissive or awkward |
| Resolver fixture | Are static + rigor + dynamic + budget decisions deterministic? | Low | Tests cover Lite, Deep, Tournament, retry, risky diff, missing mapping, cap block | Rule precedence is ambiguous |
| Codex binding spike | Can isolated Codex receive model and effort? | Low | Fake Codex sees `--model` and `-c model_reasoning_effort=...`; isolated config remains clean | Codex launch shape breaks |
| Cursor binding spike | Can Cursor Agent be a reliable process adapter? | Medium | Wrapper writes output file, honors model ID, exits nonzero on failure | Requires interaction or output cannot be normalized |
| Claude Agent metadata spike | Can built-in Agent honor model/effort? | Medium | Worker demonstrably uses requested model/effort | Host ignores/rejects metadata |
| Receipt visibility spike | Can humans debug selections without event pollution? | Low | Receipt/diagnostics include `compute_selection`; runtime-core facts remain transport-neutral | Canonical events need provider fields |
| Budget dry run preview | Can high-cost runs show intended spend before launch? | Medium | Tournament/Migrate preview lists selected profiles and cap decisions | Preview goes stale or blocks normal work |

## Recommendation

Implement the **Bounded Adaptive Profile Stack**, staged in this order:

1. Static logical profiles on dispatch steps, with a manifest schema migration.
2. Config bindings from logical profiles to adapter-specific model/effort values.
3. Dispatch receipt diagnostics for resolved compute selection.
4. Step identity/run-context input to dispatch resolution.
5. Rigor multiplier.
6. Budget governor.
7. Bounded dynamic escalation.
8. Selective ensemble profiles for Explore Tournament and critical reviews.

This order is deliberate. Static profiles create the vocabulary. Bindings give
users control. Receipts make the system debuggable. Only then should Circuit
turn on dynamic escalation.

Schema-review refinement: attach this policy to dispatch steps or, where hidden
fanout is the real control point, to typed work patterns under those steps.
Broader work intent can explain why a profile applies, but it should not replace
explicit `default_profile`, `floor_profile`, `allowed_profiles`, and budget
rules for safety-critical or cost-sensitive dispatches.

## Runner-Up

The runner-up is **Config-Only Adapter Variants plus Role Tiers**.

It is the right fallback if the project wants a near-zero-runtime-change slice:
document adapter aliases, map roles to stronger defaults, and let wrappers own
model flags. It loses because it cannot express workflow step risk, cannot
bound or explain dynamic selection, and will accumulate adapter alias debt.

## Why The Other Options Lose

- Concrete provider pins in manifests lose because they break portability and
  invite provider churn into shipped workflow YAML.
- Capability tags lose because compute policy needs floors, defaults, allowed
  profiles, dynamic rules, and budget behavior; that is not a functional
  capability requirement.
- Rigor-only loses because run-level intent is too coarse for per-step risk.
- Adaptive-only loses because it needs a bounded profile vocabulary underneath.
- Provider-specialist-only loses because it chooses adapter bindings, not step
  intent.
- Portfolio-ensemble-only loses because it is too expensive for general work.
- Budget-governor-only loses because it caps choices but does not choose.
- Full AI router loses as a first implementation because deterministic policy,
  receipts, and config bindings must come first.
- Run Compute Plan loses as the core architecture because it previews decisions
  but cannot replace runtime evidence from retries, diffs, and reroutes.

## What Could Change The Recommendation

- If shipped workflows are intentionally project-local rather than portable,
  concrete provider pins become less harmful. That is not Circuit's current
  direction.
- If Claude Code Agent exposes a stable in-process model/effort contract, the
  `agent` binding can become explicit instead of inherit-only.
- If Cursor Agent cannot satisfy non-interactive prompt/output contracts, Cursor
  remains a custom wrapper target rather than a first-class binding.
- If users overwhelmingly prefer static config aliases and reject manifest policy,
  Circuit could pause after role tiers, accepting lower long-term power.
- If dynamic risk signals are unavailable at dispatch time, the first release
  should stop at static profiles + rigor + receipts until runtime context is
  available.

## Implementation Handoff

### Chosen Architecture

Bounded Adaptive Profile Stack: logical step profiles with adapter-specific
config bindings, deterministic rigor/dynamic rules, budget governor, and
receipt-level compute diagnostics.

### Decision Rationale

It best satisfies Circuit's separation of concerns:

- manifests own workflow intent
- config/adapters own provider details
- dispatch resolver owns deterministic selection
- receipts/diagnostics own debugging
- runtime core observes transport-neutral facts

### Invariants To Preserve

- No provider model IDs required in shipped workflow manifests.
- No model/effort fields in canonical runtime facts or planner-visible event
  types.
- Existing adapter routing works when policy is absent.
- Critical floors checkpoint/escalate instead of silent downgrade.
- Dynamic selection is deterministic and fixture-tested.

### First Implementation Slice

1. Define profile vocabulary and ordering in docs/config types.
2. Add `model_policy` schema for dispatch steps only.
3. Add resolver unit tests independent of provider CLIs.
4. Add `model_profiles` config parsing.
5. Add `compute_selection` to `DispatchReceipt`.
6. Extend Codex launch arguments/config for selected model/effort.
7. Leave `agent` inherit-only unless a spike proves metadata support.

### Critical Workflows

- `build.act` and `build.review` for standard implementation/review loop.
- `repair.fix` retry after partial/non-passing result.
- `explore.analyze` under Tournament.
- `migrate.review` with critical floor and budget cap.
- `sweep.survey` vs `sweep.verify` cost/quality split.
- adapter-start fallback from Codex to Agent retaining compute diagnostics.

### Known Hotspots

- `scripts/runtime/engine/src/dispatch.ts` currently mixes config parsing,
  adapter resolution, process execution, Agent receipt construction, and fallback.
  Profile resolution should likely be factored rather than bolted into one large
  function.
- `scripts/runtime/engine/src/cli/dispatch.ts` rejects `--step`; any new step
  context needs a compatibility decision and tests.
- `scripts/runtime/engine/src/codex-runtime.ts` owns isolated config writing and
  argv construction; it needs a typed way to receive model/effort binding.
- `schemas/circuit-manifest.schema.json` is strict; schema/test updates are
  mandatory for `model_policy`.
- `command-support.ts` currently reads adapter metadata into legacy dispatch
  event payloads. Runtime-core hardening must continue to quarantine provider
  details.
- `circuit.config.example.yaml` should show logical profiles only after config
  parsing supports them.

### Leading Migration Risks

- Reintroducing step identity into `.circuit/bin/dispatch` could look like the
  removed `--step` contract. Use precise naming and tests.
- Profile names can sprawl unless the initial vocabulary is curated.
- Adapter fallback can obscure that the selected adapter/profile was not honored
  unless `compute_selection.fallback` is explicit.
- Budget caps can create surprising checkpoints if users do not see why a floor
  was blocked.
- Existing docs have some rigor-contract drift; compute policy must not be used
  to decide phase skipping until workflow contracts are aligned.

### Expected Deletion Or Replacement Zones

- Ad hoc docs/examples that present provider-specific adapter aliases as the
  primary long-term model strategy.
- Any future wrapper examples that duplicate typed `model_profiles` behavior.
- Dispatch tests asserting `--step` rejection will need replacement if step
  context re-enters this CLI; keep a regression that rejects legacy per-step
  routing semantics.

### Validation Spikes Already Run

- Local CLI capability evidence from 2026-04-17 for Claude Code, Codex CLI, and
  Cursor Agent.
- Current code inspection of dispatch routing, Codex isolated launch, strict
  manifest schema, dispatch CLI, workflow manifests, rigor docs, and runtime-core
  transport-neutral boundaries.
- Profile assignment pass in this document over all current dispatch steps.

### What Still Needs Proof

- Codex effort override behavior in the isolated runtime.
- Cursor Agent wrapper reliability for prompt/output/report contracts.
- Claude Code in-process Agent metadata support, or a deliberate `claude-cli`
  adapter path.
- Exact dispatch context API for step identity and run rigor.
- Whether `compute_selection` should also be summarized in `active-run.md` for
  humans, or remain receipt/diagnostics-only in the first release.
