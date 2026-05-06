# Core-v2 Runtime Decision Diagnostics Disposition

Date: 2026-05-05

## Summary

Phase 5.8 classified `CIRCUIT_V2_RUNTIME_CANDIDATE=1` as a temporary runtime
decision diagnostics flag. Phase 5.8.1 implements the rename with a temporary
alias.

Decision:

```text
CIRCUIT_SHOW_RUNTIME_DECISION=1 is the preferred diagnostics flag.
CIRCUIT_V2_RUNTIME_CANDIDATE=1 remains as a temporary alias.
Either flag includes runtime/runtime_reason fields.
runtime_reason explains the actual selected runtime.
rollback wins the runtime_reason when rollback selects retained runtime.
strict v2 still wins over rollback.
```

This does not approve old runtime deletion.

## Current Behavior

The candidate support matrix still aliases the default support matrix:

```ts
const V2_RUNTIME_CANDIDATE_SUPPORT_MATRIX = V2_RUNTIME_SUPPORT_MATRIX;
```

Candidate diagnostics do not add support rows beyond normal default routing.

Current behavior:

| Invocation | Behavior |
|---|---|
| `CIRCUIT_SHOW_RUNTIME_DECISION=1` plus supported fresh run | routes through core-v2 and includes `runtime: "v2"` plus `runtime_reason` |
| `CIRCUIT_SHOW_RUNTIME_DECISION=1` plus unsupported fresh run | stays retained and includes `runtime: "retained"` plus `runtime_reason` |
| `CIRCUIT_V2_RUNTIME_CANDIDATE=1` | temporary alias with the same behavior |
| both diagnostics flags set | same behavior as either flag alone |
| diagnostics plus rollback | retained runtime with rollback as `runtime_reason` |
| diagnostics plus rollback plus `composeWriter` | retained runtime with rollback as `runtime_reason`; the retained compose writer still runs |
| diagnostics plus rollback plus arbitrary fixture | retained runtime with rollback as `runtime_reason` |
| strict v2 plus rollback plus diagnostics | strict v2 wins and reports v2 support |
| diagnostics plus checkpoint resume | follows the saved run folder engine marker and includes runtime fields |

Normal default output still omits runtime fields.

## Inventory Command

This command was run before writing the Phase 5.8 disposition document:

```bash
rg -n "CIRCUIT_V2_RUNTIME_CANDIDATE|useV2RuntimeCandidate|candidate diagnostics|runtime_reason|runtimeOutputFields" \
  src tests scripts docs specs README.md commands plugins .claude-plugin generated package.json
```

Phase 5.8.1 changed the live code to `showRuntimeDecision()` and added the new
env var. The current live search target is:

```bash
rg -n "CIRCUIT_SHOW_RUNTIME_DECISION|CIRCUIT_V2_RUNTIME_CANDIDATE|showRuntimeDecision|runtime_reason|runtimeOutputFields" \
  src tests scripts docs specs README.md commands plugins .claude-plugin generated package.json
```

## Consumer Classification

| File | Classification | Disposition |
|---|---|---|
| `src/cli/circuit.ts` | selector implementation and diagnostic output | Owns `showRuntimeDecision()`, the temporary alias, runtime output fields, and help text. Keep until alias retirement. |
| `tests/runner/cli-v2-runtime.test.ts` | test coverage | Proves preferred flag behavior, old alias behavior, both flags together, rollback precedence, strict-over-rollback precedence, composeWriter/fixture retained behavior, resume diagnostics, and help text. Keep. |
| `tests/soak/v2-runtime-surface.test.ts` | test support and adjacent assertions | Clears both diagnostics env vars in helpers and proves default outputs omit runtime fields. Keep. |
| `tests/runner/config-loader.test.ts` | test isolation | Clears both diagnostics env vars so rollback/config behavior is not polluted by ambient environment. Keep. |
| `tests/core-v2/checkpoint-resume-v2.test.ts` | saved-engine resume coverage | Uses runtime output fields in a rollback resume assertion, not candidate-specific logic. Keep. |
| `tests/runner/build-checkpoint-exec.test.ts` | retained resume coverage | Uses runtime output fields in a strict retained resume assertion, not candidate-specific logic. Keep. |
| `docs/architecture/v2-fallback-api-disposition-review.md` | review history | Asked whether candidate diagnostics should be kept, renamed, or removed. Superseded by Phase 5.8 and Phase 5.8.1. |
| `docs/architecture/v2-deletion-plan.md` | current migration policy | Records that runtime decision diagnostics are diagnostic output only and do not affect deletion readiness. |
| `docs/architecture/v2-worklog.md` | worklog/history | Records this checkpoint. |
| old checkpoint docs and import inventories | documentation/history | Keep as historical context. Do not treat them as live runtime consumers. |

No `scripts/`, `commands/`, `plugins/`, `.claude-plugin/`, `generated/`, specs,
or README files are live runtime decision diagnostics consumers in the current
inventory.

## Product Status

`CIRCUIT_SHOW_RUNTIME_DECISION=1` is the operator-facing name going forward.
It asks the CLI to show how runtime selection was decided.

`CIRCUIT_V2_RUNTIME_CANDIDATE=1` remains as a temporary alias because it was
used throughout the migration. Removing it immediately would create avoidable
operator and test friction.

The alias should be removed only after an explicit release note or follow-up
decision.

## Rollback Precedence

Runtime diagnostics should explain the actual selected runtime.

Therefore:

```text
CIRCUIT_SHOW_RUNTIME_DECISION=1 + CIRCUIT_DISABLE_V2_RUNTIME=1
```

reports:

```json
{
  "runtime": "retained",
  "runtime_reason": "CIRCUIT_DISABLE_V2_RUNTIME=1 keeps default runtime routing on the retained runtime"
}
```

Strict v2 remains different. It is a force-v2 test lane, so strict v2 still
wins when both strict and rollback are set.

## Deletion Implication

Runtime decision diagnostics do not make the old runtime deletable.

Renaming this flag only changes diagnostic output controls. It does not
migrate:

- retained/v1 checkpoint folders;
- unsupported public modes;
- arbitrary explicit fixtures;
- programmatic `composeWriter`;
- rollback;
- release proof compose writing;
- old runner/handler oracle tests;
- retained trace/reducer/snapshot/progress infrastructure.

## Non-Approvals

Phase 5.8.1 does not approve:

- removing `CIRCUIT_V2_RUNTIME_CANDIDATE`;
- old runtime deletion;
- changing arbitrary fixture routing;
- changing `composeWriter` behavior;
- removing rollback;
- routing more modes through core-v2;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

## Follow-Up

The next diagnostics-specific slice should decide when to remove the temporary
`CIRCUIT_V2_RUNTIME_CANDIDATE=1` alias.
