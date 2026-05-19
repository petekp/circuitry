# Architecture Exploration: First-Principles Circuit Schema

## Goal

Re-evaluate the Circuit workflow schema from first principles with two design
goals held equally:

1. **Human legibility**: workflow authors and reviewers should be able to read a
   circuit and understand the job, the phase shape, the safety boundary, and the
   knobs without reconstructing behavior from scattered prose.
2. **Agent legibility and control**: agents should be able to mechanically
   determine what to do at each step, what work patterns govern dispatch, what
   work-unit instances were created, what skills and compute policy apply, what
   budgets and gates bind the step, and what evidence is required before moving
   on.

The concrete motivator is model/effort/skills control at each workflow step, but
that is a symptom of a broader schema issue: Circuit needs a first-class way to
describe work intent and execution policy without over-indexing on today's
adapter config surface.

## Problem

Current `circuit.yaml` is a strict runtime topology manifest. It is good at
declaring ordered steps, artifacts, gates, routes, and runtime exchange paths.
It is less good at describing the actual work that happens inside those steps.

Several important controls currently live in `SKILL.md` prose rather than in a
machine-readable schema:

- parallel worker fanout
- inner worker loops
- prompt templates
- role intent
- selected or suggested skills
- model/effort needs
- rigor-specific behavior
- diagnose-only vs mutating behavior
- checkpoint auto-resolution rules
- concurrency and budget ceilings
- evidence requirements
- high-risk boundaries

This creates a mismatch:

- Humans read `circuit.yaml` and see a tidy graph, but not the real operational
  behavior.
- Agents read `SKILL.md` and must infer policy from prose that is not
  structured enough for validation.
- Runtime reads the manifest and can resume the outer graph, but cannot reason
  about many actual dispatched child work patterns or work-unit instances.

The model/effort tournament exposed the same issue. If model policy is attached
only to static manifest steps, Circuit still misses the dynamic work patterns
and work-unit instances created inside Explore, Migrate, Sweep, and `workers`.

## Invariants

- Built-in circuits must remain portable across projects and accounts.
- Provider-specific model IDs stay in config/adapters, not shipped workflow
  definitions.
- Canonical runtime events remain transport-neutral.
- Runtime state remains ledger-derived; `active-run.md` and `state.json` stay
  projections.
- A workflow definition must be reviewable by humans without running the code.
- A workflow definition must be precise enough for agents to avoid inventing
  phase behavior from prose.
- Step-level control must not turn the schema into provider-specific config
  sprawl.
- Custom circuit authors need an approachable authoring story.
- Existing v2 manifests and runtime behavior need an incremental migration path.

## Non-Goals

- Replacing every useful piece of prose with YAML.
- Making the runtime core execute arbitrary workflow programs.
- Encoding provider model catalogs in shipped circuit definitions.
- Making every dynamic decision static. Some decisions should remain
  runtime-evidence based.
- Removing `SKILL.md`; it remains valuable for narrative instructions and
  workflow-specific judgment.

## Constraints

- `schemas/circuit-manifest.schema.json` is strict and currently rejects unknown
  step fields.
- Current step shape is small: `id`, `title`, `executor`, `kind`, `protocol`,
  `reads`, `writes`, `gate`, `routes`, optional `budgets`, optional
  `capabilities`, optional `checkpoint`.
- Runtime helpers project mostly from step id, kind, gate, routes, and exchange
  paths. Runtime-core types intentionally keep planner-visible facts narrow.
- The catalog compiler is currently narrow by design. The compile-oriented RFC
  explicitly avoided a full workflow authoring DSL for its shipped pilot. This
  re-evaluation is broader than that pilot, so the old anti-goal is evidence of
  prior scope control, not a permanent architectural prohibition.
- Built-in workflows already rely on `SKILL.md` for behavior beyond the manifest.
- Custom circuit docs teach users to author `circuit.yaml` plus `SKILL.md`.
- Plugin runtime changes under `hooks/`, `skills/`, `scripts/`, or
  `.claude-plugin/` require `./scripts/sync-to-cache.sh`; this document-only
  exploration does not.

## External Surfaces

- `skills/*/circuit.yaml`
- `skills/*/SKILL.md`
- `schemas/circuit-manifest.schema.json`
- `schemas/event.schema.json`
- `schemas/job-result.schema.json`
- `scripts/runtime/engine/src/bootstrap.ts`
- `scripts/runtime/engine/src/manifest-utils.ts`
- `scripts/runtime/engine/src/dispatch-step.ts`
- `scripts/runtime/engine/src/resume.ts`
- `scripts/runtime/engine/src/runtime-core/types.ts`
- `scripts/runtime/engine/src/catalog/extract.ts`
- `.circuit/bin/compose-prompt`
- `.circuit/bin/dispatch`
- `circuit.config.yaml` / `~/.claude/circuit.config.yaml`
- README, `ARCHITECTURE.md`, `CUSTOM-CIRCUITS.md`, `docs/workflow-matrix.md`

## Adversarial Review Update

The follow-up adversarial review in
`docs/circuit-schema-adversarial-review.md` changes the recommendation in this
document.

The original proposal correctly identifies the architectural gap, but it
overstates the readiness of a broad Layered Circuit Definition as the final
answer. The safer current decision is:

- Treat the Layered Circuit Definition as a direction, not an approved target.
- Prove a narrower **Work-Pattern Policy Compiler** first.
- Model reusable work patterns and policy constraints, not every concrete
  runtime work-unit instance.
- Keep existing v2 manifests running as authoritative runtime topology.
- Keep provider/model/effort bindings in config/adapters and policy resolution
  in receipts/diagnostics.

This distinction matters because Sweep categories, Migrate batches, Repair
diagnostic paths, and `workers` slices are discovered from runtime evidence.
They cannot all be listed honestly as static authoring work units.

## Current System

