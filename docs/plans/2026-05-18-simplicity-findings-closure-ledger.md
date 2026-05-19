# Simplicity Findings Closure Ledger

Status: complete
Last updated: 2026-05-18

Archive note: this completed ledger is historical evidence. Use current code,
tests, `docs/README.md`, and canonical architecture docs for live guidance.

This ledger is the durable source of truth for closing the 2026-05-18
Circuit simplicity assessment. It exists so the assessment findings, closure
decisions, proof, and deferrals survive this chat session.

## Closure Rules

- Preserve public flow behavior, product vocabulary, CLI behavior, run-folder
  contracts, generated host package contracts, release surfaces, and existing
  flow features.
- Do not hand-edit generated outputs. Update authored sources and regenerate
  only through project scripts.
- A finding may close as fixed, intentionally deferred, or rejected. Deferred
  and rejected items need source evidence and a rationale; they are not
  failures when a change would be broad or risky.
- Run focused proof for each changed surface, then run full `npm run verify`
  before completion.

## Focused Proof Bundles

Use these before the final `npm run verify`:

- Flow authoring or catalog changes: `npm run test -- tests/runner/flow-facts.test.ts tests/contracts/catalog-completeness.test.ts` and `npm run check-flow-drift`.
- Runtime path changes: `npm run test -- tests/contracts/runtime-context-boundary.test.ts tests/runtime`.
- Generated host package changes: `npm run check-flow-drift` and the relevant host experience or generated-surface tests.
- Docs-only closure: targeted `rg` checks for stale claims plus `npm run lint`.
- Release-surface changes: `npm run check-release-infra`.

## Planning Expansion Verification

The execution-ready planning expansion was checked with:

- `rg -n "Owner files:|Partition criterion:|File-set probe|Implementation slices:|Drift probes|Rollback point:|Stop conditions:" docs/plans/2026-05-18-simplicity-findings-closure-ledger.md`
  confirmed every deferred finding has the required execution sections.
- `git diff --check` passed.
- `npm run lint` passed.
- `npm run check-flow-drift` passed with generated schematics, compiled
  manifests, host mirrors, generated surface map, and plugin runtime checks in
  sync.
- `npm run verify` passed after this planning expansion.

## Findings

### SF-1 - FlowData facet splitting

Status: fixed for first internal-flow facet split; broader flow split intentionally deferred

Current source evidence:

- `src/flows/flow-definition.ts` defines `FlowDefinitionInput` with identity,
  visibility, schematic, paths, routing, reports, writers, structural hints,
  runtime surface, canonical stage policy, and engine flags.
- `src/flows/build/data.ts` shows those facets in one flow value.
- `docs/architecture/declarative-flow-architecture.md` says this FlowData model
  is the current stabilizing center for built-in flow work.
- `src/flows/runtime-proof/data.ts` now splits local authored facets into
  `runtimeProofPaths`, `runtimeProofSchematic`,
  `runtimeProofCanonicalStagePolicy`, and `runtimeProofReports`, then
  recomposes the same exported `runtimeProofFlowData`.

Proposed action: keep the exported `FlowData` composite, and split one flow's
authoring into smaller plain values only when generated outputs remain
byte-for-byte unchanged.

Proof needed: focused flow authoring tests, `npm run check-flow-drift`, and
full `npm run verify` after any split.

Proof result:

- Used existing `tests/runner/flow-facts.test.ts` characterization coverage,
  which compares every catalog definition's typed schematic against the
  committed `src/flows/<id>/schematic.json`.
- `npm run test -- tests/runner/flow-facts.test.ts tests/contracts/catalog-completeness.test.ts`
  passed with 23 tests.
- `npm run check-flow-drift` passed. Generated schematics, compiled manifests,
  command mirrors, host flow mirrors, generated surface map, and plugin runtime
  checks are in sync.
- Diff inspection confirmed no changes to
  `src/flows/runtime-proof/schematic.json`, `generated/flows/runtime-proof`,
  `plugins/claude/skills/runtime-proof`, or
  `plugins/circuit/flows/runtime-proof`.

Rationale: this closes the safest first facet-splitting slice without changing
the public `FlowData` export or moving writer bodies, schemas, or flow package
ownership. The remaining public flows are intentionally deferred because a broad
multi-flow split would batch generated-surface risk. Future splits should still
move one flow at a time, with `fix` last.

Execution-ready plan:

- Owner files:
  - Shared shape: `src/flows/flow-definition.ts`,
    `src/flows/report-declarations.ts`, `src/flows/catalog.ts`, and
    `src/flows/types.ts`.
  - Per-flow authoring: `src/flows/{review,fix,pursue,runtime-proof,build,explore}/data.ts`
    and `src/flows/{review,fix,pursue,runtime-proof,build,explore}/flow.ts`.
  - Per-flow semantic attachments: `src/flows/<id>/reports.ts`,
    `src/flows/<id>/relay-hints.ts`, and `src/flows/<id>/writers/**`.
  - Guardrails: `tests/runner/flow-facts.test.ts` and
    `tests/contracts/catalog-completeness.test.ts`.
- Current source evidence:
  - `docs/architecture/declarative-flow-architecture.md:13` says typed
    `FlowDefinition` values are the source of truth.
  - `docs/architecture/declarative-flow-architecture.md:16` says retained flows
    are authored as plain `FlowData` in `data.ts` and bound in `flow.ts`.
  - `src/flows/flow-definition.ts:67` defines one input shape that includes
    identity, schematic, routing, report registration, runtime surface, stage
    policy, and engine flags.
  - `src/flows/flow-definition.ts:316` compiles a definition into the runtime
    package surface.
  - `src/flows/catalog.ts:18` lists the retained flow definitions, and
    `src/flows/catalog.ts:27` derives `flowPackages`.
