# Architecture Simplification Review

Date: 2026-05-15

Status: evidence-backed review, no source changes proposed here.

Goal: find places where the codebase asks a reader to jump through extra
representations, side tables, or prose heuristics before they can answer a
simple product question. In the Rich Hickey sense, this review favors simpler
concepts over merely shorter code. Simple means one thing at a time.

Worktree note: an initial `git status --short --untracked-files=all` before
writing returned no entries. A later check during this review showed other
test-file changes outside this document. This review only adds this document.

## Executive Summary

The strongest simplification opportunity is to make "the flow the runtime
executes" a single concept again. Today the path is:

1. authored schematic JSON;
2. generated compiled flow JSON;
3. normalized executable graph;
4. original compiled step looked up again from runtime context.

That is the clearest avoidable redirection in the codebase. The runtime says it
executes an `ExecutableFlow`, but the production executors still require the
original `CompiledFlow` side channel for real work.

The second strongest opportunity is to make each flow package own its complete
runtime and operator surface. The repo already has the right intent: the flow
catalog is meant to be the source of truth. But several central files still
carry flow-specific side tables: CLI mode support, canonical stage policy,
primary result paths, operator summary projection, and progress copy.

The third strongest opportunity is to stop deriving operator presentation from
English step titles. Step titles should be user-facing copy. Runtime progress
should read structured display metadata from the flow/block model.

None of these changes require weakening the existing flow/runtime boundary.
They mostly deepen it.

## Coverage Ledger

Checked:

- Product intent: `README.md`, `UBIQUITOUS_LANGUAGE.md`,
  `docs/architecture/runtime.md`, `docs/generated-surfaces.md`.
- Flow authoring path: `src/schemas/flow-schematic.ts`,
  `src/flows/compile-schematic-to-flow.ts`, `src/schemas/compiled-flow.ts`,
  `src/runtime/manifest/from-compiled-flow.ts`.
- Runtime execution path: `src/runtime/run/compiled-flow-runner.ts`,
  `src/runtime/run/graph-runner.ts`, `src/runtime/run/run-context.ts`,
  runtime executors.
- Flow package path: `src/flows/types.ts`, `src/flows/catalog.ts`,
  `src/flows/catalog-derivations.ts`, package indexes, selected schematics.
- Operator surface path: `src/runtime/projections/progress.ts`,
  `src/shared/operator-summary-writer.ts`,
  `src/shared/operator-summary/projections.ts`.
- Connector path: `src/connectors/codex.ts`, `src/connectors/claude-code.ts`,
  `src/runtime/connectors/resolver.ts`.
- Guardrail tests: `tests/contracts/engine-flow-boundary.test.ts`,
  `tests/contracts/catalog-completeness.test.ts`,
  `tests/runtime/from-compiled-flow.test.ts`.

Not fully checked:

- Every generated host mirror under `plugins/`.
- Every individual flow writer body.
- Release proof history under `docs/release/proofs/runs/`.
- Performance measurements.

## Working Hypotheses

1. Agent-written code would preserve old layers after new layers were added.
   Confirmed most strongly in the dual `CompiledFlow` / `ExecutableFlow`
   runtime path.
2. Product concepts would exist both as machine data and English strings.
   Confirmed in progress rendering and operator summary code.
3. Large files would not all be bad. Some are deep modules with real policy,
   especially the connectors. The right move is selective extraction, not a
   blanket size reduction pass.

## Finding 1: Runtime Graph Has Two Authorities

Severity: High

Status: Confirmed

Confidence: High

Type: representation split

Main locations:

- `src/runtime/run/compiled-flow-runner.ts`
- `src/runtime/run/run-context.ts`
- runtime executors
- `src/runtime/manifest/from-compiled-flow.ts`
- `src/runtime/manifest/validate-executable-flow.ts`
- `src/schemas/compiled-flow.ts`

Evidence:

- The runtime docs say flow-specific behavior should stay in packages and
  registries, while runtime owns execution mechanics. Adding a flow should not
  add flow-specific engine branches (`docs/architecture/runtime.md:14-18`).
- `runCompiledFlowWithWaiting` parses compiled flow bytes, converts them with
  `fromCompiledFlow`, and then still passes the original `compiledFlow` into
  the graph runner (`src/runtime/run/compiled-flow-runner.ts:80-100`).
- `RunContext` stores both `flow: ExecutableFlow` and
  `compiledFlow?: CompiledFlow` (`src/runtime/run/run-context.ts:20-22`).
- Runtime executors still read package-index metadata while executing an
  `ExecutableFlow`, so the broader dual-authority concern remains even without
  a separate route compatibility wrapper.
- `fromCompiledFlow` builds an `ExecutableFlow` and validates it
  (`src/runtime/manifest/from-compiled-flow.ts:135-176`).
- `validateExecutableFlow` repeats graph checks for step ids, stage ids, entry
  modes, run-file paths, checkpoint choices, and routes
  (`src/runtime/manifest/validate-executable-flow.ts:36-155`).
- `CompiledFlow` already validates route targets and the runtime success route
  key (`src/schemas/compiled-flow.ts:117-130`) plus terminal reachability
  (`src/schemas/compiled-flow.ts:201-278`).
- Production verification immediately returns to the compiled side channel:
  `requireCompiledFlow`, `requireCompiledStep`, and `findVerificationWriter`
  sit together (`src/runtime/executors/verification.ts:218-230`).
- Production relay has the same shape: `executeProductionRelay` calls
  `requireCompiledFlow`, while the public executor has a separate injected
  connector path for tests (`src/runtime/executors/relay.ts:300-312`,
  `src/runtime/executors/relay.ts:542-555`).

Why this matters:

- A reader has to hold four similar ideas at once: schematic step, compiled
  step, executable step, and compiled step recovered by id.
- Runtime tests can accidentally validate the test-only path rather than the
  production path.
- Adding a new step kind or step field can require edits in the schematic
  schema, compiler, compiled schema, executable type, adapter, executable
  validator, executor, and tests.
- The boundary is named as if `ExecutableFlow` is enough, but production work
  proves it is not enough.

Recommendation:

Make one runtime graph authority.

Preferred direction:

1. Promote the fields production executors need onto the runtime step shape:
   title, report schema, report path, prompt metadata, writer descriptor, shape
   hints, route metadata, and any connector-facing fields.
2. Treat generated compiled JSON as the serialized form of that same runtime
   shape, not as a second graph that must be adapted before use.
3. Remove `context.compiledFlow`, `requireCompiledFlow`, and
   `requireCompiledStep` from production executor paths.
4. Keep `fromCompiledFlow` only as a compatibility reader if older generated
   files must be accepted.
5. Delete the duplicated executable validator once the single graph schema is
   the runtime schema.

Behavior-preserving order:

1. Add the missing production fields to `ExecutableStep` while still populating
   them from `fromCompiledFlow`.
2. Move one executor kind at a time off `requireCompiledStep`.
3. Add a contract test that production execution can run without
   `context.compiledFlow`.
4. Remove the side channel after all executor kinds pass.

Expected test impact:

- Update `tests/runtime/from-compiled-flow.test.ts` from "adapter preserves the
  second shape" to "runtime graph has all fields executors need."
- Keep `tests/contracts/engine-flow-boundary.test.ts` intact. The fix should
  deepen the package boundary, not import flow packages from runtime.

## Finding 2: Flow Source Of Truth Leaks Into Central Side Tables

Severity: High

Status: Confirmed

Confidence: High

Type: ownership split

Main locations:

- `src/flows/types.ts`
- `src/flows/catalog.ts`
- `src/cli/circuit.ts`
- `src/shared/flow-kind-policy-core.ts`
- `src/shared/operator-summary-writer.ts`
- `src/shared/operator-summary/projections.ts`
- `src/runtime/projections/progress.ts`

