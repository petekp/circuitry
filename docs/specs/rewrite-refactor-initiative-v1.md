# Rewrite And Refactor Initiative V1

Status: architecture exploration, not current behavior.

Date: 2026-05-27

## Recommendation

Do not start with a full rewrite.

Start with a staged simplification program that preserves the current product
contracts and selectively rewrites subsystems only behind existing boundaries.
The first execution slice should prove that the system can get simpler without
weakening flow behavior, generated host surfaces, run folders, traces, reports,
or `npm run verify`.

The strongest long-term target is a clearer one-way shape:

```text
FlowData sources
  -> compiled flow package index
  -> runtime service bundle
  -> graph runner and executors
  -> host packages, run folders, reports, and proof evidence
```

This is close to the architecture already described in the repo. The work is
not to invent a new product. The work is to remove pivot residue and make the
current product easier to understand, change, and verify.

## Decision Frame

Goal: simplify Circuit after many pivots while keeping the purpose, value prop,
and core feature set intact.

Problem: the codebase contains both real product complexity and process-shaped
complexity from agent-led pivots. A rewrite could remove accidental complexity,
but it could also discard behavior that is hard to rediscover.

Decision horizon: one year. Optimize for a codebase that can keep absorbing
new flows, host changes, history/memory work, and release checks without a
fresh simplification crisis.

Primary decision: choose the path for the initiative, not the exact migration
plan. Once this direction is accepted, turn it into an audit-and-migrate ledger.

## Non-Goals

- Do not start implementation in this document.
- Do not choose a full rewrite unless current-source evidence disproves the
  existing FlowData, compiled-flow, run-folder, or generated-surface model.
- Do not relax host compatibility, generated-surface drift checks, trace/report
  contracts, or the final `npm run verify` proof bar to make simplification
  easier.
- Do not treat old migration notes, memory, or positioning docs as current
  behavior unless code, tests, generated surfaces, or release checks agree.

## Constraints

| Constraint | Consequence |
| --- | --- |
| Current host packages are committed shipping surfaces. | Host behavior must be preserved or migrated explicitly. |
| Generated outputs are source-owned. | Rewrite/refactor slices must edit sources and regenerate, not hand-patch outputs. |
| Run folders are compatibility data. | Trace, report, checkpoint, resume, and result semantics need explicit parity proof. |
| Flow-specific behavior belongs in flow packages. | Runtime simplification must reduce coupling without adding flow-specific branches. |
| Selection, connectors, and skills are product features. | Simpler architecture cannot collapse per-step model, effort, connector, or skill provenance. |
| Release checks encode public claims. | Public docs and generated release truth must move with behavior. |

## External Surfaces

- `bin/circuit`
- `plugins/claude/`
- `plugins/codex/`
- `generated/flows/`
- `.circuit/runs/`
- `~/.config/circuit/config.yaml`
- `./.circuit/config.yaml`
- public docs, release proof runs, parity matrix, and readiness report

## Product Invariants

These must survive any rewrite or deep refactor unless a later migration plan
explicitly changes them.

| Invariant | Evidence |
| --- | --- |
| Circuit is a plugin and CLI that gives agents repeatable flows with evidence, checks, traces, and reports. | [README.md](../../README.md), [package.json](../../package.json) |
| `/circuit:run` and `./bin/circuit run` are the normal front doors; direct flow host commands are hidden by default, while explicit CLI flow starts remain available for tests, debugging, and old run folders. | [README.md](../../README.md), [src/cli/circuit.ts](../../src/cli/circuit.ts) |
| Flow authoring starts from typed `FlowData` and generated schematics, compiled manifests, host mirrors, and WorkContract projections. | [docs/architecture/declarative-flow-architecture.md](../architecture/declarative-flow-architecture.md), [docs/generated-surfaces.md](../generated-surfaces.md) |
| The runtime executes compiled flow graphs and must not own flow-specific product behavior. | [src/runtime/README.md](../../src/runtime/README.md), [docs/architecture/runtime.md](../architecture/runtime.md), [tests/contracts/engine-flow-boundary.test.ts](../../tests/contracts/engine-flow-boundary.test.ts) |
| Run folders are defined by manifest snapshots, append-only traces, reports, and result files. | [docs/contracts/run.md](../contracts/run.md), [src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts) |
| Generated host surfaces are committed outputs and must be regenerated, not hand-edited. | [docs/generated-surfaces.md](../generated-surfaces.md), `npm run check-flow-drift` |
| Product-facing terms must use the canonical vocabulary: flow, schematic, block, route, relay, check, trace, report, evidence. | [UBIQUITOUS_LANGUAGE.md](../../UBIQUITOUS_LANGUAGE.md) |
| `npm run verify` is the canonical proof bar. | [package.json](../../package.json), [AGENTS.md](../../AGENTS.md) |

