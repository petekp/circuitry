---
name: goal
description: "Runs Circuit Goal for bounded objectives with typed evidence, recovery, and a safety review."
---

# Circuit Goal

## Use Case

Runs Circuit Goal for bounded objectives with typed evidence, recovery, and a safety review.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Starts Circuit from the Goal flow. Use this expert control when the operator
already knows the work should be handled as a bounded objective. Goal
supervises the objective until typed evidence proves it, recovery is needed, or
a blocked result is more honest than continuing.

This is not a runtime bypass. Circuit still records the selected flow, runs the
Goal work contract, writes trace, reports, and evidence, and follows declared
checkpoints and recovery behavior.

Circuit writes a Goal contract, runs one statically authored child flow target,
evaluates the child evidence, runs two safety review passes, and closes from
`goal.result@v1`.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Build a shell-safe invocation.** Single-quote the raw goal text instead of
   double-quoting it.

   - Wrap the goal text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the goal text contains a literal single-quote character (`'`), replace
     each one with `'\''`.
   - Then invoke the CLI with the explicit `goal` flow name, passing the
     escaped, single-quoted goal as the value of `--goal`.

   Default Goal:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --progress jsonl
   ```

   Lite Goal:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --rigor lite --progress jsonl
   ```

   Deep Goal:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --rigor deep --progress jsonl
   ```

   Autonomous Goal:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --autonomous --progress jsonl
   ```

2. **Only add axis flags when the operator explicitly asks for them.** Map Lite
   Goal to `--rigor lite`, Deep Goal to `--rigor deep`, and Autonomous Goal to
   `--autonomous`. Omit axis flags for normal Goal.
3. **Render progress while the run is active.** Prefer `presentation` when
   present: render visible status text and suppress lines marked suppress. If
   `presentation` is absent, render `display.text` for major, warning, error,
   or checkpoint events. Update task surfaces when `task_list.updated` arrives,
   and ask through a native question surface when `user_input.requested`
   arrives. Do not treat progress text as the final outcome.
4. **Parse the CLI's final JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, `trace_entries_observed`, `operator_summary_path`,
   `operator_summary_markdown_path`, and `operator_summary_html_path` when
   present.
5. **If `outcome === "checkpoint_waiting"`, render the checkpoint.** Include
   the summary and exact resume command:

   ```bash
   node '<plugin root>/scripts/circuit.ts' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
   ```

6. **If `outcome === "complete"`, render Circuit's final summary.** Read
   `operator_summary_markdown_path` and render that Markdown verbatim. Do not
   invent a separate host summary.
7. **If `outcome === "aborted"`, read `reports/result.json` at `result_path`
   and surface the abort reason.**