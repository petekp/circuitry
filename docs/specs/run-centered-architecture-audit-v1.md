# Run-Centered Architecture Audit V1

Status: architecture audit and target recommendation, not current behavior.

Date: 2026-05-28

## Decision

The simplest defensible target architecture is a **Run supervisor** above the
existing process library and runtime kernel.

This is not a blank-slate rewrite. It is also not just renaming today's Goal
flow to Run. The current repo already has several strong foundations:
FlowData-backed process packages, generated host surfaces, run folders, trace
contracts, checkpoint resume, typed reports, and hint-only history recall. The
missing piece is the product-level loop that turns operator intent into a goal,
chooses one or more processes, runs them, checks whether the goal is truly done,
and closes or blocks honestly.

Recommended target shape:

```text
Host Run entry
  -> Run supervisor
     -> memory recall
     -> conditional clarify
     -> goal contract
     -> process plan
     -> runtime kernel calls
     -> completion gate
     -> memory update event
  -> surface projector
  -> host rendering
```

The core architectural move is to put product decisions in Run, keep process
packages as reusable machinery, and keep the runtime kernel focused on graph
execution.

## Evidence Surface

This audit used the current repo, not only prior plans.

Current-source evidence:

- Product alignment: [CONTEXT.md](../../CONTEXT.md)
- Target hypothesis under test:
  [docs/specs/target-architecture-hypothesis-v1.md](target-architecture-hypothesis-v1.md)
- Prior rewrite recommendation:
  [docs/specs/rewrite-refactor-initiative-v1.md](rewrite-refactor-initiative-v1.md)
- Run command source: [src/commands/run.md](../../src/commands/run.md)
- CLI runtime entry: [src/cli/circuit.ts](../../src/cli/circuit.ts)
- Router: [src/flows/router.ts](../../src/flows/router.ts)
- Flow package model:
  [src/flows/catalog.ts](../../src/flows/catalog.ts),
  [src/flows/types.ts](../../src/flows/types.ts),
  [src/flows/flow-definition.ts](../../src/flows/flow-definition.ts)
- Goal flow:
  [src/flows/goal/data.ts](../../src/flows/goal/data.ts),
  [src/flows/goal/reports.ts](../../src/flows/goal/reports.ts)
- Runtime:
  [docs/architecture/runtime.md](../architecture/runtime.md),
  [src/runtime/run/compiled-flow-runner.ts](../../src/runtime/run/compiled-flow-runner.ts),
  [src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts)
- Generated surfaces:
  [docs/generated-surfaces.md](../generated-surfaces.md),
  [scripts/flows/emit.ts](../../scripts/flows/emit.ts),
  [plugins/README.md](../../plugins/README.md)
- Host rendering and human output:
  [docs/contracts/host-rendering.md](../contracts/host-rendering.md),
  [src/shared/operator-summary-writer.ts](../../src/shared/operator-summary-writer.ts),
  [src/shared/operator-summary/projections.ts](../../src/shared/operator-summary/projections.ts)
- Memory:
  [docs/specs/circuit-history-run-start-recall-v1.md](circuit-history-run-start-recall-v1.md),
  [src/history/run-start-recall.ts](../../src/history/run-start-recall.ts),
  [src/history/memory-preview.ts](../../src/history/memory-preview.ts)
- Blocks and checkpoints:
  [docs/flows/blocks.md](../flows/blocks.md),
  [src/schemas/flow-block-definitions.ts](../../src/schemas/flow-block-definitions.ts),
  [src/runtime/executors/checkpoint.ts](../../src/runtime/executors/checkpoint.ts),
  [src/shared/html/build-checkpoint.ts](../../src/shared/html/build-checkpoint.ts),
  [src/shared/html/prototype-checkpoint.ts](../../src/shared/html/prototype-checkpoint.ts)

Local probes:

```bash
git status --short
find src/cli src/runtime src/flows src/history src/shared -maxdepth 3 -type f | sort
rg -n "classifyCompiledFlowTask|prepareRunStartHistoryRecall|executeExecutableFlow|progressSurface|operatorSummary|checkpoint|memoryInputs" src/cli src/runtime src/flows src/history src/shared tests -g '*.ts'
node <inline import-boundary probe over git ls-files 'src/**/*.ts'>
```

