# Core-v2 Fallback API Disposition Review

Date: 2026-05-05

## Summary

Phase 5.6 stops at a review checkpoint.

This phase does not change runtime behavior, routing, tests, or product policy.
It packages the next decisions that cannot be treated as cleanup:

- arbitrary explicit fixtures;
- programmatic `composeWriter`;
- rollback;
- unsupported public modes;
- candidate diagnostics.

These decide what compatibility promises Circuit keeps while core-v2 expands.
They should be reviewed before any deletion slice or policy-changing patch.

## Current Facts

### Runtime selection

`src/cli/circuit.ts` currently routes fresh runs through this order:

```text
CIRCUIT_V2_RUNTIME=1 strict opt-in
  -> v2 if the flow/mode/depth row is supported
  -> fail closed if unsupported or composeWriter is supplied

CIRCUIT_DISABLE_V2_RUNTIME=1 rollback
  -> retained runtime for default routing
  -> strict opt-in still wins if both flags are set

CIRCUIT_V2_RUNTIME_CANDIDATE=1 candidate diagnostics
  -> v2 only for supported rows and generated-flow fixtures
  -> retained runtime for arbitrary explicit fixtures and unsupported rows

normal default routing
  -> v2 for matrix-supported fresh rows
  -> retained runtime for everything else
```

Resume is separate:

```text
core-v2-marked folder -> core-v2 resume
retained/v1 folder -> retained resume
```

### Arbitrary explicit fixtures

Default and candidate routing keep arbitrary `--fixture` or `--flow-root`
inputs on the retained runtime unless they resolve under `generated/flows`.

Strict opt-in is the experiment path: `CIRCUIT_V2_RUNTIME=1` can run a supported
flow/mode/depth row through core-v2 even when the fixture is outside
`generated/flows`.

Current proof:

- `tests/runner/cli-v2-runtime.test.ts` proves candidate arbitrary fixtures stay
  retained and generated-flow fixtures can route through v2.
- `tests/soak/v2-runtime-surface.test.ts` proves arbitrary fixtures remain
  retained in the selector soak.

### Programmatic `composeWriter`

`main(..., { composeWriter })` is an exported programmatic hook in
`src/cli/circuit.ts`.

The retained runtime honors it. Core-v2 has no equivalent hook.

Current behavior:

```text
composeWriter supplied + normal routing -> retained runtime
composeWriter supplied + candidate diagnostics -> retained runtime
composeWriter supplied + strict v2 opt-in -> fail closed
```

Current proof:

- `tests/runner/cli-v2-runtime.test.ts` proves default retained routing and
  strict fail-closed behavior.
- `tests/soak/v2-runtime-surface.test.ts` proves the retained soak path.
- release proof scripts also call the CLI `main(...)` surface with options.

### Rollback

`CIRCUIT_DISABLE_V2_RUNTIME=1` keeps default routing on the retained runtime.

Strict opt-in deliberately wins over rollback when both flags are set, because
strict opt-in is an explicit v2 experiment.

Current proof:

- `tests/runner/cli-v2-runtime.test.ts` proves rollback for Review, Fix lite,
  Build default, and Build deep, and proves strict opt-in beats rollback.
- `tests/soak/v2-runtime-surface.test.ts` proves the same precedence in the
  automated soak.

### Unsupported public modes

Unsupported flow/mode/depth rows stay retained by default. This includes
currently unproven checkpoint/tournament/autonomous modes.

Current proof:

- `tests/runner/cli-v2-runtime.test.ts` covers unsupported public entry modes.
- `tests/soak/v2-runtime-surface.test.ts` covers retained-owned paths in the
  soak suite.

## Review Decision Needed

The next step is no longer inventory. It is product disposition.

The external review should answer:

1. Should arbitrary explicit fixtures stay retained by default, become
   strict-v2-only, fail closed, or gain a provenance/compatibility marker?
2. Should `composeWriter` get a core-v2 equivalent, stay retained behind a
   smaller compatibility module, or be deprecated?
3. Should rollback remain a long-term operator safety feature, or should it have
   a removal condition?
4. Should candidate diagnostics be removed, renamed, or kept after the current
   selector soak?
5. Which retained fallback responsibility should be narrowed first after that
   decision?

## Current Recommendation For Review

Do not delete retained runtime code yet.

Recommended posture:

- keep arbitrary explicit fixtures retained by default;
- keep strict v2 opt-in as the explicit fixture experiment lane;
- keep `composeWriter` retained until the reviewer decides whether it is a real
  API or only a test/release seam;
- keep rollback until either retained fallback is intentionally retired or old
  runtime deletion has an approved recovery path;
- remove or rename candidate diagnostics only after review, because it changes
  an operator-facing debug surface.

## Why This Needs Review

Each possible next move can break someone in a way tests alone cannot judge:

- changing arbitrary fixture behavior affects custom local flow experiments;
- changing `composeWriter` affects programmatic callers and release proof
  infrastructure;
- removing rollback changes the operator's recovery path;
- deleting retained fallback code can strand unsupported modes and old run
  folders;
- removing candidate diagnostics changes how future routing changes are soaked.

This is the review checkpoint before Phase 5.7. Implementation should wait for
external review guidance.
