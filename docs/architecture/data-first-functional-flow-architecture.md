---
name: data-first-functional-flow-architecture
description: Migration-ready architecture spec for moving Circuit toward data-first flow authoring, pure compilation, typed error values, and explicit runtime capabilities.
type: architecture-decision
date: 2026-05-16
status: proposed
---

# Data-First Functional Flow Architecture

## Decision

Steer Circuit toward a data-first, functional architecture.

The target is not "more framework" or "more indirection." The target is fewer
concepts:

- authored flow definitions are plain typed values plus named semantic hooks;
- validation and compilation are pure transformations over values;
- expected failures are explicit error values;
- generated schematics, compiled manifests, docs, indexes, and host mirrors are
  derived;
- runtime state is an append-only trace of facts;
- file, clock, subprocess, connector, progress, child-run, and worktree
  behavior is supplied at the boundary;
- the graph runner keeps step advancement readable as a graph walk.

This is a follow-on direction to
`docs/architecture/declarative-flow-architecture.md`. The first
`FlowDefinition` migration made built-in flows definition-owned. This spec
hardens the next move: compress authoring around data and pure derivation
before making any runtime or Effect migration.

## Simplicity Standard

Use these rules as the review bar for the migration plan.

1. Separate things that vary independently.
   A block, a step, a report schema, a writer, a route, a generated artifact,
   and a runtime effect are different things. The authoring model may connect
   them, but it should not hide one inside another.

2. Prefer values over places.
   The compiler should accept immutable flow data and return artifacts or error
   values. Mutable places such as run folders, trace stores, subprocesses, and
   progress streams belong at runtime edges.

3. Make time explicit.
   Runtime history is trace entries, not hidden state. Resume, progress,
   checkpoint handling, and close results should be explainable from durable
   facts plus the compiled graph.

4. Keep effects at the boundary.
   Source inspection, file IO, subprocess execution, connector calls, clocks,
   worktrees, and progress output should be capabilities supplied to an
   interpreter. Domain logic should describe what must happen, not perform the
   side effect itself.

5. Do not confuse compression with cleverness.
   A shorter authoring API is valid only if it exposes the same facts more
   directly. Fluent builders, callbacks, implicit registries, and string-named
   hooks are disqualified when they make the data harder to inspect.

6. Generate facts that are mechanical.
   Authors should write product knowledge. Compatibility schematics, compiled
   manifests, host mirrors, docs indexes, and closed lookup indexes should be
   generated or drift-checked.

7. Keep semantic code as code.
   Writer logic, report projection, cross-report validation, and connector
   policy are not "boilerplate" when they encode product behavior.

## Invariants

These must remain true through any migration slice derived from this spec.

- Public CLI behavior is preserved.
- Generated host surfaces remain byte-for-byte compatible unless a separate
  versioned migration is accepted.
- Report schema names and Zod schema shapes remain the compatibility contract.
- The engine imports flow behavior through the catalog and registries, not
  through direct imports of individual flow packages.
- Connector security policy is not loosened or hidden behind a generic effect
  abstraction.
- The retained production flow set stays `review`, `fix`, `pursue`,
  `runtime-proof`, `build`, and `explore` unless a separate versioned migration
  reopens it.
- Semantic writer, validator, relay-hint, and helper code remains source code.
- Generated compatibility artifacts are regenerated and drift-checked, not
  edited by hand.
- Runtime graph execution stays flow-agnostic.
- This spec remains design-only until implementation is explicitly requested.

## Current Source Evidence

