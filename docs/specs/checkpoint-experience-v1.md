# Checkpoint Experience V1 Implementation Plan

Status: implementation plan

## Product Target

Circuit checkpoints should feel like an excellent report asking for a manager's
judgment, not like an agent handing work back. The operator should see the
artifact, the recommendation, the proof, the risk, and the few choices that
actually change the outcome.

The working metaphor is "manager and star employees":

- the agent keeps moving autonomously when the next right action is obvious;
- the agent handles routine quality work without asking;
- a checkpoint asks only for judgment the agent cannot safely own;
- the checkpoint packet makes the recommendation first and the evidence easy to
  inspect;
- raw traces, logs, and low-value status stay behind the primary surface.

This plan starts with Build because Build already has the strongest checkpoint
substrate: a typed `build.brief@v1` report written before the run waits, a
resume-time validator, and existing checkpoint runtime coverage.

## Current Repo Facts

- Built-in flows are authored as typed facts in `src/flows/<id>/facts.ts` and
  bound in `src/flows/<id>/flow.ts`; the catalog compiles those definitions
  into runtime registries, generated schematic JSON, generated manifests, and
  host mirrors. See `docs/architecture/declarative-flow-architecture.md:13-20`.
- Flow-specific behavior belongs in flow packages and registries. Runtime code
  must stay flow-agnostic. See
  `docs/architecture/declarative-flow-architecture.md:112-127`.
- Generated surfaces must not be edited by hand; after authored flow or command
  changes, regenerate surfaces and run the drift check. See
  `docs/architecture/declarative-flow-architecture.md:83-110` and
  `docs/generated-surfaces.md:7-18`.
- Build's Frame step is already a checkpoint that writes `reports/build/brief.json`,
  `reports/checkpoints/frame-step-request.json`, and
  `reports/checkpoints/frame-step-response.json`. Its only current choice is
  `continue`. See `src/flows/build/facts.ts:181-221`.
- Build binds `build.brief@v1` to `BuildBrief` and registers
  `buildBriefCheckpointBuilder` in the flow package's checkpoint writer slot.
  See `src/flows/build/flow.ts:63-74`.
- The current `BuildBrief` schema contains objective, scope, success criteria,
  verification command candidates, and a checkpoint pointer. See
  `src/flows/build/reports.ts:18-35`.
- `buildBriefCheckpointBuilder` writes the brief before operator selection and
  validates the on-disk brief against the request hash on resume. See
  `src/flows/build/writers/checkpoint-brief.ts:40-95`.
- The checkpoint executor writes optional typed checkpoint reports, hashes them
  into the request, emits `checkpoint.requested`, returns
  `waiting_checkpoint` when the run should pause, and writes the response plus
  `checkpoint.resolved` on selection. See
  `src/runtime/executors/checkpoint.ts:90-220`.
- Resume validates the waiting checkpoint request and dispatches typed report
  validation through the checkpoint writer registry. See
  `src/runtime/run/checkpoint-resume.ts:188-227`.
- Checkpoint policy is strict: `prompt`, `choices`, safe choices, and optional
  `report_template`. If a checkpoint writes a report, the policy must provide a
  `report_template`. See `src/schemas/step.ts:68-86` and
  `src/schemas/step.ts:406-424`.
- The checkpoint writer registry is the intended extension point for
  checkpoint-with-report behavior. See
  `src/flows/registries/checkpoint-writers/types.ts:1-17`.
- Operator summaries already attempt HTML first, degrade to Markdown on HTML
  failure, clean stale HTML when no projector renders, and include checkpoint
  details when the outcome is `checkpoint_waiting`. See
  `src/shared/operator-summary-writer.ts:230-364`.
- The HTML projector registry currently registers only Explore. See
  `src/shared/html/index.ts:1-14`.
- The HTML projector context currently provides run folder, run id, flow id,
  final flow report, and helpers for reading reports. It does not include the
  run outcome or waiting checkpoint object. See
  `src/shared/html/projector.ts:9-21`.
