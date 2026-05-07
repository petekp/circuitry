# Circuit v2 Migration Plan

Status: historical. The final cutover policy in
`docs/architecture/v2-final-cutover-policy.md` supersedes the old
checkpoint-by-checkpoint migration posture. The numbered checkpoint notes were
compressed into `docs/architecture/v2-checkpoint-history.md`, and the named
planning notes were compressed into
`docs/architecture/v2-architecture-history.md`.

This plan is imperative. Stop at each listed checkpoint and do not continue
until review approves the next step.

## Phase 0: Rigor Audit and Architecture Note

Goal: classify current strictness, name the v2 architecture, and document the
migration path before runtime code changes.

Files likely involved: `docs/architecture/*`, plus read-only inspection of
`src/runtime/`, `src/cli/`, `src/schemas/`, `src/flows/`, `docs/contracts/`,
`specs/`, `tests/`, generated surfaces, and `scripts/emit-flows.mjs`.

Exact deliverables: create the five Phase 0 docs required by the checkpoint.

Tests to add or update: none. This step is documentation-only.

Stop condition: Checkpoint 1 packet is produced.

Risks: architecture notes can drift into wishful design if not grounded in
current behavior; terminology tests may reject the required audit vocabulary.

Checkpoint requirement: formal Checkpoint 1 review.

## Phase 1: v2 Runtime Substrate Spike

Goal: prove a minimal v2 runtime slice beside the current runtime and evaluate
plain TypeScript against a focused Effect prototype.

Files likely involved: `src/core-v2/domain/`, `src/core-v2/manifest/`,
`src/core-v2/trace/`, `src/core-v2/run-files/`, `src/core-v2/run/`,
`src/core-v2/executors/`, `src/core-v2/projections/`, and `tests/core-v2/`.

Exact deliverables: minimal domain types including `RunFileRef`, executable
manifest validation, trace store, `RunFileStore`, graph runner, two simple
executors, one failure path, status projection, Checkpoint 2 doc, and worklog
update.

Tests to add or update: valid flow run, invalid route target, monotonic trace
sequence, path traversal rejection, failure path recording, status projection,
and stub relay output.

Stop condition: v2 substrate spike passes focused tests and Checkpoint 2 packet
is produced.

Risks: over-modeling, adopting Effect too broadly, or creating a runner that
already owns connector, projection, and fanout policy.

Checkpoint requirement: formal Checkpoint 2 review.

## Phase 2: Adapter from Current CompiledFlow to ExecutableFlowV2

Goal: convert current compiled flows into v2 executable manifests without
changing authoring schemas or generated outputs.

Files likely involved: `src/core-v2/manifest/from-compiled-flow-v1.ts`,
`src/core-v2/manifest/validate-executable-flow.ts`, generated flow fixtures,
and `tests/core-v2/from-compiled-flow-v1.test.ts`.

Exact deliverables: adapter, validation pass, notes on isolated v1 quirks, and
worklog update.

Tests to add or update: compose, verification, checkpoint, relay, sub-run,
fanout, terminal route, invalid target, pass route behavior, path preservation,
and stage preservation.

Stop condition: representative current compiled flows convert and validate in
tests with no generated output changes.

Risks: hiding v1 quirks inside generic v2 types, losing explicit paths, or
trusting v1 validation too much.

Checkpoint requirement: no formal checkpoint unless serious architecture
problems appear.

## Phase 3: Simple-Flow Parity

Goal: run Review, Fix, and Build through v2 using the v1 adapter and prove
behavior parity for simpler flows.

Files likely involved: v2 run entrypoint, parity test helpers, Review/Fix/Build
fixtures, and `tests/parity/`.

Exact deliverables: opt-in v2 execution path, parity tests for the three flows,
Checkpoint 3 doc, and worklog update.

Tests to add or update: trace lifecycle, step order, terminal result, report
files, explicit paths, checkpoint state where relevant, status projection,
failure behavior, connector selection, and run result shape.

Stop condition: Checkpoint 3 packet is produced after parity tests.

