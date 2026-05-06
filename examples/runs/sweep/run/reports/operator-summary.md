# Circuit Summary

Circuit finished Sweep with outcome complete. Deferred: 1 item.

## What Happened

- Selected flow: `sweep`
- Outcome: `complete`
- Routed by: `classifier`
- Router reason: matched cleanup prefix; routed to Sweep flow

## Details

- Worker access: This flow may invoke a write-capable Claude Code worker. Circuit will verify and review the result, but the worker can edit files in this checkout.
- Run note: Run closed with outcome complete via @complete.
- Result: remove safe dead code: Acted on the safe cleanup candidate and deferred the risky one.

## Evidence Warnings

- None

## Run Files

- Run folder: <repo>/examples/runs/sweep/run
- Result path: <repo>/examples/runs/sweep/run/reports/result.json

## Reports

- Run result: <repo>/examples/runs/sweep/run/reports/result.json
- sweep result: <repo>/examples/runs/sweep/run/reports/sweep-result.json
- sweep.brief: <repo>/examples/runs/sweep/run/reports/sweep/brief.json — sweep.brief@v1
- sweep.analysis: <repo>/examples/runs/sweep/run/reports/sweep/analysis.json — sweep.analysis@v1
- sweep.queue: <repo>/examples/runs/sweep/run/reports/sweep/queue.json — sweep.queue@v1
- sweep.batch: <repo>/examples/runs/sweep/run/reports/sweep/batch.json — sweep.batch@v1
- sweep.verification: <repo>/examples/runs/sweep/run/reports/sweep/verification.json — sweep.verification@v1
- sweep.review: <repo>/examples/runs/sweep/run/reports/sweep/review.json — sweep.review@v1