| Area | Current Owner | Inputs | Outputs | Dependencies | Pain |
|------|---------------|--------|---------|--------------|------|
| Workflow identity | `skills/<slug>/circuit.yaml` and skill directory | slug, id, purpose, entry modes | public command surface, run bootstrap | catalog compiler | Healthy and well-owned |
| Runtime topology | `circuit.yaml` steps | step order, reads, writes, gates, routes | manifest snapshot, resume order, runtime state | manifest schema, runtime engine | Precise but low-level |
| Human execution contract | `SKILL.md` body | phase prose, commands, examples, policy | agent behavior | human/agent reading | Rich but hard to validate mechanically |
| Rigor behavior | `entry_modes`, rigor docs, SKILL prose | selected mode | skipped phases, extra checks, checkpoints | router and human orchestration | Mostly prose, not schema-enforced |
| Dispatch behavior | `.circuit/bin/dispatch`, config | prompt, role, circuit, adapter config | worker receipt | dispatch runtime | Adapter/role only; no work intent or compute policy |
| Prompt assembly | `compose-prompt` plus SKILL prose | header, template, skills | prompt.md | templates and skill lookup | Skill/template selection is mostly prose |
| Child work patterns | SKILL prose and `workers` adapter | fanout plans, slice loops, category loops | child reports/results | humans/agents following instructions | Important work is invisible to outer manifest |
| Gates | manifest schema and runtime commands | section checks, verdicts, checkpoint selection | route decisions | artifacts and result files | Useful, but mostly checks presence/verdict, not full semantic contract |
| Config | `circuit.config.yaml` | adapters, role/circuit routing, circuit skills | dispatch routing and skill injection | config loader | Overloaded as execution preference without schema-level intent |

## Evidence From Current Workflows

The current schema says Explore has one worker dispatch step, `analyze`. The
Explore skill actually describes:

- Lite direct investigation
- Standard two parallel evidence workers
- Spec input mode with spec digest plus three review lenses
- Tournament diverge, adversarial review, revise, stress-test, convergence, and
  checkpoint behavior
- Deep seam proof after plan/decision

The current schema says Migrate has `inventory`, `execute`, `verify`, and
`review` dispatch steps. The Migrate skill actually describes:

- two parallel inventory workers: dependency scan and risk assessment
- batch execution through the `workers` adapter
- mandatory per-batch plan re-evaluation
- full verification worker
- cutover reviewer

The current schema says Sweep has `survey`, `execute`, and `verify` dispatch
steps. The Sweep skill actually describes:

- parallel survey workers across categories
- Deep/PROVE evidence adjudication workers
- batch execution through `workers`
- independent audit
- Autonomous injection check

Build and Repair also expose the split:

- the manifest declares outer dispatch steps
- SKILL prose decides when to use inline work vs workers
- SKILL prose decides prompt templates and skills
- SKILL prose decides some rigor-specific checkpoint behavior

This is not wrong; it was a reasonable staged architecture. But it is the reason
we cannot get strong step-level model, effort, skills, and parameter control by
only adding fields to today's outer step shape.

## First Principles

### Principle 1: A Circuit Is Not Just A Step Graph

A Circuit has at least four layers:

1. **Workflow intent**: what this workflow is for, who should use it, and what
   kind of outcome it promises.
2. **Phase graph**: durable topology, artifacts, gates, and routes.
3. **Work units**: the actual dispatchable units inside a phase, including
   fanout workers, inner loops, review lenses, and audits.
4. **Execution policy**: skills, compute intent, budgets, concurrency, adapter
   preferences, prompt templates, checkpoint behavior, and safety constraints.

The current schema models layer 2 well and models layers 1, 3, and 4 only
partially.

### Principle 2: Human And Agent Legibility Need Different Views

Humans need a circuit to answer:

- What is this workflow for?
- What are the phases?
- What is each phase trying to accomplish?
- What can go wrong?
- Where does it pause?
- Where are the expensive or risky parts?
- What can I override?

Agents need a circuit to answer:

- What files do I read and write?
- What work patterns do I follow, and what concrete work-unit instances were
  created for this run?
- Which prompt template and skill policy apply?
- What output schema is required?
- What verdicts or gates advance the run?
- What budgets, retries, concurrency caps, and risk constraints bind this step?
- Which facts are runtime-authoritative and which are diagnostics?

One YAML can serve both only if it has clear sections for intent, control, and
runtime facts. Otherwise humans get a dense manifest and agents get prose.

### Principle 3: Work Intent And Profile Floors Should Precede Provider Selection

The schema should describe the shape and risk of work:

- purpose: scan, research, code, review, decision, synthesis
- consequence: low, medium, high, critical
- context width: local, repo, broad, external
- mutation: read-only, diagnose-only, safe-edit, refactor, migration
- independence: self, fresh, adversarial, ensemble
- latency preference: fast, balanced, thorough

Logical profile floors/defaults turn that work shape into deterministic
compute policy. Adapter names and provider model IDs remain downstream
bindings; they should not be the conceptual source of truth.

### Principle 4: Static Steps Are Not Enough

If a step fans out into five survey workers or three tournament proposals, the
controllable unit is not just the outer `survey` or `decide` step. For static
fanout it may be the work unit; for dynamic fanout it is the work pattern that
creates work-unit instances:

- category survey worker
- external evidence worker
- internal analysis worker
- proposal worker
- adversarial reviewer
- cutover reviewer
- convergence worker

The schema needs a place to describe those patterns without forcing every
runtime fanout into the top-level phase graph or pretending runtime-discovered
instances are known in advance.

### Principle 5: Portable Intent, Local Binding

Shipped circuits may declare portable intent and policy constraints. Local
config binds those to concrete installed tools:

- model IDs
- effort flags
- adapter commands
- installed skill paths
- project-specific budget caps
- provider availability

The schema should be explicit about which fields are portable workflow facts
and which fields are local binding facts.

### Principle 6: Prose Remains Valuable, But Not As Hidden Policy

`SKILL.md` should explain judgment, examples, and narrative procedure. It should
not be the only owner for machine-significant facts like:

- "dispatch three proposal workers"
- "review is diagnose-only"
- "max two domain skills"
- "never cheap-run cutover review"
- "Autonomous stops after three batches"

