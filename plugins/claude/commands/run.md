---
description: Runs Circuit on a coding intent through the project CLI, recording the selected flow and run evidence.
argument-hint: <task>
---

# /circuit:run — intent front door

Runs Circuit on the user's natural-language task. This is the intent front
door. The host may recommend a flow from the request, but Circuit records the
selected flow when the run starts and then uses the same trace, reports,
evidence, checkpoints, and recovery path as direct flow commands.

Explicit flow commands remain available as
`/circuit:explore`, `/circuit:review`, `/circuit:fix`,
`/circuit:build`, `/circuit:prototype`, and `/circuit:goal`.

Pursue is routable through this selector and can be invoked
explicitly through the CLI, but it does not have a dedicated slash command yet.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Recommend the flow before invoking the CLI.** Use this rubric:

   - **Fix** — bugs, regressions, broken behavior, failing tests, crashes,
     flaky behavior, or production issues.
   - **Review** — audit-only review of existing code, current diff, PR, plan,
     report, implementation, or risk surface. Do not implement changes.
   - **Build** — implementation, refactor, docs, tests, or focused
     product/code changes that are not primarily bug fixes.
   - **Prototype** — disposable local prototypes, mockups, UI sketches,
     model-comparison variants, or throwaway evidence before Build.
   - **Explore** — investigation, explanation, architecture analysis, tradeoff
     comparison, or a decision before editing.
   - **Pursue** — broad operator goals with multiple coordinated pieces of
     work, several tracks, or a bundle of pursuits that need ordering and
     serial execution.

   If one flow is clear, briefly state the recommended flow and run the
   explicit CLI flow. Circuit records the selected flow in the run trace. Ask
   one short question only when the answer changes safety or mutation behavior,
   especially Review vs Build/Fix, Explore vs Build.

   Use the deterministic CLI router (`node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run --goal ...`) when the
   user explicitly asks Circuit/the engine to choose mechanically, the host
   cannot confidently recommend a flow, or the task is intentionally exercising
   the automatic router path.
2. **Build a shell-safe invocation.** Single-quote the raw task text; double
   quotes expand `$VAR`,
   `` `cmd` ``, `$(cmd)`, and `\` sequences — a malicious or accidental
   task string could inject commands. The safe construction rule matches
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
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run fix --goal 'the checkout total is wrong when discounts and tax both apply'
   ```

   Example for a Review task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run review --goal 'review the current diff for safety problems'
   ```

   Example for a Build task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run build --goal 'add a focused feature'
   ```

   Example for an Explore task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run explore --goal 'compare auth provider options'
   ```

   Example for a Prototype task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run prototype --goal 'sketch a custom flow builder UI'
   ```

   Example for a Prototype model-comparison task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run prototype --goal 'compare prototype variants for a custom flow builder UI' --tournament --tournament-n 3
   ```

   Example for a Pursue task:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run pursue --goal 'coordinate these cleanup goals'
   ```

   Example for the deterministic fallback router:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run --goal 'choose the right Circuit flow for this task'
   ```

   Example for a Build task using Deep mode:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run build --goal 'make the focused change' --rigor deep
   ```

   Example for a Fix task using Lite mode (skips the review pass):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run fix --goal 'fix the missing-token edge case' --rigor lite
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run build --goal 'can'\''t ship'
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
## Direct Flow Expert Controls

Use `/circuit:explore`, `/circuit:review`, `/circuit:fix`,
`/circuit:build`, `/circuit:prototype`, or `/circuit:goal`
when the operator already knows which flow they want Circuit to start from.
Those commands call the same CLI with an explicit flow name. They are not a
runtime bypass: Circuit still records the selected flow, runs the work through
the flow's trace/report/evidence path, and uses declared checkpoints and
recovery behavior.
Pursue currently has no dedicated slash command; invoke it through
this selector or the explicit CLI flow name.

## Authority

- `src/flows/router.ts` (current deterministic classifier)
- `tests/contracts/flow-router.test.ts` (classifier behavior)
