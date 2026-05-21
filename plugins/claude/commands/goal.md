---
description: Runs Circuit Goal for a bounded objective with typed evidence, recovery, and a completion gate.
argument-hint: <goal>
---

# /circuit:goal — direct Goal flow

Runs a long-running objective through the Goal flow without asking the router to
choose a flow first. Goal supervises a bounded objective until typed evidence
proves it, recovery is needed, or a blocked result is more honest than
continuing.

Circuit writes a Goal contract, dispatches to one statically authored child
flow target, evaluates the child evidence, runs two adversarial gate passes, and
closes from `goal.result@v1`.

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