If a fact changes runtime cost, safety, or control, it deserves a structured
home.

## Schema Design Criteria

| Criterion | What It Rewards |
|-----------|-----------------|
| Human Legibility | The circuit reads like a workflow, not just a file dependency graph |
| Agent Legibility | An agent can execute without inferring hidden policy from prose |
| Control Surface | Step/work-unit controls cover skills, compute, prompt templates, budgets, concurrency, isolation, and safety |
| Portability | Built-in circuits do not name provider models or account-specific resources |
| Runtime Fit | Runtime core can keep events transport-neutral and ledger-derived |
| Authorability | Custom circuit authors can learn the schema without becoming compiler engineers |
| Reviewability | A reviewer can spot dangerous policy changes in diffs |
| Extensibility | New controls can be added without overloading `dispatch.roles` or SKILL prose |
| Migration Safety | Existing v2 circuits can keep running while v3 authoring matures |

## Option 1: Extend The Current Manifest In Place

### Architecture Shape

Keep `circuit.yaml` as both authoring and runtime manifest. Add optional fields
to steps:

```yaml
steps:
  - id: review
    title: Review
    executor: worker
    kind: dispatch
    intent:
      purpose: review
      consequence: high
      mutation: read_only
      independence: fresh
    controls:
      skills:
        max: 2
        suggested: [tdd]
      compute:
        profile: review-high
      prompt:
        template: ship-review
      budget:
        max_attempts: 2
```

For fanout, add nested `work_units` under a dispatch step.

### Why It Might Work

- Lowest conceptual disruption.
- Existing runtime can ignore fields until implemented.
- Custom authors keep editing one file.
- Incremental schema migration is straightforward.

### Tradeoffs

- The manifest becomes a mixed authoring/runtime/control document.
- Runtime fields and human intent fields sit at the same level.
- Fanout and inner loops could make single steps very large.
- It risks becoming "just add another optional field" architecture.

### Failure Modes

- Humans stop reading the YAML because it becomes dense.
- Agents still need SKILL prose because nested work units are incomplete.
- Runtime starts accidentally depending on authoring-only fields.
- Provider-specific knobs leak into `controls`.

### Disqualifiers

- Wrong if Circuit wants a clean long-term separation between authoring and
  runtime snapshots.
- Wrong if fanout/inner-loop modeling becomes central rather than occasional.

### Cleanup / Migration Implications

- Easy first migration.
- Medium-to-high cleanup burden later if a split schema becomes necessary.

### Unknowns

- How much nested policy can be added before custom authors find the file
  intimidating.

## Option 2: Keep Manifest Small, Add Policy Overlays

### Architecture Shape

Leave `circuit.yaml` mostly as-is. Add a separate policy file or config section:

```yaml
workflow_policy:
  build:
    steps:
      act:
        intent:
          purpose: code
          consequence: medium
        skills:
          suggested: [tdd]
        compute:
          profile: code-standard
      review:
        intent:
          purpose: review
          consequence: high
```

Local/project config can override policy.

### Why It Might Work

- Avoids bloating the strict manifest.
- Lets policy evolve faster than topology.
- Gives users a direct override surface.

### Tradeoffs

- Splits the workflow definition across files.
- Human legibility gets worse unless tooling presents a merged view.
- Hidden drift becomes likely: step renamed in manifest, overlay stale.
- Work units inside SKILL prose still need structured identifiers.

### Failure Modes

- Policy overlay becomes a second source of truth.
- Agents miss policy when operating from manifest/SKILL context.
- Custom circuit authors do not know where a behavior is defined.

### Disqualifiers

- Wrong if the main goal is human and agent legibility from the circuit
  definition itself.

### Cleanup / Migration Implications

- Low runtime migration cost.
- High long-term drift risk without a compiler/validator.

### Unknowns

- Whether a generated merged view could make overlays tolerable.

## Option 3: Authoring Definition Compiles To Runtime Manifest

### Architecture Shape

Split Circuit's schema into two owned layers:

1. **Circuit Definition**: human/agent-friendly authoring schema with phases,
   artifacts, work units, intent, controls, mode behavior, and policies.
2. **Runtime Manifest Snapshot**: normalized, strict execution graph consumed by
   runtime core.

The authoring definition can be `skills/<slug>/circuit.yaml` in schema v3, or a
new `circuit.definition.yaml` that compiles to `circuit.manifest.yaml`. The key
architectural move is ownership, not the filename.

Example authoring shape:

```yaml
schema_version: "3"
circuit:
  id: migrate
  version: "2026-04-17"
  purpose: >
    Migrate systems safely with coexistence, rollback, and cutover review.

  modes:
    standard:
      rigor: Standard
    deep:
      rigor: Deep
      default: true
    autonomous:
      rigor: Autonomous
      checkpoint_policy: auto_except_tradeoff

  artifacts:
    brief:
      path: artifacts/brief.md
      schema: brief-migrate@v1
      public: true
    inventory:
      path: artifacts/inventory.md
      schema: inventory@v1
      public: true

  phases:
    - id: inventory
      title: Inventory
      purpose: Map dependencies and migration risk.
      kind: work
      reads: [brief]
      writes: [inventory]
      work:
        pattern: fanout
        completion: all
        units:
          - id: dependency-scan
            role: researcher
            intent:
              purpose: research
              consequence: high
              context: repo
              mutation: read_only
            skills:
              max: 2
              suggested_by_domain: true
            compute:
              intent: research-high
          - id: risk-assessment
            role: researcher
            intent:
              purpose: review
              consequence: high
              context: repo
              mutation: read_only
      gate:
        kind: result_verdict
        pass: [map_complete]
      routes:
        pass: plan
```

The compiler emits the runtime graph and validates that every work unit has a
stable id, intent, output contract, and policy.

### Why It Might Work

- Separates human authoring from runtime execution.
- Gives structured homes to fanout, skills, compute, prompt templates, budgets,
  and safety controls.
- Keeps runtime core narrow and strict.
- Enables generated human and agent views.
- Lets v2 manifests continue while v3 authoring matures.

