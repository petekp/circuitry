---
description: Runs the Fix flow directly through the project CLI, with optional Lite, Default (standard), Deep, or Autonomous entry behavior.
argument-hint: <task>
---

# /circuit:fix — direct Fix flow

Runs a task through the Fix flow without asking the router to choose a
flow first. Use this when the operator already knows they want Circuit to
take a concrete problem, understand it, make the smallest safe change, prove
it, and close with evidence.

Circuit runs the Fix flow: it reproduces the issue, isolates the cause,
relays a focused change to a worker, runs verification checks, asks for
review when required, and closes with a report and evidence.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text. Use the same safe construction rule as
   `/circuit:run`, `/circuit:explore`, `/circuit:review`, and `/circuit:build`:

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
   ./bin/circuit-next run fix --goal 'fix the foo bug' --progress jsonl
   ```

   Lite Fix (skips review, closes after verification):

   ```bash
   ./bin/circuit-next run fix --goal 'fix the missing-token edge case' --rigor lite --progress jsonl
   ```

   Deep Fix:

   ```bash
   ./bin/circuit-next run fix --goal 'fix the failing pipeline' --rigor deep --progress jsonl
   ```

   Autonomous Fix:

   ```bash
   ./bin/circuit-next run fix --goal 'diagnose and patch the crash' --autonomous --progress jsonl
   ```

   Example for a task `can't reproduce` (contains one apostrophe):

   ```bash
   ./bin/circuit-next run fix --goal 'can'\''t reproduce' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. `./bin/circuit-next`
   is the repo-local launcher for the compiled Circuit runtime; when the
   compiled CLI is absent in a fresh checkout, it builds `dist/` with the
   local TypeScript compiler before invoking `dist/cli/circuit.js`.
2. **Only add axis flags when the operator explicitly asks for them.** Map
   Lite Fix to `--rigor lite`, Deep Fix to `--rigor deep`, and Autonomous Fix
   to `--autonomous`. Omit axis flags for default Fix.
3. **Per-mode flow files.** When `--rigor lite` is supplied, the CLI
   prefers `generated/flows/fix/lite.json` over `circuit.json` because
   the Fix schematic emits a Lite-only compiled flow that skips the review
   relay. Other modes (default/deep/autonomous) load `circuit.json`.
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
6. **Parse the CLI's final JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, `trace_entries_observed`, `operator_summary_path`, and
   `operator_summary_markdown_path`.
7. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Instead surface the waiting checkpoint details:
   `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, the `user_input.requested` question/options,
   and the exact resume command:

   ```bash
   ./bin/circuit-next resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
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