Evidence:

- `CompiledFlowPackage` is explicitly described as the per-flow unit the engine
  consumes, and the comment says the engine derives router, registries, reports,
  and emit output from the catalog (`src/flows/types.ts:1-11`).
- `src/flows/catalog.ts` repeats that the catalog is the engine source of truth
  (`src/flows/catalog.ts:1-6`).
- The runtime docs say adding or changing a flow should update the flow package
  and generated surfaces, not add flow-specific branches to the engine
  (`docs/architecture/runtime.md:14-18`).
- The CLI still has a hard-coded `RUNTIME_SUPPORT_MATRIX` for public flows and
  depths (`src/cli/circuit.ts:64-96`), uses it to validate `--depth`
  (`src/cli/circuit.ts:496-504`), and uses it again to classify runtime support
  (`src/cli/circuit.ts:606-627`).
- Flow-kind policy is another central side table. It defines canonical stage
  sets for `explore`, `review`, `build`, and `fix`
  (`src/shared/flow-kind-policy-core.ts:49-82`), while unknown flow ids pass
  through (`src/shared/flow-kind-policy-core.ts:273-278`).
- Operator summary has a central primary-result side table
  (`src/shared/operator-summary-writer.ts:99-105`) and a separate per-flow
  projector registry (`src/shared/operator-summary/projections.ts:1-6`).

Why this matters:

- The documented add-flow path is not the real full path. A new flow can appear
  in the catalog yet still need CLI support rows, canonical policy rows,
  primary result path wiring, summary projection, progress labels, and generated
  surface checks.
- The code has several "nearly source of truth" places. That is where agent
  code tends to drift.
- Unknown flow pass-through in canonical policy is useful for custom flows, but
  it also means public built-in flows can escape the policy if the central set
  is not updated.

Recommendation:

Add a package-owned runtime surface contract. It should be derived from the
flow package plus its schematic during build/emit, then consumed by the CLI and
operator surfaces.

Candidate shape:

```ts
interface FlowRuntimeSurface {
  supportedEntryModes: readonly {
    name: string;
    depth: string;
    public: boolean;
  }[];
  primaryResult?: {
    schema: string;
    path: string;
    label: string;
  };
  stagePolicy?: {
    requiredCanonicals: readonly string[];
    omittedCanonicals: readonly string[];
    optionalCanonicals: readonly string[];
  };
  summaryProjector?: SummaryProjector;
  presentation?: FlowPresentation;
}
```

This does not need to become a giant config file. It should be a closure check:
"for this flow package, do all runtime and operator surfaces line up?"

Behavior-preserving order:

1. Derive `supportedEntryModes` from compiled flow `entry_modes` and replace
   the CLI matrix reads.
2. Move `FLOW_RESULT_PATHS` into package metadata or derived compiled metadata.
3. Move canonical stage policy into package metadata, with custom flows still
   allowed to opt out explicitly.
4. Make the catalog completeness tests assert the new package-owned surface.

Expected test impact:

- Strengthen `tests/contracts/catalog-completeness.test.ts`, which already
  checks catalog-to-layout invariants (`tests/contracts/catalog-completeness.test.ts:1-19`).
- Keep the engine import boundary test as the safety rail
  (`tests/contracts/engine-flow-boundary.test.ts:1-8`).

## Finding 3: Operator Progress Is Inferred From Prose

Severity: High

Status: Confirmed

Confidence: High

Type: copy/runtime complecting

Main locations:

- `src/runtime/projections/progress.ts`
- flow schematics, indirectly, because their step titles feed progress text.

Evidence:

- `stepTitle` searches the compiled flow, then executable flow, then falls back
  to the step id (`src/runtime/projections/progress.ts:62-72`).
- `stepLead` splits a title on an em dash and lowercases it
  (`src/runtime/projections/progress.ts:83-85`).