### Tradeoffs

- Adds compiler complexity.
- Requires a clear ownership map and freshness checks.
- Custom authors need tooling or a simpler authoring guide.
- Generated runtime manifests must be reviewable and stable.

### Failure Modes

- The compiler becomes a hidden second runtime.
- Generated manifests are too noisy to review.
- The authoring schema grows faster than runtime support.
- Humans edit generated runtime snapshots directly.

### Disqualifiers

- Wrong if Circuit refuses any workflow compiler beyond the current narrow
  catalog compiler.
- Wrong if custom circuit authoring must remain one tiny YAML with no tooling.

### Cleanup / Migration Implications

- Medium migration cost.
- Lowest long-term cleanup burden if ownership is strict.
- Existing v2 manifests can be treated as already-compiled runtime manifests
  during migration.

### Unknowns

- Best filename and migration convention.
- How much of `SKILL.md` should be projected from structured definitions versus
  remain handwritten.

## Option 4: Programmatic Workflow DSL

### Architecture Shape

Define workflows in TypeScript or another typed DSL and generate manifests,
docs, and tests from code.

```ts
workflow("migrate")
  .phase("inventory")
  .fanout([
    worker("dependency-scan").intent(researchHigh),
    worker("risk-assessment").intent(reviewHigh),
  ])
  .gate(resultVerdict(["map_complete"]))
```

### Why It Might Work

- Strong typechecking.
- Easy reuse of common patterns.
- Can prevent many invalid combinations before JSON Schema validation.

### Tradeoffs

- Much worse for non-engineer custom authors.
- Less readable in the plugin source tree.
- Adds build tooling and runtime trust concerns.
- Harder to edit inside Claude Code as a user-facing authoring format.

### Failure Modes

- Workflow authors become TypeScript authors.
- Generated YAML becomes opaque.
- Small custom circuits become too expensive to create.

### Disqualifiers

- Wrong if human legibility and custom circuit authorability are primary goals.

### Cleanup / Migration Implications

- High migration cost.
- Could coexist for built-ins only, but that creates two authoring paradigms.

### Unknowns

- Whether enough workflow patterns repeat to justify a DSL.

## Option 5: Work-Unit-First Runtime

### Architecture Shape

Make the runtime's primary schema a queue of typed work units rather than a
phase graph. Phases become labels or grouping metadata.

```yaml
work_units:
  - id: inventory.dependency-scan
    phase: inventory
    intent: { purpose: research, consequence: high }
    reads: [brief]
    writes: [dependency_scan]
  - id: inventory.risk-assessment
    phase: inventory
    intent: { purpose: review, consequence: high }
```

### Why It Might Work

- Directly models the true dispatch/control unit.
- Strong fit for fanout, retries, and dynamic scheduling.
- Makes model/effort/skills selection very natural.

### Tradeoffs

- Humans think in phases more readily than queues.
- Runtime topology and artifact chain become less obvious.
- Checkpoint and synthesis phases are awkward unless reintroduced as special
  work units.
- Big conceptual leap from current Circuit.

### Failure Modes

- Workflow readability collapses into a job scheduler.
- Agents optimize individual units without understanding the phase contract.
- Custom circuits become harder to author.

### Disqualifiers

- Wrong as the top-level authoring model.

### Cleanup / Migration Implications

- High migration cost if runtime-first.
- Useful as an internal compiled representation under Option 3.

### Unknowns

- Whether runtime core needs work-unit-level state in the first v3 slice.

## Option 6: Work-Pattern Policy Compiler

### Architecture Shape

Keep the current v2 manifest as the runtime topology. Add an
authoring/control layer that describes typed work patterns under outer steps.
Concrete work-unit instances are created during execution and recorded in
receipts or diagnostics.

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
        skills:
          max: 2
          domain_selected: true
        model_policy:
          default_profile: scan-fast
          floor_profile: scan-fast
          allowed_profiles: [scan-fast, research-standard, research-high]
        budget:
          max_parallel: 5
        safety:
          mutation: read_only
        output_contract: category-findings@v1
```

The runtime receipt records actual instances:

```json
{
  "work_unit_instance": {
    "pattern_id": "category-survey",
    "unit_id": "survey.dead-code",
    "selected_profile": "scan-fast",
    "budget_decision": "allowed"
  }
}
```

### Why It Might Work

- Captures hidden fanout without pretending every instance is static.
- Keeps runtime core on the strict outer graph.
- Gives compute, skill, prompt, budget, and safety policy a structured home.
- Preserves the `workers` adapter boundary by modeling delegation rather than
  parent ownership of worker internals.
- Can be proved with docs/types/fixtures before replacing authored manifests.

### Tradeoffs

- Adds a new concept: pattern vs instance.
- Still requires schema and compiler/projection ownership.
- Does not fully solve work-unit-level resume until the runtime later learns
  instance state.
- Needs very clear custom-author defaults so simple circuits do not pay the
  advanced-schema cost.

### Failure Modes

- Pattern schemas become vague escape hatches.
- The compiler starts deciding dynamic instances from runtime evidence.
- Receipts become the only way to understand behavior unless generated human
  summaries stay first-class.

### Disqualifiers

- Wrong if runtime must track every child dispatch as canonical state in the
  first slice.
- Wrong if the team cannot enforce generated freshness and one-owner rules.

### Cleanup / Migration Implications

- Medium migration cost.
- Lower cleanup burden than a broad v3 definition because it scopes the new
  schema to machine-significant controls and dynamic-work templates.

### Unknowns

- Minimal pattern vocabulary.
- Whether the first proof should live in `circuit.yaml` extensions or a sidecar
  experimental definition.

## Tradeoff Matrix

| Dimension | Extend Current Manifest | Policy Overlay | Authoring Definition -> Runtime Manifest | Programmatic DSL | Work-Unit Runtime | Work-Pattern Policy Compiler |
|-----------|-------------------------|----------------|------------------------------------------|------------------|-------------------|------------------------------|
| Human Legibility | Medium at first, falls as fields grow | Low without merged view | High if authored carefully | Medium for engineers, low for users | Low-Medium | High for built-ins, medium for custom |
| Agent Legibility | Medium | Medium-Low | High | High | High for dispatch, lower for workflow | High for controls, medium for judgment |
| Step/Work-Unit Control | Medium | Medium | High | High | High | High |
| Dynamic Unit Fit | Low | Medium | Medium unless templates exist | Medium | High | High |
| Runtime Fit | Medium-High | High | High if compiled cleanly | Medium | Medium-Low | High |
| Portability | High if disciplined | High if disciplined | High | High | High | High |
| Authorability | Medium | Low-Medium | Medium with tooling | Low | Low-Medium | Medium with a strict minimal subset |
| Migration Difficulty | Low-Medium | Low | Medium | High | High | Medium |
| Cleanup Burden | Medium-High | High | Low-Medium | Medium | Medium | Low-Medium |
| Long-Term Power | Medium | Medium | High | High but narrow audience | High but scheduler-shaped | High without scheduler-shaped authoring |

## Recommendation

Do **not** approve Option 3 as the final architecture yet. Choose **Option 6:
Work-Pattern Policy Compiler** as the next proof target.

The better near-term architecture is a constrained layered model:

```text
Human/agent authoring/control layer
  - phases and artifacts where useful
  - work patterns
  - prompt, skill, compute, budget, safety, checkpoint policy
  - mode behavior only where it compiles statically
        |
        v