## Local Evidence Used

Commands run during this exploration:

```bash
git status --short
find src -type f -name '*.ts' | awk -F/ '{counts[$2]++} END {for (area in counts) print area, counts[area]}' | sort
find tests -type f -name '*.ts' | awk -F/ '{counts[$2]++} END {for (area in counts) print area, counts[area]}' | sort
find generated plugins/claude plugins/codex -type f | awk -F/ '{counts[$1]++} END {for (area in counts) print area, counts[area]}' | sort
find docs/release/proofs/runs -maxdepth 1 -mindepth 1 -type d | wc -l
npm run check-flow-drift
```

Observed shape:

| Probe | Result |
| --- | --- |
| Source files by main area | `flows` 118, `shared` 48, `runtime` 47, `schemas` 46, `cli` 8, `connectors` 6, `history` 5, `run-status` 3, `release` 2 |
| Tests by area | `runner` 79, `contracts` 57, `unit` 22, `runtime` 14, plus parity, properties, evals, integration, release, helpers, and soak tests |
| Generated or host files | `generated` 23, `plugins` 61 |
| Checked-in proof run directories | 13 directories, 12 direct `result.json` files |
| Generated-surface drift | `npm run check-flow-drift` passed |

Pre-existing dirty working tree state at the start of this exploration:

```text
 M tests/unit/history-indexer.test.ts
?? docs/ideas/longitudinal-evidence-memory.md
```

Those files were treated as unrelated user work and were not edited.

## Current System

| Area | Current Owner | Inputs | Outputs | Dependencies | Pain |
| --- | --- | --- | --- | --- | --- |
| Product entry and operator docs | `README.md`, `docs/README.md`, `docs/operator-guide.md` | Host setup, CLI usage, operator intent | Install paths, command guidance, proof expectations | Generated surfaces, release proofs, vocabulary | Public docs must stay simple while the repo has many internal surfaces. |
| CLI and router | `src/cli/`, `src/flows/router.ts` | CLI args, goal text, config layers, compiled flow files | Runtime invocation, progress output, run folder paths | schemas, flow catalog, runtime, history recall, shared helpers | The CLI is a high-value integration surface and can become a catch-all if not kept narrow. |
| Flow authoring | `src/flows/<id>/data.ts`, `flow.ts`, `reports.ts`, `writers/`, `relay-hints.ts` | FlowData, report schemas, writers, relay guidance | Compiled flow package data, generated schematics, reports | schemas, shared helpers, registries | Flow packages are large but mostly product-owned. The risk is duplicated report and writer patterns, not the package model itself. |
| Catalog and registries | `src/flows/catalog.ts`, `src/flows/catalog-derivations.ts`, `src/flows/registries/` | Flow definitions and compiled packages | Runtime registries, report schemas, writer lookup, routing metadata | flow packages, schemas, runtime consumers | This is load-bearing but also the main place where dependency direction can blur. |
| Generated surfaces | `scripts/flows/emit.ts`, `scripts/flows/host-renderers.ts`, `generated/`, `plugins/` | FlowData, command sources, compiled flow files | Host commands, Codex skills, flow mirrors, block catalog, WorkContract projections | build output, plugin package rules, release checks | Broad blast radius. A small source change fans out to many committed outputs. |
| Runtime graph execution | `src/runtime/run/graph-runner.ts`, `src/runtime/executors/` | Executable flow, run options, capabilities, config, relayer | Trace entries, reports, checkpoints, result file | schemas, registries, connectors, run files, shared helpers | This is the densest load-bearing path. It mixes graph walk, recovery mechanics, close semantics, proof policy, and capability wiring. |
| Run files and projections | `src/runtime/run-files/`, `src/runtime/trace/`, `src/runtime/projections/`, `src/run-status/` | Trace, manifest snapshot, report files | Status, progress, result, checkpoint projections | run contract, schemas, shared output helpers | The model is right, but the reader must jump across several folders to follow one run. |
| Schemas and contracts | `src/schemas/`, `docs/contracts/`, `tests/contracts/` | Zod schemas, contract docs, property expectations | Parse boundaries, contract tests, public invariants | all layers | The schema layer is valuable, but contract and schema growth can become defensive noise if not pruned. |
| Connectors and selection | `src/connectors/`, `src/shared/selection-resolver.ts`, `src/shared/relay-selection.ts` | config layers, connector refs, skill slots, relay context | worker subprocesses, resolved selection, relay guidance | schemas, flow registries, shared helpers | Selection is a core feature. It needs sharper boundaries from flow registries and runtime capabilities. |
| History and memory | `src/history/`, `docs/specs/circuit-history-*`, local `.circuit/runs` | prior runs, reports, trace snippets | recall reports, memory input previews | run folders, schemas, CLI | High product value, but it adds another layer over run data. It should not become authority for current proof. |
| Release and proof evidence | `docs/release/`, `src/release/`, `scripts/release/`, `tests/release/` | generated outputs, public claims, golden runs | readiness report, parity matrix, proof checks | runtime, generated surfaces, host packages | Strong safety net. Also contributes many surfaces that must move together. |

