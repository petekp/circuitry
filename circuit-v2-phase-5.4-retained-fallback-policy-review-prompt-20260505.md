# Circuit core-v2 migration review: Phase 5.4 retained checkpoint/fallback policy

Please review the attached Phase 5.4 packet for the Circuit `core-v2`
migration.

## Decision requested

Approve or block Phase 5.4:

```text
retained/v1 checkpoint folders remain retained-runtime-resumed compatibility state
retained fallback behaviors are explicitly classified before deletion work
handoff continuity only falls back to v2 status projection for core-v2-marked folders
```

This is a policy and compatibility checkpoint. It is **not** a deletion review.

## Explicit non-approvals

Do not approve any of these from this packet:

```text
old runtime deletion
Build autonomous routing
Build tournament routing
other checkpoint/tournament routing
retained/v1 checkpoint folders through core-v2
moving retained trace/reducer/snapshot/progress/checkpoint/runner internals
moving connector subprocess modules
moving relay materialization
moving registries/router/catalog/compiler infrastructure
removing rollback
```

## What changed

### 1. Retained checkpoint-folder policy

New file:

```text
docs/architecture/v2-retained-checkpoint-folder-policy.md
```

Policy:

```text
core-v2-marked run folder -> core-v2 resume
retained/v1 run folder -> retained resume
```

Core-v2 will not resume retained/v1 checkpoint folders in the current migration
lane. Migrating or retiring old retained checkpoint folders would be a future
product decision, not cleanup.

### 2. Retained fallback policy

New file:

```text
docs/architecture/v2-retained-fallback-policy.md
```

It classifies:

```text
retained/v1 checkpoint folders
checkpoint/tournament modes not in the v2 matrix
unsupported flow/mode/depth fallback
arbitrary explicit fixtures
programmatic composeWriter
rollback
old runner/handler oracle tests
```

The punchline is that retained runtime is now an intentional compatibility and
fallback layer. It is not the normal owner for proven fresh-run rows, but it is
also not dead code.

### 3. Handoff fallback hardening

Phase 5.3 fixed `handoff save --run-folder` for core-v2 waiting runs by using
the neutral run-status projection when retained snapshot derivation failed.

Phase 5.4 tightens that:

```text
retained/v1 folders -> retained snapshot derivation
core-v2-marked folders -> neutral run-status fallback
malformed retained folders -> no silent v2-status fallback
```

`tests/runner/utility-cli.test.ts` now proves handoff can bind to both:

```text
default core-v2 Build deep waiting run
rollback retained Build deep waiting run
```

### 4. Build tournament clarification

Build currently has no public tournament entry mode in either:

```text
src/flows/build/schematic.json
generated/flows/build/circuit.json
```

Current Build entry modes are:

```text
default
lite
deep
autonomous
```

So this packet documents that there is no Build tournament route to test today.
If one is introduced later, it needs its own selector proof.

## Validation run

All of these passed:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/runner/utility-cli.test.ts
npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts
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

1. Is the retained/v1 checkpoint folder policy correct?
2. Is it correct that core-v2 should not resume old retained/v1 checkpoint
   folders in this migration lane?
3. Does the fallback classification give enough deletion-readiness structure?
4. Is the handoff fallback now tight enough?
5. Is the Build tournament clarification adequate?
6. What is the next best slice after Phase 5.4?

## My current recommendation

If Phase 5.4 is approved, do not route another mode by default immediately.

The best next slice is a deletion-readiness inventory:

```text
exact disposition for every src/runtime file
test disposition for retained runner/handler tests
which retained behaviors are long-term support vs migration targets vs retirement candidates
first tiny deletion candidate, if any
```

That should still avoid deleting old runtime code until a later review packet
has exact import/test/product evidence.
