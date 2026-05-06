# Phase 5.22 - Public Compatibility Policy Source

Date: 2026-05-06

## Summary

Phase 5.22 centralizes public compatibility policy copy without changing
runtime behavior.

The new module is:

```text
src/cli/runtime-compatibility-policy.ts
```

It owns the live strings for:

- explicit fixture/custom-root retained routing;
- programmatic `composeWriter` retained compatibility;
- rollback retained routing;
- retained and core-v2 checkpoint resume reasons;
- CLI runtime routing usage text;
- `circuit-next create` custom-root runtime policy text.

This keeps the runtime reason strings, CLI usage text, and create summaries from
drifting apart.

## Files Changed

- `src/cli/runtime-compatibility-policy.ts`
- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-checkpoint-5.22.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`src/cli/circuit.ts` now imports `RUNTIME_POLICY_REASONS`,
`CLI_RUNTIME_ROUTING_POLICY`, and `GENERATED_FLOW_MIRROR_ROOT_ENV` from the
policy module.

`src/cli/create.ts` now imports `CUSTOM_FLOW_ROOT_RUNTIME_POLICY` from the same
module.

`tests/runner/cli-v2-runtime.test.ts` asserts usage text includes the canonical
runtime routing policy, and selected retained runtime reasons exactly equal the
canonical constants.

`tests/runner/utility-cli.test.ts` asserts custom flow summaries include the
canonical custom-root policy text.

## Validation

Passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/utility-cli.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/release/release-infrastructure.test.ts`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.22 does not approve:

- `composeWriter` behavior changes;
- a core-v2 `composeWriter` hook;
- rollback behavior changes;
- arbitrary fixture or custom-root v2 default routing;
- arbitrary fixture or custom-root fail-closed behavior;
- retained/v1 checkpoint folder policy changes;
- connector/materializer movement;
- router/compiler movement;
- old runtime deletion;
- old oracle test deletion.

## Next

If full validation is green, continue only with behavior-preserving import/test
cleanup or v2/shared oracle twins.

Prepare a review package before changing public compatibility behavior,
saved-folder semantics, ownership boundaries, or deletion status.
