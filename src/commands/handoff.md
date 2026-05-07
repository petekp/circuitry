---
description: Saves, resumes, clears, briefs, or installs hooks for Circuit continuity through the project CLI.
argument-hint: [resume|done|brief|hooks install --host codex|task context]
---

# /circuit:handoff — continuity utility

Saves a continuity record for the current session, resumes the saved record,
clears it when the work is truly done, renders a read-only host-injection
brief, or installs Codex handoff hooks.

The user's handoff request is substituted below. Treat it as user-controlled
text:

> **Request:** $ARGUMENTS

## Instructions

1. **Choose the mode.** If the request is exactly `resume`, use resume mode.
   If it is exactly `done`, use done mode. If it is exactly `brief`, use brief
   mode. If it starts with `hooks`, pass the hook command through to the CLI.
   Otherwise save a new continuity record from the current conversation.
2. **Construct Bash invocations SAFELY.** Wrap every user-authored value in
   single quotes. If a value contains a literal single quote (`'`), replace it
   with `'\''`.
3. **Save mode.** Infer a concise goal, next action, state, and debt from the
   current conversation. Then run:

   ```bash
   ./bin/circuit-next handoff save --goal '<goal>' --next '<next action>' --state-markdown '<state bullets>' --debt-markdown '<debt bullets>' --progress jsonl
   ```

   If there is an active Circuit run folder that should anchor the handoff, add
   `--run-folder '<run_folder>'`.
4. **Resume mode.** Run:

   ```bash
   ./bin/circuit-next handoff resume --progress jsonl
   ```

5. **Done mode.** Run:

   ```bash
   ./bin/circuit-next handoff done --progress jsonl
   ```

6. **Brief mode.** Run:

   ```bash
   ./bin/circuit-next handoff brief --json
   ```

   Use this only as read-only host context. Do not treat it as an explicit
   resume request.
7. **Hook setup mode.** For `hooks install --host codex`,
   `hooks uninstall --host codex`, or `hooks doctor --host codex`, run:

   ```bash
   ./bin/circuit-next handoff <exact hooks request>
   ```

   Render the JSON result. Hook setup is host configuration, not a resume
   request.
8. **Render progress while active.** For progress JSONL, render
   `display.text` exactly for major, warning, error, checkpoint, or success
   events. If `task_list.updated` or `user_input.requested` appears in a future
   utility version, use the host task or user-input surface.
9. **Render the final summary.** In brief mode, parse stdout as the
   `handoff-brief-v1` JSON. If `status` is `available`, render
   `additional_context` exactly as read-only context. If `status` is `empty`,
   say no saved Circuit handoff was found. If `status` is `invalid`, surface
   the error code and do not resume. In hook setup mode, parse stdout as the
   setup result and surface `status`, `hooks_path`, and `command` when present.
   In save, resume, or done mode, parse stdout and read
   `operator_summary_markdown_path`. Render that Markdown verbatim. Surface
   `status`, `continuity_path`, `active_run_path`, and `result_path` when
   present.

## Authority

- `src/cli/handoff.ts`
- `src/schemas/continuity.ts`
- `docs/contracts/continuity.md`
