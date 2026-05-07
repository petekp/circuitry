# Core-v2 Architecture History

Date: 2026-05-07

## Compression

The named v2 architecture notes that described retained-runtime planning have
been removed from the active docs. Their detailed contents remain available in
git history. The implementation narrative remains in
`docs/architecture/v2-worklog.md`.

This compression covers these removed named notes:

- `v2-arbitrary-fixture-policy.md`
- `v2-candidate-diagnostics-disposition.md`
- `v2-checkpoint-resume-ownership-plan.md`
- `v2-checkpoint-resume-parity-plan.md`
- `v2-close-result-finalization-proposal.md`
- `v2-compose-writer-disposition.md`
- `v2-connector-materializer-plan.md`
- `v2-fallback-api-disposition-review.md`
- `v2-heavy-boundary-plan.md`
- `v2-phase-2-notes.md`
- `v2-phase-4-notes.md`
- `v2-phase-5-notes.md`
- `v2-phase-6-notes.md`
- `v2-result-writer-plan.md`
- `v2-retained-checkpoint-folder-policy.md`
- `v2-retained-checkpoint-resume-shrink-proposal.md`
- `v2-retained-fallback-policy.md`
- `v2-retained-progress-contract-plan.md`
- `v2-retained-runner-boundary-plan.md`
- `v2-retained-runtime-boundary.md`
- `v2-rigor-audit.md`
- `v2-runner-handler-current-import-inventory.md`
- `v2-runner-handler-test-classification.md`
- `v2-runtime-import-inventory.md`
- `v2-selector-soak-checklist.md`
- `v2-selector-soak-report.md`
- `v2-trace-progress-checkpoint-boundary-plan.md`
- `v2-trace-status-progress-plan.md`

## Why

Those notes were useful while the project was preserving retained-runtime
compatibility. They are now actively misleading as living docs because the
product decision changed: there are zero external users, old runtime adapters
are not supported, and retired run folders fail closed.

## Current Reading Path

Use these living docs instead:

- `docs/architecture/v2-final-cutover-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-public-runtime-import-path-policy.md`
- `docs/architecture/v2-checkpoint-history.md`
- `docs/architecture/v2-worklog.md`

## Milestones Preserved

- Phase 2 introduced the compiled-flow to executable-flow conversion path.
- Phase 4 proved complex-flow parity and mapped the high-risk runtime
  boundaries before moving code.
- Phase 5 proved checkpoint resume, selector defaulting, generated-flow parity,
  connector safety, and wrapper retirement.
- Final cutover retired retained-runtime compatibility instead of adapting old
  run folders.

## Rule Going Forward

Do not add another broad planning packet for old runtime compatibility. If a new
ambiguity appears, add a short named decision note that states the current
policy, the concrete ambiguity, the chosen behavior, and the verification path.
