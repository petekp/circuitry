# Phase 5.12 - Retained Checkpoint Folder Compatibility Proof

Date: 2026-05-05

## Summary

Phase 5.12 adds explicit proof that retained/v1 checkpoint folders remain
retained-owned while core-v2 checkpoint folders remain marker-owned.

This is a compatibility proof slice, not a deletion slice. It does not migrate
old checkpoint folders to core-v2 and does not delete retained checkpoint
internals.

## Behavior

No production behavior changed.

The intended policy remains:

```text
core-v2-marked checkpoint folder -> core-v2 resume/status path
retained/v1 checkpoint folder -> retained resume/status path
corrupt unmarked retained folder -> retained error path, not v2 fallback
```

## Files Changed

- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-checkpoint-5.12.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/runner/build-checkpoint-exec.test.ts` now proves:

- an actual retained waiting checkpoint folder projects through `runs show`;
- the retained projection advertises `inspect` and `resume`;
- the same folder resumes through retained compatibility when rollback and
  runtime diagnostics are enabled;
- the resume output reports `runtime: "retained"` and
  `runtime_reason: "checkpoint resume remains on the retained runtime"`.

`tests/runner/utility-cli.test.ts` now proves:

- handoff continuity can still bind to retained waiting folders;
- a corrupted unmarked retained folder fails through the retained trace error
  path instead of being saved through the marker-gated v2 run-status fallback.

Existing core-v2 tests continue to prove that core-v2-marked checkpoint folders
resume through `resumeCompiledFlowV2`, including when default v2 routing is
disabled.

## Non-Approvals

Phase 5.12 does not approve:

- old runtime deletion;
- retained/v1 checkpoint folder migration to core-v2;
- arbitrary fixture or custom-root v2 default routing;
- `composeWriter` behavior changes;
- rollback removal;
- connector subprocess movement;
- relay materializer movement;
- registry, router, catalog, or compiler movement.

## Validation

Passed in this checkpoint:

- `npm run check`
- `npm run lint`
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/utility-cli.test.ts tests/core-v2/checkpoint-resume-v2.test.ts tests/runner/run-status-projection.test.ts`
- `npm run verify`
- `git diff --check`

## Next

The release proof's retained compose writer dependency is already gone in the
current tree: the Fix proof uses internal v2 executor injection and the release
test asserts that the proof script no longer imports `dist/runtime/runner.js` or
passes `composeWriter`.

The next checkpoint should be a consolidated compatibility review, not a small
implementation slice. The remaining blockers are public or architectural:
public `composeWriter`, rollback, arbitrary/custom roots, retained/v1 checkpoint
folder policy, connector/materializer ownership, registry/router/catalog/compiler
ownership, and old oracle-test disposition.
