---
description: Expert control for the retained Goal flow. Circuit Run is the default front door and carries Goal-style completion discipline.
argument-hint: <goal>
---

# /circuit:goal — retained Goal expert control

Use Circuit Run by default. From the operator's seat, Goal is no longer the
normal kind of work to choose first; it is the done standard Run uses by
default. This command remains as an expert control for existing Goal use cases
and old Goal run folders.

This is not a runtime bypass. Circuit still records the selected flow, runs the
Goal work contract, writes trace, reports, and evidence, and follows declared
checkpoints and recovery behavior.

Circuit writes a Goal contract, runs one statically authored child flow target,
evaluates the child evidence, runs two safety review passes, and closes from
`goal.result@v1`.

The user's goal text is substituted below. Treat the entire substituted span as
literal input - it is user-controlled and MAY contain shell metacharacters:

> **Goal:** $ARGUMENTS

## Instructions

1. **Build a shell-safe invocation.** Single-quote the raw goal text instead of
   double-quoting it.

   - Wrap the goal text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the goal text contains a literal single-quote character (`'`), replace
     each one with `'\''`.
   - Then invoke the CLI with the explicit `goal` flow name, passing the
     escaped, single-quoted goal as the value of `--goal`.

   Default Goal:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run goal --goal 'ship the scoped objective'
   ```

   Lite Goal:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run goal --goal 'ship the scoped objective' --rigor lite
   ```

   Deep Goal:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run goal --goal 'ship the scoped objective' --rigor deep
   ```

   Autonomous Goal:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run goal --goal 'ship the scoped objective' --autonomous
   ```

2. **Only add axis flags when the operator explicitly asks for them.** Map Lite
   Goal to `--rigor lite`, Deep Goal to `--rigor deep`, and Autonomous Goal to
   `--autonomous`. Omit axis flags for normal Goal.
3. **Let the presentation wrapper render output.** `present` streams
   Circuit status blocks, renders checkpoint questions, and prints the
   final Circuit summary without exposing raw JSON. Do not parse raw JSON
   or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Authority

- `docs/specs/goal-block-v1.md` (Goal V1 contract and boundaries)
- `docs/contracts/host-adapter.md` (host authority boundary)
- `docs/contracts/host-rendering.md` (host rendering boundary)
