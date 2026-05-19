# Circuit Simplicity Migration Ledger

Status: complete
Active slice: complete
Last updated: 2026-05-18

Archive note: this completed migration ledger is historical evidence. Use
current code, tests, `docs/README.md`, and canonical architecture docs for live
guidance.

This ledger is the durable execution record for the Circuit simplicity migration.
It exists so context compaction does not erase slice status, test evidence,
rollback points, or decisions.

## Global Invariants

- Preserve current product behavior, public CLI and host contracts, report schema
  names, Zod schema shapes, generated surface rules, run-folder semantics,
  checkpoint resume, and generated host/plugin outputs.
- Use plain Circuit vocabulary: Flow, Schematic, Block, Step, Run, Checkpoint,
  Trace, Report, Evidence, and Run folder.
- Never hand-edit generated outputs. Update authored sources and run the approved
  generator path.
- Every implementation slice starts with a failing or characterization test.
- Do not move to the next slice while any medium-or-higher defect, generated
  drift, or unexplained failure remains.

## Source Evidence

- `README.md` says Circuit runs the same headless engine in every host and
  checks each Step output against a contract before moving on.
- `UBIQUITOUS_LANGUAGE.md` defines the product vocabulary and warns against
  prose/schema drift, hidden runtime, and product/internal collapse.
- `docs/generated-surfaces.md` defines generated outputs and drift checks.
- `docs/architecture/data-first-functional-flow-architecture.md` calls for
  authored Flow definitions as plain typed values, effects at the boundary, and
  preserved report schema/Zod contracts.
- `docs/architecture/declarative-flow-architecture.md` records the current
  FlowData-plus-flow adapter model and generated output rules.
- `src/flows/catalog.ts` is the engine-facing catalog source.
- `src/flows/flow-definition.ts` currently owns FlowDefinition, FlowData
  validation, FlowData projection, and compiled package projection.
- `src/schemas/flow-block-definitions.ts` owns the current Block catalog facts.
- `src/runtime/run/graph-runner.ts`, `src/runtime/run/run-context.ts`,
  `src/runtime/trace/trace-store.ts`, and `src/runtime/run-files/run-file-store.ts`
  show the current runtime value/effect coupling.

## Verification Ladder

- Focused red/green loop: one target test file for the active slice.
- Slice proof: focused tests plus any targeted generated drift check.
- Program milestone: `npm run verify:fast`.
- Final ship check: `npm run verify`.

## Program 1 - One Canonical Flow Value

### Slice 1.1 - Add the canonical value shell

Status: done

Objective: introduce `FlowData` and `defineFlowData(...)` as a behavior-preserving
plain value shell that projects through the existing `FlowDefinition` compiler
path, without migrating any built-in Flow yet.

Target state:

- `defineFlowDataValue(input)` returns typed success or typed errors.
- `defineFlowData(input)` throws through a compatibility wrapper.
- The output is a normal `FlowDefinition`.
- Existing `defineFlow(...)` and `defineFlowFromFacts(...)` callers continue to
  work unchanged.

Affected surfaces:

- `src/flows/flow-definition.ts`
- `tests/runner/flow-definition-compiler.test.ts`
- This ledger

Implementation checklist:

- [x] Add a failing characterization test for `defineFlowData`.
- [x] Add a failing typed-error test for `defineFlowDataValue`.
- [x] Implement the smallest `FlowData` shell that delegates to `defineFlow`.
- [x] Re-run the focused test file.
- [x] Update this ledger with command evidence and decisions.
- [x] Run the generated-surface drift check if the compiler output changes.

Intended tests:

- `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- `npm run check-flow-drift` if generated output changes

Rollback point: remove the new `FlowData` exports and tests. No built-in Flow
will depend on this shell in this slice.

Completion criteria:

- Focused compiler tests pass.
- No generated output drift is introduced.
- This ledger records the proof and any follow-up.

Evidence:

- Red: `npm run test -- tests/runner/flow-definition-compiler.test.ts` failed
  because `defineFlowData` and `defineFlowDataValue` were not functions.
- Green: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
  passed with 11 tests.
- Broader proof: `npm run check` passed.
- Drift proof: `npm run check-flow-drift` passed; generated surfaces and plugin
  runtime mirrors were in sync.

Decision:

- `FlowData` is currently a conservative shell over `FlowDefinitionInput`.
  This intentionally preserves behavior and gives later slices a stable
  migration seam without moving any built-in Flow yet.

### Slice 1.2 - Centralize report declarations

Status: done

Objective: make report schemas, channels, hints, validators, and writers part
of canonical Flow data while preserving every existing report schema name and
Zod shape.

Checklist:

- [x] Add tests for report declaration projection parity.
- [x] Add duplicate/unknown report binding errors.
- [x] Preserve old `reportDeclarations` adapter until all flows migrate.
- [x] Prove `relayReports`, `reportSchemas`, and `writers` are unchanged.

Rollback point: keep report declarations outside `FlowData` and delete only the
new projection path.

Evidence:

- Red: `npm run test -- tests/runner/flow-definition-compiler.test.ts` failed
  because `FlowData.reports` was ignored and invalid report ownership was not
  rejected.
- Green: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
  passed with 13 tests.
- Broader proof: `npm run check` passed.
- Drift proof: `npm run check-flow-drift` passed; generated surfaces and plugin
  runtime mirrors were in sync.
- Lint proof: `npm run lint` passed after manual formatting of the new union
  type.

Decision:

- `FlowData.reports` is the canonical report declaration field. It projects to
  legacy `reportDeclarations` for existing compiler and registry code.
- The old `FlowDefinition.reportDeclarations` adapter remains untouched for
  compatibility during migration.

### Slice 1.3 - Migrate Runtime proof

Status: done

Objective: migrate the smallest internal Flow first.

Checklist:

- [x] Migrate `runtime-proof` to `defineFlowData`.
- [x] Prove internal generated manifest parity.
- [x] Confirm no host mirror is emitted.

Rollback point: restore `defineFlowFromFacts` for `runtime-proof`.

Evidence:

- Red: `npm run test -- tests/runner/flow-facts.test.ts` failed because
  `runtime-proof` still used the old `defineFlowFromFacts` adapter.
- Green: `npm run test -- tests/runner/flow-facts.test.ts` passed with 4
  tests.
- Compiler proof: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
  passed with 14 tests.
- Type proof: `npm run check` passed.
- Lint proof: `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` passed after `npm run build`,
  `npm run build-plugin-runtime`, and the ordered drift check.

Decision:

- `runtime-proof` is the first built-in Flow owned by `FlowData`.
- `src/flows/runtime-proof/facts.ts` remains temporarily so the existing
  generator parity check can keep proving the generated schematic. Retiring
  duplicate fact surfaces stays isolated to Slice 1.9.
- `reportWriterSchemaAliases` preserves the existing compose writer result
  schema alias from `plan.strategy@v1` to `runtime-proof.compose@v1` without
  changing the public report schema declaration.

### Slice 1.4 - Migrate Review

Status: done

Objective: migrate the simplest public Flow with command and host mirrors.

Source evidence:

- `src/flows/review/facts.ts` currently owns Review schematic data, generated
  schematic paths, progress text, primary result metadata, report registrations,
  writer bindings, structural hint metadata, and canonical stage policy facts.
- `src/flows/review/flow.ts` currently binds those facts to routing signals,
  Zod report schemas, compose writers, and the review relay structural hint.
- `scripts/emit-flows.ts` derives public host command and flow mirrors from the
  compiled catalog and must keep Review command and manifest outputs unchanged.

Checklist:

- [x] Migrate Review reports and writers.
- [x] Migrate Review steps.
- [x] Prove generated command, host mirror, and manifest parity.

Intended tests:

- Red/green: `npm run test -- tests/runner/flow-facts.test.ts`
- Compiler parity: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- Type and lint proof: `npm run check`, `npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: restore Review's facts adapter.

