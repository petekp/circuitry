# Core-v2 Checkpoint History

Date: 2026-05-07

## Compression

The numbered per-checkpoint notes were removed from the active docs during the
final cutover cleanup. Their detailed contents remain available in git history.
The batch-by-batch narrative remains in `docs/architecture/v2-worklog.md`.

This compression covers the tracked numbered files matching:

```text
docs/architecture/v2-checkpoint-[0-9]*.md
```

The named checkpoint-resume planning docs stay in place because they are still
descriptive planning records, not numbered review packets.

## Why

The retained-runtime compatibility posture is superseded. There are zero
external users. The project no longer needs a long chain of external review
packets to preserve old runtime compatibility.

Do not recreate numbered checkpoint docs by default. If a genuinely new
ambiguity appears, write a short named decision note instead.

## Milestones

- The early work defined v2 principles, a minimal core-v2 run substrate, and a
  conversion path from current compiled flows.
- The middle work proved parity across generated public flows, sub-runs, fanout,
  connector safety, checkpoint pause/resume, status projection, and progress.
- The later work moved shared helpers and flow-owned registries out from old
  runtime ownership while keeping compatibility wrappers where they were still
  needed.
- The final cutover work reset policy, made retired run folders fail closed,
  replaced old runner/checkpoint/progress/result entrypoints with fail-closed
  stubs, and removed the retained handler, trace, reducer, snapshot, and relay
  selection implementation code.

## Living Docs

Use these instead of the old numbered shards:

- `docs/architecture/v2-final-cutover-policy.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-worklog.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-checkpoint-resume-ownership-plan.md`
- `docs/architecture/v2-checkpoint-resume-parity-plan.md`
