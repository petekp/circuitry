# Target Architecture Hypothesis V1

Status: architecture hypothesis, not current behavior.

Date: 2026-05-28

## Purpose

This document names the simplest architecture that appears capable of realizing
the current Circuit product direction:

- Run is the dominant command.
- Run turns operator intent into a well-formed goal.
- Run routes to the right process or processes without making the operator
  choose a flow taxonomy.
- Run continues until the goal is met or honestly blocked.
- Human-facing output stays succinct.
- Run artifacts are rich and durable because agents and future runs are the
  main audience for the detail.
- Checkpoints are rare, high-value, digestible human decision surfaces.
- Memory improves flow execution first, starting with project and flow memory.

This is a target hypothesis for the deeper architecture audit. It is not a
migration plan and it does not claim the repo already has this shape.

## Light Current-State Scan

### Confirmed Current Facts

| Fact | Evidence |
| --- | --- |
| Product alignment now says Run should be the dominant command, flows should be lightly visible, Goal primitives may fold into Run, artifacts are agent-facing, checkpoints are sparse rich decision points, and memory is agent-facing with succinct indicators. | [CONTEXT.md](../../CONTEXT.md) |
| `/circuit:run` is currently a direct command source, not a flow. It asks the host to recommend a flow when clear, keeps explicit flow commands available, and falls back to the deterministic CLI router when needed. | [src/commands/run.md](../../src/commands/run.md) |
| The deterministic router exists as source code and routes natural-language task text to a compiled flow package using signal metadata plus a default fallback. | [src/flows/router.ts](../../src/flows/router.ts) |
| Built-in flows are authored as typed `FlowDefinition`/`FlowData` packages, compiled into `flowPackages`, and used by the router, registries, generated schematics, generated manifests, and host mirrors. | [src/flows/catalog.ts](../../src/flows/catalog.ts), [docs/architecture/declarative-flow-architecture.md](../architecture/declarative-flow-architecture.md) |
| Goal already contains the primitives closest to the future Run model: Clarify, goal contract writing, static child-flow execution, evidence evaluation, recovery, two safety-review passes, and result closure. | [src/flows/goal/data.ts](../../src/flows/goal/data.ts), [src/flows/goal/schematic.json](../../src/flows/goal/schematic.json) |
| The runtime executes compiled flow graphs through run folders with manifest snapshots, append-only traces, reports, checkpoint resume, sub-runs, and result writing. | [docs/architecture/runtime.md](../architecture/runtime.md), [docs/contracts/run.md](../contracts/run.md), [src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts) |
| Runtime capabilities already accept `memoryInputs` and `historyRecallReport`, and the CLI can prepare run-start history recall from the local history index. | [src/runtime/run/capabilities.ts](../../src/runtime/run/capabilities.ts), [src/history/run-start-recall.ts](../../src/history/run-start-recall.ts) |
| Memory inputs are currently hint-only prior-run context injected into relay prompts; current checks must still be rerun before relying on them. | [src/history/memory-preview.ts](../../src/history/memory-preview.ts), [src/shared/relay-support.ts](../../src/shared/relay-support.ts) |
| Checkpoints already have runtime waiting/resume mechanics and HTML projectors that generate rich pages for some human decision surfaces. | [src/runtime/executors/checkpoint.ts](../../src/runtime/executors/checkpoint.ts), [src/shared/html/build-checkpoint.ts](../../src/shared/html/build-checkpoint.ts), [src/shared/html/prototype-checkpoint.ts](../../src/shared/html/prototype-checkpoint.ts) |
| Generated host surfaces are committed outputs; flow and command source changes must regenerate and pass drift checks. | [docs/generated-surfaces.md](../generated-surfaces.md) |

### Current Tensions

