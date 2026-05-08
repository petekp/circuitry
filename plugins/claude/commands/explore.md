---
description: Investigate, understand, choose among options, or shape an execution plan. Invokes the circuit-next `explore` flow end-to-end via the project CLI, producing a run trace + final report under the run folder.
argument-hint: <goal>
---

# /circuit:explore — investigation flow

Run the `explore` flow on the goal the user supplied. The flow walks a full
stage path: Frame → Analyze → Compose → Review → Close. The Compose and
Review stages relay to specialist agents; Frame, Analyze, and Close are
Circuit-written stages.

The user's goal text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Goal:** $ARGUMENTS

## Instructions

1. **Resolve plugin root.** Claude Code substitutes
   `${CLAUDE_PLUGIN_ROOT}` with the installed Circuit plugin directory.
   Do not use a path relative to the user's project.
2. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw goal (double quotes expand `$VAR`, `` `cmd` ``,
   `$(cmd)`, and `\` sequences — a malicious or accidental goal could inject
   commands). The safe construction rule:

   - Wrap the goal in **single quotes** in the final shell command. Single
     quotes disable all expansion.
   - If the goal itself contains a literal single-quote character (`'`),
     replace each one with `'\''` — that ends the current single-quoted
     string, emits one escaped apostrophe, and starts a new single-quoted
     string. This is the standard POSIX shell escape.
   - Then invoke the CLI with the escaped, single-quoted goal as the value
     of `--goal`.

   Worked example. If the goal is the literal 7-character string
   `can't go` (contains one apostrophe), the safely-escaped argv token is:

   ```text
   'can'\''t go'
   ```

   and the full Bash command becomes:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run explore --goal 'can'\''t go'
   ```

   For a goal with no special characters (e.g., `find deprecated APIs`),
   the straightforward single-quoted form is sufficient:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present run explore --goal 'find deprecated APIs'
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Claude Code plugin directory, injects the
   plugin's packaged flow root, and launches Circuit's bundled runtime.
3. **Let the presentation wrapper render output.** `present` streams
   approved progress text, renders checkpoint questions, and prints Circuit's
   final Markdown summary. Do not parse raw JSON or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Depth

This command runs at `standard` depth by default. The CLI accepts
`--depth <lite|standard|deep|tournament|autonomous>` — if the user's goal
text includes an explicit depth request (e.g., "deep dive", "quick look"),
map it to the flag; otherwise omit the flag and accept the default.

## Authority

- `src/flows/explore/contract.md` (flow contract + relay semantics)
- `src/runtime/` (current runner)