The import-boundary probe found the current source counts and cross-cluster
imports below:

| Probe Result | Value |
| --- | --- |
| Source files by cluster | `flows` 118, `shared` 48, `runtime` 47, `schemas` 46, `cli` 8, `connectors` 6, `history` 5, `run-status` 3, `release` 2 |
| Largest cross-cluster edges | `runtime -> schemas` 75, `shared -> schemas` 48, `runtime -> shared` 31, `flows -> schemas` 27, `flows -> shared` 24 |
| Current runtime-to-flow edges | 19, all through catalog, registry, type, or runtime-surface access in the probed source |
| Current CLI-to-flow edges | 2: catalog runtime surface lookup and router selection |
| Current shared-to-flow edges | 5: operator summary, relay selection/support, and selection resolver |

Confidence note: the probe is a lightweight import scan, not a full dependency
graph. It resolved relative TypeScript imports from tracked `src/**/*.ts` files,
grouped files by the first path segment under `src/`, counted cross-cluster
edges, and listed non-flow files that import from `src/flows`. It is enough for
audit direction, not enough for migration slicing.

## Current Boundary Map

| Area | Current Role | Fit With Run-Centered Target | Confidence | Evidence |
| --- | --- | --- | --- | --- |
| Host Run command | Host-facing natural-language entry. It asks the host to recommend a flow, then invokes CLI flows. | Partly fits. It is the right user entry, but too much Run behavior is host instruction text instead of source-owned product logic. | High | [src/commands/run.md](../../src/commands/run.md) |
| CLI `run` path | Parses CLI args, routes when no explicit flow is supplied, loads generated flow JSON, prepares history recall, calls runtime, writes operator summary. | Fits as invocation shell. It should not become the Run supervisor itself. | High | [src/cli/circuit.ts](../../src/cli/circuit.ts) |
| Router | Deterministic classifier over routable flow package metadata. | Fits as a process-selection helper. It should become one step inside Run, not the product front door. | High | [src/flows/router.ts](../../src/flows/router.ts) |
| Flow packages | Typed process packages compiled into catalog state, registries, generated manifests, and host mirrors. | Strong fit. This should remain the process library behind Run. | High | [src/flows/types.ts](../../src/flows/types.ts), [docs/architecture/declarative-flow-architecture.md](../architecture/declarative-flow-architecture.md) |
| Goal flow | Public flow with clarify, goal contract, static child sub-runs, evidence evaluation, recovery, two gate passes, and close. | Strong source of primitives, but not enough as-is because child process targets are statically authored and the flow is still a public peer. | High | [src/flows/goal/data.ts](../../src/flows/goal/data.ts), [tests/runner/goal-flow.test.ts](../../tests/runner/goal-flow.test.ts) |
| Runtime kernel | Executes compiled graphs, writes manifest snapshots, appends trace entries, handles checkpoints, sub-runs, recovery mechanics, and result files. | Strong fit. Keep product policy out of it. | High | [docs/architecture/runtime.md](../architecture/runtime.md), [src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts) |
| Generated surfaces | Source-owned host commands, Codex skills, flow mirrors, compiled manifests, and drift checks. | Strong fit, but visibility needs a public/default versus expert/internal distinction. | High | [docs/generated-surfaces.md](../generated-surfaces.md), [scripts/flows/emit.ts](../../scripts/flows/emit.ts) |
| Operator summaries and progress | Human projection from run result, reports, progress events, and per-flow summary projectors. | Fits the surface-output boundary. It should get thinner by default, not be removed. | High | [docs/contracts/host-rendering.md](../contracts/host-rendering.md), [src/shared/operator-summary/projections.ts](../../src/shared/operator-summary/projections.ts) |
| History recall | Fresh-run, hint-only prior-run context written to reports and injected into relay prompts. | Fits the memory direction, but only covers recall. It does not yet cover memory update or reasons. | High | [docs/specs/circuit-history-run-start-recall-v1.md](circuit-history-run-start-recall-v1.md), [src/history/run-start-recall.ts](../../src/history/run-start-recall.ts) |
| Checkpoints | Runtime pause/resume plus flow-specific checkpoint packet and HTML projection paths. | Fits if the runtime remains generic and rich human decision UX is projected from structured decision packets. | Medium | [src/runtime/executors/checkpoint.ts](../../src/runtime/executors/checkpoint.ts), [src/shared/html/build-checkpoint.ts](../../src/shared/html/build-checkpoint.ts) |