| Tension | Why It Matters |
| --- | --- |
| Run is product-dominant in the desired model, but current Run is mostly command instructions plus router entry, while Goal owns the stronger completion loop. | The architecture should not keep Run as a thin selector if the product promise is goal-backed execution. |
| Current Goal runs one statically selected child flow target. The desired Run may need to run one or more processes until the goal is met. | The deeper audit must test whether static child flow routing is enough or whether Run needs a first-class execution plan. |
| Explicit flow commands are still public and generated as peers. | The generated-surface and host-package model may need a visibility split: default public Run, hidden or expert direct controls. |
| Operator summaries and HTML projections already exist, but final output is still report-shaped in several places. | The target model should separate short surface output from rich agent-facing artifacts. |
| Memory is already wired as hint-only run-start recall, but not yet as an execution-memory update loop. | The target model should add memory boundaries without promising self-improving behavior before it is mature. |
| Checkpoint machinery is general, while the product bet is specifically rare, rich, high-value human decisions. | The audit should identify what belongs in checkpoint runtime versus decision packet projection. |

## Target Hypothesis

Circuit should be shaped as a **Run-centered process system**:

```text
Host surface
  -> Run supervisor
     -> Goal contract
     -> Memory context
     -> Process selection
     -> Runtime execution kernel
        -> Run artifacts
     -> Surface projection
     -> Memory update
```

The important simplification is not "make everything one flow." The important
simplification is to make **Run the only normal user entrypoint** and make the
other concepts support Run:

- Goal becomes the contract Run gives the agent.
- Flow becomes the process Run chooses.
- Block becomes the reusable unit a process is built from.
- Run artifacts become the durable state agents use.
- Surface output becomes a short projection for humans.
- Checkpoint becomes a rare rich decision surface.
- Memory becomes execution help for future runs.

## Minimal Concepts

| Concept | Target Meaning | User Visibility |
| --- | --- | --- |
| Run | The default command and product experience. It accepts intent, forms a goal, selects process, executes, and closes honestly. | High |
| Goal contract | The structured statement of done, proof, scope, constraints, recovery, and blocked conditions that equips the agent to succeed. | Light |
| Process package | The internal flow or flow sequence selected to satisfy the goal. This can reuse today's flow packages. | Light, as "Using Fix flow" style feedback |
| Block | Reusable process unit such as Clarify, Route, Act, Verify, Review, Human Decision, or Close. | Mostly internal |
| Run artifact | Durable trace, report, checkpoint, evidence, memory, and handoff material for agents and future runs. | Mostly internal, linkable |
| Surface output | Human-facing progress and final status. It stays short and decision-oriented. | High |
| Checkpoint | Rich human decision surface for rare moments when judgment matters. | Medium, only when needed |
| Memory hint | Prior project or flow context used to improve execution. | Low, with succinct indicator |

## Boundary Hypothesis

| Boundary | Owns | Must Not Own |
| --- | --- | --- |
| Host surface | Capturing operator intent, invoking Run, rendering compact progress, rendering rich checkpoints, showing memory indicators, and surfacing final status. | Flow taxonomy, completion logic, proof evaluation, or hidden routing policy. |
| Run supervisor | Intake, conditional clarify, goal contract formulation, process selection, execution loop orchestration, done or blocked decision, memory update event. | Low-level graph execution, connector subprocess mechanics, generated host rendering details. |
| Process library | Built-in process packages and reusable blocks. It should provide selectable processes and their contracts. | Product entrypoint ownership or host-specific UI. |
| Runtime kernel | Execute a compiled process graph against capabilities, append trace, write reports, pause/resume checkpoints, run sub-flows, and close runs. | User-facing product decisions, flow-specific branching, memory policy, or host presentation. |
| Artifact store | Run folders, manifest snapshot, trace, reports, checkpoint records, operator summary, memory inputs/updates, and handoff state. | Human-friendly narrative as the primary source of truth. |
| Surface projector | Short human output and optional rich HTML checkpoint pages from artifacts. | Agent execution state or current proof authority. |
| Memory service | Project and flow-scoped execution memory: recall at run start, update after useful runs, and succinct human indicators. | Silent behavior-changing routing or premature flow self-editing. |
| Generation boundary | Host command/skill packages, compiled manifests, flow mirrors, and drift checks from authored sources. | Hand-edited generated behavior. |

