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

## Guardrails

- Do not add an adapter for v1 run folders.
- Do not delete the 100+ checkpoint docs during the policy reset or code
  cutover groups.
- Batch work by numbered group, not tiny migration slices.
- Use local adversarial self-review before each numbered group.
- Preserve unrelated dirty work while cutting over.

## Immediate Next Step

Choose the next wrapper-retirement or package-surface batch. The likely next
move is to decide whether remaining old `src/runtime/**` compatibility wrappers
should stay as source-only internal import bridges, be moved behind a dedicated
compat package surface, or be removed with manifest/test updates.