## Complexity Inventory

### Load-Bearing Complexity

| Complexity | Why It Stays |
| --- | --- |
| Typed flows, reports, and compiled manifests | They are what make later steps consume facts instead of arbitrary prose. |
| Generated host surfaces | They keep Claude and Codex packages consistent with source flows. |
| Run folder contract | It is the basis for trace, resume, status, reports, and future history recall. |
| Selection and connector routing | Per-step model, effort, skills, and connector choice are part of the product value. |
| Contract and release checks | They are the reason simplification can happen without silent host or proof drift. |
| Human checkpoints and safe defaults | Human-in-the-loop is part of the product, not an implementation detail. |

### Likely Accreted Complexity

| Complexity | Evidence | Simplification Direction |
| --- | --- | --- |
| Runtime imports flow registries directly in many files | Import probe found `runtime -> flows` edges; boundary tests allow registries and catalog infrastructure. | Introduce a runtime-facing package index or service bundle so graph execution depends on a smaller port. |
| Shared helpers import flow registries and flow-specific reports | Import probe found `shared -> flows` edges, including HTML render helpers and selection helpers. | Split true shared foundations from flow-aware presentation or registry helpers. |
| `graph-runner.ts` owns several concerns in one file | It handles bootstrap, capability assembly, step advancement, recovery evidence, close proof gaps, terminal outcome binding, and result writing. | Extract policy-free helpers first, then isolate recovery/close policy behind narrow runtime services. |
| Report writer patterns repeat across flow packages | Flow packages usually carry `data.ts`, `reports.ts`, `command.md`, `relay-hints.ts`, plus writer folders. | Consolidate declarations and writer plumbing where FlowData reports already express enough shape. |
| Release/generation checks are broad and source changes have wide fanout | `check-flow-drift` validates block catalog, schematics, compiled flows, WorkContract projections, host mirrors, commands, and runtime bundles. | Keep the broad checks, but improve source-to-output maps and narrow renderer/package responsibilities. |
| Contract docs include deferred properties and historical closure notes | Contracts are useful, but several sections carry migration history. | Separate current invariants from migration notes so current readers do not carry old debate. |

## Options

## Option 1: Staged Simplification In Place

### Architecture Shape

Keep the current repo, source tree, generated-surface model, and runtime
contracts. Simplify by module cluster in small slices. Each slice must preserve
the public flow behavior and pass targeted tests plus the canonical verification
bar.

### What Changes

- Move runtime-facing flow data behind a smaller package-index boundary.
- Split `shared/` into true cross-layer foundations and flow-aware helpers.
- Decompose graph-runner responsibilities without changing run semantics.
- Consolidate repeated report/writer declarations inside flow packages.
- Prune historical contract prose into active invariant sections plus archives.

### Why It Might Work

The current architecture already has useful boundaries: FlowData, catalog
derivations, runtime executors, schemas, generated surfaces, and release checks.
This option improves those boundaries instead of replacing them.

### Failure Modes

| Failure Mode | Warning Signal | Prevention |
| --- | --- | --- |
| It turns into endless cleanup. | Many small PRs land but no concept count drops. | Require each slice to delete or collapse a named complexity class. |
| It avoids the hardest runtime problems. | Graph-runner remains the same size after surrounding churn. | Put graph-runner decomposition in the first three slices. |
| Compatibility fear blocks real simplification. | Every old term or adapter survives forever. | Keep a risk ledger with explicit deletion zones and migration gates. |

### Disqualifiers

- If most complexity proves tied to the same incorrect central model.
- If behavior-preserving slices cannot reduce graph-runner, registry, or shared
  dependency complexity after two real attempts.