- Partition criterion:
  - First partition by flow id, not by facet type. Complete one flow at a time so
    generated drift points at one owner.
  - Within each flow, split only plain data facets first: `routing`, `schematic`,
    `reports`, `runtimeSurface`, and `engineFlags`. Do not move writer function
    bodies or Zod schema definitions in this slice.
  - Recommended flow order: `runtime-proof` (internal and smallest), `review`
    (small public), `build`, `pursue`, `explore`, then `fix` (largest and most
    route-sensitive).
- File-set probe before each batch:
  - `rg --files src/flows | rg '/(data|flow|reports|relay-hints)\\.ts$|/writers/' | sort`
  - `rg -n "export const .*FlowData|satisfies FlowData|runtimeSurface:|reports:|routing:" src/flows/<id>/data.ts`
  - `rg -n "defineFlowData|flowDefinitions|flowPackages" src/flows/<id>/flow.ts src/flows/catalog.ts`
- Implementation slices:
  - Slice 1.1: add or update a characterization test that imports the chosen
    flow definition and compares `definition.schematic` to the committed
    schematic JSON. Use the existing `flow-facts` pattern if possible.
  - Slice 1.2: inside one `data.ts`, extract local constants for metadata,
    `routing`, `schematic`, `reports`, `runtimeSurface`, and `engineFlags`, then
    recompose the same exported `<id>FlowData` object. Keep the export name and
    `satisfies FlowData`.
  - Slice 1.3: if the same-file extraction is clean, decide whether a file split
    is still worth it. Only move facets into sibling files when the same-file
    shape is not enough for readability. Suggested names, if needed:
    `routing.ts`, `schematic.ts`, `reports-declaration.ts`, and
    `runtime-surface.ts`.
  - Slice 1.4: repeat one flow at a time. Never batch `fix` with another flow.
- Drift probes after each flow:
  - `npm run test -- tests/runner/flow-facts.test.ts tests/contracts/catalog-completeness.test.ts`
  - `npm run check-flow-drift`
  - `git diff -- src/flows/<id> generated/flows/<id> plugins/claude/skills/<id> plugins/circuit/flows/<id>`
- Rollback point:
  - Revert only the touched flow package and any new facet files for that flow.
    Generated outputs must either remain unchanged or be regenerated from the
    reverted source.
- Stop conditions:
  - Stop if `npm run check-flow-drift` reports changed generated output after a
    data-only extraction.
  - Stop if a facet move makes it harder to answer which reports, routes,
    writers, and progress entries belong to a step.
  - Stop if tests need broad rewrites outside flow authoring guardrails.

### SF-2 - Stage policy drift risk

Status: fixed

Current source evidence:

- Flow definitions declare schematic `stage_path_policy` and separate
  `canonicalStagePolicy` data.
- `src/flows/canonical-stage-policy.ts` projects canonical stage policy from
  flow definitions.
- `src/shared/flow-kind-policy-core.ts` consumes that projected policy for
  runtime fixture checks.
- `src/flows/stage-policy.ts` now provides `defineEnforcedStagePolicy(...)` for
  co-declaring schematic and package stage policy from one value, plus
  `classifyFlowStagePolicy(...)` for explicit retained-flow status checks.
- `tests/contracts/flow-kind-policy.test.ts` now proves every retained flow is
  classified as enforced or exempt, and proves each enforced
  `canonicalStagePolicy` matches the schematic `stage_path_policy` and declared
  canonical stages.

Proposed action: add a co-declaration helper and validation guard that prove
`stage_path_policy` and `canonicalStagePolicy` agree without deleting either
public contract.

Proof needed: flow-kind policy tests, compiled-flow stage tests, generated
manifest parity, and full `npm run verify`.

Proof result:

- Added the classification test first; it failed with `pursue` as the only
  retained flow whose policy status was `missing`.
- Classified `pursue` as enforced from its existing six-stage V1 flow shape and
  `docs/flows/pursue.md`.
- `npm run test -- tests/contracts/flow-kind-policy.test.ts tests/contracts/flow-path-safety-schema.test.ts tests/runner/flow-definition-compiler.test.ts`
  passed with 65 tests.
- `npm run check-flow-drift` passed. Generated schematic JSON, compiled
  manifests, command mirrors, host flow mirrors, generated surface map, and
  plugin runtimes are in sync.
- Diff inspection confirmed no changes to `src/flows/pursue/schematic.json`,
  `generated/flows/pursue`, `plugins/claude/skills/pursue`, or
  `plugins/circuit/flows/pursue`.

Rationale: the split remains intentional because schematic policy is emitted in
compiled manifests while package policy is runtime authority. The closure fixes
the unsafe part: retained flows can no longer silently omit a policy status, and
enforced package policy now has a test that must agree with the schematic and
declared stages. Existing enforced flows were not batch-migrated to the helper;
the agreement guard covers them, and future cosmetic migrations should still
move one flow at a time.

Execution-ready plan:

- Owner files:
  - Flow-owned policy data: `src/flows/*/data.ts`.
  - Policy projection: `src/flows/canonical-stage-policy.ts`.
  - Runtime fixture policy: `src/shared/flow-kind-policy-core.ts` and
    `src/shared/flow-kind-policy.ts`.
  - Schema contracts: `src/schemas/flow-schematic.ts`,
    `src/schemas/compiled-flow.ts`, and `src/schemas/stage.ts`.
  - Guardrails: `tests/contracts/flow-kind-policy.test.ts`,
    `tests/contracts/flow-path-safety-schema.test.ts`, and
    `tests/runner/flow-definition-compiler.test.ts`.