Risks: comparing incidental bytes instead of behavior, changing generated
surfaces by accident, or fixing Build schema leakage too early.

Checkpoint requirement: formal Checkpoint 3 review.

## Phase 4: Complex-Flow Parity

Goal: migrate and prove parity for Explore, Migrate, Sweep, sub-run, fanout,
connector safety, worktree behavior, and aggregate reports.

Files likely involved: `src/core-v2/executors/sub-run.ts`,
`src/core-v2/executors/fanout.ts`, `src/core-v2/fanout/*`,
`src/core-v2/connectors/*`, complex parity tests, and existing flow fixtures.

Exact deliverables: v2 sub-run executor, decomposed fanout subsystem, connector
safety coverage, complex parity notes, and worklog update.

Tests to add or update: migrate sub-run parity, sweep fanout parity, fanout
partial failure, aggregate report, worktree cleanup, connector safety, complex
terminal result, and complex status projection.

Stop condition: complex-flow parity passes and v2 covers representative old
runtime behavior.

Risks: recreating a giant fanout handler, weakening connector checks, or
sharing mutable state between runtimes.

Checkpoint requirement: no formal checkpoint unless serious differences appear.

## Phase 5: Authoring and Compiler Simplification

Goal: simplify authoring and compiler concepts after v2 parity exists.

Files likely involved: `src/schemas/flow-schematic.ts`,
`src/flows/compile-schematic-to-flow.ts`, `src/schemas/step.ts`, flow
schematics, flow package definitions, and compiler tests.

Exact deliverables: discriminated authoring step definitions where practical,
central route vocabulary, report refs in authoring, flow-owned checkpoint
policy, explicit block/stage policy ownership, notes doc, and worklog update.

Tests to add or update: kind-specific validation, invalid-field rejection,
route normalization, report path derivation, Build checkpoint ownership, block
policy, manifest equivalence, and v2 parity.

Stop condition: authoring/compiler simplifications are complete or explicitly
deferred, and v2 parity still passes.

Risks: changing product behavior while cleaning schema shape, hiding explicit
paths, or moving flow-specific rules into generic schemas.

Checkpoint requirement: no formal checkpoint unless behavior changes need
review.

## Phase 6: Generated-Surface Cleanup

Goal: make generated surface ownership obvious and drift-resistant.

Files likely involved: `docs/generated-surfaces.md`, `scripts/emit-flows.mjs`,
`commands/`, `src/flows/*/command.md`, `.claude-plugin/`, `plugins/circuit/`,
`generated/flows/`, `README.md`, `commands/README.md`, and `docs/contracts/`.

Exact deliverables: generated surface map, stale reference cleanup, generated
headers where safe, drift tests, notes doc, and worklog update.

Tests to add or update: generated files up to date, source map correct, stale
outputs absent, flow commands match package command sources, and root commands
derive from the right source.

Stop condition: generated-surface ownership is documented, stale drift is fixed,
and emit/drift tests pass.

Risks: editing generated files manually, breaking host parsing with headers, or
leaving stale public/internal ambiguity.

Checkpoint requirement: no formal checkpoint unless generated output ownership
needs review.

## Phase 7: Old Runtime Deletion

Goal: delete or retire old runtime paths after v2 behavior parity is proven.

Files likely involved: old `src/runtime/*`, old runner imports, CLI runtime
entrypoints, tests, generated outputs, docs, and v2 replacement modules.

Exact deliverables: deletion plan, reference search classification,
Checkpoint 4 doc, worklog update, then post-approval deletion and final
summary.

Tests to add or update: full tests, typecheck, lint, build, emit/drift,
contract tests, parity tests, connector safety, fanout, sub-run, and generated
surface checks.

Stop condition: before deletion, stop at Checkpoint 4. After approval, delete
approved old files, update imports, run full validation, and write final
summary.

Risks: old imports hiding in tests or scripts, losing connector safety, failing
resume compatibility, or keeping both runtimes alive indefinitely.

Checkpoint requirement: formal Checkpoint 4 review before deletion.
