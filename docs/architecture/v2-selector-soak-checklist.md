# Circuit v2 Selector Soak Checklist

Phase 4.42 starts selector soak after the retained-runtime boundary decision.
Phase 5.0 adds the automated soak gate.

The goal is operational confidence, not more runtime movement.

## Milestone Under Soak

```text
Matrix-supported fresh runs default to core-v2.
Retained runtime intentionally owns checkpoint resume, checkpoint-waiting
depths that are not v2 candidates, unsupported modes, arbitrary fixtures,
programmatic composeWriter fallback, rollback, and old oracle coverage.
```

## Matrix-Supported Fresh Runs

| Flow path | Default owner | Automated coverage | Soak status | Notes |
|---|---|---|---|---|
| Review default | core-v2 | `tests/runner/cli-v2-runtime.test.ts`, `tests/parity/review-v2.test.ts` | Ready for normal use | Default selector should omit normal runtime diagnostics. |
| Fix lite | core-v2 | `tests/runner/cli-v2-runtime.test.ts` | Ready for normal use | Bare unsupported Fix modes remain retained fallback. |
| Build default | core-v2 | `tests/runner/cli-v2-runtime.test.ts`, `tests/parity/build-v2.test.ts` | Ready for normal use | Standard Build remains a non-checkpoint close path. |
| Build lite | core-v2 | `tests/runner/cli-v2-runtime.test.ts` | Ready for normal use | Depth-bound selection behavior remains covered by wiring tests. |
| Build deep | core-v2 | `tests/runner/cli-v2-runtime.test.ts`, `tests/soak/v2-runtime-surface.test.ts` | Ready for normal use | First default-routed checkpoint mode. Build has no current tournament entry mode. |
| Explore default | core-v2 | `tests/runner/cli-v2-runtime.test.ts`, `tests/parity/explore-v2.test.ts` | Ready for normal use | Tournament remains retained unless separately proven. |
| Migrate default | core-v2 | `tests/runner/cli-v2-runtime.test.ts`, `tests/parity/migrate-v2.test.ts` | Ready for normal use | Write-capable disclosure remains shared. |
| Sweep default | core-v2 | `tests/runner/cli-v2-runtime.test.ts`, `tests/parity/sweep-v2.test.ts` | Ready for normal use | Fanout aggregate behavior has v2 coverage. |

## Retained Boundaries

| Path | Owner | Automated coverage | Soak status | Notes |
|---|---|---|---|---|
| Checkpoint resume for retained/v1 folders | retained runtime | `tests/runner/build-checkpoint-exec.test.ts` | Intentional retained boundary | Saved retained folders still resume through retained runtime. |
| Checkpoint-waiting depths not in v2 matrix | retained runtime | `tests/runner/cli-v2-runtime.test.ts`, `tests/runner/run-status-projection.test.ts` | Intentional retained boundary | Build deep is v2-owned. Other checkpoint/tournament modes still need separate proof. |
| Unsupported flow/mode/depth | retained runtime | `tests/runner/cli-v2-runtime.test.ts` | Intentional retained boundary | Unsupported combinations should not silently route to v2. |
| Arbitrary fixture fallback | retained runtime | `tests/runner/cli-v2-runtime.test.ts` | Intentional retained boundary | Strict v2 opt-in may still force fixture experiments. |
| Programmatic `composeWriter` | retained runtime | `tests/runner/cli-v2-runtime.test.ts` | Intentional retained boundary | Preserves exported `main(...)` behavior. |
| Rollback | retained runtime | `tests/runner/cli-v2-runtime.test.ts` | Ready for operator use | `CIRCUIT_DISABLE_V2_RUNTIME=1` must keep working. |
| Handoff continuity for retained and core-v2 waiting runs | neutral status plus retained snapshot fallback | `tests/runner/utility-cli.test.ts` | Ready for normal use | Core-v2 fallback is marker-gated; malformed retained folders do not silently take the v2 status path. |

## Operator Surfaces

| Surface | Coverage | Soak status | Notes |
|---|---|---|---|
| `runs show` for retained run folders | `tests/runner/run-status-projection.test.ts` | Ready for normal use | Public facade is `src/run-status/project-run-folder.ts`. |
| `runs show` for marked core-v2 run folders | `tests/runner/run-status-projection.test.ts` | Ready for normal use | v2 detection requires the explicit `engine: core-v2` marker. |
| Progress JSONL | `tests/contracts/progress-event-schema.test.ts`, `tests/unit/runtime/progress-projector.test.ts`, core-v2 progress tests | Ready for normal use | Retained and v2 projection internals remain separate. |
| Operator summary | `tests/runner/operator-summary-writer.test.ts`, CLI runtime tests | Ready for normal use | Shared writer remains used by both paths. |
| Connector safety | connector schema tests, connector smoke tests, CLI runtime tests | Watch during soak | Subprocess modules and materialization remain in runtime namespace. |
| Child runs | `tests/core-v2`, `tests/parity`, retained sub-run tests | Watch during soak | Retained recursion still owns unsupported fallback paths. |
| Fanout | `tests/core-v2`, `tests/parity`, retained fanout tests | Watch during soak | v2 and retained behavior both remain covered. |

## Soak Routine

After selector-adjacent changes, run:

```bash
npm run soak:v2:fast
npm run soak:v2
```

`npm run soak:v2` is the milestone gate. It runs the focused soak suite,
`npm run verify`, and generated-flow drift checks.

The expanded manual equivalent is:

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/soak
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/core-v2 tests/parity
npm run test:fast
npm run check-flow-drift
npm run verify
git diff --check
```

Record any selector, result, progress, status, connector, child-run, fanout, or
rollback difference in `docs/architecture/v2-worklog.md`.

## Review Trigger

No heavy review is needed for ordinary soak updates.

Request focused review before:

- routing checkpoint resume through core-v2;
- moving trace, reducer, snapshot, checkpoint, or progress internals;
- moving connector subprocess modules or relay materialization;
- moving registries, router, catalog, or compiler ownership;
- deleting old runtime files;
- removing rollback;
- changing retained fallback policy.
