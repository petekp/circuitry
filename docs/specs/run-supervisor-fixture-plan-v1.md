# Run-Supervisor Fixture Plan V1

Status: fixture-spec and test-plan target, not current behavior.

Date: 2026-05-28

## Purpose

This plan defines the smallest fixture suite that can prove the Run envelope
record contract shape before production implementation.

Implementation note: Slice 1 landed this contract as `RunEnvelopeRecord` with
schema `run.envelope@v0`. Older text in this planning file may still refer to
the supervisor sketch, but downstream implementation should use the Run
envelope names.

The fixtures should validate the Run envelope, not the runtime. Runtime
behavior is already owned by current compiled-flow runs, checkpoints, traces,
and `RunResult`. The fixture suite should answer one question:

> Can a Run envelope record express complete, follow-up, checkpoint, and
> blocked outcomes without becoming a second runtime or relying on ad hoc
> evidence scraping?

## Evidence Used

Current-source evidence:

- Contract sketch:
  [run-supervisor-contract-sketch-v1.md](run-supervisor-contract-sketch-v1.md)
- Architecture audit:
  [run-centered-architecture-audit-v1.md](run-centered-architecture-audit-v1.md)
- Goal false-complete and gate protections:
  [src/flows/goal/reports.ts](../../src/flows/goal/reports.ts),
  [tests/contracts/goal-report-schemas.test.ts](../../tests/contracts/goal-report-schemas.test.ts)
- Goal runtime examples:
  [tests/runner/goal-flow.test.ts](../../tests/runner/goal-flow.test.ts)
- Runtime result and checkpoint shape:
  [src/schemas/result.ts](../../src/schemas/result.ts),
  [src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts),
  [src/runtime/executors/checkpoint.ts](../../src/runtime/executors/checkpoint.ts)
- Reference and memory authority rules:
  [src/schemas/ref.ts](../../src/schemas/ref.ts),
  [src/schemas/memory-input.ts](../../src/schemas/memory-input.ts),
  [tests/contracts/memory-input-schema.test.ts](../../tests/contracts/memory-input-schema.test.ts)

Local probes:

```bash
git status --short
rg -n "false complete|completion-gate|clean_streak|missing-evidence|checkpoint_waiting|authority" src tests docs/specs -g '*.ts' -g '*.md'
rg -n "RunResult|GraphCheckpointWaitingResult|checkpoint.requested|checkpoint.resolved|MemoryInputV0|Ref" src/schemas src/runtime tests -g '*.ts'
```

## Fixture Scope

The first fixture suite should be pure data validation. It should not call the
runtime, create run folders, resume checkpoints, inspect generated host
packages, or choose real workers.

Allowed test inputs:

- a `RunEnvelopeRecord` JSON object;
- small child `RunResult`-shaped refs embedded as paths or reference objects;
- small `MemoryInputV0`-shaped memory inputs;
- optional decision packets that point at either a Run envelope decision or a
  child process checkpoint.

Out of scope:

- runtime execution;
- generated surface changes;
- CLI routing changes;
- real memory writes;
- `runs list/show` behavior;
- HTML checkpoint rendering.

## Fixture Data Rules

Use stable IDs and relative paths so fixtures stay readable:

| Field Family | Fixture Rule |
| --- | --- |
| Supervisor id | Use a stable `run_id` such as `00000000-0000-4000-8000-00000000f001`. |
| Process attempts | Use `attempt_id` values like `attempt-build-1` and `attempt-review-2`. |
| Child run folders | Use `.circuit/runs/<child-run-id>` style strings. They are references, not real folders. |
| Result paths | Use `reports/result.json` relative to the child run folder unless the attempt is checkpoint waiting. |
| Evidence refs | Use typed refs or ref-like paths from allowed sources: child `RunResult`, operator summary, declared process report, or future process evidence projection. |
| Memory refs | Use `MemoryInputV0`-compatible `kind`, `source`, `hints`, `staleness`, and `authority: "hint_only"`. |
| Gate passes | Use distinct attack lenses for the two required clean passes. |
| Decision packets | Use `resume_target.kind = "process-checkpoint"` only when the attempt outcome is `checkpoint_waiting`; otherwise use `resume_target.kind = "run-envelope"`. |

## Shared Fixture Defaults

The JSON snippets below are illustrative. Actual fixtures should be complete
`RunEnvelopeRecord` objects. Use these defaults unless the case overrides
them:

| Field | Default |
| --- | --- |
| `explicit_constraints` | `[]` |
| `explicit_process_request` | omitted |
| `memory_context` | `{ "used": false, "memory_input_ids": [], "authority": "hint_only" }` |
| `process_plan.selection_source` | `"router"` |
| `process_plan.rationale` | `"Matched implementation request."` |
| `process_plan.planned_attempts` | One attempt matching the case's first `process_attempts` entry. |
| `decision_packets` | `[]` unless the case needs operator input. |
| `memory_update_events` | `[]` unless the case checks memory update behavior. |
| `surface_output.artifact_links` | `["reports/run-envelope.json"]` |

## Positive Fixtures

### 1. One-Process Complete

Purpose: prove the happy path closes only with satisfied evidence and two clean
gate passes.

Abbreviated shape:

```json
{
  "schema": "run.envelope@v0",
  "run_id": "00000000-0000-4000-8000-00000000f001",
  "operator_intent": "Add the dashboard filter and prove it works.",
  "goal_contract": {
    "schema": "run.goal-contract@v0",
    "objective": "Add the dashboard filter and prove it works.",
    "done_when": [
      {
        "id": "filter-works",
        "claim": "The dashboard filter is implemented and verified.",
        "required_evidence": [
          { "kind": "command", "description": "npm run test:fast passed", "required": true }
        ]
      }
    ],
    "completion_gate": {
      "required_passes": 2,
      "blocking_severities": ["critical", "high", "medium"],
      "reset_on_blocking_finding": true
    }
  },
  "process_attempts": [
    {
      "schema": "run.process-attempt@v0",
      "attempt_id": "attempt-build-1",
      "process_id": "build",
      "outcome": "complete",
      "child_run": {
        "run_id": "00000000-0000-4000-8000-00000000c101",
        "run_folder": ".circuit/runs/00000000-0000-4000-8000-00000000c101",
        "result_path": "reports/result.json",
        "trace_entries_observed": 12,
        "manifest_hash": "runtime:build@0.1.0"
      },
      "evidence_refs": ["child-result:reports/result.json", "process-report:reports/build/verification.json"],
      "summary": "Build attempt completed with current verification evidence."
    }
  ],
  "completion_gate": {
    "schema": "run.completion-gate@v0",
    "verdict": "complete",
    "claim_results": [
      {
        "claim_id": "filter-works",
        "status": "proved",
        "evidence": ["process-report:reports/build/verification.json"]
      }
    ],
    "gate_passes": [
      {
        "pass_id": "gate-1",
        "attack_lens": "contract-and-proof",
        "evidence_checked": ["reports/result.json", "reports/build/verification.json"],
        "verdict": "gate-pass"
      },
      {
        "pass_id": "gate-2",
        "attack_lens": "false-done-and-recovery",
        "evidence_checked": ["reports/result.json", "reports/build/verification.json"],
        "verdict": "gate-pass"
      }
    ],
    "clean_streak": 2,
    "required_passes": 2,
    "next_action": "close"
  },
  "decision_packets": [],
  "memory_update_events": [
    {
      "schema": "run.memory-update-event@v0",
      "event_id": "memory-update-1",
      "scope": "flow",
      "flow_id": "build",
      "action": "recorded",
      "reason": "The run confirmed the current verification command for this project.",
      "source_refs": ["process-report:reports/build/verification.json"],
      "summary": "Use npm run test:fast as a fast verification hint for dashboard work.",
      "authority": "hint_only",
      "operator_indicator": "Updated Build memory: fast dashboard verification command."
    }
  ],
  "surface_output": {
    "schema": "run.surface-output@v0",
    "status_text": "Done: dashboard filter added and verified.",
    "selected_processes": [{ "process_id": "build", "reason": "Implementation request." }],
    "outcome": "complete",
    "memory_indicator": "Updated Build memory: fast dashboard verification command.",
    "artifact_links": ["reports/run-envelope.json"]
  },
  "outcome": "complete"
}
```

Required validator rules:

- `outcome = "complete"` requires `completion_gate.verdict = "complete"`.
- Every required done claim has a `claim_results.status = "proved"`.
- `clean_streak >= required_passes`.
- Gate passes use distinct attack lenses.
- `surface_output.outcome` matches top-level `outcome`.
- Memory update events have `authority = "hint_only"`.