| Claim | Status | Evidence |
| --- | --- | --- |
| Retained built-in flows are fact-owned. | Confirmed | `src/flows/catalog.ts` imports `reviewFlowDefinition`, `fixFlowDefinition`, `pursueFlowDefinition`, `runtimeProofFlowDefinition`, `buildFlowDefinition`, and `exploreFlowDefinition`; each flow adapter calls `defineFlowFromFacts()` with `src/flows/<id>/facts.ts`. |
| The current `FlowDefinition` still embeds a schematic-shaped value after fact projection. | Confirmed | `src/flows/flow-definition.ts` defines `FlowDefinitionInput.schematic` as `z.input<typeof FlowSchematic>` and `defineFlowFromFacts()` projects facts into that value before `defineFlow()` parses it with `FlowSchematic.parse`. |
| Build is a good proving flow for fact-owned authoring. | Confirmed | `src/flows/build/facts.ts` owns checkpoint, compose, relay, verification, close, runtime progress, and the `bindsExecutionDepthToRelaySelection` engine flag; `src/flows/build/flow.ts` binds those facts to relay hints, schemas, and writers. |
| Active schematics already fail early on many structural mistakes. | Confirmed | `src/schemas/flow-schematic.ts` validates routes, route overrides, duplicate ids, active required fields, execution/write/check shape, stages, and block-catalog compatibility helpers. |
| Schematic-to-manifest compilation is mostly pure but throws for expected compile failures. | Confirmed | `src/flows/compile-schematic-to-flow.ts` computes reachability, read paths, per-mode manifests, and throws `FlowSchematicCompileError` through `fail()`. |
| Registry derivation is already value-oriented, but also throws. | Confirmed | `src/flows/catalog-derivations.ts` builds writer, report, hint, validator, runtime-surface, and routing indexes from packages. Duplicate detection throws. |
| Runtime execution is already an explicit graph walk. | Confirmed | `src/runtime/run/graph-runner.ts` enters a step, runs its executor, evaluates the route, appends trace entries, detects cycles and attempt exhaustion, and closes the run. |
| Runtime effects are still concrete classes and functions in the core context. | Confirmed | `src/runtime/run/run-context.ts` threads `RunFileStore`, `TraceStore`, relayer, connector, child-runner, worktree runner, progress reporter, and clock together. |
| Progress display no longer has to infer every label from prose titles, but it still has fallback heuristics. | Confirmed | `src/runtime/projections/progress.ts` consumes `CompiledFlowProgressSurface`, while `stepDisplay()` falls back to step titles if metadata is absent. Contract tests require public flows to own progress metadata. |
| Runtime support and progress metadata are package-owned. | Confirmed | `src/flows/runtime-surface.ts` derives a runtime-surface map from `flowPackages`; `src/cli/circuit.ts` reads that metadata for depth support and progress. |
| Generated surfaces are already treated as generated truth. | Confirmed | `docs/generated-surfaces.md` names `src/flows/<id>/facts.ts` plus `src/flows/<id>/flow.ts` as source, marks schematic JSON and compiled manifests as generated, and names `node scripts/emit-flows.ts --check` as the drift check. |
| Connector sharing is intentionally narrow. | Confirmed | `src/connectors/shared.ts` exposes neutral relay/hash types only; `src/connectors/subprocess.ts` owns subprocess lifecycle. `tests/contracts/architecture-boundaries.test.ts` ratchets this boundary. |
| Verification command execution is behind a shared proof-plan boundary. | Confirmed | `src/runtime/executors/verification.ts` calls `runProofPlanCommand()`; `src/shared/proof-plan.ts` owns cwd checks, script preflight, env allowlist, timeout, and output caps. |
| Current tests already describe many migration safety gates. | Confirmed | `tests/runner/flow-definition-compiler.test.ts`, `tests/contracts/catalog-completeness.test.ts`, `tests/contracts/flow-schematic.test.ts`, `tests/contracts/runtime-context-boundary.test.ts`, `tests/contracts/architecture-boundaries.test.ts`, `tests/runtime/progress-projection.test.ts`, `tests/unit/proof-plan.test.ts`, and `tests/runner/connector-subprocess.test.ts`. |
| Effect is useful only after runtime capabilities are named. | Future-facing | No Effect dependency exists today. This is a target constraint, not current source fact. |

