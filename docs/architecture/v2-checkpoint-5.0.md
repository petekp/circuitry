# Circuit v2 Checkpoint 5.0

## Summary

Phase 5.0 adds an automated selector soak gate.

This phase changes tests and scripts only. It does not move runtime ownership,
delete old runtime files, route checkpoint resume through core-v2, change
selector behavior, remove rollback, or move high-risk runtime infrastructure.

## What Changed

Added:

- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-checkpoint-5.0.md`

Updated:

- `package.json`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`

## Commands

Added:

```json
"soak:v2:fast": "vitest run tests/soak tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity",
"soak:v2": "vitest run tests/soak && npm run verify && npm run check-flow-drift"
```

## Coverage

The soak suite covers:

- every matrix-supported fresh-run row without v2 env vars;
- retained fallback rows;
- strict v2 opt-in fail-closed behavior;
- rollback behavior and strict-over-rollback precedence;
- `runs show --json` for core-v2 run folders;
- progress JSONL schema parsing and lifecycle events;
- unsafe connector rejection before invocation;
- real custom connector bridge execution;
- Migrate child runs;
- fanout branch lifecycle progress;
- manifest snapshot, trace bootstrap, and result hash consistency.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run build`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed through `npm run soak:v2` and on sequential rerun.
- `npm run verify`: passed through `npm run soak:v2` and on final rerun after report updates.
- `git diff --check`: passed.

One parallel `npm run check-flow-drift` attempt overlapped with
`tests/unit/emit-flows-drift.test.ts` and saw that test's temporary stale
sibling file. The sequential rerun passed.

## Next

`npm run soak:v2` passed, so the default-selector milestone can be declared
complete with precise wording:

```text
core-v2 is the default for matrix-supported fresh runs.
retained runtime remains the intentional owner of checkpoint resume and
fallback behavior.
```

The next migration phase after that is a v2 checkpoint resume parity plan, not
old runtime deletion.
