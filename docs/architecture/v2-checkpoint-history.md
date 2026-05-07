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

Named planning notes were compressed separately into
`docs/architecture/v2-architecture-history.md`.

## Why

The retained-runtime compatibility posture is superseded. There are zero
external users. The project no longer needs a long chain of checkpoint packets
or compatibility-preserving review notes.

Do not recreate numbered checkpoint docs by default. If a genuinely new
ambiguity appears, write a short named decision note instead.

## Milestones

- The early work defined v2 principles, a minimal core-v2 run substrate, and a
  conversion path from compiled flows.
- The middle work proved parity across generated public flows, sub-runs,
  fanout, connector safety, checkpoint pause/resume, status projection, and
  progress.
- The later work moved shared helpers, connectors, and flow-owned registries to
  neutral owners outside old runtime paths.
- The final cutover reset policy, made retired run folders fail closed, removed
  old runtime implementation files, and retired the remaining old public runtime
  import paths.

## Living Docs

Use these instead of the old checkpoint shards:

- `docs/architecture/v2-final-cutover-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-public-runtime-import-path-policy.md`
- `docs/architecture/v2-architecture-history.md`
- `docs/architecture/v2-worklog.md`