## Current System Map

| Concern | Current Owner | Problem | Target Owner |
| --- | --- | --- | --- |
| Flow identity, visibility, paths | `src/flows/<id>/facts.ts` projected through `defineFlowFromFacts()` | Paths and visibility are close to the graph, but still package-shaped. | Flow fact metadata value. |
| Step graph | `src/flows/<id>/facts.ts` projected through `projectSchematicFromFacts()` | Authors still spell low-level schematic fields as facts. | Compact step values that compile to schematic items. |
| Blocks | `src/schemas/flow-block-definitions.ts`, `docs/flows/block-catalog.json`, `src/schemas/flow-schematic-policy.ts` | Block meaning and execution/stage policy are split. | Typed block definitions own default evidence, legal stages, legal execution kinds, and default checks. |
| Report schemas | `src/flows/<id>/reports.ts` plus package arrays | Schema values are source, but registration is repeated. | Report declarations bind schema, schema name, path, role, writer, relay hint, and primary-result metadata. |
| Writers | `src/flows/<id>/writers/*` plus package writer arrays | Semantic code is good; array registration is mechanical. | Writer functions remain code; registration derives from report declarations. |
| Relay hints | `src/flows/<id>/relay-hints.ts` plus package relay report entries | Hint text is semantic; attachment is mechanical. | Hint values remain code/data; attachment derives from report declarations. |
| Runtime surface | `runtimeSurface` inside each flow definition | Necessary public metadata, but repeated beside steps and modes. | Derived from modes, primary result, and explicit progress display values. |
| Schematic JSON | `src/flows/<id>/schematic.json` | Compatibility output, not authored source. | Generated compatibility artifact. |
| Compiled manifests | `generated/flows/<id>/*.json` | Already generated. | Continue generated and drift-checked. |
| Runtime execution | `src/runtime/run/graph-runner.ts` plus executors | The graph walk is clear, but concrete IO classes are wired into core context. | Same graph walk over named capabilities. |
| Trace and run files | `TraceStore`, `RunFileStore`, report validator | Durable facts are already explicit, but storage is concrete runtime machinery. | `TraceLog` and `RunFiles` capabilities. |
| Connectors | Connector modules plus `src/connectors/subprocess.ts` | Subprocess lifecycle is shared; connector parsing and policy stay separate. | `ConnectorRelay` plus narrow `Subprocess` capability. |
| Verification commands | `src/shared/proof-plan.ts` called by verification executor | Good shared boundary, but blocked/error paths still throw. | Proof-plan command observations and blocked states as values. |
| CLI | `src/cli/circuit.ts` | CLI wires parsing, selection, runtime support, fixture loading, progress, and output rendering. | CLI stays the outer adapter that renders typed errors and supplies live capabilities. |

## Target Shape

Circuit should become this pipeline:

```text
authored flow value
  -> validation value
  -> compiled package value
  -> generated compatibility artifacts
  -> runtime interpreter over executable graph values
  -> append-only trace facts
  -> edge-provided capabilities
```

The authoring source should be easy to inspect as data. A reviewer should be
able to open one flow file and answer:

- what reports exist;
- which reports are inputs and outputs for each step;
- which block each step uses;
- where routes go;
- what behavior is semantic code;
- which facts are generated from these declarations.

The runtime source should stay easy to inspect as execution. A reviewer should
be able to open the graph runner and answer:

- which step is active;
- which executor ran;
- which route was selected;
- which trace facts were appended;
- why the run stopped, resumed, or closed.

## Boundary Rules

These are hard migration constraints.

