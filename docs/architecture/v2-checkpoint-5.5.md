# Phase 5.5 - Deletion Readiness Inventory

Date: 2026-05-05

## Summary

Phase 5.5 inventories deletion readiness after Build deep became the first
default-routed core-v2 checkpoint mode.

This phase is documentation-only. It does not delete old runtime code, route
more modes through core-v2, or change product policy.

## Inventory Artifact

New doc:

- `docs/architecture/v2-deletion-readiness-inventory.md`

It classifies every file under `src/runtime` as one of:

- compatibility wrapper;
- retained fallback;
- retained product behavior;
- oracle/test support;
- neutral-move candidate;
- tiny deletion candidate;
- blocker/unknown.

It also classifies retained runner and handler tests by:

- retained fallback coverage;
- oracle coverage;
- migrated to v2;
- obsolete candidate.

## Result

No `src/runtime` file is deletion-ready.

No retained runner or handler test is obsolete.

The current blockers are known, not mysterious:

- retained/v1 checkpoint folder resume;
- unsupported flow/mode/depth fallback;
- arbitrary fixture fallback;
- programmatic `composeWriter`;
- rollback;
- retained trace/reducer/snapshot/progress/status/result/checkpoint behavior;
- connector subprocesses and relay materialization;
- registries, router, catalog, and compiler infrastructure;
- retained runner/handler fallback and oracle tests.

## Review Packet

No review packet was prepared for this phase.

The prior review decision was to proceed with inventory and no deletion. A
review packet is needed only before actual deletion, risky movement, route
widening, or product-policy change.

## Validation

Phase 5.5 validation:

- `npm run check`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## Next Step

Pick one policy or ownership decision before any deletion slice:

- arbitrary fixtures;
- programmatic `composeWriter`;
- rollback;
- retained/v1 checkpoint folder support;
- neutral ownership for registries, connectors, materializer, router, catalog,
  or compiler modules.