Compiled/projected runtime manifest snapshot
  - strict steps
  - paths
  - gates
  - routes
  - protocol ids
        |
        v
Runtime ledger/events/projections
  - transport-neutral outer-step facts
        |
        v
Receipts/diagnostics
  - concrete work-unit instances
  - selected profiles, skills, budgets, adapter bindings
```

This keeps the runtime strict while making hidden dispatch policy legible. It
also avoids the core overreach of the first proposal: trying to author all
runtime child work as static work units before dynamic workflows prove that
shape.

## Runner-Up

The runner-up is **Option 1: Extend The Current Manifest In Place** as a bridge.

It is the pragmatic bridge. It can add `intent`, `controls`, and maybe
`work_patterns` directly to v2 dispatch steps. It loses as the final
architecture because it keeps one file responsible for human authoring, runtime
execution, and local-ish policy. That works briefly and then gets muddy.

## Why The Other Options Lose

- Policy overlays lose because they split the workflow contract and make
  legibility worse unless a compiler/view exists anyway.
- Programmatic DSL loses because it optimizes type safety at the cost of custom
  circuit authorability and direct YAML review.
- Authoring Definition -> Runtime Manifest remains plausible as a later
  architecture, but it needs a real proof that a broad v3 definition is clearer
  than v2 YAML plus SKILL prose.
- Work-unit-first runtime loses as a top-level authoring model because Circuit's
  product language is still phases and artifacts, not a job queue. It remains a
  possible later internal state model if pattern receipts prove insufficient.

## Proposed Schema Concepts

### 1. Circuit Definition vs Runtime Manifest

Use distinct names for distinct responsibilities:

| Layer | Owner | Audience | Purpose |
|-------|-------|----------|---------|
| Circuit Definition / Control Layer | workflow author | humans and agents | Express phases, intent, work patterns, controls, and artifacts |
| Runtime Manifest | compiler/runtime | runtime core | Normalize steps, paths, gates, routes, and protocols |
| Runtime Events | runtime core | runtime/projector | Record observed facts and transition decisions |
| Local Policy Config | user/project | dispatch resolver | Bind portable intent to installed models, skills, adapters, and budgets |

This can be staged without renaming files immediately. The important part is to
stop treating one schema as the perfect owner for every fact.

### 2. Artifact Registry

Current steps repeat literal artifact paths. A definition schema should declare
artifact ids once:

```yaml
artifacts:
  brief:
    path: artifacts/brief.md
    schema: brief@v1
    public: true
  review:
    path: artifacts/review.md
    schema: review@v1
    public: true
    optional_in: [lite]
```

Steps then read/write artifact ids:

```yaml
reads: [brief, plan]
writes: [review]
```

Benefits:

- Humans see the workflow vocabulary up front.
- Agents can reason about canonical vs helper artifacts.
- The compiler can emit v2-style paths.
- Optional artifacts become explicit instead of encoded as `optional:` string
  prefixes everywhere.

### 3. Phase-Oriented Steps With Purpose

Each phase should explain what it is for:

```yaml
phases:
  - id: review
    title: Cutover Review
    phase: Review
    purpose: Verify migration completeness and cutover safety.
    kind: work
```

The current `title` field is not enough. `purpose` is a human/agent bridge:
short enough to read, structured enough to project into prompts and dashboards.

### 4. Work Patterns And Work-Unit Instances

Dispatchable work should be structured as patterns under phases or outer
steps. A pattern is the reusable contract; a work-unit instance is the concrete
dispatch created at runtime.

```yaml
work_patterns:
  - id: external-research
    pattern: static_fanout
    completion: all
    unit_id: "analyze.external"
    role: researcher
    prompt:
      template: research
    model_policy:
      default_profile: research-standard
      floor_profile: scan-fast
      allowed_profiles: [scan-fast, research-standard, research-high]
    skills:
      max: 2
      domain_selected: true
    safety:
      mutation: read_only
    outputs:
      report: phases/analyze-ext/external-evidence.md
```

Patterns should be few and familiar:

| Pattern | Use |
|---------|-----|
| `single` | One worker or one synthesis action |
| `static_fanout` | Known independent workers whose outputs are synthesized |
| `dynamic_fanout` | Runtime-discovered workers from categories, queue items, batches, or lenses |
| `workers_loop` | Delegate to the internal `workers` adapter without parent ownership of worker-private files |
| `tournament` | Bounded diverge, adversarial review, revise, stress-test, converge |
| `audit` | Diagnose-only review or verification worker |

The goal is not to model every shell command or every runtime instance. The
goal is to expose the policy that controls dynamic work while recording actual
instances in receipts/diagnostics.

### 5. Compute Profiles Before Provider Selection

Use explicit logical profiles for deterministic model/effort control, with
portable work intent as explanatory metadata:

```yaml
model_policy:
  default_profile: review-high
  floor_profile: review-standard
  allowed_profiles: [review-standard, review-high, review-critical]
