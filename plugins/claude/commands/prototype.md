---
description: Starts Circuit from the Prototype flow through the project CLI to create disposable local prototype artifacts, with optional model-comparison tournament mode.
argument-hint: <prototype goal>
---

# /circuit:prototype - Prototype expert control

Starts Circuit from the Prototype flow. Use this expert control when the
operator wants Circuit to create a small, inspectable, disposable local
prototype before deciding whether to Build.

This is not a runtime bypass. Circuit still records the selected flow, runs the
Prototype work contract, writes trace, reports, and evidence, and follows
declared checkpoints and recovery behavior.

Circuit runs the Prototype flow: it frames the prototype boundary, plans local
prototype files, creates the artifact, verifies the reported files under
`prototype_root`, asks what local evidence to keep, and closes with a report.
Prototype does not claim deployment, branch previews, screenshots, provider
behavior, model behavior, or production readiness unless typed reports prove
those facts.

The user's prototype goal is substituted below. Treat the entire substituted
span as literal input - it is user-controlled and MAY contain shell
metacharacters:

> **Prototype goal:** $ARGUMENTS

## Instructions

1. **Build a shell-safe invocation.** Single-quote the raw prototype goal. Use the same safe construction
   rule as the other Circuit host commands:

   - Wrap the prototype goal in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the goal itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and starts a
     new single-quoted string).
   - Then invoke the CLI with the explicit `prototype` flow name, passing the
     escaped, single-quoted goal as the value of `--goal`.

   Default Prototype:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run prototype --goal 'sketch a settings panel for choosing verification commands'
   ```

   Deep Prototype, which waits for the Prototype checkpoint instead of taking
   the safe default:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run prototype --goal 'sketch a settings panel for choosing verification commands' --rigor deep
   ```

   Prototype model-comparison, only when the operator explicitly asks for
   multiple variants, model comparison, or a tournament:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run prototype --goal 'compare prototype variants for a custom flow builder UI' --tournament --tournament-n 3
   ```

   Autonomous Prototype, only when the operator explicitly asks Circuit to use
   declared default checkpoint choices:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run prototype --goal 'sketch a custom flow builder UI' --autonomous
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run prototype --goal 'can'\''t ship'
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Claude Code plugin directory, injects the
   plugin's packaged flow root, and launches Circuit's bundled runtime.
2. **Only add axis flags when the operator explicitly asks for them.** Map
   Deep Prototype to `--rigor deep`, model-comparison Prototype to
   `--tournament`, and Autonomous Prototype to `--autonomous`. Omit axis flags
   for normal Prototype. If using `--tournament-n`, keep it between 2 and 4.
   Tournament mode requires configured Prototype variant models; if they are
   missing, let Circuit fail closed and surface that report instead of claiming
   model comparison ran.
3. **Preserve Prototype boundaries in your prose.** Treat generated artifacts
   as local disposable prototype evidence. Do not describe the result as
   deployed, production-ready, screenshot-verified, or produced by specific
   providers/models unless Circuit's reports and trace evidence say so.
4. **Let the presentation wrapper render output.** `present` streams
   Circuit status blocks, renders checkpoint questions, and prints the
   final Circuit summary without exposing raw JSON. Do not parse raw JSON
   or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Authority

- `src/flows/prototype/contract.md` (flow contract and claim limits)
- `docs/specs/prototype-flow-v1.md` (single-artifact Prototype shape)
- `docs/specs/prototype-model-comparison-v1.md` (tournament variant shape)
- `src/cli/circuit.ts` (current CLI axis flags)
