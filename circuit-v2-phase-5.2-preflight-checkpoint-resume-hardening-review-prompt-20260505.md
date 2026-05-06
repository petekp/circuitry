# Circuit core-v2 migration review: Phase 5.2 preflight checkpoint resume hardening

Please review the attached Phase 5.2 preflight correction packet for
`/Users/petepetrash/Code/circuit-next`.

## Decision Requested

Decide whether Phase 5.2 is now approved to proceed to:

```text
Phase 5.2.1 - Build deep v2 candidate smoke
```

Do not approve Build deep default routing yet. Do not approve old runtime
deletion.

## Context

Phase 5.2 implemented fixture-level core-v2 checkpoint pause/resume for new
core-v2-marked run folders only.

The prior review blocked Build-deep candidate smoke until these gaps were fixed:

1. `checkpoint.requested.request_path` had to be validated against the saved
   checkpoint step's declared request path.
2. v2 waiting status had to reject mismatched request paths and inconsistent
   choices.
3. Public-boundary rejection tests had to cover more of the checkpoint safety
   surface.
4. Follow-up review also found that resume had to validate traced
   `allowed_choices` against the saved checkpoint step choices before trusting
   those trace choices for the operator selection.

This packet contains that correction slice.

## What Changed In This Preflight Slice

### 1. Resume request-path validation

`src/core-v2/run/checkpoint-resume.ts` now rejects v2 checkpoint resume when:

```text
checkpoint.requested.request_path !== saved checkpoint step writes.request.path
```

The rejection happens before reading the checkpoint request file.

### 2. Resume trace-choice validation

`src/core-v2/run/checkpoint-resume.ts` now rejects v2 checkpoint resume when:

```text
checkpoint.requested.allowed_choices !== saved checkpoint step choices
```

Resume now validates the operator selection against saved checkpoint choices,
not trace choices. The stale trace-choice rejection happens before
`checkpoint.resolved` is written.

### 3. Waiting status hardening

`src/run-status/v2-run-folder.ts` now projects v2 waiting checkpoints as invalid
when:

```text
trace request_path != saved flow checkpoint request path
trace allowed_choices != saved flow checkpoint choices
request body allowed_choices != saved flow checkpoint choices
request file is missing/unreadable
request hash differs from trace
request JSON is invalid
request schema_version or step_id is stale
```

### 4. Rejection coverage

`tests/core-v2/checkpoint-resume-v2.test.ts` now covers:

```text
request_path mismatch rejects resume
request_path mismatch projects invalid status
missing request file rejects resume
stale schema_version rejects after hash passes
stale step_id rejects after hash passes
request allowed_choices mismatch projects invalid status and rejects resume
trace allowed_choices mismatch rejects before checkpoint.resolved
already resolved checkpoint rejects
closed run rejects
missing checkpoint report rejects when request carries its hash
```

`tests/runner/build-checkpoint-exec.test.ts` now covers the inverse resume
dispatch boundary:

```text
retained/v1 checkpoint folder resumes retained even with CIRCUIT_V2_RUNTIME=1
```

## Explicit Non-Goals

Do not approve any of these:

```text
old runtime deletion
Build deep default routing
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

1. Does v2 checkpoint resume now validate request path ownership strongly
   enough before Build-deep candidate smoke?
2. Does v2 waiting status reject invalid checkpoint path/choice/request states
   instead of presenting a resumable checkpoint?
3. Is the rejection test coverage strong enough for Phase 5.2.1 candidate smoke?
4. Does the retained-folder strict-v2 test adequately prove resume dispatch
   follows saved run-folder identity in both directions?
5. Are there any blockers before Build-deep candidate smoke?

## Validation Run

Passed:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/core-v2 tests/parity
npx vitest run tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/progress-event-schema.test.ts
npx vitest run tests/soak
npm run soak:v2:fast
npm run soak:v2
npm run test:fast
git diff --check
```

Note: `npm run soak:v2` itself runs `tests/soak`, `npm run verify`, and
`npm run check-flow-drift`.

## Files Included

Key files in the packet:

```text
HANDOFF.md
package.json
docs/architecture/v2-checkpoint-5.2.md
docs/architecture/v2-checkpoint-resume-parity-plan.md
docs/architecture/v2-deletion-plan.md
docs/architecture/v2-worklog.md
src/core-v2/domain/step.ts
src/core-v2/domain/trace.ts
src/core-v2/executors/checkpoint.ts
src/core-v2/projections/progress.ts
src/core-v2/run/checkpoint-resume.ts
src/core-v2/run/compiled-flow-runner.ts
src/core-v2/run/graph-runner.ts
src/core-v2/run/run-context.ts
src/run-status/v2-run-folder.ts
src/cli/circuit.ts
tests/core-v2/checkpoint-resume-v2.test.ts
tests/runner/build-checkpoint-exec.test.ts
tests/runner/run-status-projection.test.ts
tests/runner/cli-v2-runtime.test.ts
tests/contracts/progress-event-schema.test.ts
tests/soak/v2-runtime-surface.test.ts
```

## Expected Next Step If Approved

Proceed only to:

```text
Phase 5.2.1 - Build deep v2 candidate smoke
```

Keep it candidate/strict only, not default routing.
