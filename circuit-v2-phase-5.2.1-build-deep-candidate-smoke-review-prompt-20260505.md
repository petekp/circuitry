# Circuit core-v2 migration review: Phase 5.2.1 Build deep candidate smoke

Please review the attached Phase 5.2.1 packet for
`/Users/petepetrash/Code/circuit-next`.

## Decision Requested

Decide whether the Build deep v2 checkpoint candidate smoke is approved.

If approved, the next phase may decide whether Build deep should enter the
default selector matrix.

Do **not** approve Build deep default routing in this review unless you
explicitly choose to. Do **not** approve old runtime deletion.

## Context

Phase 5.2 implemented and hardened fixture-level core-v2 checkpoint
pause/resume. The latest follow-up fixed resume trace-choice validation against
the saved checkpoint step.

Phase 5.2.1 is the first public-flow candidate smoke:

```text
Build deep through core-v2 checkpoint pause/resume
candidate/strict only
not default-routed
```

## What Changed

### 1. Split default support from candidate/strict support

`src/cli/circuit.ts` now has:

```text
V2_RUNTIME_SUPPORT_MATRIX
V2_RUNTIME_CANDIDATE_SUPPORT_MATRIX
```

Build deep is only in the candidate/strict matrix.

Expected routing:

```text
normal Build deep -> retained runtime
CIRCUIT_V2_RUNTIME_CANDIDATE=1 Build deep -> core-v2
CIRCUIT_V2_RUNTIME=1 Build deep -> core-v2
rollback for default-supported rows -> retained runtime
```

### 2. Build deep candidate smoke

`tests/runner/cli-v2-runtime.test.ts` now proves:

```text
candidate Build deep starts on core-v2
candidate Build deep pauses with checkpoint_waiting
no reports/result.json is written while waiting
runs show --json reports waiting_checkpoint
Build brief parses
checkpoint request stores original project root and config layers
progress emits checkpoint.waiting and user_input.requested
resume follows saved core-v2 run-folder marker
resume restores original project root
resume restores selection config layers
post-checkpoint relay/verification/review/close continue
reports/result.json is written after resume
Build result report parses
runs show --json reports completed after resume
```

`tests/runner/cli-v2-runtime.test.ts` also proves strict opt-in Build deep can
pause through core-v2.

`tests/soak/v2-runtime-surface.test.ts` now treats strict Build deep as a v2
candidate path while keeping unsupported strict Fix default fail-closed.

### 3. Default routing remains unchanged

Existing default selector tests still prove Build deep stays retained unless
candidate/strict v2 routing is explicitly enabled.

## Explicit Non-Goals

Do not approve:

```text
old runtime deletion
Build deep default routing unless explicitly decided
Build tournament routing
retained/v1 checkpoint folders through core-v2
moving retained trace reader/writer
moving retained reducer/snapshot writer
moving retained progress projector
moving retained checkpoint handler
moving old runner or step handlers
moving connector subprocess modules
moving relay materializer
moving registries
```

## Review Questions

Please answer:

1. Is the selector split safe: default matrix unchanged, candidate/strict matrix
   includes Build deep?
2. Does the Build deep candidate smoke prove enough before considering default
   routing?
3. Does default Build deep still stay retained?
4. Do saved-engine resume rules remain correct for v2 and retained folders?
5. Are there any blockers before Phase 5.3 default-routing consideration?

## Validation Run

Passed:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts tests/core-v2/checkpoint-resume-v2.test.ts
npx vitest run tests/core-v2 tests/parity
npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts
npm run soak:v2:fast
npm run soak:v2
npm run test:fast
git diff --check
```

Note: `npm run soak:v2` includes `tests/soak`, full `npm run verify`, and
`npm run check-flow-drift`.

## Files Included

Key files in the packet:

```text
HANDOFF.md
package.json
docs/architecture/v2-checkpoint-5.2.md
docs/architecture/v2-checkpoint-5.2.1.md
docs/architecture/v2-checkpoint-resume-parity-plan.md
docs/architecture/v2-deletion-plan.md
docs/architecture/v2-selector-soak-checklist.md
docs/architecture/v2-selector-soak-report.md
docs/architecture/v2-worklog.md
src/cli/circuit.ts
src/core-v2/run/checkpoint-resume.ts
src/core-v2/executors/checkpoint.ts
src/core-v2/projections/progress.ts
src/core-v2/run/graph-runner.ts
src/run-status/v2-run-folder.ts
tests/core-v2/checkpoint-resume-v2.test.ts
tests/runner/cli-v2-runtime.test.ts
tests/runner/build-checkpoint-exec.test.ts
tests/runner/run-status-projection.test.ts
tests/contracts/progress-event-schema.test.ts
tests/soak/v2-runtime-surface.test.ts
```

## Expected Next Step If Approved

Proceed to:

```text
Phase 5.3 - decide whether Build deep enters the default selector matrix
```

That should be a focused default-routing decision, not old runtime deletion.

