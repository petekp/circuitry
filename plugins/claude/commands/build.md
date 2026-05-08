---
description: Runs the Build flow directly through the project CLI, with optional Lite, Deep, or Autonomous entry behavior.
argument-hint: <task>
---

# /circuit:build — direct Build flow

Runs a task through the Build flow without asking the router to choose a
flow first. Use this when the operator is asking Circuit to make a focused
change.

Circuit runs the Build flow: it confirms the brief, makes a plan, relays the
implementation to a worker, runs checks, asks for review when required, and
closes with a report and evidence.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text. Use the same safe construction rule as
   `/circuit:run`, `/circuit:explore`, and `/circuit:review`:

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
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'add a focused feature'
   ```

   Lite Build:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'make a small change' --entry-mode lite
   ```

   Deep Build with explicit standard depth in the same invocation:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'make the focused change' --entry-mode deep --depth standard
   ```

   Autonomous Build:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'ship the requested fix' --entry-mode autonomous
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run build --goal 'can'\''t ship'
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Claude Code plugin directory, injects the
   plugin's packaged flow root, and launches Circuit's bundled runtime.
2. **Only add `--entry-mode` when the operator explicitly asks for a Build
   mode.** Map Lite Build to `--entry-mode lite`, Deep Build to
   `--entry-mode deep`, and Autonomous Build to `--entry-mode autonomous`.
   Omit `--entry-mode` for normal Build.
3. **Keep `--depth` separate from `--entry-mode`.** If the operator asks for
   an explicit depth level, pass it with `--depth`. A single command may carry
   both flags, as shown above.
4. **Let the presentation wrapper render output.** `present` streams
   approved progress text, renders checkpoint questions, and prints Circuit's
   final Markdown summary. Do not parse raw JSON or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Authority

- `docs/contracts/compiled-flow.md` (compiled flow shape)
- `src/cli/circuit.ts` (current CLI flags)
- `src/flows/router.ts` (router bypass behavior for explicit flow names)