Evidence:

- Red: `npm run test -- tests/runner/flow-facts.test.ts` failed first because
  Review still used `defineFlowFromFacts`, then failed because
  `src/flows/review/data.ts` did not exist.
- Green: `npm run test -- tests/runner/flow-facts.test.ts` passed with 4
  tests after Review moved to `defineFlowData(reviewFlowData)`.
- Compiler proof: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
  passed with 14 tests.
- Type proof: `npm run check` passed.
- Lint proof: `npm run lint` passed after formatting the Review evidence
  requirements array.
- Drift proof: `npm run check-flow-drift` passed after `npm run
  build-plugin-runtime` regenerated the compiled host runtime mirrors.

Decision:

- Review now owns one plain `FlowData` value in `src/flows/review/data.ts`.
- Public command and host flow mirrors stayed unchanged under the generator
  drift check.
- `src/flows/review/facts.ts` remains temporarily to keep the existing
  generated schematic parity probe alive until duplicate fact surfaces are
  retired in Slice 1.9.

### Slice 1.5 - Migrate Pursue

Status: done

Objective: prove public Flow migration without command ownership.

Source evidence:

- `src/flows/pursue/facts.ts` owns Pursue schematic data, two entry modes,
  report registrations, writer bindings, progress text, and the public primary
  result path.
- `src/flows/pursue/flow.ts` currently binds facts to routing signals, relay
  shape hints, Zod report schemas, compose/verification/close writers, and has
  no command path.
- `src/flows/pursue/schematic.json` and `generated/flows/pursue/circuit.json`
  are generated compatibility outputs that must stay byte-for-byte stable.

Checklist:

- [x] Migrate Pursue reports, writer bindings, and primary result.
- [x] Confirm no command surfaces are introduced.
- [x] Prove public flow mirrors remain unchanged.

Intended tests:

- Red/green: `npm run test -- tests/runner/flow-facts.test.ts`
- Compiler parity: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- Type and lint proof: `npm run check`, `npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: restore Pursue's facts adapter.

Evidence:

- Red: `npm run test -- tests/runner/flow-facts.test.ts` failed because
  `src/flows/pursue/data.ts` did not exist for a migrated Flow.
- Characterization: `npm run test --
  tests/runner/flow-definition-compiler.test.ts` passed with 15 tests after
  adding a commandless Pursue assertion.
- Green: `npm run test -- tests/runner/flow-facts.test.ts` passed with 4
  tests after Pursue moved to `defineFlowData(pursueFlowData)`.
- Compiler proof: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
  passed with 15 tests.
- Type proof: `npm run check` passed.
- Lint proof: `npm run lint` passed after formatting the Pursue evidence
  requirements array.
- Drift proof: `npm run check-flow-drift` passed after `npm run
  build-plugin-runtime` regenerated the compiled host runtime mirrors.

Decision:

- Pursue now owns one plain `FlowData` value in `src/flows/pursue/data.ts`.
- The public Pursue flow mirrors stayed unchanged, and no command or Codex
  skill command surface was introduced.
- `src/flows/pursue/facts.ts` remains temporarily to keep the existing
  generated schematic parity probe alive until duplicate fact surfaces are
  retired in Slice 1.9.

### Slice 1.6 - Migrate Build

Status: done

Objective: migrate the checkpoint-heavy Build Flow without changing checkpoint
resume or report compatibility.

Source evidence:

- `src/flows/build/facts.ts` owns the Build schematic, checkpoint paths,
  checkpoint policy, progress text, primary result, canonical stage policy, and
  `bindsExecutionDepthToRelaySelection` engine flag.
- `src/flows/build/flow.ts` binds those facts to routing signals, relay shape
  hints, report schemas, checkpoint/compose/verification/close writers, and the
  public command and contract paths.
- `tests/runner/cli-runtime.test.ts` has a checkpoint resume regression proving
  the saved run-folder marker continues to control Build resume.

Checklist:

- [x] Migrate Build reports and checkpoint writer bindings.
- [x] Migrate the checkpoint Step.
- [x] Migrate remaining Build Steps and engine flags.
- [x] Prove Build checkpoint waiting and resume behavior.

Intended tests:

- Red/green: `npm run test -- tests/runner/flow-facts.test.ts`
- Checkpoint/package characterization: `npm run test --
  tests/runner/flow-definition-compiler.test.ts`
- Checkpoint resume proof: `npm run test -- tests/runner/cli-runtime.test.ts -t
  "keeps Build checkpoint resume on the saved run-folder marker"`
- Type and lint proof: `npm run check`, `npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: restore Build's facts adapter.

Evidence:

- Characterization: `npm run test --
  tests/runner/flow-definition-compiler.test.ts` passed with 16 tests after
  adding the Build checkpoint writer/path/engine-flag assertion.
- Red: `npm run test -- tests/runner/flow-facts.test.ts` failed because
  `src/flows/build/data.ts` did not exist for a migrated Flow.
- Green: `npm run test -- tests/runner/flow-facts.test.ts` passed with 4
  tests after Build moved to `defineFlowData(buildFlowData)`.
- Compiler proof: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
  passed with 16 tests.
- Checkpoint resume proof: `npm run test -- tests/runner/cli-runtime.test.ts -t
  "keeps Build checkpoint resume on the saved run-folder marker"` passed.
- Type proof: `npm run check` passed.
- Lint proof: `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` passed after `npm run
  build-plugin-runtime` regenerated the compiled host runtime mirrors.

Decision:

- Build now owns one plain `FlowData` value in `src/flows/build/data.ts`.
- The checkpoint report schema, checkpoint request and response paths, safe
  choices, command/contract paths, and `bindsExecutionDepthToRelaySelection`
  engine flag stayed load-bearing and unchanged.
- `src/flows/build/facts.ts` remains temporarily to keep the existing generated
  schematic parity probe alive until duplicate fact surfaces are retired in
  Slice 1.9.

### Slice 1.7 - Migrate Explore

Status: done

Objective: migrate Explore including tournament, fanout, and checkpoint paths.

Source evidence:

- `src/flows/explore/facts.ts` owns Explore schematic data, five entry modes,
  tournament route overrides, fanout configuration, tradeoff checkpoint paths,
  report registrations, writer bindings, progress text, and primary result.
- `src/flows/explore/flow.ts` currently binds those facts to default routing,
  relay shape hints, Zod report schemas, compose/close writers, and public
  command/contract paths.
- `tests/runner/flow-definition-compiler.test.ts` already checks generated
  manifest parity for both `generated/flows/explore/circuit.json` and
  `generated/flows/explore/tournament.json` through the planned manifest helper.

Checklist:

- [x] Migrate the circuit path.
- [x] Migrate the tournament path.
- [x] Prove circuit and tournament manifest parity.

Intended tests:

- Red/green: `npm run test -- tests/runner/flow-facts.test.ts`
- Compiler and multi-mode manifest parity: `npm run test --
  tests/runner/flow-definition-compiler.test.ts`
