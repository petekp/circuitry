# Circuit, read as literature

A literate guide to `circuit-next`, written so the system can be understood
end-to-end without first having to puzzle out where things live. Sections are
numbered with the section sign (§1, §2, …) and cross-reference each other.
You can read it linearly; the cross-references exist so you can also jump and
still find your bearings.

The intended reader is someone with general programming experience who is
opening this codebase for the first time — a contributor, a curious engineer,
or a future-you who has lost the thread.

---

## §1. The problem this exists to solve

If you have ever asked an agent to "fix this bug" and watched it confidently
patch the wrong file, you already know the gap Circuit is trying to close.
LLMs can absorb a goal, write code, run a test, and call the result a
victory — all in one breath, with no separable place where someone (operator
or system) can intercede. There is no plan you can read. There is no
verification step that proves the change matches scope. There is no review
done by a worker that did not also write the code. There is, in short, no
*structure* — just a long monologue.

Circuit is what happens when you take that loose monologue and impose
structure on it. Not a hand-rolled prompt of "first do X, then Y" — that
falls over the moment the model decides to skip a step. Real structure: a
data-driven graph of steps, executed by a runtime that records every
boundary it crosses, validates every report it receives, and refuses to
move forward if the contract is not met.

The README puts it in one line:

> **Structured flows for coding agents.**

That phrase compresses three commitments. *Structured* — work is broken into
named stages with typed reports between them. *Flows* — the structure is
authored as data, not assembled at runtime. *For coding agents* — the
worker doing the actual code-writing is an LLM, but the orchestration is
not; the engine is plain TypeScript that happens to call out to an LLM at
specific, controlled boundaries.

We will spend most of this guide explaining what that costs and what it
buys. The short version: it costs a lot of vocabulary and a fair amount of
discipline, and it buys (a) the ability to *resume* a run after a crash,
(b) the ability to swap out *which* worker runs *which* step without
touching the flow, and (c) the ability to read a finished run end-to-end —
inputs, outputs, decisions — from files on disk, days later, without
trusting anyone's memory.

That last property is the one that matters. The rest of the guide is, in a
sense, an extended argument for why it is worth the price.

## §2. Two foundational choices

Before we look at any code, two design decisions shape almost everything
else, and they are worth naming up front.

**The host is not the engine.** A *host* is the place where an operator
types something — Claude Code, Codex, a terminal. The *engine* is the
TypeScript runtime that actually drives a flow forward. Circuit ships
self-contained host plugins (§22) that do nothing but invoke the engine
and render its output. The engine has no opinion about whether it was
launched from a chat UI, a CLI, or a CI job. This separation is what
makes Circuit cross-host: every host adapter speaks the same JSON
protocol to the same binary. A run from Claude Code and a run from the
terminal produce identical run folders.

**Flows are data, not code.** A flow — Build, Fix, Explore, or
Review — is authored as a JSON *schematic* and compiled into a
runtime graph. The engine never imports a flow's code module. New flows
are added by appending to a catalog (§19); the engine derives every
per-flow behavior — routing, report writers, shape hints, skill slots —
from that catalog. If you find yourself adding an `if (flow.id === 'fix')`
to the engine, you are violating the boundary.

These two ideas — host/engine separation and flows-as-data — are the
backbone of the system. They show up in the file layout
(`src/runtime/` for the engine, `src/flows/<id>/` for the flow packages,
`plugins/<host>/` for the host wrappers), in the contracts, and in the
tests. Once you see them, the rest of the architecture is easier to read.

## §3. The vocabulary

The repository ships a `UBIQUITOUS_LANGUAGE.md` that defines its terms
precisely. We will not reproduce it here, but a small core matters for
everything that follows. Read these once and the rest of the guide stops
being foggy.

- A **Flow** is a named kind of work — Build, Fix, Explore, etc.
- A **Schematic** is the authored JSON definition of a flow.
- A **Step** is one executable unit inside a schematic.
- A **Stage** groups steps — Frame, Analyze, Plan, Act, Verify, Review,
  Close.
- A **Run** is one execution of a flow.
- A **Trace** is the append-only record of a run's events.
- A **Report** is a typed file written by a step.
- A **Run folder** is the directory that holds a run's trace, reports,
  and resume state.
- A **Checkpoint** is a step where Circuit pauses for an operator
  decision (or a declared safe default).
- A **Relay** is a handoff to a worker (an LLM, via a connector).
- A **Connector** is the backend that runs a relay — `claude-code`,
  `codex`, or a custom executable.
- A **Role** is what the worker is being asked to do — `researcher`,
  `implementer`, or `reviewer`.

If you remember just one distinction, make it Run vs Session. A *session*
is the human-facing shell — a chat, a terminal — that may contain many
back-and-forths. A *run* is the machine-facing execution of one flow
against one goal. A run survives a session crash because its identity
lives in a folder on disk (§10), not in the session's memory.

## §4. A flow is data

A flow's authored definition is a JSON file at
`src/flows/<id>/schematic.json`. The build script (§19) compiles each
schematic into a `CompiledFlow` — the runtime graph the engine actually
loads. Compiled outputs land at `generated/flows/<id>/circuit.json` and
get mirrored into the host plugin packages.

The `CompiledFlow` schema is defined with Zod and lives at
`src/schemas/compiled-flow.ts`. Its body, trimmed to the fields that
matter to this discussion:

```ts
// src/schemas/compiled-flow.ts
const CompiledFlowBody = z
  .object({
    schema_version: z.literal('2'),
    id: CompiledFlowId,
    version: z.string().min(1),
    purpose: z.string().min(1),
    entry: z.object({
      signals: EntrySignals,
      intent_prefixes: z.array(z.string()).default([]),
    }).strict(),
    entry_modes: z.array(EntryMode).min(1),
    stages: z.array(Stage).min(1),
    stage_path_policy: SpinePolicy,
    steps: z.array(Step).min(1),
    default_selection: SelectionOverride.optional(),
  })
  .strict();
```

Everything is `.strict()` — that is, surplus keys make the parse fail
rather than being silently dropped. This discipline shows up everywhere
in Circuit's schemas, and §23 makes the case for why. For now, take it
as an aesthetic: typos should crash, not warp.

A compiled flow declares its `entry_modes` (the named modes Lite, Default,
Deep, Autonomous, Tournament — each pinning an entry step and a depth),
its `stages` (Frame, Plan, Act, …), and its `steps` — the array of
individual things the engine will execute. This is the data the engine
runs against. The runtime never needs to know that a step *implements
Build*; it knows only that the step is a `relay` with a particular role
and report schema.