| Boundary | Rule |
| --- | --- |
| Authoring vs compatibility | Authors write the compressed flow value. Compatibility schematic JSON is generated from it. |
| Validation vs compilation | Validation accumulates domain errors. Compilation runs only after validation has produced a valid definition. |
| Compilation vs runtime | Compilation produces package, schematic, manifest, registry, and surface values. Runtime does not inspect authoring-only structures. |
| Reports vs writers | Report declarations own schema identity and path. Writer functions own semantic construction of report bodies. |
| Blocks vs steps | Blocks own reusable defaults. Steps own flow-specific choices and overrides. |
| Routing vs execution | Routes are product outcomes. Executors only report outcomes; they do not decide the graph shape. |
| Trace vs state | Trace entries are durable facts. Runtime stores may cache or index them, but the trace is the replayable history. |
| CLI vs domain | CLI renders and exits. Domain logic returns values or typed errors. |
| Effect library vs effect model | Effect as a dependency is optional and late. The effect model starts by naming capabilities. |

## Authoring Compression Rules

The next authoring surface must be a plain value. Small helper functions are
allowed only when they return plain records.

Disallowed:

- mutable builders;
- method chaining as the primary API;
- callbacks that hide step construction;
- magic string lookup of semantic hooks;
- service locators;
- runtime behavior hidden behind flow ids;
- "infer everything" rules that make generated output surprising.

Allowed:

- object literals;
- literal arrays;
- `as const` values;
- pure helper functions that return records;
- explicit references to imported schema and writer values;
- explicit overrides where legacy compatibility requires them.

The rule is:

> Derive a fact only when there is one obvious representation. If two
> reasonable outputs are possible, author the choice.

## Derivation Contract

| Fact | Authored? | Derived? | Notes |
| --- | --- | --- | --- |
| Flow id and visibility | Yes | No | Identity is authored. |
| Compatibility schema versions | No | Yes | Schematic v1 and compiled-flow v2 are generated constants until a versioned migration changes them. |
| Schematic title, purpose, and version | Yes | No | Compatibility identity stays explicit for existing flows. |
| Entry classifier metadata | Yes | No | Intent prefixes and include/exclude terms are product-facing classifier facts, not derivable from regex signals. |
| Flow order/routing signals | Yes | No | Product routing is authored knowledge. |
| Mode names and depths | Yes | Runtime support rows derive from these. | Public support text must not drift from modes. |
| Report schema name | Yes | No | Schema names are compatibility contracts. |
| Report Zod schema | Yes | No | Schema values stay in `reports.ts`. |
| Report path | Usually yes | New-flow defaults may derive. | Existing flows keep explicit paths until parity proves defaults. |
| Primary result metadata | Yes by report ref | Surface derives path/schema/label. | Label is operator-facing and should stay explicit. |
| Step id | Yes | Protocol may derive for new flows. | Existing protocol ids stay explicit until byte-for-byte parity is proven. |
| Stage ids and titles | Usually yes | New-flow defaults may derive from canonical stage names. | Existing flows keep explicit stage metadata until parity proves defaults. |
| Step block | Yes | Default evidence/stage/execution may derive from block. | Overrides stay visible. |
| Step input contracts | Yes by report ref or initial contract ref | Read paths derive from producer paths. | The current compiler already derives read paths. |
| Step output contract | Usually derived from `writes` report ref | Yes | If a step writes a special contract, author it. |
| Contract aliases | Usually no | Derive from block contracts and step report refs. | Ambiguous or compatibility-only aliases stay authored. |
| Evidence requirements | Defaults derive from block | Overrides authored | Missing block evidence is a validation error. |
| Execution kind | Defaults derive from block or step constructor | Overrides authored | Relay role and sub-run target remain explicit. |
| Write slots | Derived from execution kind and report paths | Yes | Existing compatibility paths must remain unchanged. |
| Check shape | Derived from execution kind and report/check declaration | Yes | Required fields or pass lists remain authored where semantic. |
| Routes | Yes | No | Routes are product outcomes. |
| Route overrides | Yes | No | Mode-specific topology is authored. |
| Progress display | Yes in compact display field | Runtime surface derives. | No prose-title heuristics for public flows. |
| Registry entries | No | Yes | Registries derive from packages/definitions. |
| Generated host files | No | Yes | Drift check remains authority. |

