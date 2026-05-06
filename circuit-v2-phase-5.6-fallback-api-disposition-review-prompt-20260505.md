# Circuit core-v2 migration review: Phase 5.6 fallback API disposition

Please review the attached Phase 5.6 packet for the Circuit `core-v2`
migration.

## Decision requested

Advise the next migration move after Phase 5.5's deletion-readiness inventory.

Specifically, decide how Circuit should treat these retained fallback surfaces:

```text
arbitrary explicit fixtures
programmatic composeWriter
rollback
unsupported public modes
candidate diagnostics
```

This is a product/compatibility review. It is **not** a deletion review.

## Explicit non-approvals

Do not approve any of these from this packet:

```text
old runtime deletion
changing fixture routing
changing composeWriter behavior
removing rollback
removing or renaming candidate diagnostics
routing more modes through core-v2
moving retained trace/reducer/snapshot/progress/checkpoint/runner internals
moving connector subprocess modules
moving relay materialization
moving registries/router/catalog/compiler infrastructure
```

## Current facts

The current selector behavior is:

```text
matrix-supported fresh runs -> core-v2
unsupported rows -> retained runtime
arbitrary fixtures outside generated/flows -> retained by default/candidate
arbitrary fixtures outside generated/flows -> strict v2 experiment only
composeWriter supplied -> retained by default/candidate, strict v2 fails closed
CIRCUIT_DISABLE_V2_RUNTIME=1 -> retained default routing
CIRCUIT_V2_RUNTIME=1 + rollback -> strict v2 wins for supported fresh rows
core-v2-marked resume folder -> core-v2 resume
retained/v1 resume folder -> retained resume
```

The review packet includes:

```text
docs/architecture/v2-fallback-api-disposition-review.md
docs/architecture/v2-deletion-readiness-inventory.md
docs/architecture/v2-retained-fallback-policy.md
docs/architecture/v2-retained-checkpoint-folder-policy.md
docs/architecture/v2-deletion-plan.md
docs/architecture/v2-checkpoint-5.6.md
docs/architecture/v2-checkpoint-5.5.md
src/cli/circuit.ts
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
scripts/release/capture-golden-run-proofs.mjs
HANDOFF.md
```

## Review questions

Please answer:

1. Should arbitrary explicit fixtures remain retained by default?
2. Should arbitrary fixtures get a core-v2 provenance marker, strict-only gate,
   fail-closed policy, or no change?
3. Is `composeWriter` a real compatibility API that needs a core-v2 equivalent,
   or should it stay retained/deprecated?
4. Should rollback remain a long-term operator safety feature?
5. Should candidate diagnostics be removed, renamed, or kept after the current
   soak?
6. Which single fallback responsibility should Phase 5.7 tackle first?
7. What concrete proof should be required before any old runtime deletion slice?

## Current recommendation

Do not delete retained runtime code yet.

My current recommendation is:

```text
keep arbitrary fixtures retained by default
keep strict v2 opt-in as the explicit fixture experiment lane
keep composeWriter retained until its API status is decided
keep rollback until retained fallback has an approved retirement path
remove or rename candidate diagnostics only after review
```

The useful next implementation after review is probably a narrow policy-backed
slice, not another broad inventory.
