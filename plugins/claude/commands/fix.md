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
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run fix --goal 'fix the foo bug'
   ```

   Lite Fix (skips review, closes after verification):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run fix --goal 'fix the missing-token edge case' --rigor lite
   ```

   Deep Fix:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run fix --goal 'fix the failing pipeline' --rigor deep
   ```

   Autonomous Fix:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run fix --goal 'diagnose and patch the crash' --autonomous
   ```

   Example for a task `can't reproduce` (contains one apostrophe):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run fix --goal 'can'\''t reproduce'
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Claude Code plugin directory, injects the
   plugin's packaged flow root, and launches Circuit's bundled runtime.
2. **Only add axis flags when the operator explicitly asks for them.** Map
   Lite Fix to `--rigor lite`, Deep Fix to `--rigor deep`, and Autonomous Fix
   to `--autonomous`. Omit axis flags for default Fix.
3. **Per-mode flow files.** When `--rigor lite` is supplied, the CLI
   prefers `generated/flows/fix/lite.json` over `circuit.json` because
   the Fix schematic emits a Lite-only compiled flow that skips the review
   relay. Other modes (default/deep/autonomous) load `circuit.json`.
4. **Let the presentation wrapper render output.** `present` streams
   Circuit status blocks, renders checkpoint questions, and prints the
   final Circuit summary without exposing raw JSON. Do not parse raw JSON
   or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Authority

- `src/flows/fix/contract.md` (Fix report contract)
- `docs/contracts/compiled-flow.md` (compiled flow shape)
- `src/cli/circuit.ts` (current CLI flags + per-mode flow file resolution)
- `src/flows/router.ts` (router bypass behavior for explicit flow names)
