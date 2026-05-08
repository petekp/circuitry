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

   Use the deterministic CLI router (`node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run --goal ...`) only
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
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run fix --goal 'the checkout total is wrong when discounts and tax both apply'
   ```

   Example for a Review task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run review --goal 'review the current diff for safety problems'
   ```

   Example for a Build task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'add a focused feature'
   ```

   Example for an Explore task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run explore --goal 'compare auth provider migration options'
   ```

   Example for a Migrate task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run migrate --goal 'move the old SDK to the new SDK'
   ```

   Example for a Sweep task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run sweep --goal 'remove safe dead code'
   ```

   Example for the deterministic fallback router:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run --goal 'choose the right Circuit flow for this task'
   ```

   Example for a Build task using both an entry mode and an explicit
   `--depth` flag:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'make the focused change' --entry-mode deep --depth standard
   ```

   Example for a Fix task using Lite mode (skips the review pass):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run fix --goal 'fix the missing-token edge case' --entry-mode lite
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'can'\''t ship'
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Claude Code plugin directory, injects the
   plugin's packaged flow root, and launches Circuit's bundled runtime.
3. **Handle untracked Review contents deliberately.** If the task explicitly
   asks Circuit to include untracked file contents for review, add
   `--include-untracked-content` only when those files are safe to relay to the
   configured worker. Otherwise omit the flag; Review still sends untracked
   paths and sizes.
4. **Let the presentation wrapper render output.** `present` streams
   Circuit status blocks, renders checkpoint questions, and prints the
   final Circuit summary without exposing raw JSON. Do not parse raw JSON
   or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Direct Flow Bypass

Use `/circuit:explore`, `/circuit:review`, `/circuit:migrate`, `/circuit:fix`,
`/circuit:build`, or `/circuit:sweep`
when the operator already knows which flow they want. Those commands call
the same CLI with an explicit flow name and skip this classifier layer.
`migrate` and `sweep` remain routable through this command as well.

## Authority

- `src/flows/router.ts` (current deterministic classifier)
- `tests/contracts/flow-router.test.ts` (classifier behavior)