- Type and lint proof: `npm run check`, `npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: restore Explore's facts adapter.

Evidence:

- Red: `npm run test -- tests/runner/flow-facts.test.ts` failed because
  `src/flows/explore/data.ts` did not exist for a migrated Flow.
- Green: `npm run test -- tests/runner/flow-facts.test.ts` passed with 4
  tests after Explore moved to `defineFlowData(exploreFlowData)`.
- Compiler and multi-mode manifest proof: `npm run test --
  tests/runner/flow-definition-compiler.test.ts` passed with 16 tests.
- Type proof: `npm run check` passed.
- Lint proof: `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` passed after `npm run
  build-plugin-runtime` regenerated the compiled host runtime mirrors.

Decision:

- Explore now owns one plain `FlowData` value in `src/flows/explore/data.ts`.
- The normal compiled manifest, tournament compiled manifest, public command
  mirrors, fanout configuration, and tradeoff checkpoint paths stayed stable.
- `src/flows/explore/facts.ts` remains temporarily to keep the existing
  generated schematic parity probe alive until duplicate fact surfaces are
  retired in Slice 1.9.

### Slice 1.8 - Migrate Fix

Status: done

Objective: migrate the largest Flow last, including Lite route overrides.

Source evidence:

- `src/flows/fix/facts.ts` owns Fix schematic data, Lite mode route override,
  unreachable future-intent steps, verification-chain report paths, primary
  result, canonical stage policy with optional Review, and public command and
  contract paths.
- `src/flows/fix/flow.ts` currently binds those facts to routing signals,
  relay shape hints, Zod report schemas, compose/verification/close writers,
  and all report aliases used by the Fix verification chain.
- `tests/runner/flow-definition-compiler.test.ts` already asserts Fix progress
  has 14 steps and generated manifest parity for both `generated/flows/fix/circuit.json`
  and `generated/flows/fix/lite.json`.

Checklist:

- [x] Migrate Fix reports and aliases.
- [x] Migrate the core path.
- [x] Migrate Lite route overrides.
- [x] Migrate the verification chain.

Intended tests:

- Red/green: `npm run test -- tests/runner/flow-facts.test.ts`
- Compiler and Lite manifest parity: `npm run test --
  tests/runner/flow-definition-compiler.test.ts`
- Type and lint proof: `npm run check`, `npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: restore Fix's facts adapter.

Evidence:

- Red: `npm run test -- tests/runner/flow-facts.test.ts` failed because
  `src/flows/fix/data.ts` did not exist for a migrated Flow.
- Green: `npm run test -- tests/runner/flow-facts.test.ts` passed with 4
  tests after Fix moved to `defineFlowData(fixFlowData)`.
- Compiler and Lite manifest proof: `npm run test --
  tests/runner/flow-definition-compiler.test.ts` passed with 16 tests.
- Type proof: `npm run check` passed.
- Lint proof: `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` passed after `npm run
  build-plugin-runtime` regenerated the compiled host runtime mirrors.

Decision:

- Fix now owns one plain `FlowData` value in `src/flows/fix/data.ts`.
- Report aliases, relay hints, verification-chain writers, optional Review
  policy, unreachable future-intent steps, Lite `route_overrides`, command
  mirrors, and both compiled manifests stayed stable.
- `src/flows/fix/facts.ts` remains temporarily to keep the existing generated
  schematic parity probe alive until duplicate fact surfaces are retired in
  Slice 1.9.

### Slice 1.9 - Retire duplicate fact surfaces

Status: done

Objective: remove old duplicate authoring paths only after all Flows migrate.

Checklist:

- [x] Replace facts-owned tests with value-owned tests.
- [x] Update generated-surface docs.
- [x] Remove old compatibility adapters.
- [x] Run Program 1 milestone verification.

Rollback point: adapter removal must be isolated in its own final change.

Evidence:

- Red: `npm run test -- tests/runner/flow-facts.test.ts` failed because
  retained flows still had old `facts.ts` authoring files.
- Green focused tests:
  `npm run test -- tests/runner/flow-facts.test.ts` passed with 3 tests, and
  `npm run test -- tests/runner/flow-definition-compiler.test.ts` passed with
  14 tests after the old adapter tests were retired.
- Generated-source proof: `npm run emit-flows` regenerated
  `docs/generated-surfaces.md`, schematics, generated manifests, command
  mirrors, and plugin runtime mirrors from `data.ts` sources.
- Contract proof:
  `npm run test -- tests/contracts/catalog-completeness.test.ts` passed with 20
  tests, and `npm run test -- tests/contracts/engine-flow-boundary.test.ts`
  passed with 4 tests.
- Drift proof: `npm run check-flow-drift` passed and reported every flow
  schematic in sync with `src/flows/<id>/data.ts`.
- Milestone proof: `npm run verify:fast` passed with check, lint, build,
  158 fast test files, eval checks, generated-surface drift, and plugin runtime
  drift.

Decision:

- The old `FlowFact` model, `defineFlowFromFacts` adapter,
  `declarative-flow-facts.ts`, and all built-in `facts.ts` files are retired.
- Retained built-in flows now have one canonical plain value in
  `src/flows/<id>/data.ts`, and `src/flows/<id>/flow.ts` is a thin
  `defineFlowData` adapter.

## Program 2 - Blocks Simplify Authoring

### Slice 2.1 - Add Block authoring policy

Status: done

Objective: extend Block definitions with conservative authoring defaults and
explicit-required fields.

Source evidence:

- `src/schemas/flow-block-definitions.ts` already owns reusable Block facts and
  `schematicPolicy` for legal execution kinds and stages.
- `src/schemas/flow-schematic.ts` validates Schematic Steps against Block
  outputs, evidence, execution kind, stage, routes, and input contracts.
- `tests/contracts/flow-block-catalog.test.ts` already ratchets the generated
  Block catalog and is the narrowest proof surface for new Block metadata.

Target state:

- Every Block definition carries an authoring policy.
- The policy derives only obvious defaults: Block evidence requirements, Block
  output contract, and a single execution kind when the Block has exactly one.
- Step identity, title, stage, inputs, routes, protocol, writes, checks, and
  special execution details stay explicit.
- `docs/flows/block-catalog.json` remains unchanged because the policy is an
  authoring-only source, not a generated compatibility surface.

Checklist:

- [x] Add policy types.
- [x] Populate all Blocks conservatively.
- [x] Add catalog tests.
- [x] Prove no Schematic output changes.

Intended tests:

- Red/green: `npm run test -- tests/contracts/flow-block-catalog.test.ts`
- Drift: `npm run check-flow-drift`

Rollback point: remove the unused policy field.

Evidence:

- Red: `npm run test -- tests/contracts/flow-block-catalog.test.ts` failed
  because `FLOW_BLOCK_AUTHORING_POLICY` was undefined.
- Green: `npm run test -- tests/contracts/flow-block-catalog.test.ts` passed
  with 11 tests after every Block definition received conservative authoring
  policy.
- Drift proof: the first `npm run check-flow-drift` confirmed generated
  schematics and `docs/flows/block-catalog.json` stayed in sync but flagged
  compiled host runtime mirror drift after the TypeScript build.
- Generated runtime repair: `npm run build-plugin-runtime` regenerated the
  compiled host runtime mirrors.
- Final drift proof: `npm run check-flow-drift` passed with block catalog,
  schematics, generated manifests, source map, and plugin runtime mirrors in
  sync.

Decision:

- Block authoring policy is authoring-only metadata in
  `src/schemas/flow-block-definitions.ts`.
- The generated Block catalog still strips authoring-only fields, preserving
  current generated surface rules.
- Policy defaults are deliberately narrow: evidence requirements and output
  derive from the Block, and execution kind derives only for single-kind Blocks.

### Slice 2.2 - Add pure Block expansion

Status: done

Objective: add pure Block-use to full-Schematic Step expansion.

Source evidence:

- `src/schemas/flow-schematic.ts` defines the compatibility `SchematicStep`
  shape and defaults `route_overrides` and `skill_slots`.
- `src/schemas/flow-block-definitions.ts` now exposes Block authoring policy as
  authoring-only metadata.
- Existing active flows still author full Schematic Steps inside
  `src/flows/<id>/data.ts`, so the expansion helper can remain unused until
  parity is proven.

Target state:

- A pure helper expands a plain Block Step use to a full `SchematicStep`.
- The helper covers compose, relay, verification, and checkpoint shapes.
- The helper is not wired into built-in flows in this slice.

Checklist:

- [x] Add expansion tests for compose, relay, verification, and checkpoint.
- [x] Keep expansion unused until parity is proven.
- [x] Prove active Schematics remain complete.