- `operatorStepTitle` and `operatorStepAction` infer product actions from title
  prefixes such as `frame`, `analyze`, `synthesize`, `review`, `verify`, and
  `act` (`src/runtime/projections/progress.ts:87-123`).
- Relay copy special-cases `flowId === 'explore'`
  (`src/runtime/projections/progress.ts:125-145`).
- Those derived strings are used in progress events
  (`src/runtime/projections/progress.ts:453-475`) and completion messages
  (`src/runtime/projections/progress.ts:780-840`).

Why this matters:

- A harmless copy change can alter operator progress behavior.
- Adding a new flow or block requires knowing hidden title-prefix conventions.
- Product language and runtime state are tied together in a way neither docs nor
  types can enforce.
- This is a classic shallow abstraction smell: many tiny heuristics make the
  central projector know too much about every flow's wording.

Recommendation:

Move presentation metadata to the flow/block model.

Possible schematic addition:

```json
{
  "display": {
    "task": "Check the work",
    "active": "Checking the work",
    "completed": "Finished checking the work.",
    "failed": "Marked Check the work as failed."
  }
}
```

The runtime progress projector should render declared metadata. It can keep the
current title heuristic as a migration fallback, but the fallback should be
treated as legacy behavior and tested only for old fixtures.

Behavior-preserving order:

1. Add optional display metadata to schematic items and compiled steps.
2. Populate it for current public flows.
3. Change progress rendering to prefer display metadata.
4. Add a drift check that public flows have display metadata for every public
   step.
5. Remove `operatorStepTitle` and `operatorStepAction` once generated fixtures
   carry the data.

Expected test impact:

- Add one progress projection test that changes a step title but keeps display
  metadata stable. The progress text should not change.

## Finding 4: Report Writers Are Wired By Schema Strings At Runtime

Severity: Medium-High

Status: Confirmed

Confidence: High

Type: string-keyed integration

Main locations:

- `src/flows/catalog-derivations.ts`
- `src/flows/compile-schematic-to-flow.ts`
- `src/flows/registries/*`
- `src/runtime/executors/verification.ts`
- `src/runtime/executors/checkpoint.ts`
- `src/flows/registries/close-writers/shared.ts`

Evidence:

- `CompiledFlowPackage` owns writer arrays by kind
  (`src/flows/types.ts:126-133`).
- Catalog derivation builds maps keyed by `builder.resultSchemaName`
  (`src/flows/catalog-derivations.ts:15-35`).
- The compiler imports writer registries and checks whether a schematic output
  schema has a writer (`src/flows/compile-schematic-to-flow.ts:45-46`,
  `src/flows/compile-schematic-to-flow.ts:63-81`).
- Runtime verification again finds the writer by schema string
  (`src/runtime/executors/verification.ts:218-230`).
- Checkpoint execution does the same for checkpoint report writers
  (`src/runtime/executors/checkpoint.ts:100-114`).
- Close-writer helpers scan the whole compiled flow to find the unique step that
  writes a schema (`src/flows/registries/close-writers/shared.ts:17-34`).

Why this matters:

- Schema strings are doing too much. They are external report ids, writer ids,
  path lookup keys, registry keys, and cross-flow uniqueness keys.
- A rename or split requires coordinated edits across package reports, writer
  result names, schematic output names, compiled manifests, close writer reads,
  verification builders, and tests.
- The package model is close to deep, but the real connection is still a set of
  global string maps.

Recommendation:

At catalog/emit time, build a closed package manifest for each flow:

- step id -> typed writer descriptor;
- report schema -> report path;
- report schema -> validator;
- relay schema -> relay hint and cross-report validators;
- primary result descriptor;
- checkpoint report descriptor.

Keep schema strings as public report names, but stop using them as the runtime
join point for every local dependency. Runtime executors should receive direct
descriptors from the step or package closure.

Behavior-preserving order:

1. Add a derived `reportIndex` to compiled flow output.
2. Change `reportPathForSchemaInCompiledFlow` to read the index first, with the
   current scan as a fallback.