- Current source evidence:
  - `src/flows/canonical-stage-policy.ts:12` walks `flowDefinitions` and only
    records definitions that declare `canonicalStagePolicy`.
  - `src/shared/flow-kind-policy-core.ts:54` aliases runtime canonical policy to
    the projected flow-owned map.
  - `src/shared/flow-kind-policy-core.ts:246` returns pass-through when a flow id
    has no canonical-set entry.
  - The probe `rg -n "stage_path_policy:|canonicalStagePolicy:" src/flows/*/data.ts`
    shows `pursue` declares `stage_path_policy` but no `canonicalStagePolicy`.
- Partition criterion:
  - First separate flows with explicit `canonicalStagePolicy` from flows that
    currently pass through because they have no policy entry.
  - Current explicit policy flows: `review`, `fix`, `runtime-proof`, `build`, and
    `explore`.
  - Current pass-through candidate: `pursue`.
- File-set probe before edits:
  - `rg -n "stage_path_policy:|canonicalStagePolicy:" src/flows/*/data.ts`
  - `rg -n "FLOW_CANONICAL_STAGE_POLICY|pass_through|exempt" src/flows/canonical-stage-policy.ts src/shared/flow-kind-policy-core.ts tests/contracts/flow-kind-policy.test.ts`
- Implementation slices:
  - Slice 2.1: add a contract test that names every retained flow and asserts it
    has one explicit stage policy status: enforced, exempt, or intentionally
    pass-through. This test should fail first for any silent policy gap.
  - Slice 2.2: decide `pursue` before adding helpers. If `pursue` should be
    enforced, add a `canonicalStagePolicy` that matches its declared
    `stage_path_policy` and current stages. If it should remain pass-through,
    add an explicit test and rationale that says why.
  - Slice 2.3: introduce a small co-declaration helper only after the policy map
    is explicit. The helper should return both schematic `stage_path_policy` and
    package `canonicalStagePolicy` from one plain value; it must not alter
    compiled manifest shape.
  - Slice 2.4: migrate one existing enforced flow to the helper, starting with
    `runtime-proof` or `review`, then run drift proof before touching another
    flow.
- Drift probes after each slice:
  - `npm run test -- tests/contracts/flow-kind-policy.test.ts tests/contracts/flow-path-safety-schema.test.ts tests/runner/flow-definition-compiler.test.ts`
  - `npm run check-flow-drift`
  - `git diff -- src/flows/*/schematic.json generated/flows`
- Rollback point:
  - Revert the helper and the one migrated flow. Do not leave mixed helper
    state unless the tests explicitly cover both old and new declaration paths.
- Stop conditions:
  - Stop if adding a policy changes a public CLI or release diagnosis without an
    explicit product decision.
  - Stop if `pursue` cannot be classified as enforce, exempt, or pass-through
    from current docs and contracts.
  - Stop if helper code duplicates more policy text than it removes.

### SF-3 - Authoring shape compression

Status: fixed for first public-flow helper slice; broader migration intentionally deferred

Current source evidence:

- `src/flows/block-step-expansion.ts` exposes camel-case authoring shortcuts.
- `src/schemas/flow-schematic.ts` retains snake-case compatibility fields.
- `src/schemas/step.ts` defines stricter runtime step shapes.
- `src/flows/compile-schematic-to-flow.ts` bridges schematic steps into runtime
  steps.
- `src/flows/block-step-expansion.ts` now exposes execution-kind helpers:
  `composeBlockStep`, `relayBlockStep`, `verificationBlockStep`, and
  `checkpointBlockStep`. They still call the existing `expandBlockStepUse`
  expansion path.
- `src/flows/review/data.ts` now uses the compose and relay helpers for its
  three public schematic items.

Proposed action: add execution-kind declaration helpers where they remove
repeated execution boilerplate and keep schematic parity unchanged.

Proof needed: schematic parity tests, per-mode compile tests, generated drift
checks, and full `npm run verify`.

Proof result:

- Added helper characterization coverage in
  `tests/runner/block-step-expansion.test.ts` proving the helpers preserve the
  existing broad expansion path.
- Updated `tests/runner/block-authoring-migration.test.ts` so the migration
  guard recognizes both the old broad helper and the new execution-kind helpers.
- `npm run test -- tests/runner/block-step-expansion.test.ts tests/runner/block-authoring-migration.test.ts tests/contracts/compile-schematic-to-flow.test.ts tests/runner/flow-facts.test.ts`
  passed with 30 tests.
- `npm run check-flow-drift` passed. Generated schematics, compiled manifests,
  command mirrors, host flow mirrors, generated surface map, and plugin runtime
  checks are in sync.
- Diff inspection confirmed no changes to `src/flows/review/schematic.json`,
  `generated/flows/review`, `plugins/claude/skills/review`, or
  `plugins/circuit/flows/review`.

Rationale: `review` is the smallest public flow and proves the helper shape
without batching execution kinds across the larger route-sensitive flows. The
remaining flow migrations are intentionally deferred; moving `fix`, `build`,
`pursue`, and `explore` should still happen one flow and one execution family at
a time, with byte-stable generated output after each.

Execution-ready plan:

- Owner files:
  - Authoring bridge: `src/flows/block-step-expansion.ts`.
  - Block facts: `src/schemas/flow-block-definitions.ts`.
  - Compatibility schematic schema: `src/schemas/flow-schematic.ts`.
  - Runtime step schema: `src/schemas/step.ts`.
  - Compiler bridge: `src/flows/compile-schematic-to-flow.ts`.
  - Flow call sites: `src/flows/{review,fix,pursue,build,explore}/data.ts`.
  - Guardrails: `tests/runner/block-step-expansion.test.ts`,
    `tests/runner/block-authoring-migration.test.ts`,
    `tests/contracts/flow-block-catalog.test.ts`, and
    `tests/contracts/compile-schematic-to-flow.test.ts`.