intent:
  purpose: review
  consequence: critical
  context: repo
  mutation: read_only
  independence: fresh
  latency: thorough
```

The resolver may use `intent` as an input to explain or suggest profiles, but
critical floors and allowed ranges should be explicit when safety or cost
matters. Provider model IDs remain in config:

```yaml
model_profiles:
  review-critical:
    codex:
      model: gpt-5.4
      effort: xhigh
```

This keeps the Bounded Adaptive Profile Stack as the compute-control primitive:
profiles define floors/defaults/ranges, intent explains the work, and config
binds profiles to provider-specific controls.

### 6. Skill Policy

Skills should be controlled at circuit, phase, and work-pattern level:

```yaml
skills:
  max: 3
  required: []
  suggested: [tdd]
  domain_selected: true
  forbidden: [workers]
  missing_optional: omit_with_receipt_warning
```

Distinctions:

- `required`: workflow cannot run correctly without this skill. Use sparingly.
- `suggested`: use if installed or if config maps an equivalent.
- `domain_selected`: resolver may add project/domain skills up to `max`.
- `forbidden`: prevents footguns like injecting `workers` as a normal skill.

For shipped workflows, most domain skills should be `suggested` or
`domain_selected`, not required.

### 7. Prompt Policy

Prompt assembly is currently real behavior but mostly prose-owned. A work unit
should declare:

```yaml
prompt:
  template: review
  header_contract: independent-review@v1
  include_artifacts: [brief, plan, verification]
  output_contract: review@v1
```

This lets agents and tooling know which template is intended before reading
shell examples.

### 8. Budget And Concurrency Policy

Budgets should grow beyond `max_attempts` and `timeout_seconds`:

```yaml
budget:
  max_attempts: 2
  max_parallel: 3
  max_fix_loops: 1
  max_premium_dispatches: 1
  stop_after_batches: 3
  timeout_seconds: 1800
```

Budget belongs at multiple scopes:

- circuit default
- mode default
- phase override
- work-pattern override
- user/project cap

The resolver should merge these deterministically and record the effective
budget in receipts.

### 9. Safety And Mutation Policy

Current review/verify diagnose-only rules are often prose. Put them in policy:

```yaml
safety:
  mutation: read_only
  allowed_paths: []
  require_fresh_context: true
  independent_from: [implementation]
  checkpoint_on:
    - public_api
    - data_migration
    - destructive_cleanup
```

This matters for model selection, prompts, and review expectations.

### 10. Mode Behavior

Entry modes should do more than start at a step and name a rigor. They should
own structured deltas, but only where those deltas compile deterministically or
become receipt-enforced runtime caps:

```yaml
modes:
  lite:
    rigor: Lite
    skip_phases: [review]
    budget:
      max_attempts: 1
    intent_adjustments:
      latency: fast
  deep:
    rigor: Deep
    enable_patterns: [seam-proof]
    checkpoint_policy: confirm_scope
  autonomous:
    rigor: Autonomous
    checkpoint_policy: auto_when_evidence_clear
    stop_conditions:
      max_batches: 3
```

This would reduce drift where workflow-matrix, SKILL prose, and manifest entry
mode descriptions disagree about Lite or Autonomous behavior. It must not become
a hidden runtime graph rewriter.

### 11. Gate Contracts

Current gates are useful, but they are mostly shallow:

- markdown sections exist
- file exists
- result verdict is allowed
- checkpoint selection is allowed

That is a good runtime floor. The definition schema should also express gate
intent:

```yaml
gate:
  kind: review_verdict
  source: review
  pass: [clean, ship_ready]
  blocks_on:
    severity: critical
  reroute:
    issues_found: act
```

The compiler can still emit v2 `result_verdict` gates, but humans and agents
see the semantic contract.

## Control Surface Stress Test

### Model And Effort

First-principles schema should not say `model: gpt-5.4-high` in shipped
definitions. It should say:

```yaml
intent:
  purpose: review
  consequence: critical
  independence: fresh
compute:
  allow_ensemble: true
  floor: critical
```

The local resolver binds that to a profile and provider settings. The receipt
records original intent, derived profile, concrete model/effort, and why.

### Skills

Current config can map skills by circuit, and SKILL prose tells agents to pick
1-2 domain skills. A schema-level policy should make this explicit:

```yaml
skills:
  max: 2
  suggested: [tdd]
  domain_selected: true
```

For a Rust project, local config or resolver may add `rust`. For a React project,
it may add React guidance. Missing optional skills should be a receipt warning,
not a hard failure.

### Prompt Templates

The schema should declare `template: implement`, `template: review`,
`template: converge`, or workflow-specific templates. Otherwise model/skills
control is not enough; the worker still may receive the wrong operating
contract.

### Adapter Selection

Workflow definitions should not choose provider-specific adapters by default.
They may declare adapter constraints:

```yaml
execution:
  transport: worker
  isolation: worktree
  adapter_capabilities:
    required: [filesystem.write]
    optional: [long-context]
```

Config binds those to `codex`, `agent`, `cursor-agent`, or custom wrappers.

### Rigor

Rigor should be structured mode policy rather than only prose. This makes
profile-specific control legible:

- Lite lowers latency and may skip review if the workflow contract allows.
- Deep adds work patterns or raises evidence requirements.
- Tournament uses a bounded `tournament` pattern.
- Autonomous changes checkpoint policy and stop conditions, not just "no human."

### Parallelism

Fanout patterns need explicit `max_parallel`, completion rule, and aggregation:

```yaml
work_patterns:
  - id: survey-category
    pattern: dynamic_fanout
    unit_id: "survey.{category}"
    max_parallel: 5
    completion: all
    aggregate_to: analysis