3. Add writer descriptors to compiled/executable steps.
4. Move verification and checkpoint executors off global registry lookups.
5. Keep duplicate schema detection in catalog derivation as a package closure
   test.

Expected test impact:

- Existing registry tests can shrink once package closure tests prove the same
  invariant at the package boundary.

## Finding 5: Active Schematics Also Carry Draft And Future Intent

Severity: Medium

Status: Confirmed

Confidence: High

Type: lifecycle complecting

Main locations:

- `src/schemas/flow-schematic.ts`
- `src/flows/fix/schematic.json`
- `src/flows/compile-schematic-to-flow.ts`

Evidence:

- Schematic item fields needed by the compiler are optional at parse time so
  candidate schematics remain parseable. The compiler later enforces them
  (`src/schemas/flow-schematic.ts:185-194`).
- The cross-field validator only checks `writes`, `check`, and
  `checkpoint_policy` when those optional fields are present
  (`src/schemas/flow-schematic.ts:236-240`).
- Top-level compiler-required fields are also optional at parse time
  (`src/schemas/flow-schematic.ts:475-482`).
- The Fix schematic is marked active, but its purpose says two future route
  steps remain in the schematic as authoring intent and are unreachable at
  compile (`src/flows/fix/schematic.json:3-6`).
- The compatibility validator has an explicit unreachable-item diagnostic
  (`src/schemas/flow-schematic.ts:831-838`).

Why this matters:

- One schema is trying to describe draft schematics, active executable
  schematics, partially upgraded schematics, and future design intent.
- Active flow authors do not get the full benefit of Zod because required
  runtime fields are optional until compile time.
- "Unreachable but intentional" content inside active schematics creates a
  mental fork: the file is both executable truth and a design note.

Recommendation:

Split schematic lifecycle types:

- `DraftFlowSchematic`: may omit execution metadata and may contain disabled or
  future-only items.
- `ExecutableFlowSchematic`: active, fully required, no unreachable items unless
  they are explicitly marked `disabled` and excluded from compilation.
- `DeprecatedFlowSchematic`: parseable for migration, not emitted.

Behavior-preserving order:

1. Add an `ExecutableFlowSchematic` parser that requires compiler-required
   fields.
2. Use it only for `status: "active"` schematics in `scripts/emit-flows.ts`.
3. Move Fix's future no-repro/handoff intent to `docs/flows/` or to explicitly
   disabled items with a typed reason.
4. Keep the current permissive parser for drafts and migration tools.

Expected test impact:

- Add tests showing active schematics fail at parse time when `writes`,
  `check`, `version`, `entry`, or `stages` are missing.
- Keep draft parsing tests for candidate schematics.

## Finding 6: The CLI Is Doing Too Many Jobs

Severity: Medium

Status: Confirmed

Confidence: Medium-High

Type: boundary depth

Main location:

- `src/cli/circuit.ts`

Evidence:

- `src/cli/circuit.ts` is 990 lines.
- It owns argument parsing, help text, version handling, run/resume branching,
  fixture loading, route selection, entry-mode/depth aliasing, runtime support
  classification, custom-flow archetype lookup, checkpoint resume, progress,
  result output, and operator summary writing.
- Several of those jobs are visible in one span: mode/depth aliasing
  (`src/cli/circuit.ts:440-464`), entry-mode selection
  (`src/cli/circuit.ts:466-494`), fixture loading and policy validation
  (`src/cli/circuit.ts:507-520`), custom-flow archetype lookup
  (`src/cli/circuit.ts:575-604`), and runtime support classification
  (`src/cli/circuit.ts:606-627`).

Why this matters:

- The CLI is the host-facing front door, but it also owns domain policy that
  should be derived from flow metadata.
- A small CLI behavior change risks touching routing, support policy, resume,
  and presentation at once.
- This is the place most likely to grow more side tables.

Recommendation:

