# Architecture

Reference for circuit authors and contributors. For a user-facing overview of
what each circuit does, see [CIRCUITS.md](CIRCUITS.md).

---

## Table of Contents

1. [What Is a Circuit?](#what-is-a-circuit)
2. [The Artifact Chain Model](#the-artifact-chain-model)
3. [Execution Model](#execution-model)
4. [The Gate System](#the-gate-system)
5. [Relay Infrastructure](#relay-infrastructure)
6. [Circuit Composition](#circuit-composition)
7. [Capability Resolution](#capability-resolution)
8. [The Workflow Graph](#the-workflow-graph)
9. [Extending the System](#extending-the-system)

---

## What Is a Circuit?

A circuit is a multi-phase workflow encoded as two files in `skills/<name>/`:

| File | What it does |
|------|-------------|
| `circuit.yaml` | Declares the steps, their order, and how they connect |
| `SKILL.md` | Contains everything the orchestrator needs to execute each step |

**`circuit.yaml`** is machine-readable topology. The runtime engine reads it to
derive state and determine the next step.

**`SKILL.md`** is the execution contract. The orchestrator follows it line by line:
shell commands, output schemas, review handling, resume rules.

The two files must agree. If the YAML says a step requires a structured verdict
but the SKILL.md only checks for file existence, the circuit silently skips the
quality check.

Circuit skills use a `circuit:` prefix (e.g., `circuit:run`) to separate them
from domain skills. The directory name matches the slug: `circuit:run` lives at
`skills/run/`.

---

## The Artifact Chain Model

**Artifacts are the durable state, not the chat thread.**

### Every Step Produces a Named File

Each step in a circuit exits by writing a specific file to a known path. The
`run` circuit's adversarial path makes this concrete:

```text
triage-result.md          [triage, synthesis]
  -> external-digest.md   [evidence-probes, dispatch worker]
  -> internal-digest.md   [evidence-probes, dispatch worker]
  -> constraints.md       [constraints, synthesis]
  -> options.md           [options, dispatch]
  -> decision-packet.md   [decision-packet, dispatch]
  -> adr.md               [tradeoff-decision, checkpoint]
  -> execution-packet.md  [execution-contract, synthesis]
  -> seam-proof.md        [prove-seam, dispatch]
  -> implementation-handoff.md [implement, dispatch via workers]
  -> ship-review.md       [ship-review, dispatch]
  -> done.md              [summarize, synthesis]
```

The `execution-contract` step
cannot begin until `tradeoff-decision` has written `adr.md`. The `implement`
step reads `execution-packet.md` and nothing else from the decision phase. The
artifact chain is the workflow's dependency graph made explicit.

Artifacts matter for three reasons:

- **Resumability.** If a session crashes, a new session picks up from the last
  written artifact.
- **Bounded context.** Each step reads only its declared inputs, not the full
  conversation history.
- **Verified completion.** The gate system checks artifact contents, not worker
  self-reports.

### Resume Awareness

Every circuit includes resume logic that defines how a fresh session picks up
where the last one left off. The runtime engine algorithm:

1. Read the circuit manifest and event log.
2. Derive the current state from recorded events.
3. Determine the next step based on the last completed step and its routes.
4. For `workers` steps, inspect child state (`job-result.json`) before
   deciding to rerun.

**Relay state takes precedence over artifact presence.** A
step might have produced its artifact but left child workers in an inconsistent
state. Resume must check the step-local state before blindly re-executing.

### Artifact vs. Worker Report

The system distinguishes between two kinds of output:

- **Artifacts** (`${RUN_ROOT}/artifacts/*.md`) are canonical circuit outputs.
  They are the durable chain. Each one has a defined schema and a gate.
- **Worker reports** (`${RUN_ROOT}/phases/step-N/reports/*.md`) are raw worker
  outputs. They follow the relay protocol format but are not the canonical
  chain.

The orchestrator reads the report, extracts relevant information, and writes
the canonical artifact. Raw worker reports should not be promoted directly into
artifacts.

### Artifact Location

All artifacts live under a single run root:

```bash
RUN_ROOT=".circuitry/circuit-runs/${RUN_SLUG}"
mkdir -p "${RUN_ROOT}/artifacts"
```

The `RUN_SLUG` incorporates the topic. For example, a run for "auth-refactor"
would use:

```bash
RUN_ROOT=".circuitry/circuit-runs/auth-refactor"
```

Step-specific relay state (reports, last messages, prompt headers) lives under
`${RUN_ROOT}/phases/<step-name>/`. This separation keeps the canonical artifact
chain clean while preserving the full execution trace for debugging.

---

## Execution Model

Circuits use three executor/kind combinations, each with different execution
semantics:

### The Three Step Types

#### 1. Orchestrator Synthesis (`executor: orchestrator, kind: synthesis`)

The orchestrator (Claude session) reads upstream artifacts and writes a new
artifact directly, without dispatching a worker. Synthesis is for steps where
the value is in combining and distilling information, not in generating new
research or code.

From `run`, the `constraints` step:

> Read `external-digest.md`, `internal-digest.md`, and `triage-result.md`.
> Synthesize `constraints.md` with Hard Invariants, Seams and Integration Points,
> and Open Questions.

The orchestrator reads upstream artifacts directly and writes the synthesis
without dispatching a worker.

#### 2. Orchestrator Checkpoint (`executor: orchestrator, kind: checkpoint`)

The orchestrator pauses for user input at a decision point. Checkpoint steps
produce an artifact that records the user's choice: tradeoff selection, scope
confirmation, quality bar.

From `run`, the `confirm` step:

> Present the scope to the user for confirmation. Options: confirm or amend.
> If confirmed, write `scope-confirmed.md` and route to implement.
> If amended, route back to scope.

Checkpoint steps are the only steps that pause for user interaction. They are
never dispatched to workers.

#### 3. Worker Dispatch (`executor: worker, kind: dispatch`)

The orchestrator writes a prompt header, assembles the full prompt using
`compose-prompt.sh`, and dispatches the work to a worker via `dispatch.sh`.
The backend is auto-detected: Codex CLI when installed, Claude Code's Agent
tool (with worktree isolation) otherwise. The orchestrator does not do the
work itself. It composes the instructions and reads the result.

The dispatch pipeline:

```bash
# 1. Orchestrator writes the task-specific header
#    (mission, inputs, output path, schema, success criteria)

# 2. Assemble the full prompt
"$CLAUDE_PLUGIN_ROOT/scripts/relay/compose-prompt.sh" \
  --header "${STEP_ROOT}/prompt-header.md" \
  --skills "rust,tdd" \
  --template implement \
  --root "${STEP_ROOT}" \
  --out "${STEP_ROOT}/prompt.md"

# 3. Dispatch to worker (auto-detects Codex or Agent backend)
"$CLAUDE_PLUGIN_ROOT/scripts/relay/dispatch.sh" \
  --prompt "${STEP_ROOT}/prompt.md" \
  --output "${STEP_ROOT}/last-messages/last-message.txt" \
  --role implementer

# 4. Orchestrator reads the report and verifies
test -f "${STEP_ROOT}/reports/report.md"
```

Dispatch steps come in several flavors:

- **Simple dispatch**: One worker, one output. Most common.
- **Parallel dispatch**: Multiple workers run simultaneously, each producing
  its own artifact. Used for evidence probes and category surveys.
- **Dispatch via `workers`**: The `workers` adapter handles a full
  implement-review-converge loop. This is for steps that involve real code
  changes with quality gates.

### Separate Sessions for Implementation and Review

Implementation and review always run in separate sessions. The review worker
starts fresh, reads the diff, re-runs verification independently, and judges the
code without having written it.

### The `workers` Loop

When a dispatch step delegates to `workers`, it runs a multi-phase inner loop:

```text
plan -> implement -> review -> converge
                  \-> reject -> re-implement -> re-review
```

The orchestrator:
1. Writes a `CHARTER.md` in the child root from the parent execution contract.
2. Creates `batch.json` with one record per work slice.
3. For each slice: dispatches an implementation worker, then a review worker.
4. If review says `ISSUES FOUND`: re-dispatches implementation, then re-review.
5. When all slices are done: dispatches a convergence worker that checks the
   whole batch.
6. If convergence says `COMPLETE AND HARDENED`: done.
7. If convergence says `ISSUES REMAIN`: adds fix slices and loops.

The loop is bounded by circuit breakers: any slice that hits
`impl_attempts > 3` or `impl_attempts + review_rejections > 5` triggers user
escalation.

The orchestrator never modifies `batch.json` by hand. All state transitions go
through `update-batch.sh`:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/update-batch.sh" --root "${CHILD_ROOT}" \
  --slice slice-001 --event review_clean
```

All `batch.json` mutations go through `update-batch.sh` to prevent state
corruption.

---

## The Gate System

Gates are the quality enforcement mechanism. Every non-trivial step has a gate
that checks the step's output before the circuit advances.

### The Three Gate Kinds

#### 1. `schema_sections`

Checks that the artifact contains required sections. Used for synthesis steps
where the value is in the structure and completeness of the output.

From `run`, the `triage` step:

```yaml
gate:
  kind: schema_sections
  source: artifacts/triage-result.md
  required: [Pattern, Mode, Reasoning, Probe]
```

If the triage result is missing the `Probe` section, the step fails.

#### 2. `checkpoint_selection`

Used for interactive checkpoint steps where the user makes a choice. The gate
validates that the user's response is one of the allowed options.

From `run`, the `confirm` step:

```yaml
gate:
  kind: checkpoint_selection
  source: checkpoints/{step_id}-{attempt}.response.json
  allow: [confirm, amend]
```

The gate ensures the checkpoint produced a valid response before routing. The
`routes` field on the step then maps each option to a next step.

#### 3. `result_verdict`

Used for worker dispatch steps. Checks that the worker's job result contains
a passing verdict.

From `run`, the `evidence-probes` step:

```yaml
gate:
  kind: result_verdict
  source: jobs/{step_id}-{attempt}/job-result.json
  pass: [outputs_ready]
```

The `reroute` field (optional) maps specific non-passing verdicts to upstream
steps for reopening:

```yaml
gate:
  kind: result_verdict
  source: jobs/{step_id}-{attempt}/job-result.json
  pass: [evidence_sufficient]
  reroute:
    queue_adjustment_required: triage-classification
    risk_boundary_invalidated: cleanup-scope
```

### Gate Selection Guide

| Gate kind | Use when | Required contract |
|-----------|----------|-------------------|
| `schema_sections` | Quality can be checked from artifact section presence | `source` path, `required` section list |
| `checkpoint_selection` | User makes an interactive choice | `source` path, `allow` option list |
| `result_verdict` | Worker dispatch produces a structured result | `source` path, `pass` verdict list, optional `reroute` |

### How Routes Work

Each step declares its routing table in the `routes` field. Routes map
outcomes (gate verdicts, checkpoint selections, or logical labels) to next
step IDs:

```yaml
routes:
  quick: scope
  researched: evidence-probes
  adversarial: evidence-probes
  redirect_cleanup: "@stop"
  redirect_migrate: "@stop"
```

Special route targets:
- **`@complete`**: Circuit completed successfully.
- **`@escalate`**: Stop and involve the user.
- **`@stop`**: Terminate the run (used for companion circuit redirects).

Different routes from the same step lead to entirely different paths through
the graph.

### The Circuit Breaker Pattern

Every circuit includes a Circuit Breaker section that defines when to stop and
redirect. These prevent unbounded loops.

From `run`:

> Escalate to the user when:
> - A dispatch step fails twice (no valid output after 2 attempts)
> - Seam proof returns `DESIGN INVALIDATED`
> - Workers slice hits `impl_attempts > 3` or `impl_attempts + review_rejections > 5`
> - Ship review says `ISSUES FOUND` after 2 attempts

Circuit breakers also handle task misrouting. The `run` circuit's triage step
can redirect tasks to companion circuits (`cleanup`, `migrate`) when the task
signals don't fit the main graph.

---

## Relay Infrastructure

Two shell scripts and a set of templates handle prompt assembly, state
management, and the report protocol between orchestrator and workers.

### `compose-prompt.sh`: Prompt Assembly

This script assembles a worker prompt from modular pieces:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/compose-prompt.sh" \
  --header "${STEP_ROOT}/prompt-header.md" \
  --skills "rust,tdd" \
  --template implement \
  --root "${STEP_ROOT}" \
  --out "${STEP_ROOT}/prompt.md"
```

The assembly pipeline:

1. **Start with the header.** The orchestrator writes a task-specific header
   containing the mission, inputs, output path, output schema, and success
   criteria. This is the only part that changes per step.

2. **Append domain skills.** For each skill in the `--skills` list, the script
   finds the skill's `SKILL.md` file and appends it as a `## Domain Guidance`
   section. This gives the worker domain-specific knowledge (Rust idioms, React
   patterns, etc.) without the orchestrator having to inline it.

3. **Append the template.** Templates define the worker's operating contract:
   - `implement`: Write code, run verification, produce a report.
   - `review`: Inspect the diff, re-run verification, produce findings.
   - `ship-review`: Audit existing code without a preceding diff.
   - `converge`: Final quality gate across all slices.

   For review-family templates (`review`, `ship-review`, `converge`), a review
   preamble is appended first with shared review instructions.

4. **Append relay protocol (legacy fallback).** The script checks whether the
   assembled output already contains the canonical relay headings
   (`### Files Changed`, `### Tests Run`, `### Completion Claim`). If not, it
   appends `relay-protocol.md` as a safety net.

5. **Substitute known placeholders and reject unresolved ones.** If `--root`
   is provided, all `{relay_root}` tokens are replaced. After substitution, the
   assembler scans for remaining `{...}` placeholders outside fenced code
   blocks. If any remain, the script fails with a diagnostic error naming the
   source file.

### `dispatch.sh`: Backend-Agnostic Dispatch

This script dispatches assembled prompts to workers. It auto-detects the
backend and supports role-based routing:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/dispatch.sh" \
  --prompt "${STEP_ROOT}/prompt.md" \
  --output "${STEP_ROOT}/last-messages/last-message.txt" \
  --role implementer
```

Backends:
- **codex**: Codex CLI (`codex exec --full-auto`). Preferred for parallelism.
- **agent**: Claude Code Agent tool with worktree isolation. Fallback.
- **custom**: Any shell command. The prompt file is `$1`, output path is `$2`.

Role resolution: `--role` flag > `circuit.config.yaml` roles > auto-detect.

All backends emit a JSON receipt to stdout. For the agent backend, the receipt
contains the full prompt content ready for an Agent tool call. For codex, it
confirms dispatch with a PID.

### `update-batch.sh`: Deterministic State Machine

This script manages `batch.json`, the state file that tracks every slice in a
`workers` run. The orchestrator never hand-edits `batch.json`. All mutations go through this
script.

The script supports these events:

| Event | What it does |
|-------|-------------|
| `attempt_started` | Increment `impl_attempts`, set `attempt_in_progress` |
| `impl_dispatched` | Clear `attempt_in_progress`, record report |
| `review_clean` | Set slice status to `done` |
| `review_rejected` | Increment `review_rejections` |
| `converge_complete` | Set all converge slices to `done`, phase to `complete` |
| `converge_failed` | Increment `convergence_attempts` |
| `add_slice` | Append a new slice to the batch |

Every mutation is appended to `events.ndjson` as an append-only event log,
enabling rebuild-from-events recovery.

### The Worker Report Contract

Every worker writes a report file with these exact sections:

```markdown
### Files Changed
### Tests Run
### Verification
### Verdict
### Completion Claim
### Issues Found
### Next Steps
```

`compose-prompt.sh` checks for these headings. If missing, it appends
`relay-protocol.md` as a fallback. Workers that omit them produce reports the
orchestrator cannot parse.

---

## Circuit Composition

Circuits compose with each other and with non-circuit skills through
well-defined interfaces.

### How Circuits Call `workers` as an Adapter

The `workers` skill is not a circuit. It is an adapter. Circuits delegate
their implementation-heavy steps to `workers`, which handles the
plan-implement-review-converge loop.

The composition contract:

1. **The circuit owns the child root.** The circuit creates the directory
   structure, writes `CHARTER.md`, and defines the domain skills.

2. **`workers` owns the inner loop.** Once dispatched, `workers`
   handles slicing, worker dispatch, review, and convergence autonomously.

3. **The circuit synthesizes the result.** After `workers` completes, the
   circuit reads back the child state and writes its canonical artifact.

### What Parent Circuits Can Read

The `workers-execute@v1` protocol defines a strict public/private boundary.
Parent circuits interact with workers through a small set of typed contract
files and must not depend on worker-internal state.

**Public contract (parent circuits may read):**

| File | Direction | Purpose |
|------|-----------|---------|
| `dispatch-request.json` | Parent -> Workers | Slice definitions, file scope, verification commands |
| `dispatch-receipt.json` | Workers -> Parent | Confirmation that workers started |
| `job-result.json` | Workers -> Parent | Execution status, slice metadata, convergence outcome |
| `reports/report-converge.md` | Workers -> Parent | Human-readable convergence verdict |
| `reports/report-<slice-id>.md` | Workers -> Parent | Human-readable per-slice implementation reports |

**Worker-private (parent circuits must not read or depend on):**

- `batch.json`: internal state machine managed by `update-batch.sh`
- `plan.json`: internal planning state
- `events.ndjson`: internal event log for recovery
- `review-findings/`: internal review worker output

Worker internals may change. The public contract files are the stable interface.

### How Triage Routes Tasks

The `run` circuit's triage step classifies tasks and routes them to the
appropriate workflow path.

Triage classification:

| Signal Pattern | Mode | Path |
|---------------|------|------|
| Clear task, known approach, <6 files | quick | scope -> confirm -> implement -> summarize |
| Multi-domain, external research needed | researched | evidence -> constraints -> scope -> confirm -> implement -> review -> summarize |
| Named alternatives, architecture choice | adversarial | evidence -> constraints -> options -> decision -> preflight -> implement -> ship-review -> summarize |
| Existing RFC/PRD/spec | spec-review | spec-intake -> reviews -> caveat-resolution -> preflight -> implement -> ship-review -> summarize |
| Overnight quality improvement | ratchet | 17-step autonomous path |
| Adversarial tournament | crucible | 7-step diverge-explore-converge path |
| Strong cleanup signals | redirect | Redirects to `circuit:cleanup` |
| Strong migration signals | redirect | Redirects to `circuit:migrate` |

Companion circuit redirects use `@stop` routes. The triage step writes a
redirect note and tells the user to invoke the companion circuit directly.

### Domain Skills as Companions

Domain skills (`rust`, `swift-apps`, `tdd`) are separate from circuits. They are
composed at dispatch time through capability resolution and injected via
`--skills`:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/compose-prompt.sh" \
  --header "${STEP_ROOT}/prompt-header.md" \
  --skills "rust,tdd" \
  --template implement \
  --root "${STEP_ROOT}" \
  --out "${STEP_ROOT}/prompt.md"
```

- **Circuits stay domain-agnostic.** The same `run` circuit works for Rust,
  Swift, or React projects.
- **Skill budgets are enforceable.** Circuits declare maximum skill counts
  (typically 2 domain skills, 3 total), preventing prompt bloat.
- **Domain knowledge stays current.** Updating a domain skill immediately
  affects all circuits that compose it, without editing any circuit files.

---

## Capability Resolution

Circuits do not reference skills by name in their topology. Instead, each
dispatch step declares the *capabilities* it needs, semantic descriptors
like `testing.tdd`, `code.change`, or `review.independent`. At dispatch time,
the resolution layer maps those capabilities to concrete installed skills.

### What Capabilities Are

A capability is a dotted identifier that describes a semantic function:

| Capability | Meaning |
|------------|---------|
| `testing.tdd` | Test-driven development: write failing tests first, then implement |
| `code.change` | Make code changes in a specific language/framework context |
| `review.independent` | Review code without having written it |
| `research.external` | Conduct deep external research beyond the codebase |
| `repo.analysis` | Analyze codebase structure, find dead code, audit patterns |

Capabilities are not skills. A capability is *what needs to happen*; a skill
is *who does it*. The mapping between them is many-to-many.

### Resolution Order

When a dispatch step declares a required capability, the resolver checks
three sources in order:

1. **Project config** (`./circuit.config.yaml`). Per-circuit capability
   overrides take precedence.
2. **User config** (`~/.claude/circuit.config.yaml`). Global defaults.
3. **Engine built-ins**. Hardcoded fallback mappings for capabilities
   that can be inferred without explicit configuration.

### Required vs. Optional Capabilities

- **Required capabilities** must resolve to at least one skill before the
  step can dispatch. Unresolved required capabilities fail closed.
- **Optional capabilities** degrade gracefully. The step dispatches without
  the domain guidance if unresolved.

### Configuration Format

```yaml
# circuit.config.yaml
capabilities:
  testing.tdd: [tdd]
  research.external: [deep-research]
  code.change: []       # auto-detected
  review.independent: [] # auto-detected

circuits:
  cleanup:
    capabilities:
      repo.analysis: [dead-code-sweep]
```

An empty list (`[]`) means the capability is auto-detected or provided by
the engine built-ins.

---

## The Workflow Graph

Circuitry uses a workflow graph model: 3 circuits and 2 utilities sharing common
infrastructure. The primary `run` circuit contains 43 steps organized into 7
workflow paths that share steps where their flows converge.

### Shared Steps

Quick, researched, and adversarial paths share steps like evidence gathering,
scoping, and implementation. Each shared step is defined once. Routes select
which path to take through the graph.

### How Paths Share Steps

How the seven workflows share steps in the `run` circuit:

```
                                    ┌─ quick ──────> scope -> confirm ─┐
triage ─> classification ──────────>├─ researched ─> evidence ──┐      │
                                    ├─ adversarial -> evidence ─┤      │
                                    ├─ redirect ──> @stop       │      │
                                    └─ (spec-review, ratchet,   │      │
                                        crucible enter at their │      │
                                        own entry points)       │      │
                                                                │      │
                  constraints <────────────────────────────────>┘      │
                       │                                               │
            ┌──────────┴──────────┐                                    │
            │                     │                                    │
    researched: scope        adversarial: options                      │
         │                        │                                    │
         v                        v                                    │
       confirm              decision-packet                            │
         │                        │                                    │
         │                  tradeoff-decision                          │
         │                        │                                    │
         │              execution-contract  <── (spec-review merges)   │
         │                        │                                    │
         │                    prove-seam                               │
         │                        │                                    │
         └──────────>  implement  <────────────────────────────────────┘
                          │
                    ┌─────┼─────┐
                    │     │     │
              to_summary  │  to_ship_review
                    │     │     │
                    │  to_review │
                    │     │     │
                    v     v     v
                  summarize <- review / ship-review
                      │
                  @complete
```

Each step's `routes` field determines which branch is taken. The runtime
engine records the chosen route in the event log, so resume logic knows
exactly which path was active.

### Entry Modes

The `entry_modes` section in `circuit.yaml` defines where different workflow
shapes enter the graph:

```yaml
entry_modes:
  default:
    start_at: triage
  quick:
    start_at: triage
  ratchet:
    start_at: ratchet-survey
  crucible:
    start_at: crucible-frame
```

Entry modes that share a start point (default, quick, researched, adversarial
all start at `triage`) are differentiated by triage classification. Entry modes
with unique start points (spec-review, ratchet, crucible) enter at their own
subgraph and may never touch the shared triage/scope/implement path.

### Three Circuits and Two Utilities

| Name | Type | Steps | Entry modes | Purpose |
|------|------|-------|-------------|---------|
| `run` | Circuit | 43 | 7 (default, quick, researched, adversarial, spec-review, ratchet, crucible) | Primary workflow graph. Handles most tasks. |
| `cleanup` | Circuit | 8 | 2 (default, auto) | Systematic dead code and cruft removal with evidence gates. |
| `migrate` | Circuit | 7 | 1 (default) | Large-scale migrations with coexistence plans and rollback. |
| `workers` | Utility | n/a | n/a | Dispatch backbone for all circuit implementation steps. |
| `handoff` | Utility | n/a | n/a | Session state persistence for cross-session continuity. |

Companion circuits (`cleanup`, `migrate`) are reached by triage redirect or
direct invocation. They have specialized topologies that don't fit the
main graph's structure (cleanup has a 5-category parallel survey; migrate has
a coexistence plan artifact that the main graph doesn't model).

### The `circuit.yaml` Schema

```yaml
schema_version: "2"
circuit:
  id: circuit-slug             # kebab-case, matches directory name
  version: "YYYY-MM-DD"       # date of last topology change
  purpose: >
    One-sentence thesis.

  entry:
    command: /circuit           # optional: bare command trigger
    expert_command: /circuit:run # explicit invocation
    signals:
      include: [signal_names]
      exclude: [signal_names]

  entry_modes:
    default:
      start_at: step-id
      description: >
        When and why this mode is used.

  steps:
    - id: step-id
      title: Step Title
      executor: orchestrator | worker
      kind: synthesis | checkpoint | dispatch
      protocol: protocol-name@v1     # optional
      reads: [artifact-paths]        # optional: prefix with "optional:"
      writes:
        artifact:
          path: artifacts/name.md
          schema: schema-name@v1
        # For checkpoints:
        request: checkpoints/{step_id}-{attempt}.request.json
        response: checkpoints/{step_id}-{attempt}.response.json
      capabilities:                  # for dispatch steps
        required: [capability.names]
        optional: [capability.names]
      budgets:
        max_attempts: N
      gate:
        kind: schema_sections | checkpoint_selection | result_verdict
        source: path/to/check
        required: [Section Names]    # for schema_sections
        allow: [options]             # for checkpoint_selection
        pass: [verdicts]             # for result_verdict
        reroute:                     # optional, for result_verdict
          verdict_name: target-step-id
      checkpoint:                    # for checkpoint steps
        kind: checkpoint_type
        options: [option_names]
        materialize_artifact: true   # optional
      routes:
        outcome: next-step-id
        fail: "@escalate"
```

---

## Extending the System

See [CONTRIBUTING.md](CONTRIBUTING.md) for the practical workflow (fork, branch,
test, submit). This section covers the design constraints your circuit must satisfy.

### The Quality Gate Checklist

When authoring or reviewing a circuit, check these six categories:

1. **Artifact Chain Integrity.** Every step names one canonical artifact. Every
   consumer knows where its input comes from. No dangling produces without a
   consumer.

2. **Gate Semantics.** Every non-trivial step has a gate. Verdict vocabularies
   are bounded. Every negative outcome has a concrete next action.

3. **Handoff Contract Compliance.** All dispatch steps use the canonical header
   schema. Relay headings are present. Diagnose-only review steps are marked
   explicitly.

4. **Resume Safety.** Step-local relay state is checked before artifacts.
   Parallel completeness requires all worker artifacts. Child state like
   `job-result.json` is inspected before restarting `workers`.

5. **Dispatch Compatibility.** Only real CLI flags and template behavior are
   used. Skill budgets stay within limits. No interactive skills in autonomous
   dispatches.

6. **Prose/YAML Consistency.** Step count, reads, writes, parallelism, gates,
   and routes must match between `SKILL.md` and `circuit.yaml`.

### Anti-Patterns to Avoid

| Name | What goes wrong |
|------|----------------|
| Open Artifact Chain | A step declares an output that no one produces |
| Copy-The-Handoff | A raw worker report is promoted to artifact without synthesis |
| Placeholder Leakage | Unresolved `{relay_root}` tokens reach the worker |
| Interactive Skill In Autonomous Dispatch | An interactive skill appended to `codex exec --full-auto` |
| Resume By Final Artifacts Only | Resume ignores step-local state like `job-result.json` |
| Weak Gates | A gate checks only file existence |
| No Reopen Rule | Disconfirming evidence appears but the circuit only says "revise and continue" |
| Prose/YAML Drift | `SKILL.md` and `circuit.yaml` disagree |
| Review Step Mutates Source | A verdict step also changes code |

---

## Appendix: System Topology

### File Layout

```
circuitry/
  .claude-plugin/
    plugin.json               # Plugin manifest
  hooks/
    hooks.json                # SessionStart hook registration
    session-start.sh          # Handoff detection
  scripts/
    relay/
      compose-prompt.sh       # Prompt assembly pipeline
      dispatch.sh             # Backend-agnostic worker dispatch
      update-batch.sh         # Deterministic batch.json state machine
    runtime/
      bin/
        append-event.js       # Bundled CLIs (committed, no build step needed)
        catalog-compiler.js
        derive-state.js
        resume.js
      engine/
        src/
          append-event.ts     # Event log append
          derive-state.ts     # State derivation from event log
          resume.ts           # Resume logic
          schema.ts           # Shared JSON-Schema validation
          catalog/
            types.ts          # CatalogEntry types (shared contract)
            extract.ts        # Filesystem -> Catalog
            generate.ts       # Catalog -> marker blocks
          cli/
            append-event.ts   # CLI entry point
            catalog-compiler.ts # generate + catalog subcommands
            derive-state.ts   # CLI entry point
            read-config.ts    # Config file reader
            resume.ts         # CLI entry point
    sync-to-cache.sh          # Plugin cache sync
    verify-install.sh         # Installation verification
  skills/
    run/
      circuit.yaml            # 43-step workflow graph
      SKILL.md                # Execution contract
      references/
        mode-quick.md
        mode-researched.md
        mode-adversarial.md
        mode-spec-review.md
        workflow-ratchet.md
        workflow-crucible.md
        autonomous-gates.md
    cleanup/
      circuit.yaml            # 8-step cleanup circuit
      SKILL.md
    migrate/
      circuit.yaml            # 7-step migration circuit
      SKILL.md
    workers/
      SKILL.md                # Batch worker orchestrator (utility, no circuit.yaml)
      references/
        implement-template.md
        review-template.md
        ship-review-template.md
        converge-template.md
        review-preamble.md
        relay-protocol.md
        agents-md-template.md
    handoff/
      SKILL.md                # Session handoff (utility, no circuit.yaml)
      scripts/
```

### Runtime Layout (Example)

When `circuit:run` executes in adversarial mode for a task called
"sync-engine":

```
.circuitry/circuit-runs/sync-engine/
  artifacts/
    triage-result.md
    external-digest.md
    internal-digest.md
    constraints.md
    options.md
    decision-packet.md
    adr.md
    execution-packet.md
    seam-proof.md
    implementation-handoff.md
    ship-review.md
    done.md
  phases/
    evidence-probes/
      prompt-header.md
      prompt.md
      reports/
      last-messages/
    implement/
      CHARTER.md
      batch.json
      events.ndjson
      reports/
      last-messages/
      archive/
  checkpoints/
    confirm-1.request.json
    confirm-1.response.json
    tradeoff-decision-1.request.json
    tradeoff-decision-1.response.json
  jobs/
    evidence-probes-1/
      dispatch-request.json
      dispatch-receipt.json
      job-result.json
```

### Data Flow

```
User Request
    |
    v
circuit:run triage ──> classifies task
    |
    ├── quick/researched/adversarial: route through workflow graph
    ├── spec-review/ratchet/crucible: route to subgraph entry
    └── redirect: stop, suggest circuit:cleanup or circuit:migrate
    |
    v
SKILL.md (runtime truth)
    |
    ├── synthesis steps: orchestrator reads upstream -> writes artifact
    |
    ├── checkpoint steps: orchestrator + user -> artifact
    |
    └── dispatch steps:
            |
            ├── compose-prompt.sh
            |     (header + skills + template + relay_root substitution)
            |
            ├── dispatch.sh --role <role>
            |     (auto-detects codex/agent/custom backend)
            |
            ├── [if workers delegation]
            |     update-batch.sh manages state
            |     implement -> review -> converge loop
            |
            └── orchestrator reads report -> synthesizes artifact
                    |
                    v
              gate check
                    |
                    ├── pass -> follow route to next step
                    ├── reroute -> archive downstream, resume from target
                    └── fail -> @escalate, involve user
```