- Current source evidence:
  - `src/flows/block-step-expansion.ts:18` defines the current shorthand type.
  - `src/flows/block-step-expansion.ts:207` maps authoring write shortcuts to
    schematic write slots.
  - `src/schemas/flow-schematic.ts:240` validates write/check shape against
    `execution.kind`.
  - `src/flows/compile-schematic-to-flow.ts:237` compiles schematic items to
    strict runtime step variants.
  - The probe `rg -n "expandBlockStepUse\\(" src/flows/*/data.ts` currently
    finds 32 call sites across five public flows.
- Partition criterion:
  - Partition by execution kind first, then by flow. Helpers for compose,
    verification, relay, checkpoint, sub-run, and fanout must not be mixed in
    one slice.
  - Do not change generated `schematic.json` shape. The compatibility schematic
    remains snake-case.
  - Do not migrate inline raw schematic items until the helper API handles their
    execution kind without losing readability.
- File-set probe before edits:
  - `rg -n "expandBlockStepUse\\(" src/flows/*/data.ts`
  - `rg -n "reportPath|requestPath|receiptPath|resultPath|checkpointRequestPath|checkpointResponsePath|required|allow|pass" src/flows/*/data.ts`
  - `rg -n "resolveWrites|resolveCheck|validateExecutionShape|compileItem" src/flows/block-step-expansion.ts src/schemas/flow-schematic.ts src/flows/compile-schematic-to-flow.ts`
- Implementation slices:
  - Slice 3.1: add characterization tests for current `BlockStepUse` output for
    one compose, one relay, one checkpoint, and one verification example.
  - Slice 3.2: introduce execution-kind helpers in the existing bridge module or
    a sibling module, for example `composeBlockStep(...)`,
    `relayBlockStep(...)`, `checkpointBlockStep(...)`, and
    `verificationBlockStep(...)`. Each helper should still call
    `expandBlockStepUse` so there is one expansion path.
  - Slice 3.3: migrate only the smallest public flow first, likely `review`, and
    compare generated schematic output byte-for-byte.
  - Slice 3.4: migrate remaining flows in ascending complexity. Save `fix` for
    last because it has the most route and verification variants.
  - Slice 3.5: only after all call sites are migrated, decide whether the broad
    `BlockStepUse` interface should stay public for custom flows or become
    internal compatibility.
- Drift probes after each flow:
  - `npm run test -- tests/runner/block-step-expansion.test.ts tests/runner/block-authoring-migration.test.ts tests/contracts/compile-schematic-to-flow.test.ts`
  - `npm run test -- tests/runner/flow-facts.test.ts`
  - `npm run check-flow-drift`
- Rollback point:
  - Revert the migrated flow and helper additions for that execution kind.
    Because helpers call `expandBlockStepUse`, rollback should not require
    generated output edits.
- Stop conditions:
  - Stop if helpers hide route targets, report paths, or check requirements from
    the flow reader.
  - Stop if a helper needs flow-specific branches.
  - Stop if generated schematic output changes without an intentional schematic
    contract change.

### SF-4 - Runtime context narrowing

Status: fixed for compose executor; remaining executor families intentionally deferred

Current source evidence:

- `src/runtime/run/run-context.ts` keeps run values and effectful capabilities in
  one context.
- `src/runtime/run/run-values.ts` already exposes `RunValue` and `RunPorts` as
  the intended split.
- `tests/contracts/runtime-context-boundary.test.ts` says the split exists
  without replacing `RunContext` yet.
- `src/runtime/run/run-values.ts` now exposes `StepExecutionContext` and
  `stepExecutionContextFromContext(...)`, which bundle `RunValue`, `RunPorts`,
  and an already-indexed runtime step.
- `src/runtime/executors/compose.ts` now runs its implementation through
  `executeComposeWithPorts(...)`; `executeComposeResult(step, context)` remains
  as the compatibility adapter for current callers.
- `tests/contracts/runtime-context-boundary.test.ts` now proves compose no
  longer owns a direct `requireRuntimeIndexedStep(...)` lookup, while
  checkpoint, verification, and relay remain measurable migration targets.

Proposed action: later migrate executor signatures from broad `RunContext` to a
small step support object plus `RunValue` and `RunPorts`, one executor family at
a time.

Proof needed: runtime context boundary tests, focused executor tests, runtime
suite, and full `npm run verify`.

Proof result:

- Ran the file-set probe and confirmed direct runtime-index lookups were in
  compose, checkpoint, verification, and relay before the slice.
- Added a runtime boundary test that makes the remaining direct lookup sites
  measurable and asserts compose has moved to narrow execution support.
- `npm run test -- tests/contracts/runtime-context-boundary.test.ts tests/runtime/runtime-package-index.test.ts tests/runtime/default-executors.test.ts tests/runtime`
  passed with 143 tests.
- `npm run check-flow-drift` passed. Generated schematics, compiled manifests,
  command mirrors, host flow mirrors, generated surface map, and plugin runtime
  checks are in sync.

Rationale: compose is the lowest-risk executor family and now exercises the
value/ports shape without changing caller APIs or graph-loop control flow.
Checkpoint, verification, and relay remain intentionally deferred because they
carry resume, proof, and connector/run-folder contracts. They should migrate one
family at a time behind the same compatibility-adapter pattern.

Execution-ready plan:

