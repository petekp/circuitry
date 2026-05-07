---
description: Runs the Sweep flow directly through the project CLI.
argument-hint: <cleanup task>
---

# /circuit:sweep — direct Sweep flow

Runs cleanup, quality, coverage, and docs-sync work through the Sweep flow
without asking the router to choose a flow first.

The user's task text is substituted below. Treat it as user-controlled text:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Wrap the task in single quotes. If
   it contains a literal single quote (`'`), replace each one with `'\''`.
2. **Run the explicit flow.** Use default Sweep unless the operator asks for
   Lite, Deep, or Autonomous mode.

   ```bash
   ./bin/circuit-next run sweep --goal 'remove safe dead code' --progress jsonl
   ```

   Lite Sweep:

   ```bash
   ./bin/circuit-next run sweep --goal 'remove safe dead code' --entry-mode lite --progress jsonl
   ```

   Deep Sweep:

   ```bash
   ./bin/circuit-next run sweep --goal 'remove safe dead code' --entry-mode deep --progress jsonl
   ```

   Autonomous Sweep:

   ```bash
   ./bin/circuit-next run sweep --goal 'overnight repo cleanup' --entry-mode autonomous --progress jsonl
   ```

3. **Render progress while active.** For progress JSONL, render
   `display.text` exactly for major, warning, error, checkpoint, or success
   events. When `task_list.updated` arrives, update the host task surface when
   available. When `user_input.requested` arrives, use the native user-input
   surface when available.
4. **Render the final summary.** Parse stdout and read
   `operator_summary_markdown_path`. Render that Markdown verbatim. If the
   summary is missing, read `result_path` and the run-folder-relative
   `reports/sweep-result.json`.

## Authority

- `src/flows/sweep/schematic.json`
- `src/cli/circuit.ts`