## Option 2: Subsystem Rewrites Behind Existing Contracts

### Architecture Shape

Rewrite one subsystem at a time behind the existing public contract. Candidate
subsystems: runtime graph kernel, generated host renderer, selection resolver,
or history/recall. Keep the old external behavior and swap internals only after
equivalence proof.

### What Changes

- A new graph kernel can run behind `runCompiledFlowWithWaiting`.
- A new host renderer can produce byte-equivalent generated surfaces.
- A new package-index boundary can serve the same registries through a clearer
  port.

### Why It Might Work

This is useful when a subsystem is too tangled to untangle safely in place. It
contains rewrite risk to one contract boundary.

### Failure Modes

| Failure Mode | Warning Signal | Prevention |
| --- | --- | --- |
| Parallel systems persist. | Old and new kernels both stay live for months. | Require removal of the old path before the slice closes. |
| Equivalence tests are too weak. | The new subsystem passes unit tests but breaks host proofs. | Use generated-surface, runtime, runner, parity, and release checks as gates. |
| The rewrite changes product semantics accidentally. | Trace, checkpoint, or proof behavior differs without an explicit migration. | Run golden proof replay or targeted run-folder comparison before cutover. |

### Disqualifiers

- If the subsystem boundary is not already explicit enough to test.
- If the rewrite needs public contract changes before it can prove parity.

## Option 3: New Core With Compatibility Adapter

### Architecture Shape

Build a smaller new core beside the current system, then adapt existing flows
and host packages onto it. The current system remains the compatibility shell
until the new core can run the important flows.

### What Changes

- A new core model becomes the primary runtime.
- Existing compiled flows are translated or adapted.
- Generated surfaces keep the same outer shape during migration.

### Why It Might Work

This can pay off if the current runtime model is fundamentally wrong but the
host/product surface is correct.

### Failure Modes

| Failure Mode | Warning Signal | Prevention |
| --- | --- | --- |
| The adapter becomes the real system. | Most code goes into compatibility glue. | Stop if adapter complexity exceeds the deleted core complexity. |
| The new core under-models current behavior. | Checkpoints, recovery, or proof policy require special cases. | Start with the hardest flow path, not the easiest happy path. |
| The migration creates two products. | New flows work differently from old flows. | Keep one operator-facing vocabulary and one run folder contract. |

### Disqualifiers

- If the current compiled-flow and run-folder contracts remain the right
  product model.
- If compatibility requires more code than staged simplification.

## Option 4: Full Rewrite

### Architecture Shape

Freeze the current repo as reference and rebuild Circuit from scratch with a
new core, source tree, generated-surface model, and host package model.

### Why It Might Work

It offers maximum freedom if the current architecture is so wrong that local
refactors only preserve bad assumptions.

### Failure Modes

| Failure Mode | Warning Signal | Prevention |
| --- | --- | --- |
| Hard-won behavior disappears. | The rewrite cannot reproduce current run folders, host mirrors, or proof behavior. | Require a behavior ledger before writing new production code. |
| The rewrite chases elegance instead of product fit. | The new model is cleaner but drops checkpoints, evidence, or generated surfaces. | Treat product invariants as non-negotiable. |
| Migration never finishes. | Old repo remains required for real host use. | Define a short, hard cutover deadline and rollback path before starting. |

### Disqualifiers

- Current generated surfaces are in sync.
- Current runtime and contracts have broad tests.
- Current product model is now believed correct.
- The user wants simplification, not a new product.

Given current evidence, the full rewrite is the wrong default.

## Runner-Up

The runner-up is Option 2: subsystem rewrites behind existing contracts.

It loses as the top-level initiative path because it needs a precise subsystem
boundary before it is safe. Today the strongest evidence points to several
smaller coupling problems rather than one central model failure. Option 2
should stay available as a tactic when a staged slice proves that a subsystem is
too tangled to simplify in place.

## Why The Other Options Lose

Option 3 loses because a new core plus compatibility adapter would raise
concept count before it lowers it. It could be right only if the current
compiled-flow and run-folder contracts prove to be the wrong model.

Option 4 loses because the current generated surfaces are in sync, the runtime
has broad tests, and the product center appears stable. A full rewrite would
spend the most risk before proving the current architecture is the problem.

## What Would Change This Recommendation

Reconsider the recommendation if one of these happens:

- The invariant ledger changes in a way that invalidates FlowData, compiled
  flows, run folders, or generated host packages as the right center.