## Target Authoring Example

This example is intentionally a plain record. It is not a final API, but the
shape is the bar: inspectable data first, helper-returned records only where
they remove mechanical repetition.

```ts
export const buildFlowDefinition = defineFlowData({
  id: 'build',
  title: 'Build Schematic',
  purpose:
    'Build flow. Circuit frames a requested change, plans it, relays implementation to a worker, runs verification, relays review to a separate worker, and closes with a Build result file plus evidence.',
  version: '0.1.0',
  visibility: 'public',
  paths: {
    command: 'src/flows/build/command.md',
    contract: 'src/flows/build/contract.md',
  },
  entry: {
    signals: {
      include: ['build', 'implement', 'develop', 'change', 'fix', 'add'],
      exclude: [],
    },
    intentPrefixes: ['build', 'implement', 'develop'],
  },
  routing: {
    order: 30,
    signals: BUILD_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch: buildRouteReason,
  },
  modes: [
    { name: 'default', depth: 'standard', description: 'Default Build entry mode.' },
    { name: 'lite', depth: 'lite', description: 'Lite Build entry mode.' },
    { name: 'deep', depth: 'deep', description: 'Deep Build entry mode.' },
    { name: 'autonomous', depth: 'autonomous', description: 'Autonomous Build entry mode.' },
  ],
  reports: {
    brief: {
      schemaName: 'build.brief@v1',
      schema: BuildBrief,
      path: 'reports/build/brief.json',
      writer: { slot: 'checkpoint', builder: buildBriefCheckpointBuilder },
    },
    plan: {
      schemaName: 'build.plan@v1',
      schema: BuildPlan,
      path: 'reports/build/plan.json',
      writer: { slot: 'compose', builder: buildPlanComposeBuilder },
    },
    implementation: {
      schemaName: 'build.implementation@v1',
      schema: BuildImplementation,
      path: 'reports/build/implementation.json',
      relayHint: buildImplementationShapeHint,
    },
    verification: {
      schemaName: 'build.verification@v1',
      schema: BuildVerification,
      path: 'reports/build/verification.json',
      writer: { slot: 'verification', builder: buildVerificationWriter },
    },
    review: {
      schemaName: 'build.review@v1',
      schema: BuildReview,
      path: 'reports/build/review.json',
      relayHint: buildReviewShapeHint,
    },
    result: {
      schemaName: 'build.result@v1',
      schema: BuildResult,
      path: 'reports/build-result.json',
      primaryResultLabel: 'Build result',
      writer: { slot: 'close', builder: buildCloseBuilder },
    },
  },
  initialContracts: ['task.intake@v1', 'route.decision@v1', 'verification.plan@v1'],
  stagePath: {
    mode: 'partial',
    omits: ['analyze'],
    rationale:
      'Build follows Frame, Plan, Act, Verify, Review, Close. Analyze is folded into Frame and Plan.',
  },
  stages: [
    { canonical: 'frame', id: 'frame-stage', title: 'Frame' },
    { canonical: 'plan', id: 'plan-stage', title: 'Plan' },
    { canonical: 'act', id: 'act-stage', title: 'Act' },
    { canonical: 'verify', id: 'verify-stage', title: 'Verify' },
    { canonical: 'review', id: 'review-stage', title: 'Review' },
    { canonical: 'close', id: 'close-stage', title: 'Close' },
  ],
  steps: [
    {
      id: 'frame-step',
      title: 'Frame - confirm Build brief',
      block: 'frame',
      stage: 'frame',
      execution: { kind: 'checkpoint' },
      reads: { task: 'task.intake@v1', route: 'route.decision@v1' },
      writes: 'brief',
      protocol: 'build-frame@v1',
      checkpoint: {
        prompt: 'Confirm the Build brief before implementation starts.',
        choices: [{ id: 'continue', label: 'Continue' }],
        safeDefaultChoice: 'continue',
        safeAutonomousChoice: 'continue',
        reportTemplate: {
          scope: 'Make the smallest safe change that satisfies the requested goal.',
          successCriteria: [
            'The requested behavior is implemented',
            'Verification passes',
            'Review completes without a blocking issue',
          ],
        },
      },
      routes: { continue: 'plan-step', stop: '@stop' },
      progress: { taskTitle: 'Frame the work', activeText: 'Framing the work' },
    },
    {
      id: 'plan-step',
      title: 'Plan - produce Build plan',
      block: 'plan',
      stage: 'plan',
      reads: { brief: 'brief' },
      writes: 'plan',
      protocol: 'build-plan@v1',
      requiredFields: ['objective', 'verification'],
      routes: { continue: 'act-step', revise: 'plan-step', stop: '@stop' },
      progress: { taskTitle: 'Plan the work', activeText: 'Planning the work' },
    },
    {
      id: 'act-step',
      title: 'Act - implementation relay',
      block: 'act',
      stage: 'act',
      execution: { kind: 'relay', role: 'implementer' },
      reads: { brief: 'brief', plan: 'plan' },
      writes: 'implementation',
      protocol: 'build-act@v1',
      pass: ['accept'],
      routes: { continue: 'verify-step', retry: 'act-step', stop: '@stop' },
      progress: {
        taskTitle: 'Make the change',
        activeText: 'Making the change',
        relayRole: 'implementer',
      },
    },
    {
      id: 'verify-step',
      title: 'Verify - run Build verification',
      block: 'run-verification',
      stage: 'verify',
      reads: {
        proof: 'verification.plan@v1',
        plan: 'plan',
        change: 'implementation',
      },
      writes: 'verification',
      protocol: 'build-verify@v1',
      requiredFields: ['overall_status', 'commands'],
      routes: { continue: 'review-step', retry: 'act-step', stop: '@stop' },
      progress: { taskTitle: 'Check the work', activeText: 'Checking the work' },
    },
    {
      id: 'review-step',
      title: 'Review - implementation review relay',
      block: 'review',
      stage: 'review',
      execution: { kind: 'relay', role: 'reviewer' },
      reads: {
        brief: 'brief',
        plan: 'plan',
        change: 'implementation',
        verification: 'verification',
      },
      writes: 'review',
      protocol: 'build-review@v1',
      pass: ['accept', 'accept-with-fixes'],
      routes: {
        continue: 'close-step',
        retry: 'act-step',
        revise: 'act-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the result',
        activeText: 'Checking the result',
        relayRole: 'reviewer',
      },
    },
    {
      id: 'close-step',
      title: 'Close - emit Build result',
      block: 'close-with-evidence',
      stage: 'close',
      reads: {
        brief: 'brief',
        plan: 'plan',
        implementation: 'implementation',
        verification: 'verification',
        review: 'review',
      },
      writes: 'result',
      protocol: 'build-close@v1',
      requiredFields: ['summary', 'outcome', 'evidence_links'],
      routes: { complete: '@complete', stop: '@stop' },
      progress: { taskTitle: 'Wrap up', activeText: 'Wrapping up' },
    },
  ],
  engineFlags: {
    bindsExecutionDepthToRelaySelection: true,
  },
});
```

