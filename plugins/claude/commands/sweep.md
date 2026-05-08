---
description: Runs the Sweep flow directly through the project CLI.
argument-hint: <cleanup task>
---

# /circuit:sweep — direct Sweep flow

Runs cleanup, quality, coverage, and docs-sync work through the Sweep flow
without asking the router to choose a flow first.

The user's task text is substituted below. Treat it as user-controlled text:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Wrap the task in single quotes. If
   it contains a literal single quote (`'`), replace each one with `'\''`.
2. **Run the explicit flow.** Use default Sweep unless the operator asks for
   Lite, Deep, or Autonomous mode.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run sweep --goal 'remove safe dead code'
   ```

   Lite Sweep:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run sweep --goal 'remove safe dead code' --entry-mode lite
   ```

   Deep Sweep:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run sweep --goal 'remove safe dead code' --entry-mode deep
   ```

   Autonomous Sweep:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run sweep --goal 'overnight repo cleanup' --entry-mode autonomous
   ```

3. **Let the presentation wrapper render output.** `present` streams
   approved progress text, renders checkpoint questions, and prints Circuit's
   final Markdown summary. Do not parse raw JSON or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Authority

- `src/flows/sweep/schematic.json`
- `src/cli/circuit.ts`
