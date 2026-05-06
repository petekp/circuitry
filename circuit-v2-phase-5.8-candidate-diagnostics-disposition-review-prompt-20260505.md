# Circuit Core-v2 Phase 5.8 Candidate Diagnostics Disposition Review

You are reviewing `/Users/petepetrash/Code/circuit-next`.

Please review Phase 5.8 candidate diagnostics disposition. This is not a rename
implementation and not an old runtime deletion proposal.

## Decision Proposed

Phase 5.8 proposes:

```text
CIRCUIT_V2_RUNTIME_CANDIDATE=1 stays for now.
It is a temporary migration diagnostic, not a separate routing promise.
It should be renamed later to CIRCUIT_SHOW_RUNTIME_DECISION=1 or similar.
The rename needs a dedicated follow-up slice.
```

No runtime behavior changes are intended in this phase.

## Files To Review

Primary:

- `docs/architecture/v2-candidate-diagnostics-disposition.md`
- `docs/architecture/v2-checkpoint-5.8.md`
- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`

Supporting:

- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `tests/core-v2/checkpoint-resume-v2.test.ts`
- `tests/runner/build-checkpoint-exec.test.ts`

## Current Inventory Command

Phase 5.8 used this current-only inventory command before writing the new
disposition docs:

```bash
rg -n "CIRCUIT_V2_RUNTIME_CANDIDATE|useV2RuntimeCandidate|candidate diagnostics|runtime_reason|runtimeOutputFields" \
  src tests scripts docs specs README.md commands plugins .claude-plugin generated package.json
```

The disposition doc classifies each source-bearing use as selector
implementation, test coverage, diagnostic output, documentation, or history.

## Current Facts

The candidate support matrix currently aliases the default matrix:

```ts
const V2_RUNTIME_CANDIDATE_SUPPORT_MATRIX = V2_RUNTIME_SUPPORT_MATRIX;
```

So `CIRCUIT_V2_RUNTIME_CANDIDATE=1` no longer expands v2 coverage beyond
default routing. It mainly asks the CLI to include:

```text
runtime
runtime_reason
```

The current behavior remains:

- candidate plus supported fresh row -> core-v2 with runtime fields;
- candidate plus unsupported fresh row -> retained with runtime fields;
- candidate plus arbitrary explicit fixture -> retained unless under
  `generated/flows`;
- candidate plus `composeWriter` -> retained;
- candidate plus checkpoint resume -> saved engine marker wins.

## Validation

All requested Phase 5.8 validation passed:

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

1. Is it correct to classify `CIRCUIT_V2_RUNTIME_CANDIDATE=1` as a temporary
   runtime decision diagnostics flag rather than a separate routing mode?
2. Is `CIRCUIT_SHOW_RUNTIME_DECISION=1` the right future name, or should the
   future flag be named differently?
3. Should the future rename keep `CIRCUIT_V2_RUNTIME_CANDIDATE=1` as a
   temporary alias, or should it remove the old flag immediately?
4. Are all current consumers classified correctly?
5. Are the existing tests enough for this disposition slice?
6. Is there any hidden routing, rollback, fixture, composeWriter, connector,
   registry, runtime-internal, or deletion behavior change in this packet?
7. What is the next safest migration slice after this checkpoint?

Do not recommend old runtime deletion unless every retained fallback and
compatibility surface has a migration, retirement, or smaller retained-module
plan.
