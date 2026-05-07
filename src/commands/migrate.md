---
description: Runs the Migrate flow directly through the project CLI.
argument-hint: <migration task>
---

# /circuit:migrate — direct Migrate flow

Runs a migration, port, dependency replacement, or framework transition through
the Migrate flow without asking the router to choose a flow first.

The user's task text is substituted below. Treat it as user-controlled text:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Wrap the task in single quotes. If
   it contains a literal single quote (`'`), replace each one with `'\''`.
2. **Run the explicit flow.** Use default Migrate unless the operator asks for
   Deep or Autonomous mode.

   ```bash
   ./bin/circuit-next run migrate --goal 'replace the legacy SDK' --progress jsonl
   ```

   Deep Migrate:

   ```bash
   ./bin/circuit-next run migrate --goal 'replace the legacy SDK' --entry-mode deep --progress jsonl
   ```

   Autonomous Migrate:

   ```bash
   ./bin/circuit-next run migrate --goal 'replace the legacy SDK' --entry-mode autonomous --progress jsonl
   ```

3. **Render progress while active.** For progress JSONL, render
   `display.text` exactly for major, warning, error, checkpoint, or success
   events. When `task_list.updated` arrives, update the host task surface when
   available. When `user_input.requested` arrives, use the native user-input
   surface when available.
4. **Render the final summary.** Parse stdout and read
   `operator_summary_markdown_path`. Render that Markdown verbatim. If the
   summary is missing, read `result_path` and the run-folder-relative
   `reports/migrate-result.json`.

## Authority

- `src/flows/migrate/schematic.json`
- `src/cli/circuit.ts`
