# OpenCode as a third host

Idea seed for evaluating OpenCode (sst/opencode) as a third Circuit host
alongside Claude Code and Codex, plus the local-model worker thread that
motivated it. Captured 2026-05-28 from a conversation that started with
"what would it take for Circuit to support local coding models?" and
turned into "I'd prefer to evaluate OpenCode as a potential host."

This is not an implementation spec. It is a first read on feasibility,
the contract a host must satisfy, and a cheap way to evaluate OpenCode
before paying for first-class support. Code and file references were
checked against the repo at capture time and will drift; re-verify
against `src/schemas/host.ts`, `scripts/flows/`, and the generated
`plugins/` packages before acting.

Related: [`circuit-vs-compound-engineering.md`](./circuit-vs-compound-engineering.md)
(multi-host framing), [`tracker-connector.md`](./tracker-connector.md)
(worker connector shape).

## The trigger

The starter question was about local coding models (the conversation
used Qwen2.5-Coder via Ollama as the example). The honest reframe is
that a model is not an engine. Circuit does not drive models; it drives
agentic CLIs that read files, edit, run commands, and loop. A local
weight needs a harness. That splits into two very different integration
points Circuit already names:

- **Worker connector**: something Circuit drives as a subprocess for a
  relay step (Claude Code, Codex, cursor-agent today).
- **Host**: the agentic environment Circuit lives inside, which owns the
  `/circuit:run` front door, shells out to the bundled runtime, and
  renders Circuit's surfaces back to the operator (Claude Code primary,
  Codex second).

The user's interest landed on the host question, which is the harder and
more interesting one.

## Two host styles already exist

The key finding: Circuit's two hosts use different integration styles,
and OpenCode maps cleanly onto the looser one.

- **Claude Code is wrapper-driven (tight).** The command runs
  `... present run --goal ...` and a bespoke `present` mode in
  `plugins/claude/scripts/circuit.ts` parses the JSONL progress stream
  and renders the `⎿` status blocks in TypeScript.
- **Codex is instruction-driven (loose).** The command runs
  `... run --goal ... --progress jsonl` and the generated
  `plugins/codex/commands/run.md` is prose telling the host model what to
  do: build a Bash command, run the wrapper, render `presentation`
  events as `⎿ ${status_text}`, map `task_list.updated` to the host task
  surface, ask `user_input.requested` in-thread and resume with the
  selected option's `checkpoint_choice`, then render
  `run_surface_markdown_path` verbatim
  (`plugins/codex/commands/run.md:147-179` at capture time).

**OpenCode is a Codex-shaped host.** It has markdown commands with
`$ARGUMENTS` under `.opencode/command/`, a Bash tool, an `AGENTS.md`
instruction file, and a native `todo` tool. The Codex `run.md` ports over
almost verbatim. OpenCode needs no `present`-mode wrapper because the
host model renders from instructions, exactly like Codex.

Note: the `--host` flag is scoped to handoff continuity hooks
(`handoff hooks install --host codex`), not a general "run as host X"
selector. Host identity is carried by which command markdown plus wrapper
mode invokes the runtime.

## Host contract vs. what OpenCode offers

Derived from the progress-event contract (`src/schemas/progress-event.ts`)
and the Codex `run.md` rendering rules:

| Circuit needs | OpenCode |
| --- | --- |
| Slash-command front door (`/circuit:run <task>`) | Yes: `.opencode/command/*.md`, `$ARGUMENTS` |
| Shell out to a local node runtime, stream output | Yes: Bash tool |
| Status blocks (`presentation.status_text`, append/suppress) | Partial: no native live-update slot; degrades to append-only in-thread, same as Codex |
| Task list (`task_list.updated`) | Yes: native `todo` tool |
| Checkpoint questions (`user_input.requested`) | Partial: no structured picker like Claude AskUserQuestion; degrades to in-thread ask plus resume with `checkpoint_choice` (Codex's exact fallback) |
| Verbatim final summary (`run_surface_markdown_path`) | Yes: render markdown |
| Session-continuity instruction file | Yes: `AGENTS.md` |

The two partial rows are already the Codex degradation path, not new
gaps.

## What it would take

### Tier 0: evaluate it (hours, no schema changes)

This is what "evaluate OpenCode as a host" actually asks for, and Circuit
already has the grading artifact: `docs/host-trial-checklist.md`.

1. Hand-port `plugins/codex/commands/run.md` and `handoff.md` into
   `.opencode/command/circuit-run.md` (plus handoff), pointed at the
   installed wrapper, invoking `... run --goal "$ARGUMENTS" --progress jsonl`.
2. Drop the Codex host guidance into a project `AGENTS.md`.
3. Walk the checklist scenarios (Natural Fix / Review / Build / Explore,
   plus a Checkpoint and a forced Failure) and grade against the "What To
   Grade" section.

The runtime and wrapper are host-agnostic node, so they run as-is. This
teaches whether OpenCode's in-thread rendering of status blocks and
checkpoints feels good before paying for first-class support.

### Tier 1: first-class `opencode` host

The blast radius, and why a host costs more than a worker connector:

- `src/schemas/host.ts:3`: add `'opencode'` to the closed `HostKind`
  enum.
- `src/schemas/flow-blocks.ts:120-122`: add an `opencode` key to
  `HostCapabilities`. The superRefine at `flow-blocks.ts:170-187`
  requires a non-empty strategy for every host key on every block, so
  every block definition in `src/schemas/flow-block-definitions.ts`
  (~16 at capture time) needs an `opencode: [...]` line. This is the
  expensive, unavoidable part.
- `scripts/flows/host-renderers.ts`: add a `renderOpenCodeHostCommand()`
  (likely near-identical to the Codex renderer).
- `scripts/flows/emit.ts`: mirror commands and flows into
  `plugins/opencode/`.
- `scripts/plugins/runtime-bundle.ts`: add `plugins/opencode/runtime/circuit.js`
  as a bundle output.
- `plugins/opencode/`: manifest, generated commands, bundled runtime, and
  a `scripts/circuit.ts` wrapper (copy Codex's; drop `present`).
- Session continuity: the handoff SessionStart hook is hardcoded to
  claude/codex (`src/cli/handoff.ts:437,536`). OpenCode's plugin/event
  system would need its own session-start shim to surface the "handoff is
  present" banner.
- Release parity checks under `scripts/release/` enumerate hosts and
  would need the new host added.

## Risks specific to OpenCode

1. **Headless "ask" hang.** OpenCode defaults `external_directory` and
   bash approvals to `ask`. Under `opencode serve`/headless there is no
   surface to answer, so the session can freeze forever (tracked in
   OpenCode issues #14473 and #16367). Circuit checkpoints
   (`user_input.requested`) and worker bash calls both hit this.
   Mitigation: run the interactive TUI for checkpointing flows, pre-grant
   bash permission in `opencode.json`, or restrict headless to
   non-interactive / auto-degrade runs.
2. **The closed `HostCapabilities` contract is the real tax.** Unlike a
   worker connector (mostly additive), a first-class host forces a
   per-block `opencode` strategy everywhere. Mechanical, not hard, but
   unavoidable surface area.

## The payoff: a fully local Circuit stack

OpenCode is model-agnostic (any provider via models.dev, including local
Ollama). Neither Claude Code nor Codex can host Circuit on a local model.
OpenCode can. So OpenCode-as-host closes the loop on the local-model
thread that started the conversation: host and worker could both be
local. OpenCode (orchestrator) running a local model, relaying to a local
worker connector, gives a fully offline Circuit stack. That stack is only
possible if OpenCode is a host.

### Sidebar: the local worker connector

For completeness, the worker side of "support local models" is lighter
than the host side:

- A read-only local advisor works **today, config-only**, via the
  existing `CustomConnectorDescriptor` and `relayCustom` adapter
  (`src/connectors/custom.ts`). Register a wrapper under
  `relay.connectors.<name>` that reads the prompt file and writes one
  JSON object to the output file. Cap: custom connectors are read-only in
  V1 (`src/schemas/connector.ts:64-71`), so a local model can review and
  research but not implement.
- A writable local implementer needs a first-class builtin connector
  modeled on `src/connectors/codex.ts`: add to `EnabledConnector`
  (`connector.ts:5`), wire the dispatch (`src/runtime/executors/relay.ts:92-104`),
  and add `expectedProvider`/`supportedEfforts` cases
  (`src/runtime/connectors/resolver.ts:208-219`). The provider enum
  already includes `'custom'` (`src/schemas/selection-policy.ts:11`).
  Local models have no reasoning-effort knob, so map effort to `none`
  like cursor-agent. The connector wraps an agentic CLI (Aider, OpenCode
  run mode), not the raw model.

## Recommendation

Run the Tier-0 trial against `docs/host-trial-checklist.md` before any
schema changes. The thing most likely to make or break OpenCode as a host
is subjective: whether model-rendered status blocks and in-thread
checkpoints read as cleanly as Claude's native surfaces. The checklist is
built to grade exactly that, and it costs hours instead of an enum-wide
refactor.

## References (checked at capture time)

- Host packaging: `plugins/claude/`, `plugins/codex/`,
  `plugins/codex/commands/run.md`
- Host schema: `src/schemas/host.ts`, `src/schemas/flow-blocks.ts`,
  `src/schemas/flow-block-definitions.ts`
- Generation: `scripts/flows/host-renderers.ts`, `scripts/flows/emit.ts`,
  `scripts/plugins/runtime-bundle.ts`
- Progress contract: `src/schemas/progress-event.ts`
- Trial checklist: `docs/host-trial-checklist.md`
- Worker connectors: `src/connectors/custom.ts`,
  `src/connectors/codex.ts`, `src/runtime/executors/relay.ts`,
  `src/runtime/connectors/resolver.ts`, `src/schemas/connector.ts`
- OpenCode docs: https://opencode.ai/docs/commands/,
  https://opencode.ai/docs/config/, https://opencode.ai/docs/rules/,
  https://opencode.ai/docs/permissions/, https://opencode.ai/docs/server/
