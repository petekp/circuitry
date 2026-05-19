# Circuit Status Block Storyboard

Removal-candidate note: the live rendering contract is
`docs/contracts/host-rendering.md`. Keep this only while the transcript examples
remain useful design context.

This is the storyboard behind Circuit's status-block rendering contract. The
live contract is in `docs/contracts/host-rendering.md`; this file shows how the
event stream should feel in transcripts and future live host surfaces.

The goal is to replace repeated `Circuit: ...` lines with one visible Circuit
header and a compact sequence of status lines:

```text
Circuit
⎿ Chose review.
⎿ Framing the work...
⎿ Asking the reviewer to check the result...
⎿ Waiting for your choice...
⎿ Finished Explore.
```

## What This Needs To Prove

The status block has to work across all user-facing Circuit output, not only the
happy path.

It should answer:

- Does a normal flow produce one coherent block?
- Do warning and error lines stay attached to the block?
- Does a checkpoint question stay attached to the status line that introduced
  it?
- Do utility commands such as `create` and `handoff` become tiny blocks, not
  odd fragments?
- Do child runs, fanout, and sequential commands need nesting or separate
  blocks?
- Does the final summary continue the block or start a second block?

The current proof runs already cover these cases:

| Proof run | Shape covered |
|---|---|
| `docs/release/proofs/runs/review/progress.jsonl` | normal one-run flow |
| `docs/release/proofs/runs/explicit-build/progress.jsonl` | warning start and checkpoint wait |
| `docs/release/proofs/runs/checkpoint/progress.jsonl` | checkpoint resume through completion |
| `docs/release/proofs/runs/abort/progress.jsonl` | retry exhaustion and abort |
| `docs/release/proofs/runs/customization/progress.jsonl` | short `create` utility command |
| `docs/release/proofs/runs/handoff/progress.jsonl` | sequential run ids in one proof capture |
| `docs/release/proofs/runs/explore-decision/progress.jsonl` | tournament fanout and checkpoint |

The proof runs show three pressure points:

- Multiple sequential blocks are real: the handoff proof contains a Build run,
  a handoff save run, and a handoff resume run in one capture.
- Fanout can be noisy: the Explore tournament proof emits repeated relay start
  and completion events for option branches.

## Proposed Rendering Model

Circuit emits progress events. The host renderer owns a small amount of
presentation state.

```text
Event stream             Renderer state             Transcript
route.selected           opens status block          Circuit
route.selected           appends status line         ⎿ Chose review.
step.started             appends status line         ⎿ Framing the work...
relay.started            appends status line         ⎿ Asking the reviewer...
user_input.requested     appends status line         ⎿ Waiting for your choice...
```

Rules:

- Print `Circuit` once for a top-level command invocation.
- Render status lines as `⎿ <short status>`.
- Do not repeat `Circuit` for every event.
- Treat the current Claude presentation wrapper as append-only. It can print a
  new line, but it cannot mutate a line that was already written to stdout.
- Do not show raw JSON, run ids, report paths, or trace internals by default.
- Keep `display.text` machine-parseable and short enough for the existing
  240-character limit.
- Use tone and event type for filtering; do not encode warning or error meaning
  only in prose.
- Treat `task_list.updated` as a native plan/task surface event, not a status
  line by default.
- Treat `user_input.requested` as the checkpoint question source. The status
  block should introduce the wait; the native input surface should carry the
  options when available.

## Event Line Policy

This is the proposed default visible budget. It is intentionally smaller than
"prefix every current major event with `⎿`".

| Event type | Default transcript behavior |
|---|---|
| `route.selected` | Show `⎿ Chose <flow>.` for top-level routes. |
| `run.started` | Suppress for normal starts. Show only when it carries a warning, resume, or child-run boundary. |
| `step.started` | Show the operator-facing action: `⎿ Framing the work...`, `⎿ Checking the context...`. |
| `relay.started` | Show when the user benefits from knowing another worker is active. Hide connector details by default. |
| `relay.completed` | Suppress by default unless it communicates a user-relevant result. |
| `checkpoint.waiting` | Show `⎿ Waiting for your choice...`. |
| `user_input.requested` | Suppress as a status line and use the native question UI or in-thread fallback for the choices. |
| `step.aborted` | Show a short failure line. |
| `run.aborted` | Show the final abort line. |
| `run.completed` | Show a concise completion line only when no final summary will immediately continue the block. |

## Storyboards

These storyboards show the desired user transcript, not the raw event stream.

### Normal Review

Source: `docs/release/proofs/runs/review/progress.jsonl`

```text
Circuit
⎿ Chose review.
⎿ Framing the work...
⎿ Asking the reviewer to check the result...
⎿ Wrapping up...
⎿ Review complete. Verdict: CLEAN. Findings: 0.
```