Notice that the schematic itself is *not* the runtime form. Schematics
are designed for authoring — they say things like `"output":
"build.implementation@v1"` and `"execution": { "kind": "relay", "role":
"implementer" }`. The compile step in `src/flows/compile-schematic-to-flow.ts`
expands those shorthands into the structured `Step` objects with explicit
`writes`, `routes`, and `check` fields the engine consumes. Authoring and
runtime are deliberately different shapes; the boundary between them is
the compile step.

## §5. The shape of a step

A `Step` is a discriminated union with one variant per execution kind.
Six kinds exist; we will get to the executor for each in §11–§13. For
now, look at one variant — `ComposeStep` — to see the pattern:

```ts
// src/schemas/step.ts
export const ComposeStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('compose'),
  writes: z.object({ report: ReportRef }).strict(),
  check: SchemaSectionsCheck,
}).strict();
```

Every step shares a common base: an `id`, a `title`, a `protocol` (a
versioned identifier for what shape of work the step represents), a
`reads` array of run-relative paths the step is allowed to consume, a
`routes` map from outcome name to next step, and optional `selection`,
`skill_slots`, and `budgets` (max attempts, wall clock).

The discriminant — `kind` — picks the executor. The `executor` field
distinguishes the orchestrator (the engine writes the report itself) from
relayed work (a worker writes the report through a connector).

Three things are worth noticing. First, the `routes` map is data: it
says what to do on each named outcome (`pass`, `retry`, `revise`,
`stop`, `continue`, terminal targets like `@complete`). Second, the
`check` declares the rule that turns a step's output into a route; for
compose steps, `check.required` lists the report sections that must be
populated. Third, both `writes` and the outer step are `.strict()`, so a
schematic with a typo'd field name fails the compile, not at runtime.

This is what we mean by "flows are data" (§2): a `CompiledFlow` is a
typed graph of `Step` objects, and the engine knows how to walk that
graph without ever importing flow-specific code.

## §6. The six step kinds

There are exactly six executor kinds. They are deliberately limited —
adding a new kind is a major change to the engine, while adding a new
*flow* (a new arrangement of these kinds) is mechanical (§19).

The executors live in `src/runtime/executors/` and are wired up in one
small registry:

```ts
// src/runtime/executors/index.ts
export function createDefaultExecutors(options: DefaultExecutorOptions = {}): ExecutorRegistry {
  const relayConnector = options.relayConnector;
  return {
    compose:      async (step, ctx) => executeCompose(step, ctx),
    relay:        async (step, ctx) => executeRelay(step, ctx, relayConnector),
    verification: async (step, ctx) => executeVerification(step, ctx),
    checkpoint:   async (step, ctx) => executeCheckpoint(step, ctx),
    'sub-run':    async (step, ctx) => executeSubRun(step, ctx),
    fanout:       async (step, ctx) => executeFanout(step, ctx, relayConnector),
  };
}
```

The kinds, in plain English:

- **compose** — the orchestrator writes a typed report itself, by reading
  prior reports and applying a registered writer (§11).
- **relay** — Circuit hands work to a worker through a connector and
  receives a report back (§12).
- **verification** — the orchestrator runs declared shell commands and
  records their results.
- **checkpoint** — the run pauses for an operator choice (or a declared
  safe default at certain depths) (§16).
- **sub-run** — a step launches a child flow whose result feeds the
  parent.
- **fanout** — multiple branches run in parallel and their outputs are
  joined.

This split — *the orchestrator does the deterministic work, workers do the
LLM work* — is load-bearing. The orchestrator's job is to read files,
validate schemas, write reports, and append trace entries. The worker's
job is to think. Crossing that line in either direction (an LLM
hand-writing a schema, the orchestrator deciding what to implement) is
where systems like this go wrong. We will see the consequences ratify
themselves throughout §11–§14.

## §7. Routes, recovery, and terminals

A step's `routes` map names every outcome the step can produce. The
target is either another step (by id) or a *terminal* — one of the four
final states the run can land in.

```ts
// src/runtime/domain/route.ts
export type TerminalTarget = '@complete' | '@stop' | '@handoff' | '@escalate';
```

`@complete` means the run finished successfully. `@stop` is a clean
voluntary halt — the operator picked "stop" at a checkpoint, or a
verification failed and the flow has nowhere productive to go. `@handoff`
saves enough state for another session to pick up (§17). `@escalate`
hands the problem to a higher authority — typically a human.

Two route names are special: `pass` and the recovery pair `retry` /
`revise`. `pass` is the success route a check writes when its rule
satisfies. `retry` and `revise` are how a step tells the runner "this
attempt failed but the run is not over — bring me back with one more
shot." The graph runner (§8) knows about these:

```ts
// src/runtime/run/graph-runner.ts
const RECOVERY_ROUTE_LABELS = new Set(['retry', 'revise']);

function maxAttemptsForRoute(step: ExecutableStep, route: string | undefined): number {
  return configuredMaxAttempts(step) ?? (isRecoveryRoute(route) ? 2 : 1);
}
```

Outside a recovery route, a step gets exactly one attempt; on a recovery
return, it gets two by default (overridable by `budgets.max_attempts`).
The runner explicitly tracks an `activeRecovery` so that a step
re-entered through `retry` does not look like a routing cycle. If
recovery exhausts, the run aborts with an explanation written into the
trace.

This is the simplest piece of state in the runner, but it is the one
that makes "the model wrote bad JSON, let it try once more" feel
principled rather than hacky. Recovery is a route, not a flag.

## §8. The graph runner — the heart of the engine

If you read only one file in this codebase, read
`src/runtime/run/graph-runner.ts`. It is the loop that drives every run.
The interesting part is short:

```ts
// src/runtime/run/graph-runner.ts (annotated)
let currentStepId = options.resumeCheckpoint?.stepId ?? flow.entry;
for (let index = 0; index < maxSteps; index += 1) {
  const step = steps.get(currentStepId);
  if (step === undefined) return await closeRun(/* abort */);

  // Compute attempt count, refuse cycles into already-completed steps,
  // honor recovery semantics. Then write step.entered.
  await trace.append({ run_id, kind: 'step.entered', step_id: step.id, attempt });

  // Hand to the executor. Either it returns { route, details } or it
  // signals a checkpoint wait — in which case we return immediately,
  // *without* closing the run.
  const outcome = await executors[step.kind](step, stepContext);
  if (isWaitingCheckpointStepOutcome(outcome)) {
    return { kind: 'checkpoint_waiting', /* … */ };
  }
  const { route, details } = outcome;

  // Resolve the route name to the next step or a terminal.
  const target = step.routes[route];
  if (target === undefined) return await closeRun(/* abort: undeclared route */);

  await trace.append({ run_id, kind: 'step.completed', step_id: step.id, attempt, route_taken: route });

  if (target.kind === 'terminal') {
    return await closeRun(context, outcomeForTerminal(target.target), target.target);
  }
  currentStepId = target.stepId;
  incomingRouteTaken = route;
}
```

A few details lift this above a textbook graph walker.

**Bootstrap is special.** Before the loop starts, the runner appends a
`run.bootstrapped` trace entry that captures the run's identity — flow
id, manifest hash, depth, change kind. This entry is the only place the
run's frozen identity lives; everything else is derived from it. The
`RunTrace` schema (§9) refuses to parse a log whose first entry is
anything else.

**Cycles abort, recovery does not.** A pure graph walker would happily
loop. The runner refuses to re-enter an already-completed step *unless*
the incoming route is a recovery route and the step has attempts
remaining. This makes the difference between "Build is retrying its
implementer" and "Build's plan step routes to itself in an infinite
loop" structural, not best-effort.

**A checkpoint is not closure.** When an executor returns a waiting
checkpoint outcome, the runner returns *up* the stack without writing a
`run.closed` trace entry. The CLI catches this and reports a special
`checkpoint_waiting` outcome. The next session resumes the run by
loading the same folder (§17). Checkpoints are pauses, not endings — the
log distinguishes the two by what is and is not in it.

**Errors close the run.** A handler exception writes `step.aborted` and
then closes the run with `aborted`. There is no path where an error
silently disappears; the trace either contains a successful completion,
an aborted close, or no close at all (a checkpoint-waiting run).

The runner is roughly 550 lines of TypeScript. There is no flow-specific
code in it. Everything that distinguishes Build from Fix lives either in
the schematic (data) or in the writers and shape hints (per-flow code in
`src/flows/<id>/`).

## §9. Trace as the source of truth

The trace is the single place where Circuit records what happened. It is
a file — `trace.ndjson` — under each run folder, holding one JSON
event per line. Every other piece of run state is derived from it: the
operator summary (§20), the in-progress projection, the resume position
(§17), the verdict reported on stdout. The trace is the *authority*; the
projections are read-only views.

The store enforces the discipline:

```ts
// src/runtime/trace/trace-store.ts (excerpt)
async append(input: TraceEntryInput): Promise<TraceEntry> {
  const appendOne = async (): Promise<TraceEntry> => {
    if (this.closed) throw new Error('cannot append trace entry after run close');
    const entry = TraceEntrySchema.parse({
      ...input,
      schema_version: input.schema_version ?? 1,
      recorded_at: input.recorded_at ?? this.now().toISOString(),
      sequence: this.nextSequence,
    });
    await appendFile(this.tracePath, `${JSON.stringify(entry)}\n`, 'utf8');
    this.nextSequence += 1;
    this.entries.push(entry);
    if (entry.kind === 'run.closed') this.closed = true;
    try { await this.options.onAppend?.(entry); } catch { /* projections cannot corrupt the trace */ }
    return entry;
  };
  // Serialize concurrent appends through a chained promise.
  const result = this.appendTail.then(appendOne, appendOne);
  this.appendTail = result.then(() => undefined, () => undefined);
  return await result;
}
```

A few invariants are visible here. **Sequence numbers are assigned by the
store, not the caller.** They are 0-based, contiguous, monotone — the
schema rejects gaps. **Appends after `run.closed` throw.** Closing is
terminal; the only way past it is to start a new run. **Projection
hooks are insulated.** A failing `onAppend` cannot corrupt the trace,
because the file write happened before the hook ran and the hook's
exception is swallowed.

The list of trace-entry kinds is open-ended but small: `run.bootstrapped`,
`run.closed`, `step.entered`, `step.completed`, `step.aborted`,
`step.report_written`, `check.evaluated`, `relay.started`,
`relay.request`, `relay.receipt`, `relay.result`, `relay.completed`,
`relay.failed`, `skills.loaded`, `checkpoint.requested`,
`checkpoint.resolved`, `sub_run.started`, `sub_run.completed`,
`fanout.*`. Each variant is `.strict()` and fails parse on a typo — so a
writer that misspells `report_path` as `report_pahh` cannot silently
strip the field and pass through.

Why this much ceremony? Because the trace is the *only* thing replay can
trust. If the snapshot file (§17) and the trace disagree about whether a
step completed, the trace wins — by construction, the snapshot is a
function of the trace. Every contract in `docs/contracts/run.md` lands
on the same point: anything that could let two runs' entries silently
merge, or let a typo silently strip a field, is rejected at parse time.
This is how the engine survives crashes (§17): the trace is the world,
the snapshot is just a mirror.

## §10. The run folder

Each run gets its own directory:

```
.circuit-next/runs/<run-id>/
├── trace.ndjson                   # the log (§9)
├── manifest.json                  # the saved CompiledFlow bytes
├── result.json                    # written at run.closed
├── reports/
│   ├── <flow>-result.json         # the close report
│   ├── <flow>/<step>.json         # per-step typed reports
│   ├── relay/<step>.{request,receipt,result}.json
│   ├── checkpoints/<step>-{request,response}.json
│   └── operator-summary.{json,md} # the human-facing projection (§20)
```

Every path is *relative to the run folder root*. The runtime forbids
escapes:

```ts
// src/runtime/run-files/paths.ts (excerpt)
export function resolveRunFilePath(runDir: string, runRelativePath: string): string {
  if (isAbsolute(runRelativePath)) throw new Error(`run file path must be relative: …`);
  if (runRelativePath.includes('\\')) throw new Error('must use POSIX "/" separators');
  if (runRelativePath.split('/').some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error('must not contain empty, current-directory, or parent-directory segments');
  }
  // Plus: real-path checks reject any segment that is or crosses a symlink.
}
```

A run folder is "current" only if it contains a valid manifest snapshot
*and* a `run.bootstrapped` trace entry whose `manifest_hash` matches that
snapshot. This is the gate every entry point checks before treating a
folder as resumable. Status projection, checkpoint resume (§17), and
handoff continuity all read this same contract.

