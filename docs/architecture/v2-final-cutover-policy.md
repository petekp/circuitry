# Core-v2 Final Cutover Policy

Date: 2026-05-07

## Decision

The retained-runtime compatibility posture is superseded. There are zero
external users, so the product should move to a final cutover instead of
preserving old runtime compatibility for outside callers.

Do not prepare more external review packets by default. The Phase 5.60 review
packet path stops here unless a genuinely new ambiguity appears.

## Numbered Groups

1. Policy reset only. Done.
2. Code cutover. Done: retained and v1 run folders fail closed with exactly:

   ```text
   This run folder was created by the retired runtime. Start a fresh run.
   ```

3. Dead adapter cleanup. Done: the retained/v1 run-status projector and retained
   compatibility facades are deleted. The run-status dispatcher now fails closed
   for unmarked retired run folders.
4. Doc compression. Done: the tracked numbered checkpoint notes are compressed
   into `docs/architecture/v2-checkpoint-history.md`.
5. Old runtime implementation removal. Done in focused batches: old handler,
   trace, reducer, snapshot, and relay-selection implementation files are
   removed. Old runner, checkpoint, progress, and result-writer entrypoints
   remain only as fail-closed public stubs.
6. Shared-helper wrapper retirement. Done: the old `src/runtime/**` helper
   wrappers for config loading, selection, relay support, manifest snapshots,
   operator summaries, flow-kind policy, run-relative paths, disclosure,
   terminal verdicts, recovery routes, JSON reports, and fanout helper logic are
   removed. Current owners live under `src/shared/**`.
7. Registry wrapper retirement. Done: the old `src/runtime/catalog-derivations.ts`
   and `src/runtime/registries/**` wrappers are removed. Current owners live
   under `src/flows/**`.
8. Connector wrapper retirement. Done: the old `src/runtime/connectors/**`
   wrappers are removed. Current owners live under `src/connectors/**`.

## Guardrails

- Do not add an adapter for v1 run folders.
- Do not delete the 100+ checkpoint docs during the policy reset or code
  cutover groups.
- Batch work by numbered group, not tiny migration slices.
- Use local adversarial self-review before each numbered group.
- Preserve unrelated dirty work while cutting over.

## Immediate Next Step

Choose the next wrapper-retirement or package-surface batch. The old
flow-authoring, shared-helper, registry, and connector wrappers have been
removed; the likely next move is to decide whether remaining old
`src/runtime/**` run-status, result-path, runner, or type surfaces should stay
as source-only internal import bridges, be packaged, or be removed with
manifest/test updates.
