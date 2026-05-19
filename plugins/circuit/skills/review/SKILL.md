---
name: review
description: "Use when the user wants Circuit to audit existing code, a diff, PR, implementation, plan, report, or risk surface without implementing changes."
---

# Circuit Review

## When to Use This Skill

Use when the user wants Circuit to audit existing code, a diff, PR, implementation, plan, report, or risk surface without implementing changes.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Run the `review` flow on the scope the user supplied. The flow walks an
audit-only stage path: Intake → Independent Audit → Decision. Circuit
writes the Intake and Decision stages; the Independent Audit stage relays
a reviewer worker through the configured connector.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Resolve plugin root.** Use the absolute path to the installed
   Circuit plugin directory, the directory that contains
   `.codex-plugin/plugin.json`. Do not use a path relative to the
   user's project.
2. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw scope text. Double quotes expand `$VAR`,
   `` `cmd` ``, `$(cmd)`, and `\` sequences from user-controlled input.

   - Wrap the scope in **single quotes** in the final shell command.
   - If the scope contains a literal single-quote character (`'`), replace
     each one with `'\''`.
   - Then invoke the CLI with the escaped, single-quoted scope as the value
     of `--goal`.

   Example:

   ```bash
   node '<plugin root>/scripts/circuit.mjs' run review --goal 'review the latest change' --progress jsonl
   ```

   Example with an apostrophe:

   ```bash
   node '<plugin root>/scripts/circuit.mjs' run review --goal 'can'\''t regress runtime safety' --progress jsonl
   ```

3. **Handle untracked file contents deliberately.** Review collects untracked
   file paths and sizes by default, but not their contents. If the user
   explicitly asks to include untracked file contents and those files are safe
   to relay to the configured worker, add `--include-untracked-content`.
   Otherwise omit the flag.
4. **Render progress while the run is active.** `--progress jsonl` writes
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
5. **Parse the final JSON output.** On success the CLI prints a JSON object
   with these fields on stdout: `run_id`, `run_folder`, `outcome`
   (`complete` | `aborted`), `trace_entries_observed`, `result_path`,
   `operator_summary_path`, and `operator_summary_markdown_path`.
6. **Render Circuit's final summary.** Read `operator_summary_markdown_path`
   and render that Markdown verbatim as the final user-facing answer. Do not
   invent a separate summary. If the operator summary is missing, fall back to
   the Review reports and include:
   - `outcome` (e.g., "Run completed" / "Run aborted")
   - `run_folder` — the absolute path of the run folder where evidence lives
   - `result_path` — the run summary `reports/result.json`
   - if `outcome === 'complete'`,
     `${run_folder}/reports/review-result.json` — the review flow's
     typed review-result report
   - any `evidence_warnings` from the intake or review-result report
   - `trace_entries_observed` count + a pointer to `trace.ndjson` under the run
     folder for the full trace

   The default CLI path now writes a schema-valid
   `${run_folder}/reports/review-result.json` for the audit-only review
   flow when the run completes. Surface that path as the typed review
   result report only for completed runs.

   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
   to surface the abort `reason`; do not claim that
   `reports/review-result.json` exists on aborted runs.
7. **Do not modify the CLI output before surfacing.** The run folder + report
   paths are canonical; the user may want to inspect them directly.

## Axes

Review runs at standard rigor. Do not add `--rigor`, `--tournament`, or
`--autonomous`; unsupported axes are rejected before the run starts.

## Authority

- `src/flows/review/contract.md` (review flow contract)
- `tests/runner/review-runtime-wiring.test.ts` (default registered review
  composer writer)