Intended tests:

- Red/green: `npm run test -- tests/runner/block-step-expansion.test.ts`
- Compatibility proof: `npm run test -- tests/contracts/flow-schematic.test.ts`
- Drift: `npm run check-flow-drift`

Rollback point: keep expansion code unused and removable.

Evidence:

- Red: `npm run test -- tests/runner/block-step-expansion.test.ts` failed
  because `src/flows/block-step-expansion.ts` did not exist.
- Green: `npm run test -- tests/runner/block-step-expansion.test.ts` passed
  with 5 tests after adding the pure expansion helper.
- Compatibility proof:
  `npm run test -- tests/contracts/flow-schematic.test.ts` passed with 41
  tests.
- Drift proof: `npm run check-flow-drift` passed with schematics, generated
  manifests, source map, and plugin runtime mirrors in sync.

Decision:

- `expandBlockStepUseValue(...)` returns typed errors; `expandBlockStepUse(...)`
  is the throwing compatibility adapter.
- The helper maps authoring names such as `evidenceRequirements`,
  `checkpointPolicy`, `routeOverrides`, and `skillSlots` to the current
  Schematic Step shape.
- No built-in Flow uses the helper yet.

### Slice 2.3 - Derive unambiguous Block-owned fields

Status: done

Objective: derive evidence, output, execution, writes, and check only when the
Block policy makes them unambiguous.

Source evidence:

- `src/flows/block-step-expansion.ts` is currently unused and expands explicit
  Block Step uses through the existing `SchematicStep` parser.
- `src/schemas/flow-block-definitions.ts` now declares conservative authoring
  defaults: Block evidence requirements, Block output contract, and a single
  execution kind only when unambiguous.
- `src/schemas/flow-schematic.ts` already validates execution-specific
  `writes` and `check` shapes.

Target state:

- The expansion helper can omit evidence requirements and output when the Block
  owns those values.
- The helper can omit execution only for single-kind Blocks.
- The helper can derive compose, relay, verification, and checkpoint `writes`
  and `check` from explicit report/path/result lists.
- Ambiguous execution remains an error, not an inference.

Checklist:

- [x] Derive evidence requirements.
- [x] Derive execution only for single-kind policies.
- [x] Keep route targets, route overrides, relay role, report paths,
  checkpoint choices, and fanout details explicit.

Intended tests:

- Red/green: `npm run test -- tests/runner/block-step-expansion.test.ts`
- Drift: `npm run check-flow-drift`

Rollback point: mark ambiguous derivations explicit.

Evidence:

- Red: `npm run test -- tests/runner/block-step-expansion.test.ts` failed on
  omitted evidence/output/execution and shorthand path/check fields, then failed
  type checking until the invalid-error assertion narrowed the error variant.
- Green: `npm run test -- tests/runner/block-step-expansion.test.ts` passed
  with 8 tests.
- Type proof: `npm run check` passed.
- Drift proof: `npm run check-flow-drift` passed with generated surfaces and
  plugin runtime mirrors in sync.

Decision:

- Block Step expansion derives Block evidence requirements and output contract.
- Execution derives only when Block policy has one legal execution kind; Blocks
  such as `plan` still require explicit execution.
- Writes and check derive only from explicit path/result/check lists, preserving
  route targets, route overrides, relay roles, checkpoint choices, and fanout
  metadata as authored decisions.

### Slice 2.4 - Migrate compose and close Blocks

Status: done

Objective: migrate the lowest-risk Block uses first.

Source evidence:

- `src/flows/review/data.ts` has compose-style `intake-step` and
  close-style `verdict-step`.
- `src/flows/pursue/data.ts` has compose-style `contract-step`, `graph-step`,
  `wave-plan-step`, and close-style `close-step`.
- `src/flows/build/data.ts` has close-style `close-step`.
- `src/flows/fix/data.ts` has close-style `fix-close-lite` and `fix-close`.
- `tests/runner/flow-definition-compiler.test.ts` already checks catalog
  definitions, packages, and generated manifests for parity.

Target state:

- The targeted compose and close steps use `expandBlockStepUse(...)`.
- Block-owned evidence/output and path/check shorthand replace repeated
  Schematic fields.
- Generated schematics and compiled manifests stay byte-for-byte equivalent.

Checklist:

- [x] Migrate Review compose/close.
- [x] Migrate Pursue compose/close.
- [x] Migrate Build and Fix close.

Intended tests:

- Red/green: `npm run test -- tests/runner/block-authoring-migration.test.ts`
- Parity: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- Drift: `npm run check-flow-drift`

Rollback point: restore explicit Step fields for the affected Flow.

Evidence:

- Red: `npm run test -- tests/runner/block-authoring-migration.test.ts`
  failed because Review had no `expandBlockStepUse(...)` migrated steps.
- Green source ratchet:
  `npm run test -- tests/runner/block-authoring-migration.test.ts` passed with
  the Slice 2.4 target steps migrated.
- Parity proof:
  `npm run test -- tests/runner/flow-definition-compiler.test.ts` passed with
  14 tests, proving definitions, packages, schematics, and generated manifests
  stayed equivalent.
- Wider checks caught cleanup: `npm run check` first failed on a readonly-array
  assertion type, and `npm run lint` first failed on import order/formatting.
  Both were fixed.
- Type/lint proof: `npm run check` and `npm run lint` passed.
- Generated runtime repair: `npm run build-plugin-runtime` regenerated compiled
  host runtime mirrors after TypeScript source changes.
- Drift proof: `npm run check-flow-drift` passed with all generated surfaces and
  plugin runtime mirrors in sync.

Decision:

- Migrated steps use `expandBlockStepUse(...)` only where the slice named them.
- Flow-specific outputs and evidence remain explicit when they differ from the
  Block default.
- Repeated report path/check shapes moved to the compact path/check fields.

### Slice 2.5 - Migrate verification Blocks

Status: done

Objective: simplify verification authoring while preserving proof behavior.

Source evidence:

- `src/flows/build/data.ts` has Build `verify-step` as a
  `run-verification` Block.
- `src/flows/pursue/data.ts` has Pursue `verify-step` as a
  `run-verification` Block.
- `src/flows/fix/data.ts` has the Fix verification chain:
  `fix-regression-baseline`, `fix-baseline-snapshot`, `fix-verify`,
  `fix-change-set`, and `fix-regression-rerun`.
- `tests/runner/build-runtime-wiring.test.ts`,
  `tests/runner/pursue-runtime-wiring.test.ts`, and Fix writer/runtime tests
  cover proof behavior beyond generated parity.

Target state:

- The named verification steps use `expandBlockStepUse(...)`.
- The Block default supplies evidence and execution kind.
- Output stays explicit when the Flow writes a flow-specific report schema.
- Report paths, required fields, routes, route overrides, and retry targets stay
  explicit.

Checklist:

- [x] Migrate Build verification.
- [x] Migrate Pursue verification.
- [x] Migrate Fix verification chain.

Intended tests:

- Red/green: `npm run test -- tests/runner/block-authoring-migration.test.ts`
- Parity: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- Focused runtime proof:
  `npm run test -- tests/runner/build-runtime-wiring.test.ts tests/runner/pursue-runtime-wiring.test.ts tests/runner/fix-regression-rerun-writer.test.ts`
- Drift: `npm run check-flow-drift`

Rollback point: restore explicit verification metadata.

Evidence:

- Red: `npm run test -- tests/runner/block-authoring-migration.test.ts`
  failed because Build `verify-step` had not migrated.
- Green source ratchet:
  `npm run test -- tests/runner/block-authoring-migration.test.ts` passed with
  the Slice 2.5 verification steps migrated.
- Parity proof:
  `npm run test -- tests/runner/flow-definition-compiler.test.ts` passed with
  14 tests.
