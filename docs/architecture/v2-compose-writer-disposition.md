# Core-v2 Compose Writer Disposition

Date: 2026-05-05

## Summary

Phase 5.7 decides the status of programmatic `composeWriter` without changing
runtime behavior.

Decision:

```text
composeWriter remains retained-runtime-only compatibility.
core-v2 does not gain a matching composeWriter hook in this slice.
internal v2 customization should use executor injection or generated reports.
release proof has since moved its internal Fix proof override to v2 executor
injection.
```

This does not approve old runtime deletion.

## Current Behavior

| Invocation | Runtime | Proof |
|---|---|---|
| normal routing plus `composeWriter` | retained runtime | `tests/runner/cli-v2-runtime.test.ts` |
| candidate diagnostics plus `composeWriter` | retained runtime | `tests/runner/cli-v2-runtime.test.ts` |
| strict v2 opt-in plus `composeWriter` | fail closed | `tests/runner/cli-v2-runtime.test.ts` |
| rollback plus `composeWriter` | retained runtime | `tests/runner/cli-v2-runtime.test.ts` |
| soak plus `composeWriter` | retained runtime | `tests/soak/v2-runtime-surface.test.ts` |

The key rule is simple: core-v2 must not silently ignore a caller-supplied
compose writer.

## Inventory Command

This command was run before writing this document so the inventory would not
include the new Phase 5.7 disposition files themselves:

```bash
rg -n "composeWriter|ComposeWriterFn|writeComposeReport" \
  src tests scripts docs specs README.md commands plugins .claude-plugin generated package.json
```

The current source-bearing results are classified below.

## Consumer Classification

| File | Classification | Disposition |
|---|---|---|
| `src/cli/circuit.ts` | public programmatic API and selector policy | `CliMainOptions.composeWriter` remains accepted by `main(...)`, but it is retained-runtime-owned. Normal and candidate routing fall back to retained runtime when supplied. Strict v2 fails closed. |
| `src/runtime/runner-types.ts` | retained runtime implementation | Defines `ComposeWriterFn` and invocation fields. Keep while retained runner compatibility exists. |
| `src/runtime/runner.ts` | retained runtime implementation | Exports `writeComposeReport(...)`, defaults retained compose writing to it, and passes injected compose writers through retained execution. Keep while retained fallback exists. |
| `src/runtime/step-handlers/compose.ts` | retained runtime implementation | Calls `ctx.composeWriter(...)` for retained compose steps. Keep. |
| `src/runtime/step-handlers/sub-run.ts` | retained runtime implementation | Propagates compose writer support into retained child runs. Keep. |
| `src/runtime/step-handlers/fanout.ts` | retained runtime implementation | Propagates compose writer support into retained fanout branch runs. Keep. |
| `src/runtime/step-handlers/types.ts` | retained runtime implementation | Carries the retained handler context type for compose writers. Keep. |
| `scripts/release/capture-golden-run-proofs.mjs` | release proof | No longer uses `writeComposeReport(...)` or public `composeWriter`. It seeds the deterministic Fix proof through internal v2 executor injection. |
| `tests/runner/cli-v2-runtime.test.ts` | retained fallback coverage | Proves default, candidate, rollback, and strict-v2 fail-closed behavior. Keep. |
| `tests/soak/v2-runtime-surface.test.ts` | retained fallback coverage | Proves the soak-level retained composeWriter path. Keep. |
| `tests/runner/build-report-writer.test.ts` | oracle coverage | Uses compose writer injection to seed Build report writer scenarios. Keep as old-runtime oracle coverage. |
| `tests/runner/build-verification-exec.test.ts` | oracle coverage | Uses injected plan writers for retained Build verification scenarios. Keep. |
| `tests/runner/compose-builder-registry.test.ts` | oracle coverage | Uses the compose writer seam to exercise synthetic compose builders. Keep. |
| `tests/runner/close-builder-registry.test.ts` | oracle coverage | Uses the compose writer seam before synthetic close-builder proof. Keep. |
| `tests/runner/fanout-runtime.test.ts` | oracle coverage | Uses compose writer injection to seed branch reports. Keep. |
| `tests/runner/fix-runtime-wiring.test.ts` | oracle coverage | Uses a custom compose writer to override Fix frame output. Keep. |
| `tests/runner/fix-report-writer.test.ts` | oracle coverage | Calls `writeComposeReport(...)` directly for Fix report writer proof. Keep. |
| `tests/contracts/orphan-blocks.test.ts` | oracle coverage | Uses prototype compose writing to prove orphan-block behavior. Keep. |
| `tests/runner/terminal-outcome-mapping.test.ts` | retained fallback coverage | Uses prototype compose writing in retained terminal outcome scenarios. Keep. |
| `tests/runner/handler-throw-recovery.test.ts` | retained fallback coverage | Proves retained recovery when compose writing throws. Keep. |
| `tests/runner/checkpoint-handler-direct.test.ts` | direct handler support | Supplies a defensive compose writer that should not be invoked by checkpoint tests. Keep until the retained handler test cluster is retired or migrated. |
| `tests/runner/fanout-handler-direct.test.ts` | direct handler support | Supplies a defensive compose writer for direct retained handler tests. Keep. |
| `tests/runner/relay-handler-direct.test.ts` | direct handler support | Supplies a defensive compose writer for direct retained relay tests. Keep. |
| `tests/runner/sub-run-handler-direct.test.ts` | direct handler support | Supplies a defensive compose writer for direct retained sub-run tests. Keep. |
| `tests/runner/verification-handler-direct.test.ts` | direct handler support | Supplies a defensive compose writer for direct retained verification tests. Keep. |