- The runtime package-index spike and graph-runner decomposition spike both
  fail to reduce real coupling after honest attempts.
- A behavior ledger shows current tests and proof runs cannot protect core
  compatibility.
- A normal flow change still requires runtime-specific branches after the
  first simplification slices.
- Host package or generated-surface constraints change enough that preserving
  the current package model is no longer valuable.

## Tradeoff Matrix

| Dimension | Option 1: Staged Simplification | Option 2: Subsystem Rewrites | Option 3: New Core With Adapter | Option 4: Full Rewrite |
| --- | --- | --- | --- | --- |
| Product safety | High, because contracts stay live | Medium-high, if each boundary has equivalence tests | Medium, because adapter behavior can drift | Low until parity is rebuilt |
| Simplification upside | Medium-high | High inside selected subsystems | High if the new core is right | Highest in theory |
| Migration difficulty | Medium | Medium-high | High | Very high |
| Cleanup burden | Medium, must be managed | High if old and new paths overlap | Very high adapter risk | Very high |
| Rollback story | Strong | Strong per subsystem if old path remains until cutover | Weak after adapter work spreads | Weak |
| Testability | Strong, existing tests apply | Strong only at explicit boundaries | Hard, needs parity harness first | Hardest |
| Concept count | Drops gradually | Drops locally, may rise during rewrite | Rises during adapter period | Drops only after complete cutover |
| Fit for current evidence | Best | Good as a tactic inside Option 1 | Not yet earned | Not earned |

## Assumptions

| Assumption | Why It Matters | How To Verify | Fastest Disproof |
| --- | --- | --- | --- |
| The product center is now stable. | Refactoring toward a moving target recreates the current problem. | Write and approve the invariant list before code changes. | A new near-term pivot changes core flow, evidence, or host goals. |
| Current generated surfaces describe real shipping behavior. | They are the compatibility surface for simplification. | `npm run check-flow-drift`, host smoke tests, release checks. | Generated output is stale or not what hosts consume. |
| Runtime complexity is partly accidental, not entirely essential. | This makes simplification possible without a new core. | Try one graph-runner extraction slice with no behavior change. | The extraction only moves code without reducing coupling or reader burden. |
| FlowData remains the right authoring center. | Replacing it would force a much larger migration. | Add or modify a small flow capability through FlowData and measure fanout. | A normal flow change still requires runtime-specific branches. |
| Existing tests are broad enough to protect staged simplification. | This is why rewrite can wait. | Run focused runtime, contract, generated-surface, and release checks after the first slice. | Important behavior lacks any test or proof surface. |

## Migration Risk Ledger

| Risk | Options Affected | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Host package drift | All | Medium | High | Keep generated surfaces committed and run `npm run check-flow-drift` before and after each slice. |
| Run folder incompatibility | All runtime changes | Medium | High | Treat manifest snapshot, trace, reports, and result files as compatibility fixtures. |
| Recovery and checkpoint semantics drift | Runtime and core changes | Medium | High | Use runtime tests and proof runs that exercise failed checks, checkpoint pause/resume, and recovery routes. |
| Selection resolution loses provenance | Runtime, shared, connector changes | Medium | High | Preserve guidance decisions and selection provenance in trace tests. |
| Partial rewrite leaves duplicate systems | Options 2 and 3 | High | High | Define deletion criteria before introducing a replacement path. |
| Contract docs become stale | Options 1 and 2 | Medium | Medium | Update docs only with source evidence and run docs/release checks when public claims move. |
| Simplification removes valuable explicitness | All | Medium | Medium | For each deletion, name which invariant or test proves the concept was redundant. |

## Validation Spikes

Run these before committing to a large migration ledger.

| Spike | Question Answered | Cost | Success Signal | Failure Signal |
| --- | --- | --- | --- | --- |
| Runtime package-index port spike | Can runtime stop importing flow registries directly? | 1-2 days | Runtime depends on a smaller service bundle; runtime and contract tests pass. | The port duplicates registry behavior or hides flow-specific logic. |
| Graph-runner decomposition spike | Can the runner split without changing behavior? | 1-2 days | Recovery, close, and step-advance helpers move behind narrow functions; `tests/runtime` and runner tests pass. | Code moves but the main loop remains just as hard to follow. |
| Generated renderer equivalence spike | Can host rendering be simplified safely? | 1 day | Renderer code gets smaller and generated outputs remain byte-equivalent or intentionally reviewed. | Outputs drift without a product reason. |
| Flow writer consolidation spike | Can report declarations remove writer boilerplate? | 1-2 days | One flow loses repeated writer registration code while report schema tests pass. | The abstraction hides flow-specific product language. |
| Contract pruning spike | Can current invariants be separated from migration history? | 1 day | A contract doc becomes shorter without losing enforceable invariants or tests. | The removed prose was still the only explanation of a live behavior. |