- Focused runtime proof:
  `npm run test -- tests/runner/build-runtime-wiring.test.ts tests/runner/pursue-runtime-wiring.test.ts tests/runner/fix-regression-rerun-writer.test.ts`
  passed with 21 tests.
- Type proof: `npm run check` first caught a legacy `route_overrides` spelling
  in a migrated Fix step; after changing it to `routeOverrides`, `npm run check`
  passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift after the TypeScript build; `npm run build-plugin-runtime`
  repaired it, and the next `npm run check-flow-drift` passed.

Decision:

- Verification steps now derive the `run-verification` evidence and
  `verification` execution kind from the Block.
- Flow-specific verification report schemas, report paths, required fields,
  route targets, retry behavior, and Fix Lite route override stay explicit.

### Slice 2.6 - Migrate relay Blocks

Status: done

Objective: simplify relay boilerplate without hiding connector behavior.

Source evidence:

- Review has `audit-step` as reviewer relay.
- Build has `act-step` and `review-step` as implementer/reviewer relays.
- Pursue has `batch-step` and `review-step` as implementer/reviewer relays;
  this slice includes them so no relay island remains.
- Explore has `synthesize-step`, `review-step`, and `stress-proposals-step` as
  relay Steps; the tournament fanout relay template stays for Slice 2.7.
- Fix has `fix-gather-context`, `fix-diagnose`, `fix-act`, and `fix-review` as
  relay Steps. `fix-review` owns the `connector-failed` route that must stay
  explicit.

Target state:

- Relay Steps use `expandBlockStepUse(...)`.
- Relay role, report/request/receipt/result paths, pass outcomes, routes, and
  connector-failed routes stay explicit.
- Block-owned evidence and path/check shape repetition are removed where safe.

Checklist:

- [x] Migrate Review relay.
- [x] Migrate Build relay.
- [x] Migrate Pursue relay.
- [x] Migrate Explore and Fix relay paths.
- [x] Preserve authored `connector-failed` routes.

Intended tests:

- Red/green: `npm run test -- tests/runner/block-authoring-migration.test.ts`
- Parity: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- Focused runtime proof:
  `npm run test -- tests/runner/review-runtime-wiring.test.ts tests/runner/build-runtime-wiring.test.ts tests/runner/pursue-runtime-wiring.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/explore-tournament-runtime.test.ts`
- Drift: `npm run check-flow-drift`

Rollback point: restore explicit relay fields per Flow.

Evidence:

- Red: `npm run test -- tests/runner/block-authoring-migration.test.ts`
  failed because Review `audit-step` had not migrated.
- Green source ratchet:
  `npm run test -- tests/runner/block-authoring-migration.test.ts` passed with
  the Slice 2.6 relay steps migrated.
- Parity proof:
  `npm run test -- tests/runner/flow-definition-compiler.test.ts` passed with
  14 tests.
- Focused runtime proof:
  `npm run test -- tests/runner/review-runtime-wiring.test.ts tests/runner/build-runtime-wiring.test.ts tests/runner/pursue-runtime-wiring.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/explore-tournament-runtime.test.ts`
  passed with 36 tests.
- Type/lint proof: `npm run check` and `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift after the TypeScript build; `npm run build-plugin-runtime`
  repaired it, and the next `npm run check-flow-drift` passed.

Decision:

- Relay Steps now use compact report/request/receipt/result path fields and
  explicit pass outcomes.
- Relay role remains explicit.
- The authored `connector-failed` route on Fix review is preserved.
- Pursue relay was migrated in this slice to avoid a leftover relay-only
  authoring island.

### Slice 2.7 - Migrate checkpoint, fanout, and special Blocks

Status: done

Objective: migrate high-risk Block uses last.

Source evidence:

- Build `frame-step` is a checkpoint that writes the Build brief and pause
  request/response files.
- Fix `fix-no-repro-decision` is the uncertainty checkpoint before acting.
- Explore `proposal-fanout-step` is the decision tournament fanout.
- Explore `tradeoff-checkpoint-step` is the tournament human decision.

Target state:

- These high-risk Steps use `expandBlockStepUse(...)`.
- Checkpoint choices, checkpoint policies, fanout branch metadata, paths, and
  routes stay explicit.
- Existing checkpoint resume and tournament behavior stay unchanged.

Checklist:

- [x] Migrate Build checkpoint.
- [x] Migrate Fix checkpoint.
- [x] Migrate Explore tournament fanout/checkpoint.

Intended tests:

- Red/green: `npm run test -- tests/runner/block-authoring-migration.test.ts`
- Parity: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- Focused runtime proof:
  `npm run test -- tests/runner/build-checkpoint-exec.test.ts tests/runtime/checkpoint-resume.test.ts tests/runner/explore-tournament-runtime.test.ts`
- Drift: `npm run check-flow-drift`

Rollback point: keep special Block authoring explicit.

Evidence:

- Red: `npm run test -- tests/runner/block-authoring-migration.test.ts`
  failed because Build `frame-step` had not migrated.
- Green source ratchet:
  `npm run test -- tests/runner/block-authoring-migration.test.ts` passed with
  the Slice 2.7 checkpoint, fanout, and special Steps migrated.
- Parity proof:
  `npm run test -- tests/runner/flow-definition-compiler.test.ts` passed with
  14 tests.
- Focused runtime proof:
  `npm run test -- tests/runner/build-checkpoint-exec.test.ts tests/runtime/checkpoint-resume.test.ts tests/runner/explore-tournament-runtime.test.ts`
  passed with 36 tests.
- Type/lint proof: `npm run check` and `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift after the TypeScript build; `npm run build-plugin-runtime`
  repaired it, and the next `npm run check-flow-drift` passed.

Decision:

- Build and Fix checkpoint policies remain explicit.
- Explore fanout branch metadata remains explicit.
- The helper now carries checkpoint and fanout path/check shorthand without
  hiding choices, branch policy, or route semantics.

### Slice 2.8 - Tighten validation around the new authoring model

Status: done

Objective: prevent backsliding into freeform Schematic authoring.

Source evidence:

- `src/flows/block-step-expansion.ts` now centralizes Block Step expansion.
- Migrated built-in Flow data uses `output`, `evidenceRequirements`, or
  explicit `execution` only when those values differ from the Block-owned
  default or the execution kind is ambiguous.
- `tests/runner/flow-definition-compiler.test.ts` proves generated Schematics
  remain full compatibility outputs after authoring compression.

Target state:

- Block-owned defaults are override-only in compressed authoring.
- Restating default output, default evidence requirements, or default
  single-kind execution is rejected by the helper.
- Generated Schematics still contain full output/evidence/execution/write/check
  fields.

Checklist:

- [x] Add override-only syntax.
- [x] Reject restated Block-owned defaults after migrations.
- [x] Keep generated Schematics complete compatibility outputs.

Intended tests:

- Red/green: `npm run test -- tests/runner/block-step-expansion.test.ts tests/runner/block-authoring-migration.test.ts`
- Parity: `npm run test -- tests/runner/flow-definition-compiler.test.ts`
- Program milestone: `npm run verify:fast`

Rollback point: ship warnings before errors for one transition slice.

Evidence:

- Red: `npm run test -- tests/runner/block-step-expansion.test.ts tests/runner/block-authoring-migration.test.ts`
  failed because restated Block defaults still passed.
- Green focused proof:
  `npm run test -- tests/runner/block-step-expansion.test.ts tests/runner/block-authoring-migration.test.ts`
  passed with 14 tests after override-only validation landed.
- Parity proof:
  `npm run test -- tests/runner/flow-definition-compiler.test.ts` passed with
  14 tests.
- Type/lint/drift proof: `npm run check`, `npm run lint`, and
  `npm run check-flow-drift` passed after regenerating plugin runtime mirrors
  when needed.