- Owner files:
  - Context and projections: `src/runtime/run/run-context.ts` and
    `src/runtime/run/run-values.ts`.
  - Graph runner wiring: `src/runtime/run/graph-runner.ts`.
  - Runtime package index: `src/runtime/manifest/runtime-package-index.ts` and
    `src/flows/registries/runtime-index.ts`.
  - Executors: `src/runtime/executors/compose.ts`,
    `src/runtime/executors/checkpoint.ts`,
    `src/runtime/executors/verification.ts`, and
    `src/runtime/executors/relay.ts`.
  - Guardrails: `tests/contracts/runtime-context-boundary.test.ts`,
    `tests/runtime/runtime-package-index.test.ts`,
    `tests/runtime/default-executors.test.ts`, and `tests/runtime/**`.
- Current source evidence:
  - `src/runtime/run/run-context.ts:9` defines the broad `RunContext`.
  - `src/runtime/run/run-values.ts:19` defines `RunValue`, and
    `src/runtime/run/run-values.ts:79` defines `RunPorts`.
  - `src/runtime/run/graph-runner.ts:293` builds the runtime package index and
    `src/runtime/run/graph-runner.ts:294` constructs the broad context.
  - Current executor package-index lookups are limited to four sites:
    `compose.ts:47`, `verification.ts:47`, `checkpoint.ts:109`, and
    `relay.ts:610`.
- Partition criterion:
  - Migrate executor families one at a time. Do not change graph-loop control
    flow in the same slice as executor API changes.
  - Start with compose because it has low external IO and uses the existing
    result adapter. Then checkpoint, verification, and relay. Defer sub-run and
    fanout unless the first four prove the shape.
  - Keep compatibility wrappers that accept `RunContext` until all internal
    callers move to the narrower value/ports API.
- File-set probe before edits:
  - `rg -n "requireRuntimeIndexedStep\\(" src/runtime/executors src/runtime/run src/runtime/manifest`
  - `rg -n "execute.*Result\\(|executeCompose\\(|executeCheckpoint\\(|executeVerification\\(|executeRelay\\(" src/runtime tests`
  - `rg -n "RunValue|RunPorts|runValueFromContext|runPortsFromContext" src/runtime tests`
- Implementation slices:
  - Slice 4.1: add a test that names the current four
    `requireRuntimeIndexedStep` sites. The test should make the migration
    measurable instead of relying on code review.
  - Slice 4.2: introduce a narrow `StepExecutionContext` value containing
    `run`, `ports`, and the already-indexed runtime step support needed by the
    executor. Build it in `graph-runner.ts` next to the current executor call.
  - Slice 4.3: migrate compose to a new `executeComposeWithPorts(...)` while
    keeping `executeComposeResult(step, context)` as a compatibility adapter.
  - Slice 4.4: migrate checkpoint, then verification, then relay. Each slice
    removes one direct executor lookup through `context.packageIndex`.
  - Slice 4.5: after the four executor families move, tighten
    `runtime-context-boundary.test.ts` so those executors cannot regress to the
    broad context path.
- Drift probes after each executor:
  - `npm run test -- tests/contracts/runtime-context-boundary.test.ts tests/runtime/runtime-package-index.test.ts tests/runtime/default-executors.test.ts`
  - For compose/checkpoint/verification: add the matching focused runner tests
    that exercise that executor.
  - For relay: run relay provenance and shape hint registry tests before the
    full runtime suite.
  - `npm run test -- tests/runtime`
- Rollback point:
  - Keep old `execute*Result(step, context)` adapters until the final cleanup.
    Reverting one executor migration should require only that executor file and
    the context builder changes for that slice.
- Stop conditions:
  - Stop if graph-runner step advancement becomes less explicit.
  - Stop if typed failure/result semantics are weakened.
  - Stop if relay, checkpoint resume, sub-run, fanout, or run-folder contracts
    need behavior changes to accommodate the narrower context.

### SF-5 - Generator decomposition

Status: fixed

Current source evidence:

- `docs/generated-surfaces.md` defines generated schematics, manifests, command
  mirrors, host mirrors, and skill surfaces.
- `scripts/emit-flows.ts` owns planning, rendering, checking, formatting, stale
  cleanup, and writes for those surfaces.
- `tests/unit/emit-flows-drift.test.ts` guards stale sibling and host mirror
  behavior.
- `scripts/emit-flows/host-renderers.ts` now owns pure Claude/Codex command and
  skill rendering.
- `scripts/emit-flows.ts` remains the entrypoint and still owns catalog loading,
  filesystem writes, drift checks, stale cleanup, and generated surface map
  orchestration.

Proposed action: split pure host command and skill rendering out of
`scripts/emit-flows.ts` while keeping script output unchanged.

Proof needed: `tests/unit/emit-flows-drift.test.ts`, `npm run check-flow-drift`,
host surface tests, and full `npm run verify`.

Proof result:

- Baseline `npm run test -- tests/unit/emit-flows-drift.test.ts` passed before
  the extraction.
- Added `tests/unit/emit-flows-renderers.test.ts` to characterize Claude host
  command rendering, Codex host command rendering, and Codex skill placeholder
  removal.
- `npm run test -- tests/unit/emit-flows-renderers.test.ts` passed with 3 tests.
- `npm run test -- tests/unit/emit-flows-drift.test.ts tests/unit/emit-flows-renderers.test.ts tests/contracts/host-experience-docs.test.ts tests/contracts/claude-host-plugin.test.ts tests/contracts/codex-host-plugin.test.ts`
  passed with 51 tests.
- `npm run check-flow-drift` passed. Generated schematics, compiled manifests,
  command mirrors, host flow mirrors, generated surface map, and plugin runtime
  checks are in sync.
