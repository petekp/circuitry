---
name: flow-authoring-model
description: Unified model for authoring Circuit flows from blocks, schematics, routes, checks, reports, and generated manifests.
type: product-architecture
date: 2026-05-01
status: active
---

# Flow Authoring Model

This is the canonical authoring model for Circuit flows.

Use it with:

- `UBIQUITOUS_LANGUAGE.md` for vocabulary.
- `docs/flows/block-catalog.json` for the machine-readable block catalog.
- `src/schemas/flow-blocks.ts` for the block catalog schema.
- `src/schemas/flow-schematic.ts` for authored schematic shape.
- `src/flows/compile-schematic-to-flow.ts` for schematic to compiled-flow projection.
- `docs/contracts/compiled-flow.md` for runtime graph invariants.

This document is hand-authored because it explains intent and boundaries.
Do not hand-maintain current flow inventories here. Current flow facts come from
`src/flows/<id>/schematic.json`, `generated/flows/<id>/`, and generated release
surfaces such as `docs/release/parity-matrix.generated.md`.

## Short Version

A flow is an authored schematic compiled into a runtime graph.

A schematic should say:

- which block runs;
- what typed input the block needs;
- what typed output the step writes;
- which named routes are allowed;
- how the step executes;
- what model, effort, skills, and connector policy are preferred;
- what evidence must exist before the flow moves on.

This is deliberately not a freeform graph builder. Authors should mostly choose
or edit schematics made from known blocks.

## Authoring Layers

Circuit keeps four layers separate.

| Layer | Meaning | Source |
| --- | --- | --- |
| Block | Reusable kind of work. | `docs/flows/block-catalog.json` |
| Schematic step | Flow-specific use of a block. | `src/flows/<id>/schematic.json` |
| Report schema | Typed fact written or consumed by a step. | `src/flows/<id>/reports.ts` |
| Route policy | Named outcomes and targets. | schematic routes plus route policy constants |

The block is reusable. The schematic step is the flow-specific use of that
block.

## Block Model

Every block has a stable identity, expected input contracts, one output
contract, allowed routes, and expected evidence.

The important point is that later steps consume named facts, not whatever text a
model happened to produce. A block can accept more than one input shape when the
work is genuinely reusable across paths. For example, Act can work from a brief
plus a diagnosis, a brief plus a plan, or all three. The block catalog records
those alternatives so schematic validation can reject under-specified steps
without forcing every flow through the same path.

Custom flows should compose built-in blocks first. Users should not define
arbitrary new block code in the first custom-flow surface. New block extension
can come later after the built-in catalog has proved itself across real
schematics.

## Schematic Step Model

A schematic step binds a block to a specific flow purpose.

Typical step concerns:

- `id`: stable step id.
- `uses`: block id.
- `stage`: canonical stage for this step.
- `input`: named report contracts consumed by the step.
- `output`: report contract produced by the step.
- `evidence_requirements`: proof the step promises to leave behind.
- `execution`: whether the runtime composes, relays, verifies, checkpoints,
  runs a child flow, or fans out.
- `selection`: optional model, effort, skill, depth, or invocation options.
- `routes`: named outcomes mapped to step ids or terminal targets.
- `route_overrides`: mode-specific route target overrides.

The compiler normalizes the authored shape into a CompiledFlow. Runtime graph
invariants then apply to the compiled manifest, not to prose in this document.

## Compatibility

Schematic assembly should fail early when a step cannot consume what came before
it.

Basic rule:

> A schematic step can run only when its required input contracts are available.

Availability is route-aware. A later schematic step does not make its output
available to an earlier branch just because it appears earlier in the JSON file.
If one branch can reach Close without passing through Review, Close cannot
require a Review report unless the schematic has a separate close path for the
skipped-review case.

Mode-specific routes are part of compatibility. If Lite skips Review, it should
route to a separate close step whose inputs do not require a Review report. That
keeps reviewed and unreviewed close paths honest.

## Routes

Routes should represent product outcomes, not clever control flow.

Common authored outcomes:

- continue
- connector-failed
- retry
- revise
- ask
- split
- stop
- handoff
- escalate
- complete

Schematics may use `continue` or `complete` as their success outcome. The
compiler preserves the authored label and also emits the runtime success route
`pass`, which is what step handlers follow after a successful check.

Branches help when they represent a real choice:

- evidence reproduced or did not reproduce;
- verification passed or failed;
- review accepted or requested fixes;
- the operator chose continue, stop, or handoff;
- the queue has more work or is empty;
- risk says split the work before continuing.

If a flow needs many tiny branches, that usually means the block model is
missing a better reusable block.

## Human Decisions

Human Decision is a block, not a host-specific special case.

The schematic should declare the question, options, default policy, and
unattended behavior. Hosts can render the question through native affordances
when available:

- Claude Code can use its user-question surface.
- Codex can use its host question surface.
- Non-interactive runs can use the declared default, pause, or fail clearly.

The answer is recorded as typed evidence. Later steps should not care which host
collected it.

## Selection

Model, effort, skills, depth, and invocation options attach to authored
selection layers.

Blocks say what kind of work is happening. Schematics and config say how hard to
run that work for this flow and operator context. A Lite Fix path might skip
independent review after strong verification, while a Deep Fix path might run a
separate Review step with higher effort. Both paths can still use the same Act,
Run Verification, and Close blocks.

## Reports And Evidence

Each step should produce two useful surfaces:

1. A typed report for later steps and close writers.
2. Evidence that lets the operator audit what happened.

Typed reports keep the flow reliable. Evidence keeps the result explainable
without forcing the operator to read raw trace entries.

Block contracts are nominal. They live in `docs/flows/block-catalog.json` as
named identifiers such as `flow.brief@v1` or `verification.result@v1`.

Per-flow schemas are structural. They live in `src/flows/<id>/reports.ts` as
concrete Zod types with flow-specific fields.

Contract aliases bridge the two. Each schematic declares how generic block
contracts map to flow-specific schemas. The runtime uses the flow-specific
schema for actual parsing and field access.

## Fix As The Proving Shape

Fix is the public bug-fixing flow.

Older bug-fix evidence should inform Fix. It should not force Circuit to ship a
second public bug-fixing flow name.

Fix proves the reusable schematic path:

1. Frame the problem.
2. Gather context.
3. Diagnose.
4. Ask a human decision when evidence is uncertain.
5. Act.
6. Run verification.
7. Review when the mode requires it.
8. Close with evidence.
9. Handoff when work is paused.

Separate reports, commands, or runtime code for a second bug-fixing name stay out
of scope unless the public naming model is explicitly reopened.

## Adding A Flow

1. Create `src/flows/<id>/schematic.json`.
2. Define per-flow report schemas in `src/flows/<id>/reports.ts`.
3. Declare contract aliases in the schematic.
4. Wire schematic steps to schemas through `input` and `output`.
5. Add writers and relay hints owned by the flow package.
6. Add the package to `src/flows/catalog.ts`.
7. Run `npm run emit-flows` and then `npm run verify`.

The runtime should not import the new flow directly. Runtime registries derive
from the catalog.

## What Not To Put Here

Do not add hand-maintained lists of:

- installed flows;
- entry modes per flow;
- generated compiled-flow files;
- command ownership;
- current route inventories;
- release support status.

Those are derivable facts. Put them in generated outputs or tests that compare
docs against the code-owned source.