- Milestone proof: first `npm run verify:fast` failed because
  `block-step-expansion.ts` was an unclassified shared flow-root file. After
  adding it to the catalog completeness allowlist,
  `npm run test -- tests/contracts/catalog-completeness.test.ts`,
  `npm run check`, and `npm run lint` passed. The second
  `npm run verify:fast` passed with check, lint, build, 160 fast test files,
  eval checks, generated-surface drift, and plugin runtime drift.

Decision:

- `output`, `evidenceRequirements`, and single-kind `execution` are now
  override-only in compressed Block Step authoring.
- Generated Schematic values remain complete compatibility outputs with
  output, evidence, execution, writes, and check fields populated.

## Program 3 - Runtime Values Separate From Places And Effects

### Slice 3.1 - Introduce Run values and Run ports

Status: done

Objective: add value/port wrappers without behavior changes.

Source evidence:

- `src/runtime/run/run-context.ts` currently defines `RunContext` as the
  compatibility shape that carries run identity, concrete run folder path,
  clock, `RunFileStore`, `TraceStore`, relay, selection config, child-run, and
  worktree capabilities together.
- `src/runtime/run/graph-runner.ts` constructs fresh/resume run directories,
  `TraceStore`, `RunFileStore`, progress projection, runtime package index, and
  the `RunContext` inside the graph loop boundary.
- `src/runtime/run/capabilities.ts` lists adapter-provided execution
  capabilities, including clock, connector, child-run, worktree, selection, and
  progress hooks.
- `tests/contracts/runtime-context-boundary.test.ts` is the existing boundary
  test for runtime context shape drift.

Target state:

- A Run value names the pure run identity and flow execution facts.
- Run ports name the effectful boundaries: clock, trace log, run files, run
  directory, progress, connector, child run, worktree, and selection.
- Existing `RunContext` remains available unchanged as the temporary
  compatibility shape.

Checklist:

- [x] Add clock, trace log, run files, run directory, progress, connector,
  child run, worktree, and selection ports.
- [x] Keep existing `RunContext` as a temporary compatibility shape.
- [x] Prove compile and boundary tests.

Intended tests:

- Red/green: `npm run test -- tests/contracts/runtime-context-boundary.test.ts`
- Type proof: `npm run check`

Rollback point: remove unused wrappers.

Evidence:

- Red: `npm run test -- tests/contracts/runtime-context-boundary.test.ts`
  failed because `src/runtime/run/run-values.ts` did not exist.
- Green focused proof:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts` passed with
  2 tests after adding `RunValue`, named Run ports, and compatibility
  projections from existing `RunContext`.
- Type/lint proof: `npm run check` and `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` passed, including generated Flow
  surfaces and plugin runtime mirrors.

Decision:

- `RunContext` remains the runtime executor compatibility shape.
- `RunValue` excludes concrete places/effects such as `runDir`, `files`,
  `trace`, and `now`.
- Run ports now name the effect boundaries that later slices can move behind:
  clock, trace log, run files, run directory, progress, connector, child run,
  worktree, and selection.

### Slice 3.2 - Move run folder and store construction to a boundary

Status: done

Objective: remove concrete filesystem setup from graph walking.

Source evidence:

- `src/runtime/run/graph-runner.ts` currently imports `lstat`, `mkdir`, and
  `readdir`, owns `assertFreshRunDir(...)`, constructs `TraceStore`, constructs
  `RunFileStore`, and wires progress projection directly inside
  `executeExecutableFlowWithWaiting(...)`.
- `tests/runner/fresh-run-root.test.ts` preserves fresh Run folder rejection
  behavior and the exact timing of "reject before writing run bytes".
- `tests/runtime/checkpoint-resume.test.ts` preserves resume behavior, including
  reusing an existing Trace and rejecting invalid resume folders.
- `src/runtime/run/run-values.ts` now names run directory, trace log, run files,
  clock, and progress as Run ports.

Target state:

- Graph walking receives an opened Run boundary instead of constructing concrete
  filesystem stores itself.
- Node filesystem setup, fresh/resume directory checks, progress projection,
  `TraceStore`, and `RunFileStore` construction live in one boundary module.
- `RunContext` still exposes `runDir`, `files`, and `trace` for compatibility,
  with those concrete values supplied by the boundary.

Checklist:

- [x] Move fresh/resume directory checks out of graph runner.
- [x] Inject `TraceStore` and `RunFileStore` through ports.
- [x] Keep error strings identical.

Intended tests:

- Red/green: `npm run test -- tests/contracts/runtime-context-boundary.test.ts`
- Behavior proof:
  `npm run test -- tests/runner/fresh-run-root.test.ts tests/runtime/checkpoint-resume.test.ts`
- Type/lint proof: `npm run check && npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: keep old construction path behind an adapter.

Evidence:

- Red: `npm run test -- tests/contracts/runtime-context-boundary.test.ts`
  failed because `graph-runner.ts` still owned concrete Run folder and store
  construction.
- Green architecture proof:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts` passed with
  3 tests after adding `src/runtime/run/run-boundary.ts` and having
  `graph-runner.ts` call `openRunBoundary(...)`.
- Behavior proof:
  `npm run test -- tests/runner/fresh-run-root.test.ts tests/runtime/checkpoint-resume.test.ts`
  passed with 18 tests, preserving fresh Run folder and checkpoint resume
  behavior.
- Type/lint proof: `npm run check` first caught an implicit `ref` type in the
  new boundary adapter; after typing it as `RunFileRef | string`,
  `npm run check` and `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift. `npm run build-plugin-runtime` regenerated the approved runtime
  outputs, and the next `npm run check-flow-drift` passed.

Decision:

- Node filesystem setup, progress projection, `TraceStore`, and `RunFileStore`
  construction now live in `run-boundary.ts`.
- `graph-runner.ts` keeps graph advancement, trace event decisions, and terminal
  closure, while receiving concrete Run stores from the opened boundary.
- `RunContext` still carries `runDir`, `files`, and `trace` for executor
  compatibility.

### Slice 3.3 - Return typed graph outcomes

Status: done

Objective: make expected runtime outcomes values instead of thrown control flow.

Source evidence:

- `src/runtime/run/graph-runner.ts` currently returns closed Run results and
  checkpoint-waiting results, but setup/validation failures still leave through
  throws.
- `executeExecutableFlow(...)` currently throws when the waiting-aware path
  pauses at a Checkpoint, preserving the older checkpoint-unaware contract.
- `src/cli/circuit.ts` and `src/runtime/run/compiled-flow-runner.ts` call the
  compatibility runner functions, so public CLI stdout/stderr can stay
  unchanged while the core gains typed outcome values.
- `tests/runner/terminal-outcome-mapping.test.ts`, runtime wiring tests, and
  checkpoint tests preserve closed, aborted, and waiting behavior.

Target state:

- A new graph outcome union represents closed Runs, Checkpoint waiting, and
  rejected runtime setup/validation outcomes as values.
- Existing `executeExecutableFlowWithWaiting(...)` and
  `executeExecutableFlow(...)` keep their public return/throw behavior by
  adapting typed outcomes.
- CLI and host contracts continue to see the same stdout, stderr, result, and
  error text.

Checklist:

- [x] Add typed graph result union.
- [x] Convert complete, aborted, checkpoint waiting, and rejected outcomes.
- [x] Keep CLI stdout/stderr unchanged.

Intended tests:

- Red/green: `npm run test -- tests/runtime/graph-outcome.test.ts`
- Compatibility proof:
  `npm run test -- tests/runner/terminal-outcome-mapping.test.ts tests/runtime/checkpoint-resume.test.ts tests/runner/fresh-run-root.test.ts`