## Target Run Lifecycle

1. **Intake**: capture the operator's intent and any explicit constraints.
2. **Memory context**: retrieve project and flow execution memory as hint-only
   context, with a succinct indicator if used.
3. **Clarity gate**: decide whether the request is clear enough to formulate a
   goal. If not, call Clarify. Do not turn every Run into a chat prelude.
4. **Goal contract**: write the goal the agent will work against: done claims,
   proof, constraints, scope, recovery, and blocked stop condition.
5. **Process selection**: choose the flow or flow sequence needed for the goal,
   then say just enough for transparency.
6. **Execution**: run selected process packages through the runtime kernel.
7. **Completion gate**: decide whether the goal is met, blocked, or needs a
   follow-up process. This is the Goal primitive that most clearly belongs in
   Run.
8. **Checkpoint only when valuable**: pause for human judgment only when a rich
   decision surface materially improves the outcome.
9. **Artifact close**: write durable agent-facing artifacts first.
10. **Surface close**: show a very short human-facing final status and required
    next action, if any.
11. **Memory update**: if useful, update execution memory and surface a brief
    "what changed and why" indicator.

## What Should Stay From The Current Architecture

| Keep | Reason |
| --- | --- |
| FlowData and compiled flow packages | This is already the strongest source-of-truth model for repeatable processes. |
| Block catalog direction | It matches the desire for reusable process building blocks without exposing all blocks to users. |
| Run folder contract | It is exactly the durable artifact foundation agents and future runs need. |
| Trace and report discipline | It supports recovery, auditability, future memory, and replay without relying on chat residue. |
| Runtime graph kernel | The plain graph walk is a good execution primitive if product decisions move upward into Run. |
| Generated surface discipline | It prevents host drift while the public surface changes. |
| History recall as hint-only memory | It has the right authority posture for execution-first memory. |
| HTML checkpoint projection | It matches the rich human decision-surface bet. |

## What Should Change In The Target

| Change | Reason |
| --- | --- |
| Fold Goal primitives into Run | Run should own goal formulation, completion, and honest blocking because that is the dominant product experience. |
| Treat direct flow commands as expert controls | Users should not start by choosing among Build, Fix, Review, Explore, Prototype, Goal, and Pursue. |
| Make process selection an internal Run decision | This reduces the steering burden before the agent even starts working. |
| Add an explicit Run supervisor boundary above the runtime kernel | The runtime should execute graphs; the supervisor should decide what goal/process loop to run. |
| Separate surface output from run artifacts | Humans need succinct status; agents need the rich detail. These should not be the same object with two audiences. |
| Move checkpoint product meaning to decision packets and HTML projection | The runtime should pause/resume safely; rich decision UX should be a projection over structured decision packets. |
| Make memory an execution service first | This gives immediate value without silent routing changes or premature self-evolving flows. |

## Current Implementation Pressure Points To Audit

| Pressure Point | Audit Question |
| --- | --- |
| Run vs Goal split | Can today's Goal flow be renamed/folded into Run without preserving both as user-facing concepts? |
| Static child flow in Goal | Does Run need a dynamic process plan that can call multiple flows until the goal is met? |
| Router placement | Should routing remain a flow classifier, or become one step inside goal-backed Run planning? |
| Generated direct commands | Which generated flow commands can become hidden, internal, or expert-only without breaking host contracts? |
| Runtime package lookup from graph runner | Can engine flags and primary-result binding move behind a runtime package index so the kernel stays flow-agnostic? |
| Operator summary projections | Can current operator summaries become one human surface projection while rich run artifacts remain agent-facing? |
| Checkpoint HTML projectors | Can checkpoint HTML be driven by a generic decision packet contract rather than flow-specific presentation paths? |
| Memory recall and update loop | Where should project and flow execution memory live, and how does Run record update reasons? |

