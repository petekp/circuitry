# Core v2 Phase 5.15 Review Prompt

You are reviewing the `circuit-next` core-v2 migration. Please inspect the
included codebase slice and give a blocking-findings-first review.

## Context

`circuit-next` is a developer-flow runtime. The migration goal is feature parity
with a better core runtime design, not product shrinkage by surprise.

Current state:

- Generated public fresh runs now default to `core-v2` for the current catalog:
  Review default; Fix default/lite/deep/autonomous; Build
  default/lite/deep/autonomous; Explore default/lite/deep/autonomous/tournament;
  Migrate default/deep/autonomous; Sweep default/lite/deep/autonomous.
- Retained runtime is still a live compatibility carrier for arbitrary fixtures,
  custom flow roots, retained/v1 checkpoint folders, public `composeWriter`,
  rollback, old oracle tests, retained trace/status/progress/checkpoint behavior,
  connector subprocesses/materializer, and router/compiler compatibility.
- We are trying to reduce old-runtime deletion blockers with implementation and
  tests, not more inventory-only docs.
- Strong-model review should be reserved for public compatibility behavior,
  saved-state semantics, connector/materializer ownership, router/compiler
  ownership, or old runtime deletion.

## Recently Approved Baseline

Phase 5.13 moved registries/catalog derivations to neutral `src/flows/**`
ownership with old `src/runtime/**` re-exports.

Phase 5.14 added `src/compat/retained-runtime.ts` as the facade for retained
fresh-run fallback, retained/v1 checkpoint resume, retained snapshot derivation,
retained trace reading, and retained trace reduction.

The previous review approved the retained compatibility facade and recommended
Option B next: old runner/handler oracle-test mapping and migration with no
public behavior changes.

## Phase 5.15 Work Under Review

Phase 5.15 starts that oracle-test mapping lane.

Batch 1 and 2:

- moved accidental test-only relay/callback type imports to shared or retained
  facade paths;
- kept tests that intentionally execute retained `runCompiledFlow(...)`,
  `resumeCompiledFlowCheckpoint(...)`, `writeComposeReport(...)`, or old helper
  values on old runner imports;
- added a production import guard for retained execution implementation imports.

Batch 3:

- added `tests/core-v2/control-loop-v2.test.ts`;
- proved v2 terminal target outcome mapping;
- proved v2 relay verdict admission uses the connector body, including non-first
  `check.pass` members;
- fixed `src/core-v2/executors/relay.ts` so `relay.completed.data.admitted` is
  recorded and failed relay checks do not leak rejected/malformed verdicts into
  final `reports/result.json`.

Batch 4:

- extended production v2 relay evidence so `relay.started.data.resolved_from`
  records connector resolution provenance;
- added v2 proof for connector identity/provenance in
  `tests/core-v2/control-loop-v2.test.ts` and `tests/core-v2/connectors-v2.test.ts`.

Batch 5:

- added v2 checkpoint-route twins for rich route labels and bounded retry loops;
- proved checkpoint selections route through their declared labels instead of
  collapsing to `pass`;
- proved retry loops stop at `budgets.max_attempts`.

## Validation Reported By Implementing Agent

The implementing agent reports these passed after the final batch:

```bash
npm run check
npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts tests/runner/terminal-outcome-mapping.test.ts
npm run lint
npm run build
npm run verify
git diff --check
```

`npm run verify` reported:

```text
126 test files passed
1395 tests passed
6 skipped
generated flow drift checks passed
release infra checks passed
```

## Review Scope

Please review only the included files. Focus on whether Phase 5.15 is safe to
keep and what the next implementation checkpoint should be.

Allowed in this phase:

- v2 tests for old retained oracle behavior that core-v2 already owns;
- narrow core-v2 trace/result correctness fixes;
- import-boundary cleanup in tests;
- docs/worklog/handoff updates that reflect implementation.

Not approved by this phase:

- old runtime deletion;
- old runner/handler test deletion;
- public `composeWriter` behavior changes;
- rollback changes;
- arbitrary external fixture or custom-root v2 default routing;
- retained/v1 checkpoint folder semantic changes;
- connector subprocess or relay materializer movement;
- router/catalog/compiler movement.

## Files To Inspect First

Start with:

- `docs/architecture/v2-checkpoint-5.15.md`
- `HANDOFF.md`
- `src/core-v2/executors/relay.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `docs/architecture/v2-runner-handler-test-classification.md`

Then compare against retained oracles:

- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/runner/check-evaluation.test.ts`
- `tests/runner/runner-relay-provenance.test.ts`
- `tests/runner/runner-relay-connector-identity.test.ts`
- `tests/runner/pass-route-cycle-guard.test.ts`

Then inspect public compatibility boundaries:

- `src/cli/circuit.ts`
- `src/compat/retained-runtime.ts`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-retained-checkpoint-folder-policy.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`

## Questions To Answer

1. Are there blocking correctness findings in Phase 5.15?
2. Is `relay.completed.data.admitted` the right way to prevent failed relay
   verdicts from entering final v2 results?
3. Is `relay.started.data.resolved_from` the right evidence shape for connector
   provenance, or should it be placed elsewhere?
4. Do the new v2 twin tests actually cover retained oracle intent, without
   pretending the retained tests are obsolete?
5. Did this slice accidentally change public compatibility behavior, selector
   policy, arbitrary/custom root routing, rollback, `composeWriter`,
   retained/v1 checkpoint folders, connector ownership, or old runtime deletion
   status?
6. Are the docs/handoff accurate enough for the next agent?
7. What should the next implementation checkpoint be?
8. Does the next checkpoint require review before implementation?

## Desired Output

Use this structure:

```text
Executive verdict

Blocking findings
- [severity] file:line - finding

Non-blocking notes

Direct answers to questions 1-8

Recommended next checkpoint
- goal
- files likely touched
- tests required
- validation commands
- whether review is required before implementation

Old runtime deletion status
```

Be strict about separating verified facts from inference. Cite concrete files,
symbols, and line numbers wherever possible.