This is more than tidiness. It means every artifact a run can produce —
the model's response body, the verification's exit code, the operator's
checkpoint choice — is *content-addressed by location*. Days later, an
audit can read a folder and reconstruct the run; nothing important lives
in an external database, an in-process variable, or an ephemeral session.

## §11. Compose: the orchestrator's voice

A `compose` step is one where the engine itself writes a typed report by
reading prior reports and applying a registered writer. No LLM involved.
This is how Circuit composes a Build *plan* from the Build *brief*, or a
final Build *result* from every report the run has produced.

```ts
// src/runtime/executors/compose.ts (excerpt)
async function writeRegisteredComposeReport(step, context) {
  const report = step.writes?.report;
  if (report?.schema === undefined) return false;
  const flow = requireCompiledFlow(context, step);
  const compiledStep = requireCompiledStep(context, step, 'compose');
  const composeBuilder = findComposeBuilder(report.schema);
  if (composeBuilder !== undefined) {
    const readPaths = resolveComposeReadPaths(composeBuilder, flow, compiledStep);
    const inputs = Object.fromEntries(
      Object.entries(readPaths).map(([name, p]) =>
        [name, p === undefined ? undefined : readJsonReport(context, p)]),
    );
    const body = composeBuilder.build({ runFolder: context.runDir, flow, step: compiledStep, /*…*/ inputs });
    await context.files.writeJson(report, body);
    return true;
  }
  // Fall through to close-builder lookup; otherwise throw.
}
```

The mechanics are deliberately dull. A *compose builder* is a per-flow
function registered by schema name. The builder declares which input
reports it needs; the executor resolves those paths, reads them, calls
the builder with structured inputs, and writes the typed body. The
schema is validated on the way in (§9: `step.report_written` is
appended only after a successful `writeJson`).

Two design notes. First, *no prompts*. Compose is the place where the
engine does its own work, deterministically, against schemas it
controls. If a step needs an LLM's interpretation of something, that
step is a relay (§12), not a compose. Second, *schema name is the
key*. The builder registry maps `'build.plan@v1'` to the function that
knows how to produce a Build plan from a Build brief. This is the
mechanism that lets the engine handle every flow's compose steps with
the same code path: the engine looks up the writer by schema, the
writer knows what its inputs and outputs are.

The final step of every flow is a compose step that writes the flow
result. This is by design: the *result* is a deterministic projection of
everything a run produced, and we want it built by code we can read,
not by an LLM that might decide it knows better.

## §12. Relay: the only place a worker writes

A `relay` step is where Circuit hands work to an LLM through a
*connector*. It is the only step kind where a worker writes a report.
Everything else — verification, compose, checkpoint, fanout join,
sub-run mediation — is the orchestrator's responsibility.

The relay executor's job is approximately: pick the connector, render
the prompt, write the request, invoke the connector, validate the
response, write the report. Each of those crossings is recorded in the
trace.

The full sequence of trace entries for one successful relay attempt is:

```
relay.started     — connector chosen, role recorded, selection resolved
[skills.loaded]   — local skills, if any, with content hashes (§21)
relay.request     — sha256 of the prompt bytes
relay.receipt     — connector's receipt id and CLI version
relay.result      — sha256 of the result body
relay.completed   — verdict + duration
check.evaluated   — pass or fail against the report's check rule
```

When the connector itself fails (process crash, timeout, schema reject)
the sequence ends instead with `relay.failed`, which carries enough
provenance — connector, role, resolved selection, resolved-from
provenance, request hash, terminal reason — to distinguish
infrastructure failure from a model-produced "reject" verdict.

A condensed view of the writer:

```ts
// src/runtime/executors/relay.ts (excerpt; trimmed)
const requestPath = context.files.resolve(request);
await writeFile(requestPath, prompt, 'utf8');
const requestPayloadHash = sha256Hex(prompt);

await context.trace.append({ kind: 'relay.started', /* connector, role, resolved_selection, resolved_from */ });
if (loadedSkills.length > 0) {
  await context.trace.append({ kind: 'skills.loaded', skills: loadedSkills.map(({ body: _, ...s }) => s) });
}
await context.trace.append({ kind: 'relay.request', request_payload_hash: requestPayloadHash });

let relayResult: RelayResult;
try {
  relayResult = await relayWithResolvedConnector(relayExecution.connector, { prompt, /*…*/ });
} catch (error) {
  await context.trace.append({ kind: 'relay.failed', /* full provenance + reason */ });
  return { kind: 'connector_failed', /* … */ };
}

await context.files.writeText(receipt, relayResult.receipt_id);
await context.files.writeText(result, relayResult.result_body);
await context.trace.append({ kind: 'relay.receipt', receipt_id, cli_version });
await context.trace.append({ kind: 'relay.result', result_report_hash: sha256Hex(relayResult.result_body) });
```

The hashes matter. They turn the trace into a *cryptographic* audit
trail: if the request file on disk does not hash to the value in
`relay.request`, the file has been tampered with after the fact, and the
checkpoint-resume path (§17) will refuse to continue. The same trick
guards checkpoint reports.