## Must-Be-True Assumptions

| Assumption | Why It Matters | Fastest Disproof |
| --- | --- | --- |
| Existing FlowData/compiled package architecture can remain the process library behind Run. | Avoids unnecessary rewrite of the most useful current boundary. | A deeper audit shows process packages cannot support Run's goal loop without flow-specific runtime hacks. |
| Goal's contract, evidence evaluation, recovery, and safety review primitives are reusable enough to become Run primitives. | Lets the target reuse current work instead of inventing a new supervisor from scratch. | Goal reports or routes prove too specific to today's Goal flow semantics. |
| Run folder artifacts can support parent Run plus one or more child process executions. | The target needs durable multi-process execution without chat state. | Current trace/report contracts cannot represent multi-flow goal pursuit without breaking compatibility. |
| Host surfaces can hide most direct flow commands while keeping generated internals available. | The public product surface gets simpler without deleting useful expert controls. | Host plugin contracts or user behavior require direct command parity. |
| Memory can start as project and flow execution hints without becoming routing authority. | Keeps memory useful and safe while the effectiveness ratchet matures. | The only valuable memory use cases require changing flow selection immediately. |
| Rich checkpoints can be projections over structured decision packets. | Keeps runtime simple while preserving the HTML decision-surface bet. | Existing checkpoint use cases need arbitrary UI behavior that cannot be represented by a bounded decision packet. |

## Main Risks

| Risk | Why It Is Real | Mitigation For The Audit |
| --- | --- | --- |
| Renaming Goal to Run hides a real conceptual distinction. | Goal may be a contract primitive while Run is the lifecycle. | Audit whether "goal contract" can be internal while Run remains the command. |
| Run supervisor becomes a second runtime. | A goal loop can accidentally duplicate graph execution, routing, recovery, and close semantics. | Define supervisor as orchestration over runtime calls, not step execution. |
| Direct flow commands become unsupported too early. | Expert controls may be useful for debugging, tests, and power users. | Treat them as expert/internal until usage evidence says remove. |
| Memory makes behavior spooky. | Automatic memory can silently change execution. | Require succinct indicators and keep early memory hint-only. |
| Checkpoints become routine interruptions. | That would contradict the product promise of less handholding. | Require explicit checkpoint value criteria and rich decision context. |
| Surface output gets too thin for debugging. | Operators and agents still need paths into evidence when something fails. | Keep links and artifacts available, but out of the default narrative. |

## Deeper Audit Questions

1. What is the smallest Run supervisor contract that can absorb Goal's useful
   primitives without becoming a general-purpose orchestration engine?
2. Which Goal reports should become Run reports, which should become generic
   contracts, and which should disappear?
3. Can the current `route.decision@v1`, `goal.contract@v1`, child-run reports,
   and `run.closed` outcome model represent "run multiple flows until done"?
4. What generated-surface migration would make Run dominant while keeping
   direct flow commands available as expert controls?
5. Can checkpoint requests be recast as rich decision packets with optional
   HTML projections, while preserving current resume safety?
6. What is the minimal memory boundary for project and flow execution memory:
   recall, use, update, indicator, and invalidation?
7. Which current runtime imports from `src/flows/` are acceptable catalog access
   and which indicate the kernel still knows too much about product packages?
8. Which existing tests already protect this target, and what new tests would
   define the Run supervisor boundary?

## Recommended Next Step

Use this hypothesis as the target lens for a deeper architecture audit. The
audit should not ask "how do we clean up every current folder?" first. It
should ask:

1. Which current parts already fit this Run-centered model?
2. Which parts need to move, collapse, or become internal?
3. Which contracts make migration safe?
4. Which current complexities are load-bearing for this target?
5. Which complexities exist only because older product models were preserved?

The likely simplest direction is **not** a blank-slate rewrite. It is a
goal-backed Run supervisor layered above the existing process-library and
runtime-kernel foundations, with a sharper split between human surface output
and agent-facing artifacts.
