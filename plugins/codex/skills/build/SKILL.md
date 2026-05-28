---
name: build
description: "Expert control for starting Circuit from Build when you already know the task is implementation or documentation work."
---

# Circuit Build

## Use Case

Expert control for starting Circuit from Build when you already know the task is implementation or documentation work.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Starts Circuit from the Build flow. Use this expert control when the operator
is asking Circuit to make a focused change and the Build flow is already the
right starting point.

This is not a runtime bypass. Circuit still records the selected flow, runs the
Build work contract, writes trace, reports, and evidence, and follows declared
checkpoints and recovery behavior.

Circuit runs the Build flow: it confirms the brief, makes a plan, relays the
implementation to a worker, runs checks, asks for review when required, and
closes with a report and evidence.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Build a shell-safe invocation.** Single-quote the raw task text. Use the same safe construction rule as the other Circuit host skills:

   - Wrap the task text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the task itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and starts a
     new single-quoted string).
   - Then invoke the CLI with the explicit `build` flow name, passing the
     escaped, single-quoted task as the value of `--goal`.

   Default Build:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run build --goal 'add a focused feature' --progress jsonl
   ```

   Lite Build:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run build --goal 'make a small change' --rigor lite --progress jsonl
   ```

   Deep Build:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run build --goal 'make the focused change' --rigor deep --progress jsonl
   ```

   Autonomous Build:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run build --goal 'ship the requested fix' --autonomous --progress jsonl
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node '<plugin root>/scripts/circuit.ts' run build --goal 'can'\''t ship' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Circuit plugin directory and injects the plugin's
   packaged flow root before it launches Circuit's bundled runtime.
2. **Only add axis flags when the operator explicitly asks for them.** Map
   Lite Build to `--rigor lite`, Deep Build to `--rigor deep`, and Autonomous
   Build to `--autonomous`. Omit axis flags for normal Build.
3. **Render progress while the run is active.** `--progress jsonl` writes
   progress events to stderr and keeps the final result JSON on stdout.
   Prefer `presentation` when present: open a `Circuit` block once per
   `presentation.block_id`, render visible status lines as
   `⎿ ${presentation.status_text}`, suppress `presentation.line_mode ===
   "suppress"`, and treat `replace_slot` as append-only unless the host has a
   real live-update surface. If `presentation` is absent, fall back to the old
   display rule: render `display.text` for major, warning, error, or checkpoint
   events and suppress detail. Do not show raw JSON, raw step IDs, or trace
   internals by default. When `task_list.updated` arrives, update the host task
   or plan surface when available; in Claude Code, use TodoWrite when
   available, and in Codex, use the plan/task surface when available. When
   `user_input.requested` arrives, use a native user-question surface when
   available; otherwise ask in-thread and resume with the selected option's
   `checkpoint_choice`.
5. **Parse the CLI's final JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, `trace_entries_observed`, `operator_summary_path`,
   `operator_summary_markdown_path`, and `operator_summary_html_path` when
   present.
6. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** If `operator_summary_html_path` is present, surface it as
   the rich checkpoint summary first. Then surface the waiting checkpoint
   details: `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, the `user_input.requested` question/options,
   and the exact resume command as the fallback:

   ```bash
   node '<plugin root>/scripts/circuit.ts' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
   ```

7. **If `outcome === "complete"`, render Circuit's final summary.** Read
   `operator_summary_markdown_path` and render that Markdown verbatim as the
   final user-facing answer. Do not invent a separate summary. If the operator
   summary is missing, surface `result_path`, then read the run-folder-relative
   `reports/build-result.json` report. Surface its review result fields;
   to summarize changed files and evidence, follow its `evidence_links`
   entry (in prose: evidence links) for `build.implementation` and read that
   report.
8. **If `outcome === "aborted"`, read `reports/result.json` at
   `result_path` and surface the abort reason.**