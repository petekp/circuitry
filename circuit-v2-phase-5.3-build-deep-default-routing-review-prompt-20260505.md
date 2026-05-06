# Circuit core-v2 migration review: Phase 5.3 Build deep default routing

Please review the attached Phase 5.3 packet for the Circuit `core-v2` migration.

## Decision requested

Approve or block Phase 5.3:

```text
Build deep is now default-routed through core-v2.
```

This is a focused default-routing decision. It is **not** a deletion review.

## Explicit non-approvals

Do not approve any of these from this packet:

```text
Build tournament routing
other checkpoint/tournament mode routing
old runtime deletion
retained/v1 checkpoint folders through core-v2
moving retained trace/reducer/snapshot/progress/checkpoint/runner internals
moving connector subprocess modules
moving relay materialization
moving registries/router/catalog/compiler infrastructure
removing rollback
```

## What changed

### 1. Build deep entered the default v2 support matrix

`src/cli/circuit.ts` now includes:

```text
build default -> core-v2
build lite -> core-v2
build deep -> core-v2
```

The candidate matrix no longer carries a Build-deep-only exception; it aliases
the default support matrix.

Rollback remains unchanged:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1 build --mode deep -> retained runtime
```

Resume remains saved-folder-identity-based:

```text
core-v2-marked folder -> core-v2 resume
retained/v1 folder -> retained resume
```

### 2. No-env Build deep default smoke was added

`tests/runner/cli-v2-runtime.test.ts` now proves a normal no-env Build deep run:

```text
circuit-next run build --mode deep ...
```

goes through core-v2, pauses at the checkpoint, emits checkpoint/user-input
progress, projects waiting status through `runs show --json`, resumes through
the saved core-v2 marker, restores request context, writes `reports/result.json`,
parses the Build result, and projects final completed status.

Normal stdout still omits runtime diagnostics for default routing.

### 3. Soak coverage now includes default Build deep

`tests/soak/v2-runtime-surface.test.ts` adds Build deep checkpoint pause/resume
to the automated selector soak gate.

Retained fallback coverage was adjusted:

```text
default Build deep -> core-v2
rollback Build deep -> retained runtime
```

### 4. Handoff continuity learned core-v2 waiting runs

Full `npm run verify` initially found that `handoff save --run-folder` assumed a
retained v1 trace/snapshot shape when binding to a waiting run. That was hidden
while default Build deep was retained.

`src/cli/handoff.ts` now keeps the old retained snapshot path for v1 folders and
falls back to the neutral run-status projection for core-v2 folders. That lets
run-backed handoff continuity bind to both retained waiting runs and core-v2
waiting runs.

## Validation run

All of these passed:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2/checkpoint-resume-v2.test.ts
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/core-v2 tests/parity
npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts
npx vitest run tests/soak
npm run soak:v2:fast
npm run soak:v2
npm run test:fast
git diff --check
```

`npm run soak:v2` includes the focused soak suite, full `npm run verify`, and
`npm run check-flow-drift`.

## Review questions

Please answer:

1. Is Build deep safe to keep in the default core-v2 support matrix?
2. Does the no-env default Build deep smoke prove enough public behavior?
3. Does rollback still prove a safe retained fallback for Build deep?
4. Is the `handoff save --run-folder` compatibility fix the right response to
   core-v2 waiting runs becoming default?
5. Are there any hidden old-runtime deletion implications? There should not be.
6. What is the next best migration target after this, and does it need a deep
   review before coding?

## My current recommendation

If Phase 5.3 is approved, do **not** immediately widen to another mode without
choosing a specific target.

Good next candidates:

```text
A. Plan/implement the next checkpoint-bearing public mode only if one exists and has clear product value.
B. Classify the remaining retained fallback behaviors for deletion-readiness.
C. Start a focused retained/v1 checkpoint-folder retirement policy plan.
```

My bias is B or C before another routing move, because Build deep was the
obvious public checkpoint path. The remaining retained runtime responsibilities
are now more about compatibility, old folders, fallback policy, and deletion
readiness than simple selector widening.
