# Circuit Core-v2 Phase 5.10 Trusted Generated Mirror Policy Review

Please review the next proposed migration decision. Phase 5.9 is already
implemented and validated; this prompt is for the next slice.

## Context

The core-v2 selector now default-routes matrix-supported fresh runs when they
load from the normal generated fixture root:

```text
generated/flows/** -> selector matrix decides
external --fixture/--flow-root -> retained runtime by default
strict CIRCUIT_V2_RUNTIME=1 -> explicit v2 experiment lane
```

Phase 5.9 confirmed that arbitrary explicit fixtures and custom flow roots
should remain retained-runtime-owned by default.

The inventory exposed a narrower question:

```text
plugins/circuit/flows/** files are generated mirrors of generated/flows/**
plugins/circuit/scripts/circuit-next.mjs injects --flow-root <plugin root>/flows
src/cli/circuit.ts currently treats that injected root like any other external flow root
therefore installed plugin flows stay retained by current path policy
```

That may be correct, or it may mean default core-v2 routing has not reached the
installed host wrapper path.

## Current Evidence

Relevant files:

- `src/cli/circuit.ts`
- `plugins/circuit/scripts/circuit-next.mjs`
- `src/cli/create.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`

Current code facts:

- `resolveFixturePath(...)` resolves explicit `--flow-root` paths outside
  `generated/flows`.
- `fixtureEligibleForCandidateV2(...)` returns true only when no explicit
  fixture/root is supplied, or when the resolved fixture path is inside
  `generated/flows`.
- `plugins/circuit/scripts/circuit-next.mjs` injects `--flow-root <plugin root>/flows`
  for host wrapper `run` invocations when the caller did not supply a fixture or
  flow root.
- `tests/contracts/codex-host-plugin.test.ts` proves the wrapper injects the
  packaged flow root and that the CLI can load from it, but does not assert
  core-v2 routing for that path.
- `src/cli/create.ts` emits custom flow invocations using `--flow-root
  <custom-home>/flows`. Those should remain retained unless a separate custom
  flow v2 support contract is approved.

## Proposed Question

Should Phase 5.10 add a trusted-generated-mirror policy for installed plugin
flow roots?

Possible answers:

```text
A. Keep packaged host flow roots retained by default.
B. Treat only installed plugin generated mirrors as trusted generated roots.
C. Treat any generated mirror root with drift/source proof as trusted.
D. Do nothing until old runtime deletion becomes a near-term goal.
```

My current bias is either A or B:

- A is safest and keeps arbitrary fixture policy simple.
- B may be necessary if "matrix-supported fresh runs default to core-v2" is
  intended to include installed plugin wrapper invocations, not just repo-local
  `generated/flows` invocations.

I would avoid C unless there is a concrete provenance mechanism.

## Questions For Review

Please answer plainly and cite concrete files, symbols, and tests.

1. Is the installed plugin flow root a trusted generated mirror or an arbitrary
   explicit flow root for selector purposes?
2. Does the current retained default for `plugins/circuit/flows/**` undermine
   the migration goal that matrix-supported fresh runs default to core-v2?
3. If packaged host flow roots should be trusted, what exact provenance test or
   path policy is sufficient?
4. Should custom flow roots from `circuit-next create` remain retained even if
   packaged host flow roots become trusted?
5. What focused tests are required before changing the selector?
6. Is this review-worthy before implementation, or should Phase 5.10 stay as a
   no-op policy note?

## Non-Approvals

Do not recommend:

- old runtime deletion;
- routing arbitrary external fixtures through core-v2 by default;
- routing custom flow roots through core-v2 by default without a separate
  custom-flow support contract;
- changing `composeWriter`;
- removing rollback;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