### 2. Missing-Evidence Follow-Up

Purpose: prove a child process can close complete while the Run envelope refuses
to close because required evidence is missing.

Minimum differences from the complete fixture:

- first attempt outcome is `complete`;
- at least one required claim has `status = "missing"` and a non-empty `gap`;
- `completion_gate.verdict = "needs_followup"`;
- `completion_gate.next_action = "plan-followup-process"`;
- `process_plan.planned_attempts` includes a second attempt such as
  `attempt-review-2`;
- that follow-up attempt includes `followup_for` with the missing claim id,
  prior attempt id, and missing evidence refs;
- top-level `outcome = "needs_attention"` or equivalent target spelling, not
  `complete`;
- no close-shaped surface output.

Required validator rules:

- Missing required evidence forbids `completion_gate.verdict = "complete"`.
- Missing required evidence forbids top-level `outcome = "complete"`.
- `needs_followup` requires a planned follow-up attempt or a decision packet.
- Follow-up attempts must cite the missing claim and prior attempt id.

Current source anchor: `GoalEvidenceEvaluation` rejects completion-gate routing
unless every claim is proved, and Goal tests cover weak child proof moving to
checkpoint rather than close.

### 3. Checkpoint Needed

Purpose: prove a child process checkpoint can pause Run without pretending the
Run envelope wrote runtime checkpoint trace entries.

Minimum shape:

- one process attempt has `outcome = "checkpoint_waiting"`;
- that attempt has no `child_run.result_path`;
- that attempt has `checkpoint.step_id`, `checkpoint.request_path`, and
  `checkpoint.allowed_choices`;
- `completion_gate.next_action = "ask-operator"`;
- a decision packet has `reason = "checkpoint-waiting"`;
- the decision packet uses
  `resume_target.kind = "process-checkpoint"`,
  `resume_target.run_folder = <child run folder>`, and
  `resume_target.checkpoint_step_id = <checkpoint step id>`;
- top-level outcome is `needs_attention`.

Required validator rules:

- `checkpoint_waiting` attempts must have a checkpoint object.
- `checkpoint_waiting` attempts must not have `child_run.result_path`.
- `process-checkpoint` resume targets require a matching waiting process
  attempt.
- The Run envelope fixture must not include fake `checkpoint.requested` or
  `checkpoint.resolved` trace entries.

Current source anchor: `GraphCheckpointWaitingResult` carries `checkpoint`
fields and no `resultPath`; the checkpoint executor owns trace pairing and
resume validation.

### 4. Blocked

Purpose: prove honest blocked closure when proof cannot be produced or recovery
is exhausted.

Minimum shape:

- one or more process attempts have `outcome = "blocked"` or `failed`;
- `completion_gate.verdict = "blocked"`;
- at least one claim has `status = "blocked"` or `contradicted`;
- `completion_gate.next_action = "blocked"`;
- top-level `outcome = "blocked"`;
- `surface_output.operator_action` names the next input needed.

Required validator rules:

- `blocked` top-level outcome requires a blocked gate verdict or failed process
  state with an explicit reason.
- `blocked` requires a non-empty operator action, reason, or handoff path.
- A blocked record must not include `surface_output.status_text` that says or
  implies "done".

Current source anchor: `GoalResult` requires useful action text for blocked,
failed, and handoff results.

## Negative Fixtures

The first validator test plan should include these invalid records:

| Invalid Fixture | Expected Failure |
| --- | --- |
| `false-complete-missing-claim` | Top-level `outcome = "complete"` with any required claim not proved must fail. |
| `false-complete-one-gate-pass` | `completion_gate.next_action = "close"` with `clean_streak < 2` or fewer than two clean passes must fail. |
| `duplicate-gate-lens` | Two gate passes using the same `attack_lens` must fail. |
| `missing-evidence-no-followup` | `completion_gate.verdict = "needs_followup"` without a follow-up attempt or decision packet must fail. |
| `memory-authority-route` | Any memory input or update event that grants route, proof, checkpoint, recovery, policy, or write authority must fail. |
| `checkpoint-resume-without-waiting-attempt` | A decision packet with `resume_target.kind = "process-checkpoint"` but no matching waiting attempt must fail. |
| `waiting-attempt-with-result-path` | A `checkpoint_waiting` attempt that already has `child_run.result_path` must fail. |
| `ad-hoc-evidence-ref` | Evidence refs outside child result, operator summary, declared report, process evidence projection, memory, or operator input must fail. |
| `surface-complete-while-record-blocked` | Surface output claiming completion while the top-level record is blocked or needs attention must fail. |

