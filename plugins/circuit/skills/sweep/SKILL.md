---
name: sweep
description: "Use when the user wants Circuit to run cleanup, dead-code removal, quality passes, coverage improvements, or safe maintenance batches."
---

# Circuit Sweep

## When to Use This Skill

Use when the user wants Circuit to run cleanup, dead-code removal, quality passes, coverage improvements, or safe maintenance batches.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Runs cleanup, quality, coverage, and docs-sync work through the Sweep flow
without asking the router to choose a flow first.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Construct the Bash invocation SAFELY.** Wrap the task in single quotes. If
   it contains a literal single quote (`'`), replace each one with `'\''`.
2. **Run the explicit flow.** Use default Sweep unless the operator asks for
   Lite, Deep, or Autonomous mode.

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run sweep --goal 'remove safe dead code' --progress jsonl
   ```

   Lite Sweep:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run sweep --goal 'remove safe dead code' --entry-mode lite --progress jsonl
   ```

   Deep Sweep:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run sweep --goal 'remove safe dead code' --entry-mode deep --progress jsonl
   ```

   Autonomous Sweep:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run sweep --goal 'overnight repo cleanup' --entry-mode autonomous --progress jsonl
   ```

3. **Render progress while active.** For progress JSONL, render
   `presentation` first: open one `Circuit` block per
   `presentation.block_id`, render visible status lines as
   `⎿ ${presentation.status_text}`, suppress `line_mode: "suppress"`, and
   append `replace_slot` lines unless the host can update a live slot. If
   `presentation` is absent, render `display.text` for major, warning, error,
   checkpoint, or success events. When `task_list.updated` arrives, update the
   host task surface when available. When `user_input.requested` arrives, use
   the native user-input surface when available.
4. **Render the final summary.** Parse stdout and read
   `operator_summary_markdown_path`. Render that Markdown verbatim. If the
   summary is missing, read `result_path` and the run-folder-relative
   `reports/sweep-result.json`.

## Authority

- `src/flows/sweep/schematic.json`
- `src/cli/circuit.ts`
