---
description: Starts Circuit from the Prototype flow through the project CLI to create disposable local prototype artifacts, with optional model-comparison tournament mode.
argument-hint: <prototype goal>
---

# /circuit:prototype - Prototype expert control

Starts Circuit from the Prototype flow. Use this expert control when the
operator wants Circuit to create a small, inspectable, disposable local
prototype before deciding whether to Build.

This is not a runtime bypass. Circuit still records the selected flow, runs the
Prototype work contract, writes trace, reports, and evidence, and follows
declared checkpoints and recovery behavior.

Circuit runs the Prototype flow: it frames the prototype boundary, plans local
prototype files, creates the artifact, verifies the reported files under
`prototype_root`, asks what local evidence to keep, and closes with a report.
Prototype does not claim deployment, branch previews, screenshots, provider
behavior, model behavior, or production readiness unless typed reports prove
those facts.

The user's prototype goal is substituted below. Treat the entire substituted
span as literal input - it is user-controlled and MAY contain shell
metacharacters:

> **Prototype goal:** $ARGUMENTS

## Instructions

1. **Build a shell-safe invocation.** Single-quote the raw prototype goal. Use the same safe construction
   rule as the other Circuit host commands:

   - Wrap the prototype goal in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the goal itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and starts a
     new single-quoted string).
   - Then invoke the CLI with the explicit `prototype` flow name, passing the
     escaped, single-quoted goal as the value of `--goal`.

   Default Prototype:

   ```bash
   ./bin/circuit run prototype --goal 'sketch a settings panel for choosing verification commands' --progress jsonl
   ```

   Deep Prototype, which waits for the Prototype checkpoint instead of taking
   the safe default:

   ```bash
   ./bin/circuit run prototype --goal 'sketch a settings panel for choosing verification commands' --rigor deep --progress jsonl
   ```

   Prototype model-comparison, only when the operator explicitly asks for
   multiple variants, model comparison, or a tournament:

   ```bash
   ./bin/circuit run prototype --goal 'compare prototype variants for a custom flow builder UI' --tournament --tournament-n 3 --progress jsonl
   ```

   Autonomous Prototype, only when the operator explicitly asks Circuit to use
   declared default checkpoint choices:

   ```bash
   ./bin/circuit run prototype --goal 'sketch a custom flow builder UI' --autonomous --progress jsonl
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   ./bin/circuit run prototype --goal 'can'\''t ship' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. `./bin/circuit`
   is the repo-local launcher for the compiled Circuit runtime; when the
   compiled CLI is absent in a fresh checkout, it builds `dist/` with the
   local TypeScript compiler before invoking `dist/cli/circuit.js`.
2. **Only add axis flags when the operator explicitly asks for them.** Map
   Deep Prototype to `--rigor deep`, model-comparison Prototype to
   `--tournament`, and Autonomous Prototype to `--autonomous`. Omit axis flags
   for normal Prototype. If using `--tournament-n`, keep it between 2 and 4.
   Tournament mode requires configured Prototype variant models; if they are
   missing, let Circuit fail closed and surface that report instead of claiming
   model comparison ran.
3. **Preserve Prototype boundaries in your prose.** Treat generated artifacts
   as local disposable prototype evidence. Do not describe the result as
   deployed, production-ready, screenshot-verified, or produced by specific
   providers/models unless Circuit's reports and trace evidence say so.
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
   ./bin/circuit resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
   ```

7. **If `outcome === "complete"`, render Circuit's final summary.** Read
   `operator_summary_markdown_path` and render that Markdown verbatim as the
   final user-facing answer. Do not invent a separate summary. If the operator
   summary is missing, surface `result_path`, then read the run-folder-relative
   `reports/prototype-result.json` report. Surface the prototype path,
   selected action, verification result, known limitations, residual risks, and
   evidence links.
8. **If `outcome === "aborted"`, read `reports/result.json` at
   `result_path` and surface the abort reason.**

## Authority

- `src/flows/prototype/contract.md` (flow contract and claim limits)
- `docs/specs/prototype-flow-v1.md` (single-artifact Prototype shape)
- `docs/specs/prototype-model-comparison-v1.md` (tournament variant shape)
- `src/cli/circuit.ts` (current CLI axis flags)