Existing architecture docs and checkpoint docs that mention `composeWriter` are
documentation and history, not additional runtime consumers.

## API Status

`composeWriter` is a real compatibility surface today because callers can pass
it to `main(..., options)`.

It is not a core-v2 API.

External callers should not expect core-v2 to honor `composeWriter`. If they
need this hook, their invocation stays on the retained runtime. If they force
strict v2, Circuit fails before writing a partial run folder.

Internal v2 customization should use v2 executor injection at the v2 runner
layer. The CLI now passes `v2Executors` to both fresh core-v2 runs and v2
checkpoint resume, and the core-v2 runner supports executor injection below the
CLI. Use that path instead of cloning the old compose writer hook.

Phase 5.18 also updates the live runtime reason for programmatic
`composeWriter` fallback so it no longer says core-v2 is waiting for an
equivalent hook. The operator-facing reason now says `composeWriter` is retained
compatibility, and that core-v2 customization uses executor injection or
generated reports.

Phase 5.20 moves most test use of retained compose report helpers to
`src/compat/retained-runtime.ts` under retained-named exports. The old
`src/runtime/runner.js` import path remains intentionally covered by
`tests/runner/fix-report-writer.test.ts`, which calls `writeComposeReport`
directly as the public-path compatibility proof.

Phase 5.22 moves the live `composeWriter` runtime reason into
`src/cli/runtime-compatibility-policy.ts` and has CLI tests assert that exact
reason for retained fallback and strict-v2 rejection.

## Release Proof

`scripts/release/capture-golden-run-proofs.mjs` was the only non-test caller
found in the Phase 5.7 inventory. It has since moved off public
`composeWriter`: the Fix golden proof uses internal v2 compose executor
injection to write the deterministic proof brief, then continues through the
normal v2 selector path.

That removes the release script as a retained `composeWriter` consumer. It does
not retire the public compatibility API.

## Deletion Implication

Old runtime deletion remains blocked while `composeWriter` is retained
compatibility.

Before deletion can be reconsidered, one of these must be true:

```text
composeWriter is retired by explicit product decision
composeWriter callers are migrated to v2 executor/report proof surfaces
composeWriter is kept behind a smaller retained compatibility module
```

Until then, `src/runtime/runner.ts` and `src/runtime/step-handlers/compose.ts`
remain live.

## Non-Approvals

Phase 5.7 does not approve:

- adding a core-v2 `composeWriter` hook;
- deleting retained runtime files;
- changing arbitrary fixture routing;
- removing rollback;
- removing or renaming candidate diagnostics;
- routing more modes through core-v2;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

## Follow-Up

The release-proof dependency has been removed. The remaining useful
`composeWriter` work is public compatibility work: keep it retained, move it
behind a smaller compatibility module, or retire it through an explicit
operator-facing decision later.
