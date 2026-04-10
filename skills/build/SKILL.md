---
name: build
description: >
  Build features, scoped refactors, docs, tests, or mixed changes. The doing
  workflow. Phases: Frame -> Plan -> Act -> Verify -> Review -> Close. Docs and
  tests are first-class outputs, not afterthoughts. If architecture uncertainty
  appears, stop and restart through Explore rather than muddling through.
trigger: >
  Use for /circuit:build, or when circuit:run routes here.
---

# Build

Features, scoped refactors, docs, tests, mixed code+docs+tests changes. The doing workflow.

## Phases

Frame -> Plan -> Act -> Verify -> Review -> Close

## Entry

The router passes: task description and rigor profile (Lite, Standard, Deep, Autonomous).

Build uses the semantic outer engine on the real execution path. The human-facing
dashboard is generated from machine state; do not hand-edit it.

Map rigor to Build entry mode:
- Standard -> `default`
- Lite -> `lite`
- Deep -> `deep`
- Autonomous -> `autonomous`

When Build starts, derive `RUN_SLUG` and `RUN_ROOT` as usual, then always call
the semantic bootstrap wrapper. Bootstrap is idempotent, so call it even if the
router already initialized the run:

```bash
RUN_SLUG="add-dark-mode-support"  # derived from task description
RUN_ROOT=".circuit/circuit-runs/${RUN_SLUG}"
ENTRY_MODE="default"              # map from the selected rigor

"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" bootstrap \
  --run-root "$RUN_ROOT" \
  --manifest "$CLAUDE_PLUGIN_ROOT/skills/build/circuit.yaml" \
  --entry-mode "$ENTRY_MODE" \
  --goal "<task description>" \
  --project-root "$PWD"
```

## Phase: Frame

Write `artifacts/brief.md`:

```markdown
# Brief: <task>
## Objective
<what we are building and why>
## Scope
<what is in scope -- be specific about boundaries>
## Output Types
<check all that apply: code, tests, docs, ADRs, config>
## Success Criteria
<measurable conditions for done>
## Constraints
<hard invariants, boundaries, non-negotiables>
## Verification Commands
<exact commands to prove success -- not placeholders>
## Out of Scope
<what we are NOT doing>
```

Key rule: Output Types must be explicit. If the change affects code, ask whether
tests, docs, or config changes are also required. Docs and tests are first-class
outputs, not afterthoughts.

Ambiguity check: If the task is genuinely ambiguous (more than one reasonable
interpretation), ask one clarifying question before writing `brief.md`.

After writing `artifacts/brief.md`, write the checkpoint request file and call the
semantic checkpoint command:

```bash
cat > "$RUN_ROOT/checkpoints/frame-1.request.json" <<'JSON'
{
  "step": "frame",
  "selection_required": ["continue"],
  "reason": "brief ready for checkpoint resolution"
}
JSON

"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" request-checkpoint \
  --run-root "$RUN_ROOT" \
  --step frame
```

Rigor behavior:
- Lite, Standard, Autonomous: auto-write `{"selection":"continue"}` to
  `checkpoints/frame-1.response.json`, then call `resolve-checkpoint`.
- Deep: stop for user confirmation. Once the user confirms, write
  `checkpoints/frame-1.response.json` with `selection: continue`, then call
  `resolve-checkpoint`.

```bash
cat > "$RUN_ROOT/checkpoints/frame-1.response.json" <<'JSON'
{
  "selection": "continue"
}
JSON

"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" resolve-checkpoint \
  --run-root "$RUN_ROOT" \
  --step frame
```

Gate: `brief.md` exists with non-empty Objective, Scope, Output Types, Success
Criteria, and Verification Commands.

## Phase: Plan

Write `artifacts/plan.md`:

```markdown
# Plan: <task>
## Approach
<how we will do this -- concrete, not abstract>
## Slices
<ordered implementation sequence>
### Slice 1: <name>
<what this slice does, files affected, verification>
### Slice N: <name>
<what this slice does, files affected, verification>
## Verification Commands
<exact commands, run after each slice and at completion>
## Rollback Triggers
<conditions that mean "stop and revert">
## Adjacent-Output Checklist
- [ ] Tests: new/updated tests for changed behavior?
- [ ] Docs: do any docs reference changed code/APIs?
- [ ] Config: any config changes needed?
- [ ] Migrations: any data/schema migrations?
- [ ] Observability: logging, metrics, alerts affected?
- [ ] Compatibility: any breaking changes to document?
```

Address each adjacent-output item explicitly: mark it required with details or
mark it N/A. Treat unchecked items as plan-quality gaps to fix before proceeding.

Deep rigor folds seam proof into this phase. Identify the riskiest seam, prove
it inside the planning work, and refine the slices here. This is extra rigor
inside Plan, not a separate runtime step.

If planning or seam proof reveals architecture uncertainty, multiple viable
architectures, or a design invalidation that requires deeper exploration, stop
and tell the user to restart via Explore. Same-run Build -> Explore transfer is
not supported in v1. Do not advance the runtime until `plan.md` is sound.

When `plan.md` is ready, complete the synthesis step:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" complete-synthesis \
  --run-root "$RUN_ROOT" \
  --step plan