The first migration slice must prove that this value projects to the same
current Build `FlowDefinition`, `CompiledFlowPackage`, schematic JSON,
generated manifest, runtime surface, report schema registrations, writer
registrations, relay hints, command mirrors, and host mirrors.

## Error Values

Expected failures should be data. The target compiler should not throw for
normal authoring mistakes.

Compiler validation should return:

```ts
type Validation<A, E> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly errors: readonly E[] };
```

Example compiler errors:

```ts
type FlowDefinitionError =
  | { readonly kind: 'duplicate-flow-id'; readonly flowId: string }
  | { readonly kind: 'unknown-report-ref'; readonly flowId: string; readonly stepId: string; readonly ref: string }
  | { readonly kind: 'invalid-route-target'; readonly flowId: string; readonly stepId: string; readonly target: string }
  | { readonly kind: 'invalid-block-stage'; readonly flowId: string; readonly stepId: string; readonly block: string; readonly stage: string }
  | { readonly kind: 'invalid-block-execution'; readonly flowId: string; readonly stepId: string; readonly block: string; readonly execution: string }
  | { readonly kind: 'missing-writer'; readonly flowId: string; readonly schemaName: string; readonly slot: string }
  | { readonly kind: 'missing-progress'; readonly flowId: string; readonly stepId: string }
  | { readonly kind: 'generated-parity-drift'; readonly flowId: string; readonly artifact: string };
```

