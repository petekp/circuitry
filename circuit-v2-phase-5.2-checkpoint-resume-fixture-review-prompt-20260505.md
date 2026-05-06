# Review Prompt — Circuit core-v2 Phase 5.2

Please review the attached Phase 5.2 bundle for the Circuit core-v2 migration.

## Context

The migration has passed the default-selector milestone for matrix-supported
fresh runs, but old runtime deletion is still blocked.

Phase 5.2 is the first checkpoint-resume parity implementation slice:

```text
Goal:
  fixture-level core-v2 checkpoint pause/resume

Not the goal:
  Build deep default routing
  old retained checkpoint folder migration
  old runtime deletion
  retained trace/reducer/snapshot/progress movement
```

The prior review conditionally approved Phase 5.2 only if these corrections were
made before implementation:

1. Checkpoint request/resolution fields used by resume/status/progress must be
   first-class v2 trace fields, not only `data`.
2. `report_path` must not be overloaded for checkpoint request paths.
3. Waiting checkpoint must be a graph result, not a thrown handler error.
4. Resume graph continuation must reconstruct prior step completion/attempt
   state from existing trace.

This bundle attempts to satisfy those conditions.

## Main Files To Review

Implementation:

```text
src/core-v2/domain/trace.ts
src/core-v2/domain/step.ts
src/core-v2/executors/checkpoint.ts
src/core-v2/run/checkpoint-resume.ts
src/core-v2/run/graph-runner.ts
src/core-v2/run/compiled-flow-runner.ts
src/core-v2/run/run-context.ts
src/core-v2/projections/progress.ts
src/run-status/v2-run-folder.ts
src/cli/circuit.ts
```

Tests:

```text
tests/core-v2/checkpoint-resume-v2.test.ts
tests/runner/run-status-projection.test.ts
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
```

Docs/evidence:

```text
docs/architecture/v2-checkpoint-resume-parity-plan.md
docs/architecture/v2-checkpoint-5.2.md
docs/architecture/v2-deletion-plan.md
docs/architecture/v2-worklog.md
HANDOFF.md
```

## Claimed Behavior

Core-v2 can now pause and resume a marked v2 checkpoint run folder in a
dedicated fixture path.

Pause should:

```text
write checkpoint request file
hash exact request bytes after write
append checkpoint.requested with first-class request_path/request_report_hash/allowed_choices
emit checkpoint.waiting progress
emit user_input.requested progress
leave run open
not append step.completed
not append step.aborted
not append run.closed
not write reports/result.json
```

Resume should:

```text
detect engine=core-v2 from saved run folder
verify manifest snapshot bytes and bootstrap identity
reject closed runs
find latest unresolved checkpoint.requested
validate request hash before JSON parsing
validate schema_version, step_id, allowed choices, and check.allow
validate checkpoint report hash when present
restore projectRoot and selection_config_layers from request
write response before checkpoint.resolved
append checkpoint.resolved with first-class selection/response_path/resolution_source
reconstruct completed step counts from existing trace before continuation
continue graph through post-checkpoint relay and verification
write reports/result.json on close
project completed status after resume
```

CLI resume should follow saved run-folder engine marker:

```text
core-v2-marked run folder -> core-v2 resume
retained/v1 run folder -> retained resume
```

Fresh-run rollback/strict flags should not override saved resume ownership.

## Validation Reported

Passed:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts
npx vitest run tests/core-v2 tests/parity
npx vitest run tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/progress-event-schema.test.ts
npx vitest run tests/soak
npm run soak:v2:fast
npm run soak:v2
npm run test:fast
git diff --check
```

`npm run soak:v2` includes `npm run verify` and `npm run check-flow-drift`.

One initial `npm run soak:v2` failed on the terminology guard because the word
`dispatch` appeared in active files. The wording was corrected to
checkpoint/resume routing, and the full `npm run soak:v2` rerun passed.

## Review Questions

Please answer:

1. Is Phase 5.2 behavior-preserving outside the intended new v2 checkpoint
   fixture capability?
2. Are the v2 checkpoint trace fields correctly first-class, and is
   `report_path` avoided for request paths?
3. Is waiting modeled correctly as an open graph result rather than an abort?
4. Is resume validation strong enough: manifest, bootstrap identity, request
   hash-before-parse, stale request, allowed choice, `check.allow`, and
   checkpoint report hash?
5. Does graph resume reconstruct enough prior step state to avoid retry/cycle
   divergence?
6. Does status/progress projection preserve the public contracts?
7. Does CLI resume routing by saved engine marker look right?
8. Are there blockers before proceeding to a Build-deep candidate smoke?

## Hard Constraints

Do not approve:

```text
old runtime deletion
Build deep default routing
Build tournament routing
Explore tournament routing
old retained checkpoint folder migration
moving retained trace reader/writer
moving retained reducer/snapshot writer
moving retained progress projector
moving old checkpoint handler
moving old runner or step handlers
moving connector subprocess/materializer/registries
changing unsupported-mode fallback
changing rollback behavior for fresh runs
```

## Expected Next Slice If Approved

If Phase 5.2 is approved, the next slice should be:

```text
Phase 5.2.1 — Build deep v2 candidate smoke
```

That should prove Build deep through an explicit v2 candidate/strict path, not
default routing yet:

```text
Build deep pauses through core-v2
runs show shows waiting checkpoint
resume follows v2 engine marker
checkpoint brief/report hash validation works
selection config restores
project root restores
post-checkpoint continuation works
result closes
progress is acceptable
rollback/fallback behavior remains safe
```

Only after that should Phase 5.3 consider adding Build deep to the default
selector matrix.