```

This lets Circuit budget, schedule, and debug parallel workers without reading
SKILL prose.

### Checkpoints

Checkpoint behavior should distinguish:

- checkpoint exists in topology
- when it should actually ask the user
- when Autonomous may auto-resolve
- what evidence permits auto-resolution
- what choices reroute

Current schema has only checkpoint shape, not conditional policy.

### Mutability And Review Independence

Review and verify work patterns should declare `mutation: read_only` or
`diagnose_only`. Implementation patterns should declare allowed mutation scope
and verification requirements.

### Receipts And Debugging

Every resolved work-unit instance should have a receipt section like:

```json
{
  "work_unit_selection": {
    "unit_id": "review.cutover",
    "intent": {
      "purpose": "review",
      "consequence": "critical",
      "mutation": "read_only"
    },
    "skills": {
      "requested": ["tdd"],
      "included": ["tdd"],
      "omitted_optional": []
    },
    "compute": {
      "derived_profile": "review-critical",
      "model": "gpt-5.4",
      "effort": "xhigh"
    },
    "budget": {
      "decision": "allowed"
    }
  }
}
```

This stays out of canonical runtime events and belongs in dispatch/work-unit
receipts or diagnostics.

## Stress Tests

### Explore Tournament

The winning schema must model:

- three proposal workers with different stances
- three adversarial reviewers
- three revision workers
- three stress-test workers
- one convergence/pre-mortem synthesis
- one tradeoff checkpoint
- bounded budget and ensemble policy

Current v2 manifest cannot express this without prose. Option 6 can express it
as a `tournament` work pattern inside the Decide phase while compiling to a
runtime-safe outer graph.

### Build

The winning schema must model:

- Plan/Act/Verify/Review/Close phases
- Act through `workers_loop`
- review as fresh-context, diagnose-only work
- mode-specific behavior for Lite vs Standard vs Deep vs Autonomous
- skills and compute intent for implementation vs review

Option 6 keeps Build human-readable while giving agents a structured workers
loop contract.

### Repair

The winning schema must model:

- bounded reproduction/hypothesis search
- regression-test-first intent
- no-repro escalation
- fix through `workers_loop` or inline under Lite
- independent review except when mode explicitly skips it

This requires mode deltas, safety, and budgets that v2 currently leaves to
prose.

### Migrate

The winning schema must model:

- inventory fanout
- coexistence plan checkpoint
- batch execution through workers
- mandatory re-evaluation after each batch
- full verification
- cutover review with critical consequence
- rollback and coexistence requirements

Option 6 can represent inventory fanout and cutover review as different work
patterns with different intent metadata and compute floors, while batch
instances remain runtime-discovered.

### Sweep

The winning schema must model:

- category survey fanout
- confidence/risk triage
- PROVE evidence adjudication
- low-risk batch execution
- deferred review
- Autonomous three-batch stop condition
- injection check

This is a strong argument for work patterns and mode behavior as first-class
schema concepts, with concrete categories and batches recorded as runtime
instances.

### Custom Circuits

The winning schema must not make custom authors write 200 lines for a simple
research workflow. It needs:

- a minimal form for simple single-worker workflows
- defaults for common phase patterns
- generated validation messages that explain what is missing
- examples that show both simple and advanced usage

The work-pattern proof should support a compact authoring subset and project it
to the fuller runtime manifest and summary views.

## Must-Be-True Assumptions

| Assumption | Why It Matters | How To Verify | Fastest Disproof |
|------------|----------------|---------------|------------------|
| A constrained pattern definition can stay readable | Core bet of Option 6 | Rewrite Sweep as an experimental work-pattern definition | The source is longer and less clear than SKILL prose plus v2 YAML |
| A compiler can remain an owner-normalizer, not a hidden runtime | Prevents architecture drift | Type-level skeleton plus golden generated manifest fixtures | Generated output depends on runtime state or config |
| Work patterns cover real hidden dispatches | Needed for step-level control | Model Explore Tournament, Migrate inventory, Sweep survey, Build workers loop | Many hidden behaviors still need prose-only exceptions |
| Intent dimensions are few enough | Prevents taxonomy sprawl | Try assigning intent metadata to all built-in work patterns | Authors need custom ad hoc fields everywhere |
| Config can bind logical profiles and portable intent to local tools | Keeps provider IDs out of definitions | Resolver fixture for models, effort, skills, adapters, budgets | Definitions must name concrete providers to be useful |
| Runtime core can consume compiled manifests without learning authoring fields | Preserves runtime architecture | Runtime fixture uses compiled v2/v3 snapshot only | Planner needs authoring-only fields |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Authoring schema grows too large | Medium | High | Define a minimal subset and pattern presets |
| Compiler becomes a second runtime | Medium | High | Compiler only normalizes static definitions; no runtime facts or config |
| Human-authored and compiled files drift | Medium | High | Generated freshness checks and "do not edit generated" convention |
| Existing custom circuits break | Medium | High | Keep v2 manifest support; migrate built-ins first |
| Provider details leak into definitions | Medium | Medium | Schema allows intent/profile names only; provider bindings in config |
| Skill names become environment-specific hard requirements | Medium | Medium | Use suggested/domain-selected skills; required only for project-local circuits |
| Runtime events get polluted with execution policy | Low-Medium | High | Keep policy in definition/config and resolution in receipts |
| Review diffs become noisy | Medium | Medium | Stable compiler output and generated summary views |

## Validation Spikes

| Spike | Question Answered | Cost | Success Signal | Failure Signal |
|-------|-------------------|------|----------------|----------------|
| Work-pattern definition sketch for Sweep | Can the most fanout-heavy workflow become more legible? | Low-Medium | Source is clearer than current YAML+prose for survey/execute/verify | YAML becomes too long or abstract |
| WorkPatternIR skeleton | What is the minimal typed structure for patterns and controls? | Low | Type skeleton models single/static_fanout/dynamic_fanout/workers/tournament/audit | Needs arbitrary `Record<string, unknown>` escape hatches |
| Compiler golden fixture | Can v3 source compile to current v2-like runtime manifest? | Medium | Existing runtime bootstrap can consume generated snapshot | Runtime needs authoring fields directly |
| Intent assignment pass | Are intent dimensions sufficient? | Low | Every built-in hidden dispatch gets purpose/consequence/context/mutation/independence | Many one-off dimensions appear |
| Skill policy resolver fixture | Can skills be required/suggested/domain-selected deterministically? | Low | Missing optional skills warn; required missing blocks; max count enforced | Resolver needs prose inspection |
| Compute resolver fixture | Can intent derive logical profiles and bind provider config? | Low | Receipts explain intent -> profile -> provider binding | Provider IDs leak into definitions |
| Human review exercise | Is the new schema easier to review? | Low | Reviewer can identify risky/costly work patterns from source alone | Reviewer still must read SKILL prose for judgment protocols |

## Recommended First Slice

Do not immediately rewrite the runtime. Start with a proof-oriented schema
spike. The concrete Sweep proof plan is
`docs/work-pattern-policy-compiler-proof-slice.md`.

1. Create an experimental work-pattern definition for one workflow with heavy
   hidden behavior, preferably Sweep first and Explore Tournament second.
2. Define a small `WorkPatternIR` type with:
   - id
   - parent step id
   - pattern
   - unit id template
   - dynamic source, if any
   - role
   - model policy
   - intent metadata
   - skills policy
   - prompt policy
   - budget
   - safety/mutation
   - output contract
3. Add receipt examples for concrete `work_unit_instance` records produced by
   those patterns.
4. Write a compiler/projection fixture that emits the current v2-compatible
   runtime manifest shape for the outer graph.
5. Generate a human summary view from the same definition:
   - phases
   - work patterns
   - expected dynamic instances
   - expensive/critical work
   - checkpoints
   - mode differences
6. Keep runtime events unchanged.

This validates the architectural bet without committing to a full migration.

## What Should Change In The Model/Effort Recommendation

The earlier model-effort tournament should be refined:

- `model_policy` should remain the deterministic compute-control primitive for
  floors, defaults, allowed ranges, and ensemble eligibility.
- `intent` should supplement `model_policy` by explaining the work shape and
  giving resolvers evidence for profile selection. It should not replace
  explicit critical floors.
- Step-level policy must include child work patterns, not only static top-level
  manifest steps.
- Skills and prompt templates belong in the same execution-control family as
  compute, because all three shape worker behavior.

The better name is:

> **Work-Pattern Adaptive Profile Stack**

It sits inside the constrained Work-Pattern Policy Compiler.

## Handoff To architecture-scaffold

### Chosen Architecture

Work-Pattern Policy Compiler: a constrained authoring/control layer that
declares phases where useful, work patterns, prompt/skill/compute/budget/safety
policy, and statically compilable mode behavior, projected into strict v2
runtime manifest snapshots while actual runtime work-unit instances are
recorded in receipts/diagnostics.

### Decision Rationale

This preserves the key insight of the Layered Circuit Definition while avoiding
the unproven assumption that all hidden work can be statically listed as work
units. It keeps local provider/tool bindings in config, runtime topology strict,
and dynamic work visible through pattern contracts plus receipts.

### Invariants

- Runtime events remain transport-neutral.
- Provider model IDs stay in config/adapters.
- Existing v2 manifests continue to run during migration.
- `SKILL.md` remains the narrative execution guide, but machine-significant
  control moves into structured definition fields.
- Work-unit instance receipts explain resolved skills, compute, budgets, and
  bindings.

### Non-Goals

- Full runtime rewrite in the first slice.
- Programmatic-only workflow authoring.
- Eliminating all workflow prose.
- Encoding provider catalogs in workflow definitions.
- Listing every runtime-discovered child dispatch statically.

### Critical Workflows

- Sweep: category fanout, PROVE adjudication, workers loop, autonomous cap.
- Explore: Standard evidence fanout and Tournament sequence.
- Migrate: inventory fanout, workers loop, cutover review.
- Build: workers loop and independent review.
- Repair: bounded diagnosis and regression-first fix.

### External Surfaces

- `schemas/circuit-manifest.schema.json`
- possible new `schemas/circuit-definition.schema.json`
- `skills/*/circuit.yaml` or new `circuit.definition.yaml`
- catalog compiler or new definition compiler path
- generated runtime manifest snapshot
- generated human summary view
- config resolver for skills/compute/adapters/budgets
- dispatch receipts/diagnostics

### Known Hotspots

- Catalog compiler ownership rules from the compile-oriented RFC.
- Runtime-core type boundaries around manifest snapshots and transport-neutral
  facts.
- Custom circuit authoring docs.
- Existing workflow SKILL prose that owns hidden fanout and mode behavior.
- Dispatch config surface, especially roles/circuits/default.

### Leading Migration Risks

- Accidentally creating two live sources of truth.
- Making custom circuit authoring too complex.
- Trying to model every judgment in schema instead of only machine-significant
  control.
- Moving too much runtime behavior into a compiler.
- Confusing work patterns with concrete runtime instances.

### Expected Deletion Or Replacement Zones

- Prose-only declarations of fanout counts, skill budgets, and compute floors
  should eventually become structured fields with prose explanations.
- `model_policy` examples should be reframed as profile floors/defaults under
  work patterns, with `intent` as explanatory metadata.
- Some custom-circuit docs will need new minimal and advanced examples.

### Validation Spikes Already Run

- Current schema and all built-in workflow manifests inspected.
- SKILL prose inspected for hidden work units and controls.
- Runtime manifest consumption points inspected.
- Config and dispatch routing surfaces inspected.
- Existing compile-oriented ownership constraints reviewed.

### What Still Needs Proof

- A concrete work-pattern definition for Sweep.
- A minimal `WorkPatternIR` that covers static fanout, dynamic fanout,
  workers-loop delegation, tournament, and audit patterns.
- A projection fixture proving the authoring/control layer can emit current
  runtime-compatible manifests.
- Receipt examples proving concrete work-unit instances can be debugged without
  runtime event pollution.
- A human review showing the source is easier, not just more complete.