Why this shape works:

- One top-level command means one block.
- Normal `run.started` is not useful after `Chose review.`
- `relay.completed` is not shown because the final review result is what the
  operator cares about.

### Build Waiting At A Checkpoint

Source: `docs/release/proofs/runs/explicit-build/progress.jsonl`

```text
Circuit
⎿ Chose build with deep thoroughness.
⎿ This flow may invoke a write-capable Claude Code worker.
⎿ Framing the work...
⎿ Waiting for your choice...
```

Native question surface:

```text
Confirm the Build brief before implementation starts.

Continue - Resume with 'continue'.
```

Why this shape works:

- The warning is attached to the same block.
- The checkpoint status line does not need to contain every choice.
- The choices belong in the native question surface or an in-thread fallback,
  not in repeated status lines.

### Build Checkpoint Through Completion

Source: `docs/release/proofs/runs/checkpoint/progress.jsonl`

```text
Circuit
⎿ Chose build with deep thoroughness.
⎿ This flow may invoke a write-capable Claude Code worker.
⎿ Framing the work...
⎿ Waiting for your choice...
⎿ Planning the work...
⎿ Making the change...
⎿ Asking the implementer to make the change...
⎿ Checking the work...
⎿ Asking the reviewer to check the result...
⎿ Wrapping up...
⎿ Build complete. Verification passed. Review accepted.
```

Why this shape works:

- The status block survives the checkpoint and resume.
- There is no second `Circuit` header after the resume.
- The resume command is a fallback detail, not a normal status line.

### Abort

Source: `docs/release/proofs/runs/abort/progress.jsonl`

```text
Circuit
⎿ Chose build.
⎿ This flow may invoke a write-capable Claude Code worker.
⎿ Framing the work...
⎿ Planning the work...
⎿ Making the change...
⎿ Retrying the change...
⎿ Marked the change as failed.
⎿ Run aborted: implementation retry limit reached.
```

Why this shape works:

- The error stays inside the block.
- The exact machine reason remains in JSON and reports.
- The user-facing line can be shorter than the raw reason.

### Create Utility Command

Source: `docs/release/proofs/runs/customization/progress.jsonl`

```text
Circuit
⎿ Chose create.
⎿ Published release-note-flow.
```

Why this shape works:

- Utility commands should be small blocks.
- There is no need for step-level nesting when there are no steps.

### Sequential Handoff Commands

Source: `docs/release/proofs/runs/handoff/progress.jsonl`

```text
Circuit
⎿ Chose build with deep thoroughness.
⎿ This flow may invoke a write-capable Claude Code worker.
⎿ Framing the work...
⎿ Waiting for your choice...

Circuit
⎿ Chose handoff save.
⎿ Saved the handoff.

Circuit
⎿ Chose handoff resume.
⎿ Resumed the handoff.
```

Why this shape works:

- These are separate top-level command invocations in one proof capture.
- Separate invocations should use separate `Circuit` blocks.
- A blank line between blocks prevents orphaned `⎿` lines.

### Explore Tournament

Source: `docs/release/proofs/runs/explore-decision/progress.jsonl`

```text
Circuit
⎿ Chose explore with tournament thoroughness.
⎿ Framing the decision...
⎿ Checking the context...
⎿ Drafting options...
⎿ Comparing 4 options...
⎿ Stress-testing the proposals...
⎿ Waiting for your choice...
⎿ Composing the final choice...
⎿ Decision made. Selected: Vue.
```

Why this shape works:

- Fanout should not print one visible line per branch by default.
- The status block should show the operator-level movement: draft, compare,
  stress-test, decide.
- Branch details belong in debug views, reports, or an expanded task surface.

## Block Boundary Rules

Use one `Circuit` block when:

- A single top-level command is running.
- A checkpoint pauses and later resumes the same run.
- A child run executes inside the parent run and can be nested.

Start a new `Circuit` block when:

- A separate top-level command invocation begins.
- A utility command runs after a flow command.
- A renderer cannot prove that a new run id belongs to the active parent run.

Do not emit a bare `⎿` line unless the renderer has already opened a `Circuit`
block. This is the main guard against status lines getting divorced from their
header.

## Nested Line Rules

V1 defaults to no nested transcript rendering. `presentation.depth` is metadata
for future native surfaces, not an instruction to indent current stdout or chat
transcripts.

Use nested `⎿` lines only when the nesting improves orientation.

Good nesting candidates:

- child flow runs, when a future flow delegates to Build;
- explicit fanout summaries if the UI expands branches;
- future native task surfaces where each step has expandable child activity.

Bad nesting candidates:

- every normal step;
- relay start and completion pairs;
- checkpoint choices;
- report links and evidence paths.

If nested rendering is implemented, the event stream should expose enough
structure for the renderer to avoid guessing. Useful fields would include
`parent_run_id`, `depth`, or a specific child-run boundary event. Without that,
prefer flat lines with flow labels over inferred indentation.

## Status Slot Renderer

`tests/unit/shared/status-block-renderer.test.ts` covers the shared status-slot
renderer with two modes:

- append transcript: every event is rendered as a new line;
- live snapshot: events that share a slot replace the previous line for that
  slot before the surface is rendered.

This proves a state model, not terminal line rewriting. A native UI, plan
surface, or future run card can update a slot in place. A plain stdout or chat
transcript should either append lines or render a collapsed snapshot later.

That makes this possible for live surfaces:

```text
Circuit
⎿ Running review...
```

Later becomes:

```text
Circuit
⎿ Review completed.
```

The same event history can still render as an append-only transcript:

```text
Circuit
⎿ Running review...
⎿ Review completed.
```

The renderer uses a useful rule: replacement should be explicit and
slot-scoped. A `review-relay` update can replace the review line, but it should
not replace route lines, checkpoint lines, child-run lines, or unrelated
milestones.

Good replacement slots:

- `review-relay`: `Running review...` -> `Review completed.`
- `implementation-relay`: `Making the change...` -> `Change implemented.`
- `verification`: `Checking the work...` -> `Verification passed.`
- `checkpoint:<step>`: `Waiting for your choice...` -> `Choice received.`
- `child-run:<flow>`: `Build sub-run running...` -> `Build sub-run completed.`

Bad replacement slots:

- route selection;
- distinct step milestones;
- final result lines;
- separate top-level command blocks.

The tests also parse representative `ProgressEvent` values before applying
presentation metadata. That keeps the contract tied to the real event stream,
but the renderer intentionally does not guess slots from raw event type or
prose.

## Presentation Metadata

Status replacement is explicit in the progress contract. `display.text` remains
available for older hosts, while new hosts should prefer `presentation`.

Events can carry a separate presentation object:

```ts
presentation: {
  block_id: run_id,
  line_mode: 'append' | 'replace_slot' | 'suppress',
  slot_id?: 'audit-step:relay',
  status_text: 'Review completed.',
}
```

That object should be derived by Circuit, not by each host. Hosts should not
guess `slot_id` from `display.text`, `label`, or event ordering.

Compatibility rule:

- Old hosts can keep using `display.text` as an append-only status stream.
- New live hosts can use `presentation` for block and slot behavior.
- Contract tests must reject `replace_slot` events without a `slot_id`.
- Generated host instructions must say whether a host should use append-only
  rendering or live-slot rendering.

## Final Summary Boundary

The final summary is the highest-risk boundary because the current host
contract says to render `operator_summary_markdown_path` verbatim.

If the summary Markdown also starts with `Circuit`, a live presentation wrapper
that already printed progress will create two adjacent blocks:

```text
Circuit
⎿ Chose review.
⎿ Framing the work...

Circuit
⎿ Review complete. Verdict: CLEAN. Findings: 0.
```

That is acceptable only for renderers that cannot preserve state. The target
shape should be one continuous block:

```text
Circuit
⎿ Chose review.
⎿ Framing the work...
⎿ Asking the reviewer to check the result...
⎿ Review complete. Verdict: CLEAN. Findings: 0.
```

The implementation uses the second shape below: standalone Markdown remains
valid, and structured summary status text lets wrappers continue an already
open block.

1. Keep the summary Markdown as a standalone block, but allow presentation
   wrappers to render it in continuation mode when they already opened a block.
2. Store structured final summary lines separately from the standalone Markdown,
   so hosts can choose full-block or continuation rendering without string
   surgery.
3. Keep progress as temporary status only and make the final summary the only
   durable block. This is simplest for final answers, but weaker for terminal
   transcripts because earlier status lines already streamed.

Do not implement summary continuation by string surgery in the Claude wrapper.
That would silently weaken the current `operator_summary_markdown_path`
contract.

## Implemented Shape

The production slice has three layers:

1. Runtime text authorship: progress events should carry short status-line text,
   not full `Circuit: ...` sentences.
2. Host presentation state: renderers must open the `Circuit` block once and
   prevent orphaned `⎿` lines.
3. Summary rendering: `operator_summary_markdown_path` remains a standalone
   fallback, while `operator_summary_status_text` lets stateful wrappers add a
   final continuation line.

Current transcript hosts append every visible line. Future native surfaces can
use `replace_slot` to update a rendered line in place. Raw JSONL stays
append-only and authoritative.