## Hypothesis Test

The target hypothesis survives the deeper scan, with one important correction:
**Run should not be implemented as a normal flow alone.** It needs to be a
supervisor boundary above flow execution.

Why:

- Today's Run is a direct command and router entry, not a flow. That makes it a
  good user entry but a weak product logic boundary.
- Today's Goal flow has the strongest completion semantics, but it is modeled as
  a public flow peer and runs one statically selected child flow target.
- The runtime already supports sub-runs, checkpoints, traces, reports, and
  result closure. It should execute process packages, not decide product
  concepts like "is this goal actually done?"
- The generated-surface system already supports public versus internal flows.
  That means simplification can be a visibility and entrypoint change, not a
  deletion of working flow packages.

## What Already Fits

| Current Part | Keep Because | Confidence |
| --- | --- | --- |
| `FlowData` and `CompiledFlowPackage` | They are the right unit for repeatable process packages and generated outputs. | High |
| Catalog-derived registries | They keep flow-specific writers and schemas out of direct runtime imports. | High |
| Compiled graph runtime | It gives a deterministic execution kernel with trace and checkpoint behavior. | High |
| Run folders | They are the durable artifact substrate for future agents and memory. | High |
| Host rendering contract | It already says Circuit owns progress/final text and hosts render it. | High |
| Operator summary files | They are an existing surface projector that can become more succinct. | Medium |
| Hint-only run-start recall | It has the right authority posture for memory. | High |
| HTML checkpoint projectors | They validate the rich human decision-surface bet. | Medium |

## What Should Move, Collapse, Or Become Internal

| Current Thing | Target Change | Reason | Confidence |
| --- | --- | --- | --- |
| Run command instructions | Move core Run behavior into source-owned supervisor logic. | Host prompt text is too weak a boundary for goal formulation, process planning, completion gating, and memory updates. | High |
| Router as front door | Collapse into Run's process-selection step. | Users should not experience Circuit as "pick a flow"; routing is one internal decision. | High |
| Public Goal flow | Fold useful Goal primitives into Run and make Goal no longer a primary user-facing concept. | Product model wants Run as dominant entry; Goal is a contract/lifecycle primitive. | High |
| Goal child-flow aliases | Replace static child-target reports with a generic process-attempt model. | A Run may need one process, several processes, or a follow-up process chosen after evidence. | Medium |
| Direct flow commands | Keep as expert/internal controls, not equal top-level defaults. | They remain useful for debugging and power users, but they work against Run-first UX when presented as peers. | High |
| Operator summary detail | Project a shorter default human surface, with links to artifacts. | Human-facing output should not be the proof bundle; artifacts are primarily for agents and future runs. | High |
| Checkpoint product meaning | Move toward structured decision packets plus optional HTML projection. | Runtime should pause/resume; product UX should decide when a rich decision point matters. | Medium |
| Memory recall-only path | Add update events with reasons after useful runs. | Execution-first memory needs recall, use, update, indicator, and invalidation. | Medium |

## Contracts That Make Migration Safe

| Contract Or Test Surface | Why It Matters |
| --- | --- |
| Run trace contract | Protects manifest snapshots, append-only trace, run closure, checkpoint pairing, and replay assumptions. |
| Generated surface drift checks | Prevents host packages and generated manifests from silently diverging from source. |
| Engine-flow boundary test | Prevents runtime code from importing per-flow implementation modules directly. |
| Flow package completeness tests | Keep command ownership, writer registrations, schemas, and generated surfaces aligned. |
| Goal report schema tests | Prove goal contracts, evidence evaluation, two-pass gates, and false-complete rejection are real current behavior. |
| Host rendering contract and Codex host tests | Keep final output and plugin surfaces honest while Run visibility changes. |
| History schema and recall tests | Preserve memory as hint-only, cited, non-authoritative context. |
| Block catalog tests | Keep reusable blocks typed and aligned with docs before Run starts composing them more directly. |

## Load-Bearing Complexity

These are real complexity, but deleting them would damage the target:

