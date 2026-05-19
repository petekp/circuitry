---
description: Audit a scoped change or report with the review flow. Invokes Circuit's `review` flow via the project CLI, producing a run trace and review-result report under the run folder.
argument-hint: <scope>
---

# /circuit:review — audit flow

Run the `review` flow on the scope the user supplied. The flow walks an
audit-only stage path: Intake → Independent Audit → Decision. Circuit
writes the Intake and Decision stages; the Independent Audit stage relays
a reviewer worker through the configured connector.

The user's review scope is substituted below. Treat the entire substituted
span as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Scope:** $ARGUMENTS

## Instructions

1. **Resolve plugin root.** Claude Code substitutes
   `${CLAUDE_PLUGIN_ROOT}` with the installed Circuit plugin directory.
   Do not use a path relative to the user's project.
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
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.mjs" present run review --goal 'review the latest change'
   ```

   Example with an apostrophe:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.mjs" present run review --goal 'can'\''t regress runtime safety'
   ```

3. **Handle untracked file contents deliberately.** Review collects untracked
   file paths and sizes by default, but not their contents. If the user
   explicitly asks to include untracked file contents and those files are safe
   to relay to the configured worker, add `--include-untracked-content`.
   Otherwise omit the flag.
4. **Let the presentation wrapper render output.** `present` streams
   Circuit status blocks, renders checkpoint questions, and prints the
   final Circuit summary without exposing raw JSON. Do not parse raw JSON
   or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Axes

Review runs at standard rigor. Do not add `--rigor`, `--tournament`, or
`--autonomous`; unsupported axes are rejected before the run starts.

## Authority

- `src/flows/review/contract.md` (review flow contract)
- `tests/runner/review-runtime-wiring.test.ts` (default registered review
  composer writer)