- Diff inspection confirmed no changes under `docs/generated-surfaces.md`,
  `generated/flows`, `plugins/claude/commands`, `plugins/claude/skills`,
  `plugins/circuit/commands`, `plugins/circuit/flows`, or
  `plugins/circuit/skills`.

Rationale: the behavior-preserving decomposition is intentionally limited to
the pure renderer concern first. Surface-map rendering, stale discovery,
comparison helpers, and emit/check orchestration are still deferred because
splitting them in the same pass would batch output graph, cleanup, and
comparison ownership. The remaining script is smaller and easier to audit, and
all generated/public surfaces stayed byte-stable.

Execution-ready plan:

- Owner files:
  - Generator entrypoint: `scripts/emit-flows.ts`.
  - Generated surface map: `docs/generated-surfaces.md`.
  - Generated outputs: `docs/flows/block-catalog.json`,
    `src/flows/*/schematic.json`, `generated/flows/**`,
    `plugins/claude/**`, and `plugins/circuit/**`.
  - Guardrails: `tests/unit/emit-flows-drift.test.ts`,
    `tests/contracts/host-experience-docs.test.ts`,
    `tests/contracts/claude-host-plugin.test.ts`, and
    `tests/contracts/codex-host-plugin.test.ts`.
- Current source evidence:
  - `docs/generated-surfaces.md:21` lists generated surface ownership and drift
    checks.
  - `scripts/emit-flows.ts:110` owns Codex skill metadata.
  - `scripts/emit-flows.ts:155` renders Claude host command output.
  - `scripts/emit-flows.ts:224` renders Codex host command output.
  - `scripts/emit-flows.ts:495` renders the surface inventory.
  - `scripts/emit-flows.ts:781` loads compiler modules from `dist`.
  - `scripts/emit-flows.ts:1038` writes emitted surfaces, and
    `scripts/emit-flows.ts:1100` checks emitted surfaces.
- Partition criterion:
  - Split by generator concern, not by output directory. The output graph must
    remain identical at each slice.
  - Keep `scripts/emit-flows.ts` as the CLI entrypoint throughout. New modules
    should be imported by it; do not change package scripts in the first pass.
  - Treat host markdown renderers, surface-map rendering, stale cleanup, and
    emit/check orchestration as separate concerns.
- File-set probe before edits:
  - `rg -n "function render|async function|function check|function emit|function findStale|function load|function compile" scripts/emit-flows.ts`
  - `npm run check-flow-drift`
  - `git diff -- docs/generated-surfaces.md generated/flows plugins/claude plugins/circuit`
- Implementation slices:
  - Slice 5.1: extract pure host command and skill rendering into
    `scripts/emit-flows/host-renderers.ts`. It should export the same rendering
    functions and metadata. No output writes move in this slice.
  - Slice 5.2: extract generated surface map rendering into
    `scripts/emit-flows/surface-map.ts`. Keep table rows byte-for-byte stable.
  - Slice 5.3: extract stale surface discovery helpers into
    `scripts/emit-flows/stale-surfaces.ts`.
  - Slice 5.4: extract check comparison helpers into
    `scripts/emit-flows/drift-checks.ts`.
  - Slice 5.5: only after the pure pieces are separated, consider splitting
    emit/check orchestration. The entrypoint should still read as "load catalog,
    plan surfaces, emit or check".
- Drift probes after each slice:
  - `npm run test -- tests/unit/emit-flows-drift.test.ts`
  - `npm run check-flow-drift`
  - `npm run test -- tests/contracts/host-experience-docs.test.ts tests/contracts/claude-host-plugin.test.ts tests/contracts/codex-host-plugin.test.ts`
  - `git diff -- docs/generated-surfaces.md generated/flows plugins/claude plugins/circuit`
- Rollback point:
  - Revert the extracted module and restore the functions in `scripts/emit-flows.ts`.
    Because behavior should be pure extraction, no generated output should need
    rollback.
- Stop conditions:
  - Stop if any generated file changes during an extraction-only slice.
  - Stop if `node scripts/emit-flows.ts --check` requires a different build
    order than `npm run check-flow-drift`.
  - Stop if the entrypoint becomes harder to audit than the original script.

### SF-6 - Progress presentation ownership

Status: fixed; checkpoint presentation intentionally deferred

Current source evidence:

- `tests/contracts/catalog-completeness.test.ts` requires public flows to own
  progress display metadata.
- `src/runtime/projections/progress.ts` still has flow-specific relay copy for
  Explore and turns checkpoint trace facts into host-facing input events.
- `src/flows/types.ts` now lets a `CompiledFlowProgressStep` own
  `relayStartedText` and `relayCompletedText`.
- Public built-in relay steps in `review`, `fix`, `pursue`, `build`, and
  `explore` now declare relay started/completed copy in their flow-owned
  `runtimeSurface.progress.steps`.
- `src/runtime/projections/progress.ts` now prefers flow-owned relay copy and
  keeps generic fallback copy for custom or older flows. The
  `flowId === 'explore'` relay branches were removed.

Proposed action: move relay copy into runtime surfaces, leaving the projector to
map trace facts to events and keep generic fallback copy for custom flows.
Checkpoint presentation atoms remain a separate host-contract slice.

Proof needed: host experience docs tests, operator summary tests, focused
progress tests, and full `npm run verify`.

Proof result:

- Added parity tests for current Explore relay started/completed copy and
  non-Explore relay started/completed copy before changing the projector.
- `npm run test -- tests/runtime/progress-projection.test.ts` passed with the
  parity tests under the old runtime branch.
