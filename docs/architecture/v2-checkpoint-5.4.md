# Phase 5.4 - Retained Checkpoint Folder And Fallback Policy

Date: 2026-05-05

## Summary

Phase 5.4 turns the post-Build-deep question into explicit policy:

```text
What retained runtime behavior is compatibility support?
What behavior is still a migration target?
What would need to be true before deletion?
```

This phase does not route another mode through core-v2 and does not delete old
runtime code.

## Policy Artifacts

New docs:

- `docs/architecture/v2-retained-checkpoint-folder-policy.md`
- `docs/architecture/v2-retained-fallback-policy.md`

The checkpoint-folder policy says:

```text
core-v2-marked run folder -> core-v2 resume
retained/v1 run folder -> retained resume
```

Core-v2 will not resume retained/v1 checkpoint folders in the current migration
lane. That would be a migration feature or retirement decision, not cleanup.

The fallback policy classifies:

- retained/v1 checkpoint folders;
- checkpoint/tournament modes not in the v2 matrix;
- unsupported flow/mode/depth fallback;
- arbitrary explicit fixtures;
- programmatic `composeWriter`;
- rollback;
- old runner/handler oracle tests.

## Handoff Compatibility Hardening

Phase 5.3 made Build deep a core-v2 waiting run by default. That exposed a
handoff assumption: run-backed continuity used retained v1 snapshot derivation
for all waiting runs.

Phase 5.4 tightens the fix:

- retained/v1 folders still use retained snapshot derivation;
- if retained snapshot derivation fails, handoff falls back to neutral run
  status only when the folder is explicitly core-v2-marked;
- retained malformed folders do not silently take the core-v2 status fallback.

`tests/runner/utility-cli.test.ts` now proves handoff can bind to both:

- core-v2 Build deep waiting runs;
- retained Build deep waiting runs under rollback.

## Build Tournament Clarification

Build has no current public tournament entry mode.

The current Build entry modes are:

```text
default
lite
deep
autonomous
```

So Phase 5.4 does not add a Build tournament retained test. The policy docs
state that any future Build tournament mode needs its own selector proof before
v2 routing.

## Non-Approvals

Phase 5.4 does not approve:

- old runtime deletion;
- routing retained/v1 checkpoint folders through core-v2;
- Build autonomous routing;
- adding or routing Build tournament;
- moving retained trace/reducer/snapshot/progress/checkpoint/runner internals;
- moving connector subprocess modules;
- moving relay materialization;
- moving registries/router/catalog/compiler infrastructure;
- removing rollback.

## Validation

Phase 5.4 validation:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts`: passed.
- `npx vitest run tests/runner/utility-cli.test.ts`: passed.
- `npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `git diff --check`: passed before this validation-result refresh.

`npm run soak:v2` ran the focused soak suite, full `npm run verify`, and
`npm run check-flow-drift`.

## Next Step

After this phase, do not widen more modes by default unless there is a clear
target and review-backed proof plan.

The better next migration work is deletion-readiness inventory:

- exact disposition for every `src/runtime` file;
- retained runner/handler test disposition;
- fallback policy decisions for arbitrary fixtures, `composeWriter`, rollback,
  and old checkpoint folders.
