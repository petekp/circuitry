# Core-v2 Final Cutover Policy

Date: 2026-05-07

## Decision

The retained-runtime compatibility posture is superseded. There are zero
external users, so Circuit has moved to final cutover instead of preserving old
runtime compatibility for outside callers.

Do not prepare more external review packets by default. The Phase 5.60 review
packet path stops here unless a genuinely new ambiguity appears.

## Current Policy

- Supported fresh runs execute through core-v2.
- Core-v2 marked checkpoint folders resume through core-v2.
- Retained and v1 run folders fail closed with exactly:

  ```text
  This run folder was created by the retired runtime. Start a fresh run.
  ```

- Do not add an adapter for v1 run folders.
- Unsupported or unproven invocations fail closed until they are explicitly
  proven through core-v2.
- Rollback to the retired runtime is no longer a supported execution path.

## Completed Groups

1. Policy reset.
2. Retained/v1 folder fail-closed cutover.
3. Dead adapter cleanup.
4. Numbered checkpoint note compression.
5. Old runtime implementation removal.
6. Flow-authoring wrapper retirement.
7. Shared-helper wrapper retirement.
8. Registry wrapper retirement.
9. Connector wrapper retirement.
10. Run-status, progress, result, checkpoint, and public runner surface
    retirement.
11. Final named-note doc compression.

## Guardrails

- Batch work by numbered group, not tiny migration slices.
- Use local adversarial self-review before each numbered group.
- Preserve unrelated dirty work while cutting over.
- Write a short named decision note only when a genuinely new ambiguity appears.

## Living Docs

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-public-runtime-import-path-policy.md`
- `docs/architecture/v2-checkpoint-history.md`
- `docs/architecture/v2-architecture-history.md`
- `docs/architecture/v2-worklog.md`
