# Phase 5.21 - Retained Checkpoint Folder Boundary

Date: 2026-05-06

## Summary

Phase 5.21 creates a narrower compatibility boundary for retained/v1 checkpoint
folders.

The new module is:

```text
src/compat/retained-checkpoint-folders.ts
```

It owns the retained saved-folder operations:

- retained checkpoint resume;
- retained snapshot derivation;
- retained trace reading;
- retained trace reduction.

Production callers now use that smaller boundary:

- CLI checkpoint resume;
- handoff run-backed snapshot loading;
- run-status retained trace loading;
- v1 run-status retained trace reduction.

This is behavior-preserving. It does not migrate old folders to core-v2, expire
old folders, widen v2 status fallback, change rollback, change public
compatibility behavior, or delete retained runtime code.

## Files Changed

- `src/compat/retained-checkpoint-folders.ts`
- `src/compat/retained-runtime.ts`
- `src/cli/circuit.ts`
- `src/cli/handoff.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-checkpoint-5.21.md`
- `docs/architecture/v2-retained-checkpoint-folder-policy.md`
- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`src/compat/retained-checkpoint-folders.ts` delegates to retained
implementations:

- `resumeCompiledFlowCheckpoint`;
- `deriveSnapshot`;
- `readRunTrace`;
- `reduce`.

The broader `src/compat/retained-runtime.ts` still re-exports those operations
for compatibility with existing facade imports, but production saved-folder
callers now import the narrower boundary directly.

`tests/runner/retained-compat-facade.test.ts` proves:

- the smaller boundary exposes the retained/v1 checkpoint folder operations;
- CLI resume imports retained checkpoint resume from the checkpoint-folder
  boundary;
- handoff imports retained snapshot derivation from the checkpoint-folder
  boundary;
- run-status imports retained trace reading/reduction from the checkpoint-folder
  boundary;
- production code outside `src/compat/**` still does not import retained runner,
  reducer, snapshot writer, or trace reader directly.

`tests/runner/run-status-facade.test.ts` now asserts the run-status dispatcher
and v1 projector use `../compat/retained-checkpoint-folders.js`, not the broad
retained runtime facade.

## Validation

Passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/runner/utility-cli.test.ts`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.21 does not approve:

- checkpoint folder migration;
- retained/v1 checkpoint folder expiry;
- core-v2 resume for unmarked retained folders;
- status or handoff fallback widening;
- rollback behavior changes;
- `composeWriter` behavior changes;
- arbitrary fixture or custom-root routing changes;
- connector/materializer movement;
- router/compiler movement;
- old runtime deletion;
- old oracle test deletion.

## Next

If full validation is green, the next implementation batch can continue with a
behavior-preserving compatibility-boundary cleanup or v2/shared oracle twin.

Pause and prepare a review package before changing saved-folder semantics,
public compatibility behavior, ownership boundaries, or deletion status.