Split the CLI by deep responsibilities after the flow metadata split:

- `parseRunInvocation`: argv -> typed invocation.
- `resolveFlowRoute`: explicit or classifier route -> flow id and reason.
- `selectFlowEntry`: mode/depth/entry resolution against compiled flow metadata.
- `loadFlowForInvocation`: generated flow, fixture, or custom flow.
- `runAndPresent`: calls runtime and writes host-facing JSON.

Do not do a mechanical "one helper per 30 lines" cleanup. The useful split is
by ownership of invariants.

Behavior-preserving order:

1. Move runtime support logic out first, after Finding 2 gives it a better data
   source.
2. Then extract invocation parsing and entry selection.
3. Leave result writing last, because it touches operator summary behavior.

Expected test impact:

- Current CLI router tests should become easier to target because support
  classification and entry selection can be tested without spawning the full
  CLI path.

## Finding 7: Connector Process Lifecycle Is Duplicated, But Policy Should Stay Explicit

Severity: Medium

Status: Confirmed

Confidence: Medium

Type: selective extraction

Main locations:

- `src/connectors/claude-code.ts`
- `src/connectors/codex.ts`

Evidence:

- Claude Code connector owns timeout defaults, SIGTERM/SIGKILL grace, and stdout
  and stderr caps (`src/connectors/claude-code.ts:80-95`), then spawns a
  detached process (`src/connectors/claude-code.ts:140-157`).
- Codex connector has a separate but similar detached process runner, process
  group kill path, capped stdout/stderr collection, timeout handling, and parse
  handoff (`src/connectors/codex.ts:400-525`).
- Codex also has important connector-specific policy: read-only sandbox and
  argv boundary assertions (`src/connectors/codex.ts:266-327`).

Why this matters:

- Timeout, group kill, capped streams, close/error races, and diagnostic
  snippets are hard to get right. Duplicating them creates quiet divergence.
- The connector policy is not duplication. Codex and Claude Code need different
  argv and capability rules.

Recommendation:

Extract only the process lifecycle core:

```ts
runCappedSubprocess({
  executable,
  args,
  timeoutMs,
  stdoutMaxBytes,
  stderrMaxBytes,
  stdin: 'ignore',
  detached: true
})
```

Leave these in connector-specific files:

- allowed flags;
- provider effort mapping;
- schema flag support;
- read/write capability boundary;
- stdout protocol parser;
- connector-specific error wording when it is product-relevant.

This is useful, but it should not outrank the graph and metadata simplifications.

## Finding 8: Verification Resolution Is A Good Direction, But It Should Become The Proof Plan Boundary

Severity: Medium

Status: Confirmed

Confidence: Medium

Type: deepen a good module

Main locations:

- `src/shared/verification-resolver.ts`
- `src/flows/build/writers/checkpoint-brief.ts`
- `src/runtime/executors/verification.ts`

Evidence:

- `verification-resolver.ts` centralizes package script discovery, package
  manager detection, blocked reasons, and `ProofPlanBlockedError`
  (`src/shared/verification-resolver.ts:1-80`).
- Build checkpoint brief uses the resolver to infer verification commands from
  project root and goal (`src/flows/build/writers/checkpoint-brief.ts:20-23`,
  `src/flows/build/writers/checkpoint-brief.ts:50-57`).
- Runtime verification still receives commands from a schema-specific writer
  and then executes them (`src/runtime/executors/verification.ts:218-230`).

Why this matters:

- This module is already simplifying the right thing: Circuit owns the proof
  plan shape, while the project owns actual commands.
- But resolution, command validation, and command execution are still spread
  across flow writers and the verification executor.

Recommendation:

Promote this into a `ProofPlan` boundary:

- resolver: project + requested needs -> command plan or blocked reason;
- validator: command plan -> safe command execution spec;
- executor: command plan -> observed check results;
- reporter: observed results + flow context -> flow-specific report body.

The flow-specific part should be the report body, not command discovery.