- `npm run test -- tests/runtime/progress-projection.test.ts tests/soak/runtime-surface.test.ts tests/contracts/catalog-completeness.test.ts tests/contracts/host-experience-docs.test.ts`
  passed with 35 tests after the refactor.
- `npm run test -- tests/runner/operator-summary-writer.test.ts` passed with 29
  tests.
- `npm run check-flow-drift` passed. Generated schematics, compiled manifests,
  command mirrors, host flow mirrors, generated surface map, and plugin runtime
  checks are in sync.
- Diff inspection confirmed no changes under `docs/generated-surfaces.md`,
  `generated/flows`, `plugins/claude/skills`, `plugins/circuit/flows`,
  `plugins/claude/commands`, `plugins/circuit/commands`, or
  `plugins/circuit/skills`.

Rationale: relay copy was the smallest behavior-preserving ownership move and
is now flow-owned for all public built-ins. Checkpoint presentation is
intentionally deferred because moving prompts, choice labels, or resume command
copy could change `checkpoint.waiting` or `user_input.requested` events. The
projector still maps checkpoint trace facts to host-facing input events.

Execution-ready plan:

- Owner files:
  - Progress surface types: `src/flows/types.ts`.
  - Flow-owned progress data: `src/flows/{review,fix,pursue,build,explore}/data.ts`.
  - Runtime projection: `src/runtime/projections/progress.ts`.
  - Host contracts: `docs/contracts/host-capabilities.md`,
    `docs/contracts/native-host-adapters.md`, and
    `docs/specs/narration-display-profiles.md`.
  - Guardrails: `tests/runtime/progress-projection.test.ts`,
    `tests/soak/runtime-surface.test.ts`,
    `tests/contracts/catalog-completeness.test.ts`,
    `tests/contracts/host-experience-docs.test.ts`, and
    `tests/runner/operator-summary-writer.test.ts`.
- Current source evidence:
  - `src/flows/types.ts:129` defines `CompiledFlowProgressStep` with
    `taskTitle`, `activeText`, and optional `relayRole`.
  - `tests/contracts/catalog-completeness.test.ts:190` requires public flow
    runtime surfaces to own progress display metadata for every schematic item.
  - `src/runtime/projections/progress.ts:80` and `src/runtime/projections/progress.ts:91`
    still choose relay status copy by `flowId`.
  - `src/runtime/projections/progress.ts:673` maps checkpoint trace events to
    `checkpoint.waiting` and `user_input.requested` host progress events.
- Partition criterion:
  - Split relay status copy before checkpoint presentation. Relay copy is
    smaller and already tied to `CompiledFlowProgressStep`.
  - Keep fallback copy for custom or old flows until every built-in public flow
    declares explicit copy.
  - Do not change checkpoint resume command strings, event types, or host
    capability docs in the relay-copy slice.
- File-set probe before edits:
  - `rg -n "flowId === 'explore'|user_input\\.requested|checkpoint\\.waiting|CompiledFlowProgressSurface|progressSurface" src/runtime/projections/progress.ts src/flows/types.ts src/flows/*/data.ts tests/runtime/progress-projection.test.ts tests/soak/runtime-surface.test.ts tests/contracts/catalog-completeness.test.ts`
  - `rg -n "runtimeSurface:|progress:|primaryResult:" src/flows/*/data.ts`
- Implementation slices:
  - Slice 6.1: add snapshot-style tests for current relay started/completed copy
    for Explore and one non-Explore flow. This is the red/green guard for copy
    parity.
  - Slice 6.2: extend `CompiledFlowProgressStep` with optional relay presentation
    fields, such as `relayStartedText` and `relayCompletedText`. Do not remove
    the existing fallback logic yet.
  - Slice 6.3: populate relay text in each built-in public flow's
    `runtimeSurface.progress.steps` where `relayRole` is present. Values must
    match the current runtime strings exactly.
  - Slice 6.4: change `progress.ts` to prefer per-step relay text and then fall
    back to existing generic copy. Remove the `flowId === 'explore'` branches
    only when tests prove exact parity.
  - Slice 6.5: plan checkpoint presentation separately. If moving checkpoint
    prompt, choice labels, or resume command copy into runtime surfaces would
    change `checkpoint.waiting` or `user_input.requested` events, stop and split
    a new checkpoint-host contract goal.
- Drift probes after each slice:
  - `npm run test -- tests/runtime/progress-projection.test.ts tests/soak/runtime-surface.test.ts tests/contracts/catalog-completeness.test.ts tests/contracts/host-experience-docs.test.ts`
  - `npm run test -- tests/runner/operator-summary-writer.test.ts`
  - `npm run check-flow-drift`
  - For copy parity, compare before/after progress JSON fixtures or snapshots
    rather than relying on visual review.
- Rollback point:
  - Revert progress type additions and the single flow's `runtimeSurface`
    changes first. The runtime fallback path should keep behavior intact while
    rolling back data additions.
- Stop conditions:
  - Stop if host-visible progress event types or resume payloads change.
  - Stop if custom flows without new progress fields lose readable fallback
    status text.
  - Stop if the progress data becomes noisier than the runtime branch it
    replaces.

### SF-7 - Proof-bundle clarity

Status: fixed

Current source evidence:

- `package.json` exposes focused checks, `check-flow-drift`, `verify:fast`, and
  final `verify`.
- `AGENTS.md` listed the canonical commands but did not name focused bundles by
  change surface.
- This ledger now records the focused proof bundles used for this closure.

Proposed action: add a short focused-proof note to `AGENTS.md` and keep this
ledger's bundle map as the assessment-specific proof record.

Proof needed: review the `AGENTS.md` note, run `npm run lint`, and complete
final `npm run verify`.

Proof result:

