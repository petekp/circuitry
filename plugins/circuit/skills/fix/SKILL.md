---
name: fix
description: "Use when the user wants Circuit to fix a bug, regression, failing test, crash, broken behavior, flaky behavior, or production issue."
---

# Circuit Fix

## When to Use This Skill

Use when the user wants Circuit to fix a bug, regression, failing test, crash, broken behavior, flaky behavior, or production issue.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Runs a task through the Fix flow without asking the router to choose a
flow first. Use this when the operator already knows they want Circuit to
take a concrete problem, understand it, make the smallest safe change, prove
it, and close with evidence.

Circuit runs the Fix flow: it reproduces the issue, isolates the cause,
relays a focused change to a worker, runs verification checks, asks for
review when required, and closes with a report and evidence.

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
   - Then invoke the CLI with the explicit `fix` flow name, passing the
     escaped, single-quoted task as the value of `--goal`.

   Default Fix (standard depth, full review pass):

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run fix --goal 'fix the foo bug' --progress jsonl
   ```

   Lite Fix (skips review, closes after verification):

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run fix --goal 'fix the missing-token edge case' --entry-mode lite --progress jsonl
   ```

   Deep Fix:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run fix --goal 'fix the failing pipeline' --entry-mode deep --progress jsonl
   ```

   Autonomous Fix:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run fix --goal 'diagnose and patch the crash' --entry-mode autonomous --progress jsonl
   ```

   Example for a task `can't reproduce` (contains one apostrophe):

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run fix --goal 'can'\''t reproduce' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Circuit plugin directory and injects the plugin's
   packaged flow root before it launches Circuit's bundled runtime.
2. **Only add `--entry-mode` when the operator explicitly asks for a Fix
   mode.** Map Lite Fix to `--entry-mode lite`, Deep Fix to
   `--entry-mode deep`, and Autonomous Fix to `--entry-mode autonomous`.
   Omit `--entry-mode` for default Fix.
3. **Keep `--depth` separate from `--entry-mode`.** If the operator asks for
   an explicit depth level, pass it with `--depth`. A single command may carry
   both flags.
4. **Per-mode flow files.** When `--entry-mode lite` is supplied, the CLI
   prefers `generated/flows/fix/lite.json` over `circuit.json` because
   the Fix schematic emits a Lite-only compiled flow that skips the review
   relay. Other modes (default/deep/autonomous) load `circuit.json`.
5. **Render progress while the run is active.** `--progress jsonl` writes
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
6. **Parse the CLI's final JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, `trace_entries_observed`, `operator_summary_path`, and
   `operator_summary_markdown_path`.
7. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Instead surface the waiting checkpoint details:
   `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, the `user_input.requested` question/options,
   and the exact resume command:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
   ```

8. **If `outcome === "complete"`, render Circuit's final summary.** Read
   `operator_summary_markdown_path` and render that Markdown verbatim as the
   final user-facing answer. Do not invent a separate summary. If the operator
   summary is missing, surface `result_path`, then read the run-folder-relative
   `reports/fix-result.json` report. Surface its review result fields;
   to summarize the change and verification evidence, follow its
   `evidence_links` entries (in prose: evidence links — for example
   `fix.change` and the verification report) and read those reports.
9. **If `outcome === "aborted"`, read `reports/result.json` at
   `result_path` and surface the abort reason.**

## Authority

- `src/flows/fix/contract.md` (Fix report contract)
- `docs/contracts/compiled-flow.md` (compiled flow shape)
- `src/cli/circuit.ts` (current CLI flags + per-mode flow file resolution)
- `src/flows/router.ts` (router bypass behavior for explicit flow names)