```

Gate: `plan.md` exists with non-empty Approach, Slices, and Verification Commands.

## Phase: Act

Act is always a dispatch step in this migration. No mode may bypass dispatch.

Create the parent-owned implementation workspace:

```bash
IMPL_ROOT="$RUN_ROOT/phases/implement"
mkdir -p "${IMPL_ROOT}/archive" "${IMPL_ROOT}/reports" "${IMPL_ROOT}/last-messages" "${IMPL_ROOT}/jobs"
cp "$RUN_ROOT/artifacts/plan.md" "${IMPL_ROOT}/CHARTER.md"
```

Write `artifacts/implementation-handoff.md` with the concrete implementation
mission, verification commands, expected outputs, and relay headings:
- `### Files Changed`
- `### Tests Run`
- `### Completion Claim`

Keep `workers` as the inner adapter. Do not duplicate its inner event system.
Do not pass `workers` through `--skills`; it is the internal adapter.

Before dispatch, materialize the outer request at:
- `phases/implement/jobs/act-1.request.json` for the first attempt
- `phases/implement/jobs/act-2.request.json` for the second attempt
- `phases/implement/jobs/act-3.request.json` for the third attempt

Then call the semantic dispatch command:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" dispatch-step \
  --run-root "$RUN_ROOT" \
  --step act
```

When the worker result exists at the manifest path for the active attempt, call:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" reconcile-dispatch \
  --run-root "$RUN_ROOT" \
  --step act
```

Public files owned by the outer Build workflow:
- `phases/implement/jobs/{step_id}-{attempt}.request.json`
- `phases/implement/jobs/{step_id}-{attempt}.receipt.json`
- `phases/implement/jobs/{step_id}-{attempt}.result.json`
- `reports/report-converge.md`
- `reports/report-{slice_id}.md`

If `reconcile-dispatch` reports `gate_passed=false`, the Act step stays
incomplete. Interpret that mechanically:
- `completion=partial`: finish remaining work, write the next request file, and dispatch again
- `completion=blocked`: resolve the dependency or reopen the step before retrying
- `completion=complete` with a disallowed verdict: fix findings, update the handoff if needed, and re-dispatch

Gate: Act advances only when the result is mechanically complete and the verdict
satisfies the manifest pass list.

## Phase: Verify

Independently re-run all verification commands from `plan.md`. Record results in
`artifacts/verification.md`:

```markdown
# Verification: <task>
## Verification Results
- <command>: PASS | FAIL
- <command>: PASS | FAIL
## Regression Check
<any new failures introduced?>
```

Then complete the synthesis step:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" complete-synthesis \
  --run-root "$RUN_ROOT" \
  --step verify
```

Verify always routes to Review in this migration.

## Phase: Review

Review is always present in this migration, including Lite.

Create the review workspace:

```bash
REVIEW_ROOT="$RUN_ROOT/phases/review"
mkdir -p "${REVIEW_ROOT}/reports" "${REVIEW_ROOT}/last-messages" "${REVIEW_ROOT}/jobs"
```

Dispatch an independent reviewer in a fresh context. The reviewer audits
implementation against `brief.md` and `plan.md`, reruns verification where
needed, and writes the public review result.

Outer review contract paths:
- `phases/review/jobs/review-1.request.json`
- `phases/review/jobs/review-1.receipt.json`
- `phases/review/jobs/review-1.result.json`

Dispatch:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" dispatch-step \
  --run-root "$RUN_ROOT" \
  --step review
```

When the reviewer output exists, promote the human-facing review artifact to
`artifacts/review.md`, then reconcile the dispatch:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" reconcile-dispatch \
  --run-root "$RUN_ROOT" \
  --step review
```

If review does not pass its verdict gate, the step remains incomplete. Fix the
findings, write the next request file for `review`, and dispatch again. After
two critical-review loops with no passing verdict, escalate to the user.

## Phase: Close

Write `artifacts/result.md`:

```markdown
# Result: <task>
## Changes
<what changed, files affected>
## Verification
<test results, verification command output>
## Adjacent Outputs Delivered
<tests, docs, config, etc. that were updated>
## Residual Risks / Debt
<known issues left intentionally>
## Follow-ups
<future work surfaced during this run>
## PR Summary
<ready-to-use PR body>
### Title
<short PR title>
### Summary
<bullet points>
### Test Plan
<how to verify>
```

Complete the final synthesis step:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" complete-synthesis \
  --run-root "$RUN_ROOT" \
  --step close
```

This terminates the run via `run_completed`.

## Circuit Breakers

Escalate when:
- Workers: `impl_attempts > 3` or `impl_attempts + review_rejections > 5`
- Review returns critical issues after 2 fix loops
- Architecture uncertainty appears during Plan and the user must restart via Explore
- Verification commands fail after bounded fix attempts
- A dispatch step fails twice

Include counter values, failure output, and concrete options (adjust scope, skip
slice, abort, restart via Explore).

## Resume

Use the semantic resume command as the source of truth:

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/circuit-engine.sh" resume \
  --run-root "$RUN_ROOT" \
  --json
```

Read `resume_step`, `status`, and `reason`.
- If status is terminal, stop.
- Otherwise continue from the reported `resume_step`.
- Do not reconstruct the phase from a handwritten artifact chain.