Runtime expected failures should also become values where the caller can render
them. Non-failure states should not be mixed into the error type.

```ts
type RuntimeError =
  | { readonly kind: 'fresh-run-dir-invalid'; readonly runDir: string; readonly reason: string }
  | { readonly kind: 'resume-trace-invalid'; readonly runDir: string; readonly reason: string }
  | { readonly kind: 'manifest-hash-mismatch'; readonly expected: string; readonly actual: string }
  | { readonly kind: 'report-invalid'; readonly schemaName: string; readonly path: string; readonly reason: string }
  | { readonly kind: 'connector-failed'; readonly connector: string; readonly reason: string }
  | { readonly kind: 'route-cycle'; readonly stepId: string; readonly route: string };
```

Checkpoint waiting is a normal runtime outcome, not a failure:

```ts
type RuntimeInterruption = {
  readonly kind: 'checkpoint-waiting';
  readonly runDir: string;
  readonly stepId: string;
  readonly choices: readonly string[];
};
```

Compatibility adapters may keep throwing while old call sites expect thrown
errors. The migration is complete only when expected compiler errors are values
before CLI/runtime rendering.

## Runtime Capability Direction

Do not start by adding Effect to every module. First name the capabilities.

Target service interfaces:

| Capability | Current source shape | Target responsibility |
| --- | --- | --- |
| `Clock` | `now?: () => Date` options across runtime and CLI | Supply time values. |
| `TraceLog` | `TraceStore` | Append and load trace facts. |
| `RunFiles` | `RunFileStore` plus report validator | Read/write run-relative reports with typed failures. |
| `ConnectorRelay` | relayer and connector modules | Relay work to a connector under existing security policy. |
| `Subprocess` | `runConnectorSubprocess()` and proof-plan command execution | Run bounded subprocesses with timeout, capped output, and status values. |
| `Progress` | `ProgressReporter` | Emit progress events without domain code knowing the host. |
| `ChildRuns` | child runner, compiled-flow resolver, worktree runner | Run child flows and expose child results as values. |

If Effect is adopted later, the shape should be an implementation detail around
these named capabilities:

```ts
type CircuitProgram<A> = Effect.Effect<
  A,
  CircuitError,
  Clock | RunFiles | TraceLog | ConnectorRelay | Subprocess | Progress | ChildRuns
>;
```

The only unsafe edge should be an adapter:

```ts
await Effect.runPromise(program.pipe(Effect.provide(NodeRuntimeLive)));
```

The migration must not add Effect until the runtime service boundary is named
across the capabilities in this table and at least one narrow runtime slice has
compatibility tests proving that the old promise API still behaves the same.

## First Executable Slice

Start with Build authoring compression.

Why Build:

- it is public;
- it has checkpoint, compose, relay, verification, close, runtime progress,
  relay hints, writer registration, and an engine flag;
- it is smaller than Explore and Fix;
- it can prove the authoring model without tournament, fanout, sub-run, or
  no-review close special cases.