- `npm run lint` passed.
- `npm run check-flow-drift` passed, including generated schematics, compiled
  manifests, host mirrors, generated surface map, and plugin runtime checks.
- `npm run verify` passed with typecheck, lint, build, 163 test files, 1736
  passing tests, eval checks, generated-surface drift checks, plugin runtime
  checks, and release infrastructure checks.

Rationale: this is a small documentation change that improves agent execution
without changing runtime behavior or generated surfaces.

### SF-8 - Stale docs

Status: fixed

Current source evidence:

- `README.md` pointed to `src/flows/<id>/facts.ts`.
- `tests/runner/flow-facts.test.ts` asserts retained flows no longer have
  `facts.ts` files.
- `docs/architecture/declarative-flow-architecture.md` says current flows are
  authored in `data.ts` and bound in `flow.ts`.

Proposed action: update README to point to `data.ts` and `flow.ts`.

Proof needed: targeted `rg` check for stale README `facts.ts`, focused
`flow-facts` test, and final `npm run verify`.

Proof result:

- `rg -n "facts\\.ts|authoritative flow facts" README.md AGENTS.md docs/architecture/declarative-flow-architecture.md docs/generated-surfaces.md`
  returned no hits.
- `npm run test -- tests/runner/flow-facts.test.ts` passed with 3 tests.
- `npm run lint` passed.
- `npm run check-flow-drift` passed with no generated drift.
- `npm run verify` passed with typecheck, lint, build, 163 test files, 1736
  passing tests, eval checks, generated-surface drift checks, plugin runtime
  checks, and release infrastructure checks.

Rationale: this is a confirmed stale claim with a low-risk docs-only fix.

## Final Review

Closure review 1 findings:

- Medium: `AGENTS.md` initially used "flow facts" as prose, which could look
  like reviving the retired facts model. Resolved by naming the exact
  `tests/runner/flow-facts.test.ts` path.
- Low: broad refactor findings are deferred, not implemented. This is allowed by
  the closure rules because each deferral has evidence, risk rationale, and
  proof needed.

Closure review 1 after fixes: no medium-or-above findings.

Closure review 2 findings:

- No medium, high, or critical findings. The ledger persists all required
  findings, each item has a closure status and proof plan, low-risk docs changes
  are fixed, generated-surface parity is proven, and broad refactors are
  deferred with evidence instead of forced.

Planning expansion review 1 findings:

- Medium: the original closure ledger preserved the findings but did not give a
  later agent enough partition criteria, owner files, rollback points, or stop
  conditions to execute the refactors safely. Resolved by adding
  execution-ready plans for SF-1 through SF-6.
- Low: the SF-2 stage policy plan reveals that `pursue` currently has
  `stage_path_policy` but no `canonicalStagePolicy`. The plan calls this out as
  the first decision point instead of silently treating it as a bug.

Planning expansion review 1 after fixes: no medium-or-above findings.

Planning expansion review 2 findings:

- No medium, high, or critical findings. Every deferred item has current source
  evidence, exact owner files, partition criteria, read-only probes,
  implementation slices, focused proof commands, rollback points, and stop
  conditions. The plan remains planning-only and does not require public
  behavior, generated-surface, run-folder, or host contract drift.

Implementation final proof:

- Combined focused proof ladder passed:
  `npm run test -- tests/contracts/flow-kind-policy.test.ts tests/contracts/flow-path-safety-schema.test.ts tests/runner/flow-definition-compiler.test.ts tests/unit/emit-flows-drift.test.ts tests/unit/emit-flows-renderers.test.ts tests/contracts/host-experience-docs.test.ts tests/contracts/claude-host-plugin.test.ts tests/contracts/codex-host-plugin.test.ts tests/runtime/progress-projection.test.ts tests/soak/runtime-surface.test.ts tests/contracts/catalog-completeness.test.ts tests/runner/operator-summary-writer.test.ts tests/runner/block-step-expansion.test.ts tests/runner/block-authoring-migration.test.ts tests/contracts/compile-schematic-to-flow.test.ts tests/runner/flow-facts.test.ts tests/contracts/runtime-context-boundary.test.ts tests/runtime/runtime-package-index.test.ts tests/runtime/default-executors.test.ts tests/runtime`
  with 30 files and 343 tests passing.
- `npm run check-flow-drift` passed after the implementation slices.
- `npm run verify` passed with typecheck, lint, build, 164 test files, 1745
  passing tests, 6 skipped tests, eval checks, generated-surface drift checks,
  plugin runtime checks, and release infrastructure checks.
- `git diff --check` passed.
- Diff inspection showed no changes under `docs/generated-surfaces.md`,
  `generated/flows`, `plugins/claude/skills`, `plugins/circuit/flows`,
  `plugins/claude/commands`, `plugins/circuit/commands`,
  `plugins/circuit/skills`, `docs/release`, or `generated/release`.
- `rg -n "flowId === 'explore'|relayStartedStatusText|relayCompletedStatusText" src/runtime/projections/progress.ts`
  returned no hits.

Implementation review 1 findings:

- Low: SF-1, SF-3, and SF-4 intentionally close first safe slices rather than
  completing every broader migration. This is allowed by the closure rules
  because each remaining migration has an explicit deferral rationale, and the
  implemented slices leave measurable tests and rollback boundaries.
- No medium, high, or critical findings.

Implementation review 1 after fixes: no medium-or-above findings.

Implementation review 2 findings:

- No medium, high, or critical findings. The ledger has final status, proof,
  rationale, and intentional deferral notes for SF-1 through SF-6; SF-7 and
  SF-8 remain fixed; focused proof, full verify, generated/public drift
  inspection, and release-surface checks are clean.
