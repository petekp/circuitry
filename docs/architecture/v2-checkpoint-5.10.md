# Phase 5.10 - Trusted Generated Plugin Mirror

Date: 2026-05-05

## Summary

Phase 5.10 lets the official installed Codex plugin generated flow mirror follow
the same selector matrix as `generated/flows/**`.

Decision:

```text
generated/flows/** -> selector matrix
official wrapper-injected plugin flow mirror -> selector matrix
arbitrary external --fixture/--flow-root -> retained runtime by default
custom flow roots -> retained runtime by default
strict CIRCUIT_V2_RUNTIME=1 -> explicit v2 experiment lane
```

No old runtime deletion is approved.

## Behavior Changed

`plugins/circuit/scripts/circuit-next.mjs` now sets
`CIRCUIT_GENERATED_FLOW_MIRROR_ROOT=<plugin root>/flows` only when it injects
its own packaged flow root.

`src/cli/circuit.ts` trusts a generated mirror only when:

```text
args.flowRoot is present
CIRCUIT_GENERATED_FLOW_MIRROR_ROOT is present
resolve(args.flowRoot) equals resolve(CIRCUIT_GENERATED_FLOW_MIRROR_ROOT)
the resolved fixture path is inside that root
```

The wrapper clears the marker when it does not inject the packaged flow root, so
caller-supplied `--flow-root`, caller-supplied `--fixture`, resume, checkpoint
choice, create, and help paths do not inherit stale provenance.

## Files Changed

- `plugins/circuit/scripts/circuit-next.mjs`
- `src/cli/circuit.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-checkpoint-5.10.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/contracts/codex-host-plugin.test.ts` proves:

- wrapper run invocations inject the packaged flow root and marker;
- caller-supplied flow roots do not get the marker;
- resume does not get the marker;
- every packaged flow JSON mirror equals the corresponding `generated/flows/**`
  file.

`tests/runner/cli-v2-runtime.test.ts` proves:

- plugin mirror root without marker stays retained;
- plugin mirror root with matching marker routes supported rows through core-v2;
- marker mismatch stays retained;
- custom flow roots stay retained by default;
- strict v2 can still force a compatible custom-root experiment;
- rollback keeps trusted plugin mirrors on retained runtime.

## Non-Approvals

Phase 5.10 does not approve:

- old runtime deletion;
- routing arbitrary external fixtures through core-v2 by default;
- routing custom flow roots through core-v2 by default;
- changing `composeWriter` behavior;
- removing rollback;
- generalizing trusted generated mirrors beyond the installed wrapper;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

## Validation

Passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/contracts/codex-host-plugin.test.ts`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

## Next

No further routing expansion should happen without a focused product reason and
review. Old runtime deletion remains blocked.