Slice boundary:

- add compressed definition types and pure compiler helpers in a new module;
- re-express Build in compressed form;
- keep the existing `buildFlowDefinition` export behavior unchanged;
- keep current generated artifacts unchanged;
- do not change runtime execution;
- do not add Effect.

Required parity:

- compressed Build projects to the current `FlowDefinition`;
- projected `CompiledFlowPackage` equals the current Build package;
- projected schematic equals `src/flows/build/schematic.json`;
- generated `generated/flows/build/circuit.json` remains unchanged;
- runtime surface modes, primary result, and progress copy remain unchanged;
- report schemas, relay reports, writers, relay hints, and engine flags remain
  identical;
- command and host mirrors remain unchanged after emit.

Focused verification:

```bash
npm run check
npm run test:fast -- tests/runner/flow-definition-compiler.test.ts tests/contracts/catalog-completeness.test.ts tests/contracts/flow-schematic.test.ts tests/runtime/progress-projection.test.ts
node scripts/emit-flows.ts --check
```

Broaden after the slice:

```bash
npm run lint
npm run build
npm run test:fast
npm run check-plugin-runtime
```

## Migration Readiness Checklist

Before turning this spec into a migration plan, every item below must have a
source-backed answer.

- Current-system map names the owner of flow authoring, block defaults, report
  schemas, writer hooks, relay hints, runtime surface metadata, generated
  artifacts, CLI selection, runtime graph execution, trace storage, connector
  subprocesses, and proof-plan command execution.
- The first compressed authoring value can express Build without method
  chaining, callbacks, or flow-specific compiler branches.
- Derivation rules are explicit for protocol ids, write paths, checks, progress
  metadata, runtime surface rows, report registrations, writer registrations,
  relay hints, generated schematics, and generated manifests.
- The plan distinguishes semantic code from mechanical registration.
- The plan says which existing files become deletable, which remain source, and
  which remain generated compatibility outputs.
- Expected compiler failures have typed error values and tests.
- The old thrown-error API stays behind a compatibility adapter until all call
  sites can render error values.
- Public-flow progress metadata remains complete; missing metadata is a
  validation failure, not a prose fallback.
- Public CLI behavior, report schemas, generated host surfaces,
  engine-to-flow import boundaries, connector security policy, and the retained
  production flow set remain unchanged.

## Disqualifiers

Stop the migration design if any of these becomes necessary:

- Build requires flow-specific compiler branches for ordinary steps.
- The compressed API needs fluent method chains to be usable.
- A reviewer cannot inspect the authored value without running code.
- The compiler must change runtime behavior to preserve parity.
- Public generated artifacts change in the first slice.
- Missing public runtime metadata is silently tolerated.
- Progress display depends on prose step-title heuristics for public flows.
- Connector security policy is loosened or hidden behind a generic effect.
- Semantic writer/helper code is flattened into fragile config.
- Effect is added before named capabilities exist.
- The migration leaves both low-level and compressed authoring as permanent
  peer systems.

## Longer-Term Direction

1. Compress Build authoring and prove parity.
2. Compress Review or Runtime Proof to prove the small-flow path.
3. Compress Explore to prove tournament/fanout paths.
4. Compress Fix last to prove the largest flow and preserve semantic helper
   code.
5. Mark generated schematic compatibility JSON as generated, or stop committing
   it only after a versioned migration.
6. Convert compiler expected failures from throws to typed validation values.
7. Introduce runtime capability interfaces around current concrete stores and
   subprocess helpers.
8. Consider Effect only after capability interfaces and compatibility adapters
   exist.

## What This Spec Does Not Do

- It does not start the migration.
- It does not change runtime behavior.
- It does not change public CLI behavior.
- It does not change report schemas.
- It does not change generated host surfaces.
- It does not add Effect.
- It does not remove semantic writer or helper code.
- It does not reopen connector security policy.