| Complexity | Why It Is Load-Bearing |
| --- | --- |
| Typed reports and schemas | They let later steps and future runs consume evidence instead of chat prose. |
| Generated host packages | Circuit ships through host plugins; generated surfaces prevent drift. |
| Run folders and traces | They are the artifact system, recovery spine, checkpoint record, and future memory source. |
| Runtime graph execution | It is a good kernel for process packages if product policy stays above it. |
| Selection/config/connector plumbing | Per-step worker choice and proof capture are product value, not incidental code. |
| Checkpoint resume safety | Human decision points require durable pause/resume semantics. |
| Contract and release checks | They are the proof bar that makes simplification safe. |

## Older Product-Model Residue

These look more like residue from older product shapes than core target
architecture:

| Residue | Evidence | Target Direction |
| --- | --- | --- |
| Flow commands as equal public choices | Public generated command surfaces existed for Build, Explore, Fix, Goal, Prototype, and Review, while product alignment says Run should dominate. | Make Run default; hide direct built-in flow host commands once Run parity is proven. |
| Goal as a public flow peer | Goal is listed and emitted as a public flow, but product alignment says Goal primitives may fold into Run. | Internalize Goal as contract/completion primitives. |
| Host prompt does flow recommendation | `/circuit:run` currently asks the host to recommend a flow before invoking CLI. | Make process selection source-owned and auditable. |
| Static one-child Goal execution | Goal has one authored sub-run step per target and tests lock that shape. | Use a process-attempt model that can represent one or more process runs. |
| Proof-heavy default human output pressure | Operator summaries carry rich report details, and host rendering has to suppress debug details. | Keep artifacts rich, make default surface short. |
| Checkpoint as generic pause | Runtime checkpoint behavior is generic, while the product bet is rare rich decisions. | Separate generic pause/resume from rich decision packet projection. |

## Option Set

### Option A: Keep Run As Router Plus Current Flows

Shape: preserve today's model. Run routes to a flow, direct flow commands remain
public peers, and Goal stays a separate flow for long-running objectives.

Verdict: not enough.

This is operationally safe, but it misses the product direction. It keeps the
operator-facing taxonomy alive and leaves completion semantics isolated in Goal.

Disqualifier: product alignment says Run should continue until the goal is met
or honestly blocked, not stop at flow selection.

### Option B: Rename Goal To Run

Shape: make the current Goal flow the new Run flow, perhaps hide the old Run
command and point users at the Goal schematic.

Verdict: tempting but too narrow.

Goal has the best current primitives. It proves clarify, contract, child flow,
evidence evaluation, recovery, gate, and close. But the current flow executes one
statically selected child flow target, and its reports are Goal-specific. A pure
rename would preserve the static-child limitation and likely overfit Run to
today's Goal route shape.

Disqualifier: if Run needs to call multiple process packages until done, current
Goal is a useful source, not the target architecture.

### Option C: Run Supervisor Over Process Library

Shape: add a source-owned Run supervisor boundary above compiled process
packages and the runtime kernel. It uses Goal primitives, the router, memory
recall, process packages, runtime calls, completion gates, surface projection,
and memory update events.

Verdict: recommended.

This option matches the product model while preserving the strongest existing
architecture. It reduces user-facing concepts without deleting the process
library. It also keeps the runtime kernel from becoming a product-policy engine.

Disqualifier: if deeper proof shows the current run folder and compiled process
contracts cannot represent multiple process attempts under one Run.

### Option D: Blank New Core With Compatibility Adapter

Shape: build a new core beside current Circuit and adapt existing flows,
generated surfaces, run folders, and host plugins onto it later.

Verdict: not justified by current evidence.

The repo's strongest complexity is tied to real compatibility and proof
contracts, not a fundamentally wrong model. A blank core would still need the
same host surfaces, generated outputs, traces, checkpoints, schemas, and memory
authority rules.

Disqualifier: current evidence has not disproved the FlowData, generated
surface, or run folder model.

## Recommended Target Boundaries