- The Explore HTML projector intentionally renders only after a finalized
  decision, not during `checkpoint_waiting`. See
  `src/shared/html/explore-tournament.ts:147-179`.
- The CLI already includes `operator_summary_html_path` in the final JSON for a
  waiting checkpoint when the operator-summary writer returns one. See
  `src/cli/circuit.ts:877-885`.
- The Claude wrapper auto-opens HTML for `complete` outcomes, but the
  `checkpoint_waiting` branch currently renders the checkpoint/resume command
  without opening HTML. See `plugins/claude/scripts/circuit-next.mjs:387-424`.
- Auto-open safety is centralized in pure policy helpers that reject unsafe
  paths and skip non-interactive environments. See
  `plugins/claude/scripts/auto-open-policy.mjs:1-46`.
- Progress projection already emits `checkpoint.waiting` and
  `user_input.requested` events with a native question shape and resume command.
  See `src/runtime/projections/progress.ts:658-733`.
- Pursue V1 deliberately serializes code-changing work and only marks read-only
  discovery as parallel-safe in coordination reports; parallel writes wait on a
  runtime-owned safe apply path. See `docs/flows/pursue.md:22-28`,
  `docs/flows/pursue.md:43-67`, and `docs/flows/pursue.md:257-273`.
- Pursue already writes ownership and coordination reports:
  `pursuit.contract@v1` and `pursuit.graph@v1`. See
  `src/flows/pursue/facts.ts:168-239`.
- Circuit's project-memory positioning is grounded in typed per-run reports, but
  the repo still names cross-run query/recall and agent-side consumption as
  gaps. See `docs/positioning-and-strategy.md:158-168`.
- Fix has the clearest proof-carrying precedent for refusing false completion:
  false-done cases are caught by runtime-owned proof artifacts, regression
  proof, change-set proof, and regression rerun proof. See
  `evals/false-done-fix/README.md:5-31`,
  `src/flows/fix/reports.ts:315-333`, and
  `src/flows/fix/writers/regression-rerun.ts:1-24`.

## Confirmed Gaps

- Build's checkpoint brief is structurally valid but not yet a rich decision
  packet. It lacks explicit recommendation, salience, risk, proof capsule,
  artifact preview, and "what stays internal" fields.
- Waiting checkpoints can technically carry an HTML path through the CLI, but no
  Build checkpoint HTML projector exists.
- The generic HTML projector context cannot yet distinguish "waiting checkpoint"
  from "completed run" without re-reading summary state indirectly.
- The Claude wrapper does not auto-open checkpoint HTML even if the CLI emits
  `operator_summary_html_path`.
- Current checkpoint choices are executable routes; there is no safe generic
  "ask for more coverage" or "show more evidence" choice unless the flow encodes
  a real route for it.
- No current source inspected defines a fleet-level checkpoint queue; Pursue's
  ownership and graph reports are the closest current substrate.
- Cross-run project memory exists as strategy and typed-report substrate, not as
  a shipped checkpoint salience input.

## Design Principles

1. The checkpoint is a decision packet, not a status dashboard.
2. The first visible screen answers: "What do you recommend, why should I trust
   it, and what decision do you need from me?"
3. The agent does not ask the operator to do routine craft. If coverage,
   formatting, or obvious verification is required, the plan should do it before
   checkpointing.
4. Choices must map to executable flow routes. No decorative buttons.
5. Evidence is layered: top layer is artifact, recommendation, proof, risk, and
   next action; raw logs and trace files remain linked evidence.
6. Runtime stays generic. Flow-specific packet content lives in flow schemas,
   writers, and HTML projectors.
7. Stronger models reduce the number of checkpoints; they do not remove the need
   for auditable decision packets at true judgment points.

## Packet Contract

Recommendation: extend `build.brief@v1` with a nested presentation packet rather
than changing `CheckpointPolicy`.

The packet should include:

- `kind`: stable packet type, for example `build.checkpoint_packet@v1`;
- `salience`: why this deserves the operator's attention now;
- `decision`: the one judgment being requested;
- `recommendation`: the agent's recommended choice and rationale;
- `artifact`: the whole artifact or artifact preview the operator should judge;
- `proof`: verification plan or already-collected proof relevant to the choice;
- `risk`: the real remaining uncertainty, not routine implementation chores;
- `choices`: labels and descriptions aligned with executable checkpoint choice
  ids;
- `internal`: a short machine-facing section for trace/log/report pointers that
  should not dominate the human surface.

Assumption: Build V1 can keep the only executable choice as `continue` while
using the packet to make that choice meaningful. More choices should wait until
the flow owns routes that actually do different work.

## Implementation Slices

### Slice 1: Build Packet Data

Implement:

- extend `BuildBrief` in `src/flows/build/reports.ts` with a nested checkpoint
  presentation packet;
- update `buildBriefCheckpointBuilder` to populate the packet from the goal,
  Build checkpoint policy template, verification resolver output, and checkpoint
  routes;
- keep all flow-specific shaping in `src/flows/build/**`;
- keep runtime checkpoint mechanics unchanged.

Verify:

- update `tests/contracts/build-report-schemas.test.ts` for the packet shape;
- update `tests/runner/build-checkpoint-exec.test.ts` for first-write packet
  content and resume hash validation;
- run `npm run check` and the focused tests above.

### Slice 2: HTML Projector Plumbing For Waiting Checkpoints

Implement:

- extend `HtmlProjectorContext` with generic `runOutcome` and optional
  `checkpoint` data from the operator-summary input;
- pass those fields from `writeOperatorSummary`;
- keep projector dispatch through `HTML_PROJECTORS`;
- add tests that existing Explore behavior remains gated to completed decisions.

Verify:

- update `tests/unit/shared/html/explore-tournament.test.ts` if the context type
  changes;
- update `tests/runner/operator-summary-writer.test.ts` to prove the new context
  is provided and stale HTML cleanup still works;
- run the focused HTML and operator-summary tests.

### Slice 3: Build Checkpoint HTML

Implement:

- add a Build checkpoint projector under `src/shared/html/`;
- register `build` in `HTML_PROJECTORS`;
- render only when `runOutcome === "checkpoint_waiting"` and the packet parses;
- make the first viewport artifact-first and recommendation-first;
- keep risk, proof, exact resume command, and evidence links visible but quiet;
- escape HTML and strip deceptive control characters using the existing HTML
  component/sanitization patterns.

Verify:

- add `tests/unit/shared/html/build-checkpoint.test.ts` covering gating, complete
  document rendering, recommendation/choice alignment, XSS escaping, bidi
  stripping, missing packet fallback, and no stale content;
- extend `tests/runner/operator-summary-writer.test.ts` to prove Build waiting
  checkpoints emit `operator-summary.html` and include it in JSON/Markdown
  report links;
- run the focused HTML and operator-summary suites.

### Slice 4: Host Presentation For Waiting Checkpoints

Implement:

- update `plugins/claude/scripts/circuit-next.mjs` so
  `checkpoint_waiting` outcomes also safe-open `operator_summary_html_path`
  when present;
- keep the inline checkpoint/resume command as the fallback and source of truth;
- reuse `isAutoOpenPathSafe` and `shouldSkipAutoOpen`.

Verify:

- extend wrapper or auto-open policy tests to cover checkpoint waiting with HTML
  path present, missing, unsafe, and skipped;
- run `tests/unit/auto-open-policy.test.ts` and any wrapper presentation tests.

### Slice 5: Proof-Backed Completion Linkage

Implement:

- make the checkpoint packet show proof honestly: planned proof before work,
  collected proof after resume, and missing proof as risk;
- borrow the language of proof-carrying close from Fix, but do not copy Fix-only
  regression semantics into Build;
- update operator-summary projection only if needed to keep final Build summaries
  consistent with the checkpoint packet.

Verify:

- add tests that Build final summaries do not claim proof that was not collected;
- keep release proof fixtures honest if regenerated;
- run relevant Build runtime, operator-summary, and release-infrastructure tests.

### Slice 6: Salience Policy

Implement:

- add a small authored salience policy for checkpoint packets:
  - surface judgment-changing facts;
  - hide routine status, raw trace internals, and implementation chores;
  - expose raw reports as evidence links;
  - classify responsibility checkpoints as invalid product behavior unless the
    flow has a real route that changes work.
- encode the policy in packet authoring and tests, not as a broad runtime rule.

Verify:

- add unit tests for packet authoring examples:
  - obvious coverage work stays internal or is completed before checkpointing;
  - true tradeoff risk reaches the top layer;
  - unsupported choices are not rendered.

### Slice 7: Multi-Agent Coordination Integration

Implement:

- use Pursue's `pursuit.contract@v1` and `pursuit.graph@v1` as future inputs to a
  fleet-level checkpoint queue;
- show ownership, dependencies, conflict edges, and read-only parallel groups in
  checkpoint packets when the source report exists;
- add this through shared projection code or Pursue-owned presentation, not by
  importing Pursue packages from Build;
- keep code-changing work serial until isolated worktrees, patch manifests,
  conflict rejection, and final composed verification exist.

Verify:

- add Pursue report projection tests before exposing any multi-agent queue;
- use fixture reports to prove conflicting pursuits are summarized as decisions,
  not as noisy telemetry;
- do not claim parallel write execution in docs, generated surfaces, or release
  claims.

### Slice 8: Project Memory As Frozen Context

Implement:

- treat project memory as a salience input that helps decide what belongs in a
  checkpoint packet;
- freeze any memory-derived facts into the checkpoint report at request time;
- validate resume against the frozen packet, not a live re-read of memory;
- keep memory writes explicit and auditable.

Verify:

- add tests proving resume is stable when memory changes after the checkpoint
  request;
- add tests proving memory-derived claims are labeled or cited in the packet;
- do not ship hidden memory mutation as part of checkpoint rendering.

## What Not To Build

- Do not add Build-specific branches to the checkpoint runtime.
- Do not add non-executable checkpoint choices.
- Do not hand-edit `src/flows/<id>/schematic.json`, `generated/flows/**`,
  plugin mirrors, `docs/generated-surfaces.md`, or
  `docs/flows/block-catalog.json`.
- Do not turn the checkpoint surface into a live dashboard.
- Do not make project memory a silent authority during resume.
- Do not imply Pursue runs parallel code-writing agents until the safe apply
  path exists.

## Verification Ladder

For planning-only doc changes:

```bash
npm run lint
```

For the full implementation:

```bash
npm run check
npm run lint
npm run test -- tests/contracts/build-report-schemas.test.ts
npm run test -- tests/runner/build-checkpoint-exec.test.ts
npm run test -- tests/runtime/checkpoint-resume.test.ts
npm run test -- tests/runner/operator-summary-writer.test.ts
npm run test -- tests/unit/shared/html/explore-tournament.test.ts
npm run test -- tests/unit/shared/html/build-checkpoint.test.ts
npm run test -- tests/unit/auto-open-policy.test.ts
npm run build
node scripts/emit-flows.ts --check
npm run verify
```

If authored flow or command files change, run `npm run emit-flows` before the
drift check and review the generated diff. Generated outputs should be committed
only when produced by that pipeline.

## Prototype Acceptance

The first shippable prototype is done when:

- a deep Build run pauses with `outcome: "checkpoint_waiting"`;
- the run writes a typed `build.brief@v1` packet with recommendation, artifact,
  proof, risk, salience, and executable choices;
- `reports/operator-summary.html` renders the packet;
- the CLI returns `operator_summary_html_path`;
- the Claude wrapper safe-opens the HTML and still prints the resume command;
- resume validates the original packet hash and completes the same run;
- focused tests prove stale HTML cleanup, escaping, resume validation, and no
  generated-surface drift.

That proves the valuable center before expanding into fleet coordination or
project memory.