- Type/lint proof: `npm run check && npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: adapter rethrows typed rejected values.

Evidence:

- Red: `npm run test -- tests/runtime/graph-outcome.test.ts` failed because
  `executeExecutableFlowOutcome(...)` did not exist.
- Green focused proof:
  `npm run test -- tests/runtime/graph-outcome.test.ts` passed with 3 tests,
  covering complete closed Runs, aborted closed Runs, Checkpoint waiting, and
  rejected fresh-folder setup as typed values.
- Compatibility proof:
  `npm run test -- tests/runner/terminal-outcome-mapping.test.ts tests/runtime/checkpoint-resume.test.ts tests/runner/fresh-run-root.test.ts`
  passed with 30 tests, preserving terminal mapping, resume behavior, and fresh
  Run folder rejection.
- Type/lint proof: `npm run check` passed. `npm run lint` first required
  formatting in the new test, then passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift. `npm run build-plugin-runtime` regenerated approved runtime
  outputs, and the next `npm run check-flow-drift` passed.

Decision:

- `executeExecutableFlowOutcome(...)` is the typed graph outcome seam.
- `executeExecutableFlowWithWaiting(...)` and `executeExecutableFlow(...)`
  remain compatibility adapters and still throw rejected outcomes or
  checkpoint-waiting misuse with the prior messages.
- Closed Run results remain public-contract-compatible; the typed `closed`
  wrapper is not written to `result.json`.

### Slice 3.4 - Convert checkpoint resume validation to values

Status: done

Objective: preserve resume safety while removing expected validation throws from
core resume logic.

Checklist:

- [x] Add `CheckpointResumeResult`.
- [x] Convert one validation cluster at a time.
- [x] Preserve message constants and hash/path validation.

Rollback point: typed result wrapper rethrows.

Evidence:

- Red: `npm run test -- tests/runtime/checkpoint-resume.test.ts` failed
  because `resumeCompiledFlowResult(...)` did not exist.
- Green focused proof:
  `npm run test -- tests/runtime/checkpoint-resume.test.ts` passed with 15
  tests, including typed rejection for invalid Checkpoint selection and
  compatibility rethrow with the same message.
- Resume behavior proof:
  `npm run test -- tests/runner/fresh-run-root.test.ts tests/runtime/checkpoint-resume.test.ts tests/runner/explore-tournament-runtime.test.ts`
  passed with 22 tests.
- Type/lint proof: `npm run check` passed. `npm run lint` first required
  formatting in `checkpoint-resume.ts`, then passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift. `npm run build-plugin-runtime` regenerated approved runtime
  outputs, and the next `npm run check-flow-drift` passed.

Decision:

- `resumeCompiledFlowResult(...)` now returns `resumed` or `rejected`
  Checkpoint resume values.
- `resumeCompiledFlow(...)` remains the public compatibility adapter and throws
  rejected values with preserved messages.
- Checkpoint request hash/path/choice validation now returns values through the
  resume core, while unexpected file/schema errors are normalized to rejected
  values and rethrown by the adapter.

### Slice 3.5 - Convert compose, verification, and checkpoint executors

Status: done

Objective: move low-to-medium risk executors onto ports and typed expected
failures.

Source evidence:

- `src/runtime/executors/compose.ts` currently imports `readFileSync` directly
  for report reads even though `RunContext.files` is the Run file boundary.
- `src/runtime/executors/verification.ts` currently uses thrown
  `ProofPlanBlockedError` for the expected "missing projectRoot" blocked path,
  then the graph runner converts that throw into an aborted Run.
- `src/runtime/executors/checkpoint.ts` currently imports `readFileSync`
  directly for request/report hashing and throws for expected Checkpoint
  selection failures.
- `src/runtime/executors/index.ts` is the compatibility adapter for the default
  executor registry.

Target state:

- Compose and Checkpoint executor file reads go through the Run files port.
- Compose, Verification, and Checkpoint each expose a typed result function that
  returns either a Step outcome or a failure value.
- Existing `executeCompose(...)`, `executeVerification(...)`, and
  `executeCheckpoint(...)` remain compatibility adapters for the graph runner.

Checklist:

- [x] Convert compose reads.
- [x] Convert verification blocked paths.
- [x] Convert checkpoint waiting/resolved paths.

Intended tests:

- Red/green:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts tests/runtime/executor-result-values.test.ts`
- Behavior proof:
  `npm run test -- tests/runner/build-checkpoint-exec.test.ts tests/runner/build-verification-exec.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts`
- Type/lint proof: `npm run check && npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: executor adapter maps values back to current outcome/throws.

Evidence:

- Red:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts tests/runtime/executor-result-values.test.ts`
  failed because the typed executor result functions did not exist and Compose
  still imported `node:fs`.
- Green focused proof:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts tests/runtime/executor-result-values.test.ts`
  passed with 6 tests after adding `StepExecutionResult`, result-returning
  Compose/Verification/Checkpoint functions, and compatibility adapters.
- Behavior proof:
  `npm run test -- tests/runner/build-checkpoint-exec.test.ts tests/runner/build-verification-exec.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts`
  passed with 37 tests.
- Type/lint proof: first `npm run check` caught an insufficient Step outcome
  narrowing in the new test, and first `npm run lint` required import/format
  cleanup. After fixing both, `npm run check` and `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift. `npm run build-plugin-runtime` regenerated approved runtime
  outputs, and the next `npm run check-flow-drift` passed.

Decision:

- `RunFileStore` now exposes `readText(...)`, and Run file ports carry it.
- Compose report reads now use `context.files.readJson(...)` instead of direct
  filesystem reads.
- Verification and Checkpoint expected blocked/failure paths can now be returned
  as values while the existing executor functions still throw through adapters.

### Slice 3.6 - Convert relay, fanout, sub-run, and projections

Status: done

Objective: move high-effect executors and projections behind ports.

Source evidence:

- `src/runtime/executors/relay.ts` manually creates directories and writes the
  relay request even though request/receipt/result are Run files.
- `src/runtime/fanout/branch-execution.ts` manually writes branch request and
  receipt files and reads child result files during fanout branch execution.
- `src/runtime/executors/sub-run.ts` manually copies the child result into the
  parent Run folder.
- `src/runtime/projections/progress.ts` and
  `src/runtime/projections/tournament-checkpoint-context.ts` read Run files
  directly while projecting progress/checkpoint presentation.

Target state:

- Relay, fanout, and sub-run expose typed result functions with compatibility
  adapters.
- Run-owned relay, fanout, and parent sub-run files go through `RunFileStore`.
- Progress and tournament checkpoint projection read through injected file
  readers supplied by the Run boundary/projection caller.

Checklist:

- [x] Convert relay file writes.
- [x] Convert fanout branch expansion.
- [x] Convert sub-run parent/child files.
- [x] Convert progress and tournament projections.

Intended tests:

- Red/green: `npm run test -- tests/contracts/runtime-context-boundary.test.ts`
- Behavior proof:
  `npm run test -- tests/runner/relay-invocation-failure.test.ts tests/runner/explore-tournament-runtime.test.ts tests/runner/sub-run-runtime.test.ts tests/runtime/progress-projection.test.ts tests/runner/fanout-branch-template.test.ts`
- Type/lint proof: `npm run check && npm run lint`
- Drift proof: `npm run check-flow-drift`

Rollback point: keep per-executor adapters until each executor is fully ported.

Evidence:

- Red: `npm run test -- tests/contracts/runtime-context-boundary.test.ts`
  failed because Relay, Fanout, and Sub-run lacked typed result functions and
  high-effect surfaces still used direct filesystem writes/reads.
