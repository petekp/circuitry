# Circuit Summary

Circuit finished Migrate with outcome complete. Verification: passed. Review: cutover-approved.

## What Happened

- Selected flow: `migrate`
- Outcome: `complete`
- Routed by: `explicit`
- Router reason: explicit flow positional argument

## Details

- Worker access: This flow may invoke a write-capable Claude Code worker. Circuit will verify and review the result, but the worker can edit files in this checkout.
- Run note: Run closed with outcome complete via @complete.
- Result: replace a small legacy API: Cutover approved for the synthetic migration proof.
- Verification: passed
- Review verdict: cutover-approved

## Evidence Warnings

- None

## Run Files

- Run folder: <repo>/examples/runs/migrate/run
- Result path: <repo>/examples/runs/migrate/run/reports/result.json

## Reports

- Run result: <repo>/examples/runs/migrate/run/reports/result.json
- migrate result: <repo>/examples/runs/migrate/run/reports/migrate-result.json
- migrate.brief: <repo>/examples/runs/migrate/run/reports/migrate/brief.json — migrate.brief@v1
- migrate.inventory: <repo>/examples/runs/migrate/run/reports/migrate/inventory.json — migrate.inventory@v1
- migrate.coexistence: <repo>/examples/runs/migrate/run/reports/migrate/coexistence.json — migrate.coexistence@v1
- migrate.batch: <repo>/examples/runs/migrate/run/reports/migrate/batch-result.json — migrate.batch@v1
- migrate.verification: <repo>/examples/runs/migrate/run/reports/migrate/verification.json — migrate.verification@v1
- migrate.review: <repo>/examples/runs/migrate/run/reports/migrate/review.json — migrate.review@v1
