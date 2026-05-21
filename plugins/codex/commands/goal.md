---
description: Runs Circuit Goal for a bounded objective with typed evidence, recovery, and a safety review.
argument-hint: <goal>
---

# /circuit:goal — direct Goal flow

Runs a long-running objective through the Goal flow without asking the router to
choose a flow first. Goal supervises a bounded objective until typed evidence
proves it, recovery is needed, or a blocked result is more honest than
continuing.

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
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --progress jsonl
   ```

   Lite Goal:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --rigor lite --progress jsonl
   ```

   Deep Goal:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --rigor deep --progress jsonl
   ```

   Autonomous Goal:

   ```bash
   node '<plugin root>/scripts/circuit.ts' run goal --goal 'ship the scoped objective' --autonomous --progress jsonl
   ```

2. **Only add axis flags when the operator explicitly asks for them.** Map Lite
   Goal to `--rigor lite`, Deep Goal to `--rigor deep`, and Autonomous Goal to
   `--autonomous`. Omit axis flags for normal Goal.
3. **Render progress while the run is active.** Prefer `presentation` when
   present: render visible status text and suppress lines marked suppress. If
   `presentation` is absent, render `display.text` for major, warning, error,
   or checkpoint events. Update task surfaces when `task_list.updated` arrives,
   and ask through a native question surface when `user_input.requested`
   arrives. Do not treat progress text as the final outcome.
4. **Parse the CLI's final JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, `trace_entries_observed`, `operator_summary_path`,
   `operator_summary_markdown_path`, and `operator_summary_html_path` when
   present.
5. **If `outcome === "checkpoint_waiting"`, render the checkpoint.** Include
   the summary and exact resume command:

   ```bash
   node '<plugin root>/scripts/circuit.ts' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
   ```

6. **If `outcome === "complete"`, render Circuit's final summary.** Read
   `operator_summary_markdown_path` and render that Markdown verbatim. Do not
   invent a separate host summary.
7. **If `outcome === "aborted"`, read `reports/result.json` at `result_path`
   and surface the abort reason.**

## Authority

- `docs/specs/goal-block-v1.md` (Goal V1 contract and boundaries)
- `docs/contracts/host-adapter.md` (host authority boundary)
- `docs/contracts/host-rendering.md` (host rendering boundary)