## Recommended Execution Sequence

1. Freeze the invariant ledger.
   - Turn the Product Invariants section into the acceptance contract for the
     initiative.
   - Add any missing user-approved invariants before code changes.

2. Build a current behavior ledger.
   - List the flows, host surfaces, run-folder files, public commands, and
     release checks that must remain compatible.
   - Include at least one proof path for review, fix, build, explore, goal,
     checkpoint, generated-surface drift, and host packaging.

3. Run the runtime package-index port spike.
   - Goal: reduce `runtime -> flows` coupling without changing flow behavior.
   - Stop if the new boundary only renames the registry layer.

4. Run the graph-runner decomposition spike.
   - Goal: split step advancement, recovery evidence, close semantics, and
     capability assembly into smaller runtime-owned units.
   - Do not change trace semantics in this slice.

5. Consolidate flow report and writer declarations.
   - Start with one flow that has enough duplication to matter.
   - Keep product-specific report language inside the flow package.

6. Simplify generated-surface rendering.
   - Keep `docs/generated-surfaces.md` as the map.
   - Prefer byte-equivalent renderer cleanup before product changes.

7. Prune docs and contracts after code boundaries move.
   - Move historical migration debate out of the active reading path.
   - Keep current invariants, source links, and proof commands.

8. Reassess rewrite need.
   - If the first two technical slices do not reduce coupling or reader burden,
     reconsider Option 2 for a subsystem rewrite.
   - Do not reconsider full rewrite unless the current core model is disproven.

## Decision Needed

Approve Option 1 as the initiative path, with Option 2 allowed only as a
subsystem tactic when an in-place slice fails to reduce real complexity.

Reject Option 3 and Option 4 for now. They are not impossible, but current
evidence does not justify their migration risk.

## Handoff To audit-and-migrate

Chosen architecture: staged simplification in place, with selective subsystem
rewrites behind existing contracts.

Decision rationale: the repo already has the right product center: FlowData
authoring, compiled flow manifests, runtime graph execution, run folders,
typed reports, generated host surfaces, and release proof checks. The main
problem is not a missing architecture. It is accumulated coupling and reader
burden around that architecture.

Invariants: use the Product Invariants section above.

Non-goals:

- No full rewrite at initiative start.
- No public contract break without explicit migration.
- No hand edits to generated host outputs.
- No flow-specific runtime branches.
- No history or memory behavior becoming proof authority.

Critical paths:

- `/circuit:run <task>` and `./bin/circuit run --goal ...`.
- Direct public flows: Build, Explore, Fix, Goal, Prototype, Review, and
  Pursue where exposed.
- Checkpoint pause/resume and safe defaults.
- Relay, verification, review, close, trace, report, result, and operator
  summary production.
- Generated host package refresh and drift check.

External surfaces:

- `bin/circuit`
- `plugins/claude/`
- `plugins/codex/`
- `generated/flows/`
- `.circuit/runs/`
- config files at `~/.config/circuit/config.yaml` and `./.circuit/config.yaml`
- public docs and release proof checks

Known hotspots:

- `src/runtime/run/graph-runner.ts`
- `src/flows/catalog.ts`
- `src/flows/catalog-derivations.ts`
- `src/flows/registries/`
- `src/shared/selection-resolver.ts`
- `src/shared/relay-selection.ts`
- `scripts/flows/emit.ts`
- `scripts/flows/host-renderers.ts`
- `docs/contracts/`

Leading migration risks:

- host drift,
- trace or report incompatibility,
- recovery semantics drift,
- checkpoint resume regressions,
- duplicate old/new subsystem paths,
- abstraction that hides product-specific report language.

Expected deletion zones:

- duplicate report writer registration boilerplate,
- flow-aware helpers currently living in broad `shared/` locations,
- historical contract prose that no longer states current invariants,
- direct runtime imports of flow registries once a smaller package-index port
  exists,
- any compatibility wrapper that survives past its cutover slice.

Proof still needed before implementation:

- user approval of the invariant ledger,
- a behavior ledger for the first migration slice,
- targeted spike results for runtime package-index and graph-runner
  decomposition,
- focused tests for the touched subsystem,
- `npm run verify` before calling an implementation slice complete.
