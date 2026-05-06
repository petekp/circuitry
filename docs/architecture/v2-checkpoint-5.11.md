# Phase 5.11 - Explore Tournament Default Routing

Date: 2026-05-05

## Summary

Phase 5.11 routes Explore tournament fresh runs through core-v2 by default.

This is a parity slice, not a deletion slice. It does not change arbitrary
fixtures, custom flow roots, rollback, retained/v1 checkpoint folders,
`composeWriter`, connector ownership, registry ownership, or old runtime
deletion.

## Behavior Changed

`src/cli/circuit.ts` now includes:

```text
explore + tournament depth -> core-v2 selector matrix
```

The route change is backed by a correctness hardening slice in v2 fanout:

- relay fanout branches with compiled-flow context use the production relay
  prompt path;
- branch prompts include synthetic step ids such as
  `proposal-fanout-step-option-1`;
- branch relay execution uses the public `relayer` when supplied;
- accepted branch reports run parse/schema, provenance, and cross-report
  validation before admission;
- rejected branch reports are not written;
- production relay fanout branches write retained-compatible `request.txt`,
  `receipt.txt`, `result.json`, and `report.json` artifacts.

V2 tournament checkpoint projection now enriches operator context from:

```text
reports/decision-options.json
reports/tournament-review.json
```

so progress JSONL and `runs show` expose real option labels and the tournament
tradeoff question instead of only generic option names.

## Files Changed

- `src/cli/circuit.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/projections/tournament-checkpoint-context.ts`
- `src/run-status/v2-run-folder.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-checkpoint-5.11.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/fanout-v2.test.ts` proves:

- compiled relay fanout branches use production relayer prompts;
- invalid JSON, schema failures, provenance mismatches, and cross-report
  validator failures abort branches;
- rejected branches do not write admitted branch reports.

`tests/parity/explore-v2.test.ts` proves:

- generated `generated/flows/explore/tournament.json` reaches a v2 waiting
  checkpoint with normal v2 executors;
- four tournament branch reports are admitted and aggregated;
- tournament review writes the tradeoff question;
- progress and run-status projection show real option labels;
- marker-gated v2 resume with `option-2` writes final decision/result reports.

`tests/runner/cli-v2-runtime.test.ts` and `tests/soak/v2-runtime-surface.test.ts`
prove:

- `circuit-next run explore --mode tournament` defaults to core-v2;
- rollback still forces retained runtime;
- strict unsupported invocations still fail closed for unsupported flows;
- Explore tournament wait/resume closes through core-v2 in the CLI and soak
  surfaces.

## Non-Approvals

Phase 5.11 does not approve:

- old runtime deletion;
- arbitrary fixture or custom-root v2 default routing;
- `composeWriter` behavior changes;
- rollback removal;
- retained/v1 checkpoint folder migration;
- connector subprocess movement;
- relay materializer movement;
- registry, router, catalog, or compiler movement;
- trace, reducer, snapshot, progress, checkpoint, runner, or handler deletion.

## Validation

Passed in this checkpoint:

- `npx vitest run tests/core-v2/fanout-v2.test.ts tests/parity/explore-v2.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/core-v2/fanout-v2.test.ts tests/parity/explore-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run soak:v2:fast`
- `npx vitest run tests/runner/cli-router.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run soak:v2`
- `git diff --check`

`npm run soak:v2` includes full `npm run verify` and `npm run check-flow-drift`.
The full run passed after adding explicit timeouts to long matrix-style runner
tests that exceeded Vitest's default 5 second limit under full-suite load.

## Review Result

Approved. No blocking findings were found in the included Phase 5.11 files.

The approval is scoped to generated Explore tournament through normal
compiled-flow core-v2 execution. It does not approve arbitrary fixtures, custom
flow roots, connector relocation, old runtime deletion, or public compatibility
changes.

The reviewer noted two non-blocking follow-ups:

- the internal `relayConnector` fallback path remains lower-parity than the
  production compiled-flow branch path, which is acceptable because generated
  Explore tournament uses the compiled-flow path;
- `relay.completed` trace details can still include a declared `report_path`
  before validation decides not to write the report. Report write gating is
  correct, but the trace detail could be cleaned later if any consumer treats it
  as proof of file existence.

## Next

The next implementation checkpoint should move from default routing to retained
compatibility proof. The highest-leverage next slice is retained/v1 checkpoint
folder compatibility: prove that old folders still use retained resume/status
and that core-v2-marked folders still use core-v2 resume/status.

Do not start old runtime deletion yet.
