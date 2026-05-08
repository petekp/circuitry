---
name: build
description: "Use when the user wants Circuit to add, change, implement, refactor, document, or test code and the task is not primarily a bug fix."
---

# Circuit Build

## When to Use This Skill

Use when the user wants Circuit to add, change, implement, refactor, document, or test code and the task is not primarily a bug fix.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Runs a task through the Build flow without asking the router to choose a
flow first. Use this when the operator is asking Circuit to make a focused
change.

Circuit runs the Build flow: it confirms the brief, makes a plan, relays the
implementation to a worker, runs checks, asks for review when required, and
closes with a report and evidence.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text. Use the same safe construction rule as the other Circuit host skills:

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
   node '<plugin root>/scripts/circuit-next.mjs' run build --goal 'add a focused feature' --progress jsonl
   ```

   Lite Build:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run build --goal 'make a small change' --entry-mode lite --progress jsonl
   ```

   Deep Build with explicit standard depth in the same invocation:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run build --goal 'make the focused change' --entry-mode deep --depth standard --progress jsonl
   ```

   Autonomous Build:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run build --goal 'ship the requested fix' --entry-mode autonomous --progress jsonl
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run build --goal 'can'\''t ship' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Circuit plugin directory and injects the plugin's
   packaged flow root before it launches Circuit's bundled runtime.
2. **Only add `--entry-mode` when the operator explicitly asks for a Build
   mode.** Map Lite Build to `--entry-mode lite`, Deep Build to
   `--entry-mode deep`, and Autonomous Build to `--entry-mode autonomous`.
   Omit `--entry-mode` for normal Build.
3. **Keep `--depth` separate from `--entry-mode`.** If the operator asks for
   an explicit depth level, pass it with `--depth`. A single command may carry
   both flags, as shown above.
4. **Render progress while the run is active.** `--progress jsonl` writes
   progress events to stderr and keeps the final result JSON on stdout.
   For every event whose `display.importance === "major"` or whose
   `display.tone` is `warning`, `error`, or `checkpoint`, render
   `display.text` exactly. Suppress `detail` events unless the user asks for
   debug detail. Do not show raw JSON, raw step IDs, or trace internals by
   default. When `task_list.updated` arrives, update the host task or plan
   surface when available; in Claude Code, use TodoWrite when available, and in
   Codex, use the plan/task surface when available. When `user_input.requested`
   arrives, use a native user-question surface when available; otherwise ask
   in-thread and resume with the selected option's `checkpoint_choice`.
5. **Parse the CLI's final JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, `trace_entries_observed`, `operator_summary_path`, and
   `operator_summary_markdown_path`.
6. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Instead surface the waiting checkpoint details:
   `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, the `user_input.requested` question/options,
   and the exact resume command:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
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

## Authority

- `docs/contracts/compiled-flow.md` (compiled flow shape)
- `src/cli/circuit.ts` (current CLI flags)
- `src/flows/router.ts` (router bypass behavior for explicit flow names)