- Green boundary proof:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts` passed with
  5 tests after adding result adapters and projection readers.
- Behavior proof:
  `npm run test -- tests/runner/relay-invocation-failure.test.ts tests/runner/explore-tournament-runtime.test.ts tests/runner/sub-run-runtime.test.ts tests/runtime/progress-projection.test.ts tests/runner/fanout-branch-template.test.ts`
  first caught a syntax error in `progress.ts`; after fixing the reader object,
  it passed with 12 tests.
- Type/lint proof: `npm run check` passed. `npm run lint` first required
  formatting in `sub-run.ts`, then passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift. `npm run build-plugin-runtime` regenerated approved runtime
  outputs, and the next `npm run check-flow-drift` passed.

Decision:

- Relay request writes now use `context.files.writeText(...)`.
- Fanout branch request/receipt writes now use `context.files`.
- Parent Sub-run result copies now use `context.files.writeText(...)`.
- Progress and tournament Checkpoint projection now read through injected
  readers; filesystem access lives at the run/projection boundary.

### Slice 3.7 - Enforce runtime boundary tests and remove temporary adapters

Status: done

Objective: make the simpler runtime shape permanent.

Source evidence:

- `tests/contracts/runtime-context-boundary.test.ts` now forbids graph-runner
  filesystem/store construction and checks low-risk and high-effect executor
  result adapters.
- Public runtime entry functions such as `executeExecutableFlowWithWaiting(...)`,
  `executeExecutableFlow(...)`, `resumeCompiledFlow(...)`, and default executor
  functions are imported by CLI/runtime tests and preserve current contracts.
- The result-returning functions are the new value seams; the public adapters
  are load-bearing compatibility contracts, not removable internal residue.

Target state:

- Boundary tests make the simpler runtime shape durable.
- No internal temporary adapter remains that can be removed without breaking
  current public contracts.
- Program 3 passes the milestone verification check.

Checklist:

- [x] Add boundary tests forbidding filesystem imports in graph runner.
- [x] Add boundary tests forbidding concrete store construction in graph runner.
- [x] Classify compatibility adapters and remove only non-load-bearing residue.
- [x] Run Program 3 milestone verification.

Intended tests:

- Boundary proof: `npm run test -- tests/contracts/runtime-context-boundary.test.ts`
- Residue search:
  `rg "new TraceStore|new RunFileStore|from 'node:fs/promises'|from 'node:fs'" src/runtime/run/graph-runner.ts src/runtime/executors src/runtime/projections`
- Program milestone: `npm run verify:fast`

Rollback point: adapter removal is the final isolated runtime cleanup.

Evidence:

- Boundary proof:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts` passed with
  5 tests.
- Residue search:
  `rg "new TraceStore|new RunFileStore|from 'node:fs/promises'|from 'node:fs'" src/runtime/run/graph-runner.ts src/runtime/executors src/runtime/projections`
  first found direct Sub-run child-result file reads. Added
  `src/runtime/run/external-files.ts` as the external child-result reader port,
  moved Sub-run and fanout branch child-result reads behind it, then the same
  search returned no matches.
- Adapter classification:
  `rg "executeExecutableFlowWithWaiting|executeExecutableFlow\\(|resumeCompiledFlow\\(|executeCompose\\(|executeVerification\\(|executeCheckpoint\\(|executeRelay\\(|executeFanout\\(|executeSubRun\\(" src tests -n`
  showed the compatibility adapters are imported by CLI/runtime tests and
  default executor wiring. They are load-bearing public/internal contracts and
  were retained.
- Behavior proof after the external file reader:
  `npm run test -- tests/runner/relay-invocation-failure.test.ts tests/runner/explore-tournament-runtime.test.ts tests/runner/sub-run-runtime.test.ts tests/runtime/progress-projection.test.ts tests/runner/fanout-branch-template.test.ts`
  passed with 12 tests.
- Type/lint proof: `npm run check` and `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift. `npm run build-plugin-runtime` regenerated approved runtime
  outputs, and the next `npm run check-flow-drift` passed.
- Program milestone proof: `npm run verify:fast` passed with check, lint,
  build, 162 fast test files, eval checks, generated-surface drift, and plugin
  runtime drift.

Decision:

- No non-load-bearing runtime adapter was removed. Public compatibility adapters
  remain because current CLI/runtime tests import them and the Goal requires
  preserving public contracts.
- The permanent runtime boundary is now enforced by
  `tests/contracts/runtime-context-boundary.test.ts`.

## Final Verification and Adversarial Reviews

Status: complete

Objective: prove the full migration against the Goal, resolve every
medium-or-higher finding, then complete only after two consecutive clean
adversarial reviews.

Checklist:

- [x] Run final `npm run verify` after the Program 3 milestone.
- [x] Run adversarial review 1.
- [x] Resolve adversarial review 1 medium finding.
- [x] Re-run final `npm run verify` after the review fix.
- [x] Run clean adversarial review 1.
- [x] Run clean adversarial review 2.

Evidence:

- Initial final proof: `npm run verify` passed with check, lint, build, all 163
  test files, eval checks, generated-surface drift, plugin runtime drift, and
  release infrastructure checks.
- Adversarial review 1 finding, medium: Sub-run and fanout branch execution no
  longer performed direct filesystem reads, but still imported
  `nodeExternalFileReader` as an executor-local fallback. That left concrete
  effect selection inside high-effect execution code instead of the Run boundary.
- Red review test:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts` failed
  after the boundary test started forbidding `nodeExternalFileReader` in
  Sub-run and fanout branch execution.
- Resolution: `src/runtime/run/run-boundary.ts` now owns the
  `nodeExternalFileReader` adapter, `RunContext.externalFiles` is a required
  port, graph/compiled/resume paths thread the port, and Sub-run/fanout branch
  execution read child results only through `context.externalFiles`.
- Focused proof:
  `npm run test -- tests/contracts/runtime-context-boundary.test.ts tests/runtime/runtime-capabilities.test.ts tests/runtime/sub-run.test.ts tests/runtime/fanout.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fanout-branch-template.test.ts tests/runner/sub-run-real-recursion.test.ts tests/runner/fanout-real-recursion.test.ts`
  passed with 51 tests.
- Type/lint proof: `npm run check` and `npm run lint` passed.
- Drift proof: `npm run check-flow-drift` first caught compiled host runtime
  mirror drift. `npm run build-plugin-runtime` regenerated approved runtime
  outputs, and the next `npm run check-flow-drift` passed.
- Milestone proof after the review fix: `npm run verify:fast` passed with check,
  lint, build, 162 fast test files, eval checks, generated-surface drift, and
  plugin runtime drift.
- Final proof after the review fix: `npm run verify` passed with check, lint,
  build, all 163 test files, eval checks, generated-surface drift, plugin
  runtime drift, and release infrastructure checks.
- Clean adversarial review 1: no medium-or-higher findings. Probes confirmed
  no retained `facts.ts` or `declarative-flow-facts.ts` files, no old FlowFact
  source references in authored source/docs, no concrete file/store effects in
  graph runner/executors/projections/fanout branch execution, thin
  `defineFlowData(...)` Flow adapters for all six retained Flows, and
  `expandBlockStepUse(...)` use across migrated Flow data.
- Clean adversarial review 2: no medium-or-higher findings. The same old-fact
  and runtime-effect residue probes returned no matches, `git diff --check`
  passed, and `npm run check-flow-drift` passed with generated surfaces and
  plugin runtime mirrors in sync.

Decision:

- The medium finding was real because a port abstraction with executor-local
  Node fallback still leaves the executor responsible for selecting the concrete
  effect. The boundary now selects the Node adapter; executors consume only the
  required port.
- The implementation is complete under the Goal after two consecutive clean
  adversarial reviews.

## Running Evidence

- 2026-05-18: Created ledger. Worktree was clean before ledger creation.
- 2026-05-18: Completed Slice 1.1 with focused compiler tests, `npm run check`,
  and `npm run check-flow-drift`.
- 2026-05-18: Completed Slice 1.2 with focused compiler tests, `npm run check`,
  `npm run check-flow-drift`, and `npm run lint`.
