# Phase 5.16 - Relay Recovery And Report Gating Twins

Date: 2026-05-06

## Summary

Phase 5.16 continues the low-risk old-oracle mapping lane after the Phase 5.15
review. It adds core-v2 twins for relay recovery, canonical report gating, and
connector invocation failure behavior that retained runner tests already protect.

This is not a public behavior change. It does not widen selectors, change
rollback, change `composeWriter`, change arbitrary fixture/custom-root policy,
change retained/v1 checkpoint folder policy, move connector/materializer
ownership, or delete old runtime code.

## Behavior

Core-v2 production relay trace evidence is now stricter:

```text
relay.completed.report_path is emitted only when the relay result was admitted
```

Canonical report writing already had this gate. The trace now matches the file
system evidence: transcript files remain durable for failed relay attempts, but
the admitted report path appears only when the canonical report is actually
eligible to be written.

## Files Changed

- `src/core-v2/executors/relay.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.16.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/control-loop-v2.test.ts` now proves:

- failed relay checks can route through a declared recovery route such as
  `retry`;
- rejected relay verdicts remain excluded from final `reports/result.json`;
- failed relay checks with `writes.report` keep request/receipt/result
  transcript files but do not write the canonical admitted report;
- passing relay checks with `writes.report` write the canonical report and emit
  `relay.completed.report_path`;
- connector invocation failures route through declared recovery when available;
- connector invocation failures without recovery abort cleanly and leave the
  final verdict empty.

The retained oracle references remain:

- `tests/runner/check-evaluation.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/runner/pass-route-cycle-guard.test.ts`

These retained tests are still live compatibility/oracle proof. Phase 5.16 adds
v2 twins; it does not retire the retained tests.

## Validation

Passed:

- `npm run check`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts`
- `npx vitest run tests/runner/check-evaluation.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/pass-route-cycle-guard.test.ts`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `npm run verify`

## Next

Continue implementation-first oracle mapping only while the next slice stays
inside behavior core-v2 already owns. Pause for review before any public
compatibility decision: `composeWriter`, rollback, arbitrary fixtures, custom
roots, retained/v1 folders, connector/materializer ownership, router/compiler
ownership, or old runtime deletion.
