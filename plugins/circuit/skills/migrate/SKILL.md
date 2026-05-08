---
name: migrate
description: "Use when the user wants Circuit to handle broad dependency, framework, API, or architecture transitions that need inventory, batching, coexistence, or rollback."
---

# Circuit Migrate

## When to Use This Skill

Use when the user wants Circuit to handle broad dependency, framework, API, or architecture transitions that need inventory, batching, coexistence, or rollback.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Runs a migration, port, dependency replacement, or framework transition through
the Migrate flow without asking the router to choose a flow first.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Construct the Bash invocation SAFELY.** Wrap the task in single quotes. If
   it contains a literal single quote (`'`), replace each one with `'\''`.
2. **Run the explicit flow.** Use default Migrate unless the operator asks for
   Deep or Autonomous mode.

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run migrate --goal 'replace the legacy SDK' --progress jsonl
   ```

   Deep Migrate:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run migrate --goal 'replace the legacy SDK' --entry-mode deep --progress jsonl
   ```

   Autonomous Migrate:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run migrate --goal 'replace the legacy SDK' --entry-mode autonomous --progress jsonl
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
   `reports/migrate-result.json`.

## Authority

- `src/flows/migrate/schematic.json`
- `src/cli/circuit.ts`
