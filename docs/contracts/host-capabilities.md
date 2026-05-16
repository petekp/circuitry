---
contract: host-capabilities
status: draft-v0.1
version: 0.1
last_updated: 2026-04-28
depends_on: [host-rendering, host-adapter]
---

# Host Capability Contract

Circuit stays responsible for flow behavior and user-facing words. Hosts
provide native affordances when they exist.

## Capability Slots

Hosts should map Circuit runs onto these slots:

- `progress`: render Circuit-authored `display.text` from progress events.
- `task_list`: show the current flow stage as a short checklist when the
  host has a native task list surface.
- `ask_user`: ask checkpoint and human-in-the-loop questions through the host's
  native question tool when available.
- `final_summary`: render `operator_summary_markdown_path` verbatim when the run
  ends.
- `deep_links`: keep report paths available for tooling and debug views without
  printing them in the default operator answer.
- `debug`: show raw events, step ids, and trace internals only when requested.

## Capability Levels

- `native`: the adapter controls a real host UI/API affordance.
- `model-mediated`: Circuit instructs the host model to use an affordance when
  it is available.
- `fallback`: Circuit provides text, files, and resume commands.

## Worker Connector Status

Hosts must keep the host adapter separate from the worker connector. The host
starts Circuit and renders its progress; the worker connector executes relayed
steps.

| Worker connector | Current status | Filesystem posture | First-run wording |
| --- | --- | --- | --- |
| `claude-code` | Supported and the auto default | Trusted same-workspace writes with `bypassPermissions` | Disclose before Build or Fix can run an implementer step. |
| `codex` | Supported for read-only relays | Codex CLI read-only sandbox; cannot run implementer steps | Safe to present as the read-only Codex worker. |
| custom connector | Supported for read-only registered wrappers | Trusted local process; Circuit only routes it to read-only roles | Say it inherits cwd/env and is not an OS sandbox. |

`codex-isolated` is planned but not current. It must stay out of public config
examples and fail config parsing until an isolated writable implementation is
tested.

## Current Host Mappings

### Generic Shell

- `progress`: `fallback` JSONL on stderr for external parsers.
- `task_list`: `fallback` via `task_list.updated` JSONL events.
- `ask_user`: `fallback` via `circuit-next resume --run-folder ...`.
- `final_summary`: read and render `operator_summary_markdown_path` verbatim.
- `deep_links`: read paths from stdout JSON or the operator summary.
- `debug`: inspect reports and trace files directly.

### Codex Plugin

- `progress`: `model-mediated` rendering of major `display.text` lines.
- `task_list`: `model-mediated` mapping from `task_list.updated` to Codex's
  plan/task surface when available.
- `ask_user`: `model-mediated` mapping from `user_input.requested` to Codex's
  native user-input affordance when available; otherwise ask in-thread and
  resume with the provided command.
- `final_summary`: read and render `operator_summary_markdown_path` verbatim.
- `deep_links`: include run folder and report paths from the operator summary.
- `debug`: show progress JSONL and trace ids only when the user asks.

### Codex App Server

- `progress`: planned `native` bridge.
- `task_list`: planned `native` mapping to plan updates.
- `ask_user`: planned `native` mapping to `tool/requestUserInput`.
- `final_summary`: read and render `operator_summary_markdown_path` verbatim.
- `deep_links`: expose report paths through the host client.
- `debug`: keep raw events behind an explicit debug surface.

### Claude Code Command

- `progress`: `model-mediated` rendering of major `display.text` lines.
- `task_list`: `model-mediated` use of TodoWrite from `task_list.updated` when
  available.
- `ask_user`: in-thread fallback from `user_input.requested`; Agent SDK
  `AskUserQuestion` is not assumed for slash-command surfaces.
- `final_summary`: read and render `operator_summary_markdown_path` verbatim.
- `deep_links`: include run folder and report paths from the operator summary.
- `debug`: show progress JSONL and trace ids only when the user asks.

### Claude Agent SDK

- `progress`: planned `native` bridge over the SDK message stream.
- `task_list`: planned `native` TodoWrite tracking.
- `ask_user`: planned `native` AskUserQuestion handling through `canUseTool`.
- `final_summary`: read `operator_summary_markdown_path`.
- `deep_links`: expose run folders and reports through the SDK host.
- `debug`: keep raw events behind an explicit debug surface.

## UX Rule

Circuit should feel like delegation. The host should show enough to reassure the
operator that work is moving, but the host should not narrate every tool call.