## Validator Rule Inventory

| Rule | Validates | Current Source Anchor |
| --- | --- | --- |
| Complete requires proved claims | Prevents false complete. | `GoalEvidenceEvaluation` and `GoalResult` schema tests. |
| Complete requires two clean gate passes | Preserves current two-pass review posture. | `GoalGate` schema tests. |
| Gate pass lenses are distinct | Avoids replaying the same review as two passes. | `GoalGate` schema tests. |
| Missing evidence requires follow-up or decision | Keeps Run working until done or honestly blocked. | Goal weak-proof tests and target architecture audit. |
| Checkpoint waiting has no result path | Matches current runtime waiting envelope. | `GraphCheckpointWaitingResult` and CLI checkpoint output. |
| Process checkpoint resume target matches a waiting attempt | Prevents Run envelope packets from inventing runtime resume authority. | Checkpoint executor and checkpoint resume contract. |
| Memory is hint-only | Prevents memory from becoming proof or route authority. | `MemoryInputV0` schema and tests. |
| Evidence refs come from allowed source classes | Prevents ad hoc report scraping. | `Ref` schema plus contract sketch evidence-ref rule. |
| Surface output matches record outcome | Keeps human output succinct but honest. | Host rendering contract and operator summary tests. |

## Evidence-Ref Provenance Classes

The fixture validator should initially admit only these evidence-ref classes:

| Class | Example | Notes |
| --- | --- | --- |
| Child result | `child-result:reports/result.json` | Must point at the attempt's child run. |
| Operator summary | `operator-summary:reports/operator-summary.json` | Human-facing projection may be linked, but not used alone as proof. |
| Declared process report | `process-report:reports/build/verification.json` | Must be declared by the process attempt or future evidence projection. |
| Process evidence projection | `process-evidence:reports/process-evidence.json` | Future-friendly escape hatch for avoiding flow-specific path conventions. |
| Memory | `memory:prior-run-abc123` | Hint-only. Never proves current done claims by itself. |
| Operator input | `operator-input:decision-1` | Allowed for decisions, not for command/proof claims unless paired with current evidence. |

For the first fixture suite, trace refs should be avoided as proof inputs unless
they are only metadata. This keeps the Run envelope out of child trace internals.

## Suggested Test File Shape

When implementation begins, keep the first slice narrow:

```text
tests/contracts/run-envelope-record-schema.test.ts
  valid fixtures
    accepts one-process complete
    accepts missing-evidence follow-up
    accepts checkpoint-needed
    accepts blocked
  invalid fixtures
    rejects false complete
    rejects missing evidence without follow-up
    rejects memory authority
    rejects invalid decision-packet resume target
    rejects ad hoc evidence refs
```

The tests should import a pure schema or validator only. They should not import
runtime executors, CLI entrypoints, generated flow manifests, or host plugin
surfaces.

## Open Questions For The First Implementation Slice

| Question | Why It Matters | Safe Default |
| --- | --- | --- |
| Should `needs_attention` or `needs_followup` be the top-level outcome string? | Current runtime uses `needs_attention`; the Run envelope gate uses `needs_followup`. | Use `needs_attention` at top level and `needs_followup` inside `completion_gate.verdict`. |
| Should evidence refs use the existing `Ref` object or typed strings first? | `Ref` gives stronger provenance but makes fixtures noisier. | Use `Ref` objects in code; this plan uses compact strings for readability. |
| Does every process need an evidence projection before source-owned Run implementation? | Without it, the Run envelope may learn per-flow report paths. | Allow declared process reports in the fixture, but treat a process evidence projection as likely first-slice support. |
| Should memory updates be `proposed` or `recorded` by default? | Product direction leans automatic, but the exact policy is still open. | Accept both; require `operator_indicator` whenever action is not `skipped`. |

## Completion Criteria For This Plan

This plan is ready to hand to implementation when:

- every positive fixture can be written without runtime execution;
- every negative fixture maps to one clear validator rule;
- every validator rule has a current source anchor or is marked as a new
  Run-envelope-only rule;
- the suite can run without generated output changes;
- no fixture relies on child trace internals as proof.

If any of those fail, the contract sketch should be revised before production
implementation starts.
