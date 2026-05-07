---
status: roadmap
last_updated: 2026-04-30
depends_on: [continuity, host-adapter, host-capabilities, host-rendering]
---

# Host Continuity Roadmap

This roadmap tracks the gap between saved Circuit continuity and host-level
fresh-session re-entry.

Circuit-next now has explicit handoff persistence:

- `circuit-next handoff save` writes a continuity record.
- `circuit-next handoff resume` reads the pending record and writes a summary.
- `circuit-next handoff done` clears the pending record.
- run-backed handoffs can write `active-run.md`.

That is necessary, but it is not the full original Circuit behavior. Original
Circuit also has a Claude Code `SessionStart` hook. After `/clear`, startup,
resume, or compaction, that hook prints a passive continuity banner into the new
conversation. Circuit-next does not yet have that host hook layer.

## Goal

Fresh sessions should re-orient the operator without depending on chat memory
or manual copy-paste.

The re-entry behavior must stay passive:

- Do not auto-resume a run.
- Do not continue work without an explicit operator command.
- Do show whether a pending continuity record or active run exists.
- Do show the exact command to inspect, continue, or clear the saved state.

## Current Gap

Current circuit-next support covers the data and utility layer:

- continuity record schema
- continuity index schema
- explicit handoff command
- run-backed active-run summary
- golden proof for save and resume

Missing support:

- host-neutral session bootstrap/status command
- Claude Code `SessionStart` hook registration
- Codex-specific fresh-session surfacing
- generic shell status command for non-conversational hosts
- release proof that `/clear` or fresh-session startup shows the right banner

## Target Shape

Add a host-neutral bootstrap command first.

Proposed command:

```bash
circuit-next session-start --progress jsonl
```

or:

```bash
circuit-next continuity status --format host-markdown
```

The exact name can change, but the command should have one job: read the
control-plane state and render the bootstrap packet a host should show at
session start.

The command should return:

- final JSON on stdout
- optional progress JSONL on stderr
- a Markdown banner path, or inline Markdown if that is simpler for hooks
- status: `pending_continuity`, `active_run`, `empty`, or `warning`
- explicit next commands for `handoff resume`, `run continue`, and
  `handoff done` when relevant

## Resolution Rules

The bootstrap command should resolve state in this order:

1. Pending continuity record.
2. Attached current run.
3. Empty welcome state.

Pending continuity wins over an attached current run because it is the
operator-authored handoff. An attached current run is fallback context.

If the index points at a missing continuity record, surface a clear warning and
do not silently drop it.

If the active run pointer is stale, clear or warn according to the continuity
contract, then render the remaining state.

## Claude Code Adapter

Claude Code should restore the original Circuit experience with a plugin hook.

Add generated or packaged hook files:

- `plugins/claude/hooks/hooks.json`
- `plugins/claude/hooks/session-start.mjs`

The hook registration should target:

```json
"SessionStart": "startup|resume|clear|compact"
```

The shell hook should call the host-neutral bootstrap command from the installed
plugin root and print its Markdown banner.

Expected behavior:

- `/clear` starts a new conversation.
- Claude Code runs the `SessionStart` hook.
- Circuit prints a passive banner.
- The banner names the pending goal and next action.
- The banner tells the operator to run `/circuit:handoff resume`,
  `/circuit:run continue`, or `/circuit:handoff done`.
- The banner does not dump full state or debt by default.

## Codex Adapter

Codex should not assume Claude Code hook semantics.

Current near-term behavior:

- `/circuit:handoff resume` remains explicit.
- The Codex command surface can render the same bootstrap packet when the user
  asks to resume or continue saved continuity.

Future Codex app/server behavior:

- call the host-neutral bootstrap command when a project session opens;
- render pending continuity in a native status surface if one exists;
- keep explicit resume as the action boundary.

## Generic Shell

Generic shell hosts cannot inject into a conversation.

They should expose the same state through a direct command:

```bash
circuit-next continuity status
```

This lets scripts and terminals show the same continuity truth without a host
hook.

## Acceptance Checks

Minimum checks before this is considered restored:

- A pending continuity record produces a passive banner with goal, next action,
  and explicit resume/done commands.
- An attached current run without pending continuity produces an active-run
  fallback banner.
- Empty state produces a welcome or no-op result.
- A stale active run does not produce a misleading active-run banner.
- Claude Code packaged output includes the SessionStart hook files.
- The Claude Code hook invokes the installed plugin wrapper, not the repository
  source path.
- Tests cover startup, resume, clear, and compact hook matchers.
- Golden proof captures fresh-session re-entry, not only manual
  `handoff resume`.

## Rationale

Continuity is part of the trust contract. If Circuit asks the operator to stop
supervising, it must make return easy.

The core record is not enough by itself. A later host has to know when and how
to show it.

The safest design is shared core truth with host-specific presentation:

- Circuit owns continuity state and wording.
- Claude Code owns `SessionStart` hook delivery.
- Codex owns its own session or app-server affordance.
- Generic shell owns explicit command output.

This preserves original-Circuit parity for Claude Code while keeping the
adapter model honest for other hosts.
