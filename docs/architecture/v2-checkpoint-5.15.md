# Phase 5.15 - Oracle Test Import Boundary Batches

Date: 2026-05-06

## Summary

Phase 5.15 starts the old runner/handler oracle-test mapping lane without
changing public behavior.

This slice does not delete old runner or handler tests. It removes accidental
test dependence on old runtime type/helper import paths where the test only
needs shared relay contracts, and it adds a production import guard for retained
execution implementation imports.

The second batch continues the same lane by splitting retained-runner execution
imports from shared/facade type imports inside retained runner and direct handler
tests. Tests that intentionally execute `runCompiledFlow(...)`,
`resumeCompiledFlowCheckpoint(...)`, `writeComposeReport(...)`, or old runner
helper functions still import those retained values from `src/runtime/runner.ts`.
Callback/data types now come from `src/shared/**` or
`src/compat/retained-runtime.ts`.

The third batch adds v2 control-loop twin tests for old retained oracle behavior
that core-v2 already owns: terminal target outcome mapping and relay verdict
check admission. That proof found and fixed a narrow v2 correctness gap:
`relay.completed` now records whether the relay verdict was admitted, so failed
relay checks do not leak rejected or malformed verdicts into the final
`reports/result.json`.

The fourth batch extends the same v2 proof to connector identity and connector
provenance. Production core-v2 relay traces now record both the resolved
connector and the connector resolution source in `relay.started`.

The fifth batch adds v2 twins for rich checkpoint route labels and bounded
retry loops. These tests prove core-v2 executes checkpoint selections through
their declared route labels instead of collapsing them to `pass`, and aborts
retry loops at the configured attempt budget.

## Behavior

Core-v2 relay completion trace detail changed for correctness:

```text
relay.completed.data.admitted = true | false
relay.started.data.resolved_from = { source: ... }
```

The final v2 result already reads the latest admitted relay or sub-run verdict.
This trace detail makes failed relay checks explicit and prevents rejected or
malformed relay outputs from being treated as admitted verdicts.

The `relay.started` provenance detail records the same connector-resolution
reason core-v2 already computes internally.

The public selector, rollback, arbitrary fixture policy, custom-root policy,
trusted plugin mirror policy, retained/v1 checkpoint folder policy, and
`composeWriter` behavior are unchanged.

## Files Changed

- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/cli-router.test.ts`
- `tests/runner/config-loader.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- runner/contract tests that only needed `RelayResult`
- retained runner and direct handler tests with type-only runner imports
- `src/core-v2/executors/relay.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-checkpoint-5.15.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/runner/retained-compat-facade.test.ts` now scans production source under
`src/` and fails if non-runtime production code imports retained execution
implementation modules directly instead of going through
`src/compat/retained-runtime.ts`.

The first import cleanup moves tests that only need shared relay data types from
old runtime compatibility paths to:

```text
src/shared/connector-relay.ts
src/shared/relay-runtime-types.ts
src/compat/retained-runtime.ts
```

It also moves casual `sha256Hex` helper imports to
`src/shared/connector-relay.ts`, leaving
`tests/runner/connector-shared-compat.test.ts` as the explicit old-path
compatibility proof.

Tests that intentionally execute the retained runner or prove old public import
compatibility still import retained runtime paths.

The follow-up import split moved type-only retained runner imports such as:

```text
RelayFn
RelayInput
ChildCompiledFlowResolver
CompiledFlowInvocation
CompiledFlowRunResult
CompiledFlowRunner
WorktreeRunner
```

to shared/facade modules in runner, direct handler, and contract tests. The
remaining `src/runtime/runner.ts` imports in those tests are value-level retained
execution or old helper calls.

`tests/core-v2/control-loop-v2.test.ts` now proves:

- all v2 terminal targets map to the retained terminal outcome vocabulary;
- v2 relay checks admit the actual connector verdict, including non-first
  `check.pass` members;
- rejected, unparseable, or missing relay verdicts do not appear in the final
  run result as admitted verdicts.
- production v2 relay traces carry connector identity and explicit connector
  provenance.
- v2 checkpoint route labels map through the graph runner, including terminal
  routes for ask/retry/revise/stop/handoff/escalate;
- v2 checkpoint retry loops honor `budgets.max_attempts`.

## Non-Approvals

Phase 5.15 does not approve:

- old runtime deletion;
- old runner/handler test deletion;
- public `composeWriter` behavior changes;
- rollback changes;
- arbitrary fixture or custom-root v2 default routing;
- retained/v1 checkpoint folder policy changes;
- connector subprocess or relay materializer movement;
- router/catalog/compiler movement.

## Validation

Passed so far in this checkpoint:

- `npm run check`
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts tests/runner/config-loader.test.ts tests/contracts/codex-host-plugin.test.ts tests/runner/cli-router.test.ts`
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/build-checkpoint-exec.test.ts tests/runner/codex-connector-smoke.test.ts tests/runner/agent-relay-roundtrip.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/connector-shared-compat.test.ts`
- `npx vitest run tests/runner/terminal-outcome-mapping.test.ts tests/runner/fanout-runtime.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/explore-tournament-runtime.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/runner/build-checkpoint-exec.test.ts tests/runner/fanout-real-recursion.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fresh-run-root.test.ts tests/runner/sub-run-real-recursion.test.ts tests/runner/build-report-writer.test.ts tests/runner/runtime-smoke.test.ts tests/runner/explore-report-writer.test.ts tests/runner/build-runtime-wiring.test.ts tests/runner/runner-relay-connector-identity.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/pass-route-cycle-guard.test.ts tests/runner/check-evaluation.test.ts tests/runner/terminal-verdict-derivation.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/run-relative-path.test.ts tests/runner/push-sequence-authority.test.ts tests/runner/build-verification-exec.test.ts tests/runner/sweep-runtime-wiring.test.ts tests/runner/review-runtime-wiring.test.ts tests/runner/materializer-schema-parse.test.ts tests/contracts/flow-model-effort.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/relay-invocation-failure.test.ts tests/runner/sub-run-handler-direct.test.ts tests/runner/fanout-handler-direct.test.ts`
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts tests/core-v2/default-executors-v2.test.ts tests/runner/check-evaluation.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/pass-route-cycle-guard.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/runner-relay-connector-identity.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts tests/runner/terminal-outcome-mapping.test.ts`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Next

Continue this lane with more low-risk test mapping:

- move remaining type-only imports to shared/facade paths when they are not
  testing old public import compatibility;
- add v2/shared twin tests for old oracle cases that are already v2-owned;
- keep direct retained runner and handler tests until the retained behavior is
  migrated, explicitly kept in compatibility, or retired by product decision.

Public behavior decisions for `composeWriter`, rollback, arbitrary fixtures, and
custom roots still need review before implementation.