| Boundary | Owns | Does Not Own |
| --- | --- | --- |
| Host adapter | Invoke Run, pass progress mode, render Circuit-authored progress, render final surface output, render rich checkpoints. | Flow selection, goal completion, memory authority, or proof judgment. |
| Run supervisor | Intake, memory recall use, conditional clarify, goal contract, process plan, runtime call sequence, completion gate, blocked decision, memory update event. | Low-level graph walking, checkpoint resume validation, connector subprocess mechanics, generated host rendering. |
| Process library | Built-in process packages: Fix, Build, Review, Explore, Prototype, Pursue, and future authored flows. | Product entrypoint ownership. |
| Runtime kernel | Execute one compiled process graph against capabilities, write trace/reports/result, pause/resume checkpoint, run sub-runs/fanout. | Deciding whether the operator's whole Run goal is done. |
| Artifact store | Run folder, child process artifacts, trace, reports, checkpoint records, memory inputs/updates, handoff state. | Being the default human narrative. |
| Surface projector | Short human-facing status, final outcome, required decisions, and links to artifacts. | Agent proof authority or process planning. |
| Memory service | Recall, use metadata, update proposals/events, staleness, invalidation, and succinct indicators. | Silent routing authority or self-editing flows. |
| Generation boundary | Host-visible public/default surfaces, expert/internal controls, compiled mirrors, drift checks. | Hand-edited generated behavior. |

## Minimal New Concepts

The target does not need many new product objects. It needs clearer ownership of
five concepts:

| Concept | Meaning |
| --- | --- |
| Run supervisor | Product lifecycle that works a goal until done or blocked. |
| Goal contract | Internal contract for done claims, proof, constraints, recovery, and gate policy. |
| Process attempt | One execution of a selected process package, with result and evidence links. |
| Decision packet | Structured checkpoint content that can project to HTML or native host questions. |
| Memory update event | Explicit record of what memory changed, why, and how it may affect future runs. |

## Main Audit Answers

1. **Which current parts already fit?**
   FlowData, compiled process packages, catalog-derived registries, generated
   surfaces, run folders, trace contracts, checkpoint resume, operator summary
   projection, and hint-only history recall all fit the target.

2. **Which parts should move, collapse, or become internal?**
   Run behavior should move out of host instruction text into source-owned
   supervisor logic. Router should collapse into process selection. Goal should
   become internal contract/completion machinery. Direct flow host commands
   should be hidden by default once Run parity is proven. Human-facing output
   should become a projection over artifacts rather than the artifact itself.

3. **Which contracts make migration safe?**
   Run trace contracts, generated-surface checks, engine-flow boundary tests,
   Goal schema tests, host rendering tests, history authority tests, and block
   catalog tests are the safety rails.

4. **Which complexities are load-bearing?**
   Typed schemas, generated host outputs, run folders, traces, selection,
   connector resolution, checkpoint resume, and contract checks are load-bearing.

5. **Which complexities mainly reflect older product models?**
   Equal public flow commands, public Goal-as-peer, host-side flow recommendation
   instructions, static one-child Goal execution, and proof-heavy human output
   pressure are the clearest residues.

## Risks And Fast Disproofs

| Risk | Fast Disproof |
| --- | --- |
| Run supervisor becomes a second runtime. | The design starts interpreting graph steps, checkpoint mechanics, or connector calls directly instead of calling the runtime kernel. |
| Goal primitives are too Goal-specific to reuse. | Goal report schemas cannot be generalized without weakening false-complete protection or two-pass gate behavior. |
| Multi-process Run cannot fit current artifacts. | A prototype cannot represent process attempts and child run evidence in run folders without breaking trace/result contracts. |
| Hiding direct flow commands breaks real host behavior. | Host tests or user workflows require direct command parity as a default, not just CLI/runtime access. |
| Memory becomes spooky. | Memory can affect process selection or proof without an explicit indicator, citation, and authority limit. |
| Checkpoint UX becomes routine handholding. | Decision packets appear for normal progress where no human judgment materially changes the outcome. |

## Recommended Next Step

Do not implement a broad refactor yet. The next useful artifact is a small
Run-supervisor contract sketch that proves the target can be represented without
changing production behavior:

- input: operator intent, explicit constraints, optional direct process request,
  memory hints;
- output: goal contract, process plan, process attempts, completion gate result,
  surface output, memory update event;
- hard boundary: supervisor calls existing compiled process runtime, but never
  executes graph steps itself;
- proof: a fixture-driven test sketch showing one-process complete,
  missing-evidence follow-up, checkpoint-needed, and blocked outcomes.

If that contract sketch survives review, then the implementation initiative can
move to an audit-and-migrate ledger. If it fails, the failure will identify the
exact contract that prevents Run-centered simplification.