Behavior-preserving order:

1. Keep current report schemas.
2. Move package-script preflight into the proof plan module.
3. Let flow verification writers receive observed command results instead of
   loading commands themselves.
4. Share the same proof plan path across Build, Fix, Migrate, and Sweep.

## What Is Already Good

- The flow/runtime import boundary is valuable. The contract test states the
  intent clearly: runtime may import shared flow infrastructure, not per-flow
  modules (`tests/contracts/engine-flow-boundary.test.ts:1-8`).
- Catalog completeness tests are exactly the right kind of guardrail. They bind
  catalog entries to on-disk packages and prevent vacuous coverage
  (`tests/contracts/catalog-completeness.test.ts:1-19`).
- The generated surface source map is useful and should stay. It gives clear
  edit rules and drift checks for authored sources versus generated mirrors
  (`docs/generated-surfaces.md:7-16`).
- Connector capability policy is intentionally explicit. Do not hide Codex's
  read-only boundary or Claude Code's structured-output behavior behind a vague
  shared connector base class.
- The verification resolver is a positive simplification. It should be deepened,
  not removed.

## Recommended Order Of Operations

1. **Package-owned runtime surface.**
   Replace `RUNTIME_SUPPORT_MATRIX`, `FLOW_RESULT_PATHS`, and central canonical
   policy with package-derived metadata. This reduces drift without changing
   runtime execution.

2. **Structured progress display metadata.**
   Add display fields to schematic/compiled steps and move progress rendering
   off title-prefix heuristics. This is user-visible but behavior-preserving
   when populated carefully.

3. **Single runtime graph authority.**
   Move production executor needs onto the runtime graph and remove
   `context.compiledFlow`. This is the highest leverage technical refactor but
   also the riskiest, so do it after package metadata is cleaner.

4. **Closed package report/writer contract.**
   Replace global string-key runtime lookups with package closure descriptors.
   This naturally follows the single runtime graph work.

5. **Schematic lifecycle split.**
   Give active schematics strict parse-time guarantees, while keeping a draft
   parser for experiments.

6. **CLI responsibility split.**
   Extract deep CLI modules after the metadata source is no longer hard-coded
   in the CLI.

7. **Connector lifecycle extraction.**
   Extract only subprocess lifecycle mechanics. Keep connector policy explicit.

8. **Proof plan boundary.**
   Deepen the verification resolver so command discovery and execution policy
   have one home.

## Suggested First Slice

Implement the package-owned runtime surface for entry modes and primary result
paths.

Why first:

- It is behavior-preserving.
- It shrinks the number of flow-specific central side tables.
- It gives later progress and CLI work a better source of truth.
- It is easy to prove with drift tests.

Concrete slice:

1. Add a derived helper near `src/flows/catalog-derivations.ts` that returns:
   `flow id -> supported entry modes` and `flow id -> primary result path`.
2. Make `src/cli/circuit.ts` read supported entry modes from the derived helper
   instead of `RUNTIME_SUPPORT_MATRIX`.
3. Make `src/shared/operator-summary-writer.ts` read primary result paths from
   the same derived surface instead of `FLOW_RESULT_PATHS`.
4. Add contract tests proving every public flow has a primary result descriptor
   and every public compiled flow entry mode is supported by the CLI.
5. Run `npm run verify:fast`, then `npm run verify`.

This slice gives immediate simplification and forces the design question that
matters: "What is the one place to ask what this flow can do?"

## Review Conclusion

The codebase does not need a broad cleanup pass. It needs a few decisive concept
collapses:

- one runtime graph, not compiled plus executable plus side-channel compiled;
- one package-owned runtime/operator surface, not scattered flow side tables;
- display metadata, not progress behavior inferred from prose;
- closed package report/writer descriptors, not schema strings as every local
  join key;
- strict active schematics, not active files carrying draft and future intent.

That is the path to fewer redirects and more elegance without weakening the
product model that is already working.
