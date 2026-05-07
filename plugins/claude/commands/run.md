---
description: Selects the best Circuit flow for a natural-language task and runs it through the project CLI.
argument-hint: <task>
---

# /circuit:run — flow selector

Selects the best Circuit flow for the user's natural-language task, then
runs that explicit flow through the project CLI. In this host surface, the
host model chooses the flow before invoking Circuit. The deterministic CLI
router remains available as a compatibility and fallback path.

Explicit flow commands remain available as
`/circuit:explore`, `/circuit:review`, `/circuit:migrate`, `/circuit:fix`,
`/circuit:build`, and `/circuit:sweep`.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Select the flow before invoking the CLI.** Use this rubric:

   - **Fix** — bugs, regressions, broken behavior, failing tests, crashes,
     flaky behavior, or production issues.
   - **Review** — audit-only review of existing code, current diff, PR, plan,
     report, implementation, or risk surface. Do not implement changes.
   - **Build** — implementation, refactor, docs, tests, or focused
     product/code changes that are not primarily bug fixes.
   - **Explore** — investigation, explanation, architecture analysis, tradeoff
     comparison, or a decision before editing.
   - **Migrate** — broad dependency, framework, API, or architecture
     transitions that need inventory, batching, coexistence, or rollback.
   - **Sweep** — cleanup, dead code, quality passes, coverage improvements,
     or safe maintenance batches.

   If one flow is clear, briefly state the selected flow and run the
   explicit CLI flow. Ask one short question only when the answer changes
   safety or mutation behavior, especially Review vs Build/Fix, Explore vs
   Build, or Migrate vs Build.

   Use the deterministic CLI router (`node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run --goal ...`) only
   when the user explicitly asks Circuit/the engine to choose mechanically, the
   host cannot confidently choose, or the task is intentionally exercising the
   automatic router path.
2. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text (double quotes expand `$VAR`,
   `` `cmd` ``, `$(cmd)`, and `\` sequences — a malicious or accidental
   task string could inject commands). The safe construction rule matches
   `/circuit:explore` and `/circuit:review`:

   - Wrap the task text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the task itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and
     starts a new single-quoted string).
   - Then invoke the CLI with the selected explicit flow name, passing the
     escaped, single-quoted task as the value of `--goal`.

   Example for a Fix task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run fix --goal 'the checkout total is wrong when discounts and tax both apply' --progress jsonl
   ```

   Example for a Review task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run review --goal 'review the current diff for safety problems' --progress jsonl
   ```

   Example for a Build task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run build --goal 'add a focused feature' --progress jsonl
   ```

   Example for an Explore task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run explore --goal 'compare auth provider migration options' --progress jsonl
   ```

   Example for a Migrate task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run migrate --goal 'move the old SDK to the new SDK' --progress jsonl
   ```

   Example for a Sweep task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run sweep --goal 'remove safe dead code' --progress jsonl
   ```

   Example for the deterministic fallback router:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run --goal 'choose the right Circuit flow for this task' --progress jsonl
   ```

   Example for a Build task using both an entry mode and an explicit
   `--depth` flag:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run build --goal 'make the focused change' --entry-mode deep --depth standard --progress jsonl
   ```

   Example for a Fix task using Lite mode (skips the review pass):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run fix --goal 'fix the missing-token edge case' --entry-mode lite --progress jsonl
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" run build --goal 'can'\''t ship' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Claude Code plugin directory, injects the
   plugin's packaged flow root, and then invokes `circuit-next`.
3. **Handle untracked Review contents deliberately.** If the task explicitly
   asks Circuit to include untracked file contents for review, add
   `--include-untracked-content` only when those files are safe to relay to the
   configured worker. Otherwise omit the flag; Review still sends untracked
   paths and sizes.
4. **Render progress while the run is active.** `--progress jsonl` writes
   machine-readable progress events to stderr and keeps the final result JSON
   on stdout. For every event whose `display.importance === "major"` or whose
   `display.tone` is `warning`, `error`, or `checkpoint`, render
   `display.text` exactly. Suppress `detail` events unless the user asks for
   debug detail. Do not show raw JSON, raw step IDs, or trace internals by
   default. When `task_list.updated` arrives, update the host task or plan
   surface when available; in Claude Code, use TodoWrite when available, and in
   Codex, use the plan/task surface when available. When `user_input.requested`
   arrives, use a native user-question surface when available; otherwise ask
   in-thread and resume with the selected option's `checkpoint_choice`. Keep
   host/orchestrator and worker connector distinct in prose.
5. **Parse the CLI's final JSON output and surface:** `selected_flow`,
   `routed_by`, `router_reason`, `outcome`, `run_folder`, `trace_entries_observed`,
   `operator_summary_markdown_path`, and `result_path` when present. If
   present, also surface `router_signal`.
6. **Render Circuit's final summary.** Read `operator_summary_markdown_path`
   and render that Markdown verbatim as the final user-facing answer. Do not
   invent a separate summary. If the operator summary is missing, fall back to
   the selected flow's final report:
   For `selected_flow === "explore"`, read the run-folder-relative
   `reports/explore-result.json` close-step report. For
   `selected_flow === "review"` and `outcome === "complete"`, read
   `reports/review-result.json` and surface its review result. For
   `selected_flow === "build"` and `outcome === "complete"`, read
   `reports/build-result.json` and surface its review result fields; to
   summarize changed files and evidence, follow its `evidence_links`
   entry (the JSON field is named `evidence_links`; in prose call them
   evidence links) for `build.implementation` and read that report. For
   `selected_flow === "migrate"` and `outcome === "complete"`, read
   `reports/migrate-result.json` and surface its result fields; to summarize
   the migration evidence, follow its `evidence_links` entries. For
   `selected_flow === "sweep"` and `outcome === "complete"`, read
   `reports/sweep-result.json` and surface its result fields; to summarize
   the cleanup evidence, follow its `evidence_links` entries. For
   `selected_flow === "fix"` and `outcome === "complete"`, read
   `reports/fix-result.json` and surface its review result fields; to
   summarize the change and verification evidence, follow its
   `evidence_links` entries (for example `fix.change` and the
   verification report) and read those reports.
7. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Surface the routed metadata (`selected_flow`,
   `routed_by`, `router_reason`, and optional `router_signal`), then surface
   the waiting checkpoint details from `checkpoint.waiting` and
   `user_input.requested`: `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, the question/options, and the exact resume
   command:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
   ```

8. **If `outcome === "aborted"`, read `reports/result.json` at
   `result_path` to surface the abort `reason`.**

## Direct Flow Bypass

Use `/circuit:explore`, `/circuit:review`, `/circuit:migrate`, `/circuit:fix`,
`/circuit:build`, or `/circuit:sweep`
when the operator already knows which flow they want. Those commands call
the same CLI with an explicit flow name and skip this classifier layer.
`migrate` and `sweep` remain routable through this command as well.

## Authority

- `src/flows/router.ts` (current deterministic classifier)
- `tests/contracts/flow-router.test.ts` (classifier behavior)
