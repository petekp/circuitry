---
contract: native-host-adapters
status: retired-draft
version: 0.1
last_updated: 2026-05-19
depends_on: [host-adapter, host-capabilities, host-rendering]
---

# Native Host Adapters

This is a retired draft. Native Codex App Server and Claude Agent SDK adapters
are not current roadmap items, and release truth must not list them as planned
capabilities.

Circuit emits one host-neutral run stream. If a future product decision reopens
native adapters, they must map that stream to host affordances without changing
flow behavior.

## Shared Events

- `task_list.updated` carries the current flow checklist.
- `user_input.requested` carries checkpoint questions and resume metadata.
- `operator_summary_markdown_path` carries the final response text.

Adapters may choose richer presentation, but they must preserve Circuit's
wording and keep host/orchestrator separate from worker connector.

## Claude Agent SDK Track

Historical draft notes for a possible Claude Agent SDK adapter:

- map `task_list.updated` to TodoWrite/todo tracking;
- map `user_input.requested` to AskUserQuestion through `canUseTool`;
- include `AskUserQuestion` whenever tools are restricted;
- fall back to in-thread checkpoint prompts when native input is unavailable;
- avoid expecting AskUserQuestion inside Agent-tool subagents.

## Codex App Server Track

Historical draft notes for a possible Codex App Server adapter:

- map `task_list.updated` to plan updates where supported;
- map `user_input.requested` to `tool/requestUserInput` where supported;
- treat App Server dynamic tool and user-input APIs as experimental until
  separately dogfooded;
- continue using `operator_summary_markdown_path` as the final answer source.

## Non-Goals For This Slice

This draft does not implement either native bridge. Current Circuit host support
is the Claude Code command surface, the Codex plugin surface, and generic shell
fallback behavior.
