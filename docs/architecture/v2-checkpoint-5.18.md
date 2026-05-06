# Phase 5.18 - Public Compatibility Policy Hardening

Date: 2026-05-06

## Summary

Phase 5.18 implements the reviewed public compatibility policy as a
behavior-preserving hardening slice.

This slice does not change runtime defaults. It keeps:

- `composeWriter` retained-only;
- rollback on `CIRCUIT_DISABLE_V2_RUNTIME=1`;
- arbitrary external fixtures retained by default;
- custom flow roots retained by default;
- strict v2 as the explicit experiment lane;
- trusted plugin mirrors limited to exact wrapper provenance.

The change makes those policies easier to see in user-facing output and tests.
It also removes wording that implied core-v2 should eventually expose a matching
`composeWriter` hook. Internal core-v2 customization remains executor injection
or generated reports.

## Files Changed

- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-checkpoint-5.18.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`src/cli/circuit.ts` now centralizes the public compatibility reason strings
for:

- arbitrary `--fixture` and `--flow-root` inputs;
- programmatic `composeWriter`;
- rollback;
- core-v2 checkpoint resume;
- retained checkpoint resume.

The `composeWriter` reason now says it is retained compatibility and points v2
customization to executor injection or generated reports. It no longer suggests
that a v2 `composeWriter` hook is planned.

The CLI usage text names the retained compatibility paths directly:

- unsupported modes;
- arbitrary fixtures/custom roots;
- rollback;
- `composeWriter`;
- unmarked retained checkpoint folders.

`circuit-next create` summaries now tell operators that custom flow roots run on
retained compatibility by default and that `CIRCUIT_V2_RUNTIME=1` is only for
explicit v2 experiments.

Tests prove the policy text and precedence without changing routing behavior:

- usage text includes the custom-root retained policy;
- `composeWriter` diagnostics use the retained-compatibility reason and do not
  mention an equivalent v2 hook;
- strict v2 plus `composeWriter` still fails closed;
- arbitrary fixtures and custom roots remain retained by default and mention the
  explicit v2 experiment lane;
- rollback still wins over trusted plugin mirror default routing;
- create output includes the custom-root retained policy.

## Validation

Passed:

- `npm run check`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/utility-cli.test.ts`
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`
- `npx vitest run tests/contracts/codex-host-plugin.test.ts`
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts`
- `npx vitest run tests/release/release-infrastructure.test.ts`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.18 does not approve:

- deprecating or removing `composeWriter`;
- adding a v2 `composeWriter` API;
- changing rollback semantics;
- default-routing arbitrary fixtures through core-v2;
- default-routing custom flow roots through core-v2;
- failing closed arbitrary fixtures or custom roots;
- changing retained/v1 checkpoint folder semantics;
- moving connector subprocess or relay materializer ownership;
- moving router/compiler ownership;
- deleting retained runtime files;
- deleting old runner/handler oracle tests.

## Next

The next implementation batch can keep tightening accidental old-runtime imports
and v2/shared oracle twins.

Pause and prepare a review package before any public compatibility behavior
change, saved-folder policy change, ownership movement, or deletion.
