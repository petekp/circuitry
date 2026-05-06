# Circuit Core-v2 Phase 5.8.1 Runtime Decision Diagnostics Alias Review

You are reviewing `/Users/petepetrash/Code/circuit-next`.

Please review Phase 5.8.1. This is a narrow diagnostics flag rename/alias slice.
It is not an old runtime deletion proposal.

## Decision Implemented

Phase 5.8.1 implements:

```text
CIRCUIT_SHOW_RUNTIME_DECISION=1 is the preferred diagnostics flag.
CIRCUIT_V2_RUNTIME_CANDIDATE=1 remains as a temporary alias.
Either flag includes runtime/runtime_reason.
runtime_reason explains the actual selected runtime.
rollback wins the runtime_reason when rollback selects retained runtime.
strict v2 still wins over rollback.
```

No v2 support rows were added.

## Files To Review

Primary:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-candidate-diagnostics-disposition.md`
- `docs/architecture/v2-checkpoint-5.8.1.md`

Supporting:

- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Behavior To Check

Please verify:

- `showRuntimeDecision()` returns true for the new flag or old alias;
- candidate alias no longer acts as separate routing expansion;
- active CLI usage text mentions the new flag and old temporary alias;
- diagnostics plus rollback reports rollback as the actual selected runtime
  reason;
- diagnostics plus rollback plus `composeWriter` stays retained and still runs
  the retained compose writer;
- diagnostics plus rollback plus arbitrary fixture reports rollback as the
  selected runtime reason;
- strict v2 plus rollback plus diagnostics still follows strict v2;
- saved-engine resume diagnostics report the saved engine runtime;
- normal default output still omits runtime fields.

## Validation

All requested Phase 5.8.1 validation passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

## Review Questions

Please answer plainly and cite concrete files, symbols, and tests.

1. Is the alias behavior correct?
2. Does `runtime_reason` now explain the actual selected runtime in rollback
   cases?
3. Does strict v2 still correctly override rollback?
4. Is the active CLI help text now accurate?
5. Are the focused tests sufficient?
6. Is there any hidden old runtime deletion, selector widening, fixture,
   `composeWriter`, connector, registry, or runtime-internal movement?
7. What is the next safest migration slice?

Do not recommend old runtime deletion unless every retained fallback and
compatibility surface has a migration, retirement, or smaller retained-module
plan.
