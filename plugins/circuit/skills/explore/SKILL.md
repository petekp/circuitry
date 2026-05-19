---
name: explore
description: "Use when the user wants Circuit to investigate, explain, compare options, analyze architecture, or make a decision before editing code."
---

# Circuit Explore

## When to Use This Skill

Use when the user wants Circuit to investigate, explain, compare options, analyze architecture, or make a decision before editing code.

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

Run the `explore` flow on the goal the user supplied. The flow walks a full
stage path: Frame → Analyze → Compose → Review → Close. The Compose and
Review stages relay to specialist agents; Frame, Analyze, and Close are
Circuit-written stages.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Resolve plugin root.** Use the absolute path to the installed
   Circuit plugin directory, the directory that contains
   `.codex-plugin/plugin.json`. Do not use a path relative to the
   user's project.
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
   node '<plugin root>/scripts/circuit.mjs' run explore --goal 'can'\''t go' --progress jsonl
   ```

   For a goal with no special characters (e.g., `find deprecated APIs`),
   the straightforward single-quoted form is sufficient:

   ```bash
   node '<plugin root>/scripts/circuit.mjs' run explore --goal 'find deprecated APIs' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Circuit plugin directory and injects the plugin's
   packaged flow root before it launches Circuit's bundled runtime.
3. **Render progress while the run is active.** `--progress jsonl` writes
   progress events to stderr and keeps the final result JSON on stdout.
   Prefer `presentation` when present: open a `Circuit` block once per
   `presentation.block_id`, render visible status lines as
   `⎿ ${presentation.status_text}`, suppress `presentation.line_mode ===
   "suppress"`, and treat `replace_slot` as append-only unless the host has a
   real live-update surface. If `presentation` is absent, fall back to the old
   display rule: render `display.text` for major, warning, error, or checkpoint
   events and suppress detail. Do not show raw JSON, raw step IDs, or trace
   internals by default. When `task_list.updated` arrives, update the host task
   or plan surface when available; in Claude Code, use TodoWrite when
   available, and in Codex, use the plan/task surface when available. When
   `user_input.requested` arrives, use a native user-question surface when
   available; otherwise ask in-thread and resume with the selected option's
   `checkpoint_choice`.
4. **Parse the final JSON output.** On success the CLI prints a JSON object
   with these fields on stdout: `run_id`, `run_folder`, `outcome`
   (`complete` | `aborted`), `trace_entries_observed`, `result_path`,
   `operator_summary_path`, and `operator_summary_markdown_path`. For
   tournament-path runs, the envelope also includes
   `operator_summary_html_path` — a rich, browser-viewable summary of the
   option grid and selected verdict.
5. **Render Circuit's final summary.** Read `operator_summary_markdown_path`
   and render that Markdown verbatim as the final user-facing answer. Do not
   invent a separate summary. If the operator summary is missing, fall back to
   the Explore reports and include:
   - `outcome` (e.g., "Run completed" / "Run aborted")
   - `run_folder` — the absolute path of the run folder where evidence lives
   - `result_path` — the run summary `reports/result.json` (not the
     close-step report)
   - `${run_folder}/reports/explore-result.json` — the close-step report
     (the actual flow product). Surface the path so the user can inspect
     the typed report when needed.
   - `trace_entries_observed` count + a pointer to `trace.ndjson` under the run
     folder for the full trace.

   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
   to surface the abort `reason` — the runtime mirrors that reason
   byte-for-byte from the check-evaluation layer per
   `src/flows/explore/contract.md §Relay check-evaluation semantics` and
   the `RunResult.reason` schema field.

6. **Auto-open the rich summary when present.** If the parsed JSON includes
   `operator_summary_html_path`, invoke `open <path>` via Bash so the rich
   comparison view surfaces in the operator's browser alongside the in-chat
   markdown summary. Before invoking, validate the value defensively:
   - It must be an absolute path that begins with `/` (POSIX) or a drive
     letter on Windows. `open(1)` has no `--` end-of-options sentinel —
     a path that begins with `-` would be parsed as a flag and could
     launch arbitrary applications. If the value is not absolute, do not
     run `open`.
   - It must end with `.html`. If not, do not run `open`.
   - Pass the path as a single quoted argument: `open '<path>'`. Do not
     interpolate it into a longer command line.
   This is best-effort: if the command fails (non-macOS host, no default
   browser, sandboxed environment), or if the value fails validation, do
   not retry — the path is already present in the rendered markdown above
   as "Rich summary: ...", so the operator can open it manually.
7. **Do not modify the CLI output before surfacing.** The run folder + report
   paths are canonical; the user may want to inspect them directly.

## Axes

This command runs at standard rigor by default. Use `--rigor lite` for a quick
look, `--rigor deep` for deeper analysis, and `--tournament` for a bounded
decision tournament. Add `--autonomous` only when the operator explicitly asks
for autonomous checkpoint handling.

## Authority

- `src/flows/explore/contract.md` (flow contract + relay semantics)
- `src/runtime/` (current runner)
