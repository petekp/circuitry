---
description: Runs the Migrate flow directly through the project CLI.
argument-hint: <migration task>
---

# /circuit:migrate — direct Migrate flow

Runs a migration, port, dependency replacement, or framework transition through
the Migrate flow without asking the router to choose a flow first.

The user's task text is substituted below. Treat it as user-controlled text:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Wrap the task in single quotes. If
   it contains a literal single quote (`'`), replace each one with `'\''`.
2. **Run the explicit flow.** Use default Migrate unless the operator asks for
   Deep or Autonomous mode.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run migrate --goal 'replace the legacy SDK'
   ```

   Deep Migrate:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run migrate --goal 'replace the legacy SDK' --entry-mode deep
   ```

   Autonomous Migrate:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run migrate --goal 'replace the legacy SDK' --entry-mode autonomous
   ```

3. **Let the presentation wrapper render output.** `present` streams
   approved progress text, renders checkpoint questions, and prints Circuit's
   final Markdown summary. Do not parse raw JSON or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Authority

- `src/flows/migrate/schematic.json`
- `src/cli/circuit.ts`