The other thing this code does — quietly — is enforce that the relay
step's structure is what the worker thinks it is. Notice `step.report` is
checked, parsed, and validated through `parseReport` (a Zod schema
lookup keyed by name) and then through `runCrossReportValidator` (a
per-flow check that spans multiple reports, e.g. "every batch item id
must come from the queue's `to_execute` list"). A worker that returns
JSON that parses as legal but cross-validates as illegal sees the same
recovery route as a worker that returned malformed JSON. The worker is
not trusted to know that two reports must agree; the validator is.

## §13. Connectors

A *connector* is the executable that runs a relay. Three matter:
`claude-code`, `codex`, and *custom*.

The `claude-code` connector spawns the Claude Code CLI as a Node
subprocess. Its argv is constant and load-bearing:

```ts
// src/connectors/claude-code.ts
export const CLAUDE_CODE_DISPATCH_FLAGS = [
  '-p',
  '--permission-mode', 'bypassPermissions',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--setting-sources', '',
  '--settings', '{}',
  '--output-format', 'stream-json',
  '--verbose',
  '--no-session-persistence',
] as const;
```

Each flag is there for a reason the file documents inline. `-p` selects
print mode (non-interactive). `bypassPermissions` lets the worker call
its tools without an interactive approval — there is no human in the
loop to approve, and the *check* (Zod report validation + accepted
verdict allowlist) is the substituted safety net. `--strict-mcp-config`
empties the MCP server list so no remote-write surfaces (Gmail, Notion,
Slack) leak in. `--disable-slash-commands` prevents user-defined skills
from contaminating behavior. `--setting-sources ''` skips user, project,
and local settings — important because a hook in the operator's
settings could otherwise re-enter Circuit recursively. `--settings '{}'`
seals it.

The `codex` connector is similar in purpose but different in mechanism.
Codex's CLI does not allow per-tool surface configuration; instead, it
relies on an OS-level sandbox (Seatbelt on macOS, Landlock on Linux):

```ts
// src/connectors/codex.ts
export const CODEX_NO_WRITE_FLAGS = Object.freeze([
  'exec', '--json', '-s', 'read-only', '--ephemeral', '--skip-git-repo-check',
] as const);
```

`-s read-only` is the capability anchor. Two flags would defeat it —
`--dangerously-bypass-approvals-and-sandbox` and `--full-auto` (which
silently widens the sandbox to writable) — and the connector explicitly
forbids them in argv before spawn. There is also a forbidden `--add-dir`
(extends writable roots), `-o` (writes the final message to a file),
and `-c` overrides for sandbox keys. The connector validates the final
spawn argv before launch.

The Codex connector cannot run an `implementer` role, because read-only
workers cannot write files. The relay resolver (§15) enforces this:
asking for an implementer relay through Codex fails closed at resolution
time, before the subprocess spawns.

The *custom* connector path lets operators register a wrapper executable
under `relay.connectors.<name>` in their config. The contract is
deliberately tiny — Circuit appends `PROMPT_FILE OUTPUT_FILE` as the
last two arguments; the wrapper reads the prompt and writes a JSON
object to the output file. Stdout becomes debug; stderr is propagated
on failure. Custom connectors are trusted local processes, not OS
sandboxes — declaring `capabilities.filesystem: read-only` only
affects which roles the resolver will route them to; it does not stop
the wrapper from writing files itself.

## §14. Two capability boundaries

Step back from the connector code and you can see the two distinct
strategies for "what can a worker do." The Claude Code connector
encodes its boundary at the *declarative tool layer* — by the flags
above and a parse-time assertion that the subprocess's init event
enumerates the expected tool surface. The Codex connector encodes its
boundary at the *OS layer* — by passing `-s read-only` and asserting on
the spawn argv. Both are valid; both are auditable.

Why two? Because the two CLIs are different shapes. Claude Code emits a
detailed init event; Codex does not. Trying to encode Codex's boundary
the way Claude Code's is encoded would be unsound. Trying to encode
Claude Code's boundary the way Codex's is encoded would force every
Claude Code worker into a process-level sandbox the CLI does not
support. The connectors meet the surface they have, not a surface we
wish they had.

This is also why the relay layer (§12) has to validate every report.
You cannot trust a worker to write the right thing just because the
sandbox prevents it from writing the wrong thing — the worker can still
return a string that parses as JSON but means the wrong thing. The
sandbox is a perimeter; the schema is the contract.

## §15. Selection: model, effort, skills, depth, and provenance

Each relay step needs to know *which* model to invoke at *what* effort,
with *which* local skills, on *what* connector. Selection is the layered
resolution that produces those decisions, with provenance.

The order is fixed:

1. Defaults (compiled in).
2. User-global config — `~/.config/circuit-next/config.yaml`.
3. Project config — `./.circuit/config.yaml`.
4. Flow defaults — `default_selection` from the schematic.
5. Stage selection — per-stage overrides in the flow.
6. Step selection — per-step overrides in the flow.
7. Invocation overrides — anything passed by the caller.

The resolver walks this order, applying each override that contributes,
recording every applied entry as it goes:

```ts
// src/shared/selection-resolver.ts (excerpt)
for (const source of PRE_WORKFLOW_CONFIG_SOURCES) {
  const layer = configLayers[source];
  if (layer === undefined) continue;
  const override = configLayerSelection(flowId, layer, resolved);
  if (override === undefined) continue;
  resolved = pushIfContributing(applied, { source, override }, resolved);
}
if (input.flow.default_selection !== undefined) {
  resolved = pushIfContributing(applied, { source: 'flow', override: input.flow.default_selection }, resolved);
}
for (const stage of input.flow.stages) {
  if (!stage.steps.includes(stepId)) continue;
  if (stage.selection === undefined) continue;
  resolved = pushIfContributing(applied, { source: 'stage', stage_id: stage.id, override: stage.selection }, resolved);
}
if (input.step.selection !== undefined) {
  resolved = pushIfContributing(applied, { source: 'step', step_id: input.step.id, override: input.step.selection }, resolved);
}
// Invocation layer is applied last, so CLI flags always win.
```

The output is a `SelectionResolution` with two fields: `resolved`, the
final selection, and `applied`, an ordered list of the layers that
contributed. The `resolved_from` provenance ends up in the
`relay.started` trace entry, so an audit can reconstruct *why* a
particular model was chosen for a particular relay.

A wrinkle worth naming: most flows do not let depth feed selection.
Build does — the `bindsExecutionDepthToRelaySelection` engine flag opts
in. The reason is that Build's pattern is "lite uses a smaller worker;
deep uses a larger one," and threading depth into the selection lets
config express that without baking model identities into the schematic.
Other flows don't need it, so they don't get it. Engine flags are
narrow on purpose: they are switches the engine itself branches on, not
flow-name escapes.

```ts
// src/shared/relay-selection.ts (excerpt)
export function bindsExecutionDepthToRelaySelection(flow: CompiledFlow): boolean {
  const pkg = findCompiledFlowPackageById(flow.id as unknown as string);
  return pkg?.engineFlags?.bindsExecutionDepthToRelaySelection === true;
}
```

The same flag-driven approach applies to connector routing. The
resolver in `src/runtime/connectors/resolver.ts` walks `relay.roles.<role>`,
then `relay.circuits.<flow_id>`, then `relay.default`, then auto-detect.
When a step opts into a specific connector, the resolver treats that
choice as authoritative and rejects layered values that disagree. This
is what lets the same Build flow run with `claude-code` for the
implementer, `codex` for the reviewer, and a custom connector for a
researcher — without changing the schematic.

## §16. Checkpoints

A checkpoint step pauses a run for an operator decision. Build's frame
step ships with a single `continue` choice; Explore's tournament
checkpoint ships with several, one per option under evaluation. Whether
the run *actually* pauses depends on the depth.

```ts
// src/runtime/executors/checkpoint.ts (excerpt)
function resolveCheckpoint(step, depth) {
  const effectiveDepth = depth ?? 'standard';
  const stepPolicy = policy(step);
  if (effectiveDepth === 'deep' || effectiveDepth === 'tournament') return { kind: 'waiting' };
  if (effectiveDepth === 'autonomous') {
    const selection = stepPolicy.safe_autonomous_choice;
    if (selection === undefined) return { kind: 'failed', reason: '…no declared safe autonomous choice' };
    return { kind: 'resolved', selection, resolutionSource: 'safe-autonomous', autoResolved: true };
  }
  const selection = stepPolicy.safe_default_choice;
  if (selection === undefined) return { kind: 'failed', reason: '…no declared safe default choice' };
  return { kind: 'resolved', selection, resolutionSource: 'safe-default', autoResolved: true };
}
```

The depth is the lever. At standard depth, a checkpoint auto-resolves
to its declared safe default — the schematic author's promise that
this choice is the conservative one if no human is around. At deep
or tournament depth, the checkpoint waits — the run returns up to the
CLI as `checkpoint_waiting`, the operator sees the prompt rendered in
the host, and the next session resumes with the chosen choice. At
autonomous depth, a separate `safe_autonomous_choice` (which may be
different from the standard safe default) auto-resolves.

This is the design that lets a single schematic be used for every
mode. The flow author writes one set of checkpoints, declares the safe
default per choice, and lets depth decide whether to actually pause.
"Lite skips review" and "deep waits at architecture-class checkpoints"
are not different schematics — they are the same schematic interpreted
through different depths.

A `checkpoint.requested` trace entry carries the request file's sha256,
and the request file itself carries a `selection_config_layers` snapshot
of the resolver state at the moment of pause. The resume path (§17)
reads both back and uses them to reconstruct the run.

## §17. Resume

A run that pauses at a checkpoint can be resumed in another session:

```bash
./bin/circuit-next resume --run-folder <path> --checkpoint-choice <choice>
```

The resume path does not generate fresh files. It reads the manifest
snapshot, the trace, and the checkpoint request *from the run folder*,
validates that they agree with each other, and re-enters the graph
runner with the operator's selection.

```ts
// src/runtime/run/checkpoint-resume.ts (excerpt)
export async function resumeCompiledFlow(options) {
  const trace = new TraceStore(options.runDir, /* … */);
  const entries = await trace.load();
  const bootstrap = entries[0];
  if (!isRuntimeBootstrap(bootstrap)) throw /* not a runtime run folder */;
  if (entries.some((e) => e.kind === 'run.closed')) throw /* already closed */;

  const { flow, flowBytes, snapshot } = await readRuntimeCompiledFlowManifestSnapshot({
    runDir: options.runDir,
    expectedRunId: bootstrapRunId,
    expectedFlowId: bootstrapFlowId,
    expectedHash: bootstrapManifestHash,
  });

  const requested = latestUnresolvedCheckpoint(entries);
  // Validate request file's sha256 matches the trace entry's request_report_hash.
  // Validate the choice is in step.choices.
  // Validate the saved flow's checkpoint step shape matches the trace.
  // Re-resolve selection from the saved selection_config_layers.
  return executeExecutableFlow(executable, { /* …, resumeCheckpoint: { stepId, attempt, selection } */ });
}
```

The validation chain is comprehensive on purpose. A run folder that has
been edited between save and resume — a file truncated, a request
swapped — fails before the engine commits to anything. The hashes are
not nice-to-haves; they are the only mechanism that keeps replay honest
when files on disk are mutable.

This same pattern — the trace is the world, files are projections —
shows up in the broader handoff CLI (`circuit-next handoff save | resume |
done`). A handoff is a cross-session continuity record, useful when
you want to stop work for the day and have the next session pick up
the right run with the right context. The continuity record contains
the run folder reference and a small piece of operator-authored prose;
the actual *state* still lives in the run folder.

## §18. Routing — picking a flow from a goal

When a user says "fix this bug" or "compare auth providers," some
component has to decide *which* flow runs. Three different things might
be making that decision, and the README and the host-adapter contract
take pains to keep them separate.

**The host model.** When a user types `/circuit:run …` in Claude Code,
the slash command's prompt instructs the host model to pick a flow
before invoking the CLI. The Claude Code plugin's `run.md` contains
the rubric the model uses. The decision is the host model's; Circuit
just sees an explicit `circuit-next run <flow> --goal "…"`.

**The CLI router.** When the CLI is invoked without an explicit flow —
`circuit-next run --goal "…"` — Circuit's deterministic classifier picks
one. That is `src/flows/router.ts`, a regex-and-rule classifier that
walks the flow packages in priority order:

```ts
// src/flows/router.ts (excerpt)
for (const { pkg, routing } of routables) {
  if (routing.isDefault) continue;
  for (const signal of routing.signals) {
    if (!signal.pattern.test(taskText)) continue;
    if (routing.skipOnPlanningReport === true && hasPlanningReport) {
      break;  // Suppressed by the planning-report guard; fall through to next package.
    }
    return {
      flowName: pkg.id,
      source: 'classifier',
      matched_signal: signal.label,
      reason: routing.reasonForMatch(signal),
      ...inferEntryMode(pkg.id, taskText),
    };
  }
}
```

The router is intentionally dumb. It does not call an LLM. It runs a
list of regexes against the goal text in a fixed order. Review is
considered first because its signals — "review", "audit" — are
unambiguous. Build is considered last because its signals
("build", "implement") collide with planning-report phrasing
("write a plan"). When a signal matches but the request also mentions a
planning artifact ("write a build plan"), the `skipOnPlanningReport`
guard suppresses the match and lets routing fall through to the
default flow.

**Plan-execution shortcuts.** A separate classifier branch picks up
imperative phrasings — "execute this plan", "carry out this checklist"
— and routes them based on what kind of work the plan describes.
"Decide between options" routes to Explore in tournament mode. These are conveniences for habits
the operator already has; they are not the canonical front door.

**Explicit flow names.** `circuit-next run build --goal "…"` skips
routing entirely. The host plugin's per-flow commands
(`/circuit:build`, `/circuit:fix`, …) take this path.

A run's operator summary (§20) records *which* path picked the flow
(`routed_by: classifier` or `routed_by: explicit`) and the reason. An
operator who disagrees with the classifier's choice can pass an
explicit flow next time. The asymmetry is by design: the engine is
opinionated about how to *run* a flow; it is humble about which flow to
run.

## §19. Flow packages — adding a flow without touching the engine

The `src/flows/<id>/` folder is the unit of authoring. A flow package
exports a single value:

```ts
// src/flows/types.ts (excerpt)
export interface CompiledFlowPackage {
  readonly id: string;
  readonly visibility: 'public' | 'internal';
  readonly paths: { schematic: string; command?: string; contract?: string };
  readonly routing?: CompiledFlowRoutingMetadata;
  readonly relayReports: readonly CompiledFlowRelayReport[];
  readonly reportSchemas?: readonly CompiledFlowReportSchema[];
  readonly writers: {
    readonly compose: readonly ComposeBuilder[];
    readonly close: readonly CloseBuilder[];
    readonly verification: readonly VerificationBuilder[];
    readonly checkpoint: readonly CheckpointBriefBuilder[];
  };
  readonly structuralHints?: readonly StructuralShapeHint[];
  readonly engineFlags?: CompiledFlowEngineFlags;
}
```

Three things travel together in a package: the *data* (the schematic and
its routing metadata), the *schemas* (the Zod validators for the reports
the flow produces), and the *writers* (the per-flow code for compose,
close, verification, and checkpoint reports). The engine never imports a
package directly; it consumes them through `src/flows/catalog.ts`:

```ts
// src/flows/catalog.ts
export const flowPackages: readonly CompiledFlowPackage[] = [
  reviewCompiledFlowPackage,
  fixCompiledFlowPackage,
  runtimeProofCompiledFlowPackage,
  buildCompiledFlowPackage,
  exploreCompiledFlowPackage,
];
```

Adding a flow is therefore a four-step recipe: create the folder,
export a package, append it to the catalog, run `npm run build && node
scripts/emit-flows.ts` to regenerate the compiled JSON and host plugin
mirrors. No engine edit. The repository's `AGENTS.md` says the rule
explicitly: *if you find yourself editing engine files to add a flow,
the boundary is being violated.*

The catalog also drives drift detection. A CI step,
`check-flow-drift`, runs the emit pipeline and compares the output bytes
to the committed files. If a schematic edit forgot to regenerate the
compiled JSON, CI fails. This is what makes the host plugins safe to
ship: the bytes in `plugins/<host>/skills/<id>/circuit.json` are
guaranteed to match the schematics they were derived from.

This is also where structural shape hints live. A *shape hint* is the
prompt fragment a relay step appends to tell the worker the exact JSON
shape its response must have. The hint is co-located with the schema
it constrains, and it lives in the flow package, not in the engine —
because the engine has no business knowing what a Build review report
looks like.

```ts
// src/flows/build/relay-hints.ts (excerpt)
export const buildImplementationShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'build.implementation@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "summary": "<what changed>", "changed_files": [...], "evidence": [...] }',
    'Make the smallest behaviorally scoped change that satisfies the requested goal. …',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against build.implementation@v1 before writing reports/build/implementation.json.',
  ].join(' '),
};
```

The hint tells the worker exactly what to produce *and* tells it what
the runtime will reject. The worker is being honest about its
constraints because honesty is cheaper than re-running a relay. The
worker is told what the runtime checks because being told closes a
class of avoidable failures.

## §20. The operator summary — talking to humans

A `result.json` is the machine-facing artifact of a run. An operator
summary is the human-facing one. It is a deliberately *lossy*
projection: it skips evidence the operator does not need to see and
foregrounds the verdict, the residual risks, and the next step.

The writer lives at `src/shared/operator-summary-writer.ts`. It produces
two files: `reports/operator-summary.json` (typed) and
`reports/operator-summary.md` (human-readable). The host plugins are
expected to render the markdown verbatim — operators see Circuit's
voice, not the host model's paraphrase.

A small example of the kind of normalization the writer does:

```ts
// src/shared/operator-summary-writer.ts (excerpt)
function friendlyRunNote(flowId, summary) {
  const match = /^([a-z-]+) v[\d.]+ closed (\d+) step\(s\) for goal ".+"\.$/.exec(summary);
  if (match !== null) {
    return `Circuit completed ${match[2]} ${capitalized(flowId)} steps for this goal.`;
  }
  return summary;
}
```

The runtime's literal "build v0.1.0 closed 6 step(s) for goal …" is a
fact, but it is not a sentence anyone wants to read. The writer
rewrites it into a friendlier line. This is a small piece of evidence
for a much larger principle: *user-facing prose is plain English*. The
project's `AGENTS.md` enforces this for the operator-facing voice;
the operator summary writer is where that rule turns into code.

A nice consequence: the same writer produces the summary for both a
completed run (`run.closed` with outcome `complete`) and a
checkpoint-waiting run. The operator gets a coherent sentence in both
cases — "the run is paused for your decision," not a stack trace.

## §21. Skills

A *skill* in Circuit is a SKILL.md file under
`~/.agents/skills/<id>/SKILL.md` or `~/.claude/skills/<id>/SKILL.md`. A
relay step can have one or more *skill slots* — optional flow-authored
placeholders that the operator binds to concrete local skills in
`config.yaml`. There is also `selection.skills`, an explicit list that
appends or replaces the slot bindings.

When a relay attempt loads skills, it appends a `skills.loaded` trace
entry with the id, optional slot, path, sha256, and byte count of each
loaded skill. The body itself is *not* stored in the trace — only its
hash, so an audit can verify what was loaded without storing
arbitrary text.

This integrates cleanly with everything we have already established.
Skills are content-addressed (sha256), so the trace can prove which
skill was loaded; loading is recorded between `relay.started` and
`relay.request`, so the prompt the worker received is auditable; and
the resolved selection (§15) decides *which* skills load, so config
layering remains the single point of policy.

The deliberate anti-feature is hard-coding skill ids in flow packages.
A built-in flow may expose an optional slot, but it never names a
concrete skill id; that name must come from operator config. The
reason is contamination: if a flow shipped with a hard-coded
`react-change-review` skill, every operator would pull that skill
whether or not they wanted to, and Circuit would have stitched its
flows into one operator's preferences. Slots make the joint visible.

## §22. Plugins — how Circuit reaches the host

`plugins/claude/` and `plugins/circuit/` are self-contained host
adapters. They are generated artifacts, but they are committed to the
repository because hosts install them as packages, not as build
products.

The Claude Code plugin contains:

- `commands/<id>.md` — slash command files (`/circuit:run`,
  `/circuit:fix`, etc.). These are prompts that the host model reads;
  they instruct the model to pick a flow and then invoke the CLI.
- `skills/<id>/circuit.json` — compiled flow JSON, mirrored from
  `generated/flows/`.
- `hooks/session-start.mjs` — a hook that injects a Circuit handoff
  context into the start of a session if a continuity record is present.
- `.claude-plugin/plugin.json` — the plugin manifest.

The Codex plugin (`plugins/circuit/`) is shaped slightly differently —
flows live under `flows/<id>/` and are loaded by a `scripts/circuit-next.mjs`
launcher that injects `--flow-root` so Circuit reads the packaged flows
rather than the operator's checkout.

The `host-adapter.md` contract under `docs/contracts/` governs this
surface. Every host adapter MUST support routed runs, explicit
runs, checkpoint resume, JSON parse from stdout, JSONL progress from
stderr, task-list rendering from `task_list.updated` events,
user-input rendering from `user_input.requested` events, and verbatim
rendering of the operator summary's markdown. The contract is the
*reason* the host adapters are interchangeable — a Codex run and a
Claude Code run produce identical run folders because both hosts speak
the same protocol to the same engine.

The hook design has its own constraint, worth highlighting because it
is a class of bug Circuit got wrong once and corrected. A host hook
runs in some cwd that the host chooses — sometimes the project, often
a plugin cache. A naive hook would call `process.cwd()` to find the
project root; that produces a workspace-identity bug because the hook
is not in the project. The contract requires hooks to read the host's
stdin JSON for workspace identity and pass an explicit `--project-root`
to Circuit. The bug is now an explicit rule (§7 in `AGENTS.md`):
*"Host hooks use hook input for identity."*

## §23. Strict by default

Several places in this guide have noted, in passing, that schemas are
`.strict()` and that fields are validated by Zod even when "everyone
knows" what shape they should be. Step back and you can see this is
a system-wide commitment.

The clearest articulation lives in `docs/contracts/run.md`, which lists
eight `RUN-I` invariants the runtime enforces. A few of them, paraphrased:

- **RUN-I1.** A trace's first entry is `run.bootstrapped`. The bootstrap
  carries `flow_id`, `manifest_hash`, `depth`, and `change_kind` — fields
  that cannot be inferred from any later entry. A log that begins
  otherwise has no framing and is rejected.
- **RUN-I2.** Sequence numbers are 0-based, contiguous, monotonic. Gaps,
  repeats, and out-of-order entries are rejected at parse time.
- **RUN-I3.** Every entry in a `RunTrace` shares the bootstrap's
  `run_id`. Cross-run smuggling — concatenating two runs' logs — is the
  most dangerous corruption mode for log-sourced state, and it is
  rejected even though no individual entry can detect it. There is even
  a defense against prototype-chain tricks: the identity fields
  (`run_id`, `kind`, `sequence`) must be *own* properties, so an
  `Object.create({ run_id: phantom })` cannot smuggle a phantom id past
  the discriminated union.
- **RUN-I8.** Every schema that crosses the trace/snapshot boundary is
  `.strict()` *transitively* — `ChangeKindDeclaration`, `ConnectorRef`,
  `ProviderScopedModel`, `SkillOverride`, `SelectionOverride`,
  `ResolvedSelection`, every nested object. A typo anywhere in the tree
  is rejected, not stripped.

These are not idle. The contract documents specific historical bugs
each invariant closes — a writer that misspelled `report_path` as
`report_pahh` (silent strip, fields disappear); a snapshot that
disagreed with the bootstrap on `change_kind` (silent divergence,
nobody noticed); a polluted resolved-selection that smuggled extra
keys through nested objects (silent contamination, subtle behavior
drift). Strictness is the response to actual incidents, not a
preference.

The cost is real. Adding a field requires a schema edit, a contract
update, and often a fixture refresh. The benefit is
also real: when something goes wrong, it goes wrong *loudly*, at the
boundary, with a Zod error that names the offending key. The audit
trail is trustworthy because the schema refuses to admit anything
ambiguous.

## §24. The themes that persist

A literate guide is supposed to convince the reader that the design has
a center of gravity. Circuit's center, if I had to name it in one
breath: *the trace is the world; everything else is a projection*. From
that one commitment a great many other things follow.

It follows that flows must be *data*, not code (§4) — because code
cannot be a projection. It follows that the trace is `.strict()` and
its sequence numbers are mandatory (§9, §23) — because a projection is
only useful if the source is unambiguous. It follows that resume
hashes everything it touches (§17) — because a projection that cannot
re-derive itself from disk is fragile. It follows that compose is
the orchestrator's voice and relay is the worker's (§11, §12) —
because mixing them blurs the question "who wrote this?" It follows
that connectors are a thin shell over an external CLI, with their
boundaries asserted on argv (§13, §14) — because a connector that
silently widens its surface invalidates everything the trace says
about a relay. It follows that operator-facing text is plain English
(§20) — because if you cannot read the projection, the source might as
well be opaque.

The other themes — host/engine separation (§2), flows-as-packages
(§19), strictness as a system property (§23) — are downstream of the
same commitment, expressed at different scales. The engine is small
because flows are data. The host adapters are interchangeable because
they speak a stable protocol to the same engine. The schemas are
strict because the trace must be honest.

If you came to this guide cold and now have a sense of *why* the
codebase is shaped the way it is — why there is a `RunFileStore` that
forbids parent-segment paths, why `relay.failed` repeats the
`relay.started` provenance, why `bindsExecutionDepthToRelaySelection`
is an opt-in flag rather than a default, why custom connectors must be
named in `connectors` and referenced by name — then the literate guide
has done its job. The code itself is the rest of the story; you can
now read it as something other than a list of files.

---

*Where this guide can lead you next: `UBIQUITOUS_LANGUAGE.md` for the
canonical vocabulary, `docs/architecture/runtime.md` for the runtime's
own one-page summary, `docs/contracts/run.md` for the formal RUN-I
invariants, `docs/contracts/host-adapter.md` for the host adapter
surface, `docs/flows/blocks.md` for the block catalog and authoring
model. The schematics under `src/flows/<id>/schematic.json` are the
clearest examples of the data we have been discussing all along.*
