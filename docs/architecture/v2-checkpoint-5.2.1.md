# Circuit v2 Checkpoint 5.2.1

## Summary

Phase 5.2.1 proves Build deep as a core-v2 checkpoint candidate without making
it a default-routed mode.

Default Build deep remains retained-runtime-owned. Explicit candidate or strict
v2 routing can now run Build deep through core-v2, pause at the Build
checkpoint, project waiting status, resume by saved v2 run-folder identity, and
close the run.

No old runtime deletion is approved.

## What Changed

Updated:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-checkpoint-5.2.1.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Behavior Added

The CLI now distinguishes:

```text
default v2 support matrix
candidate/strict v2 support matrix
```

Build deep is in the candidate/strict matrix only:

```text
default Build deep -> retained runtime
CIRCUIT_V2_RUNTIME_CANDIDATE=1 Build deep -> core-v2 candidate
CIRCUIT_V2_RUNTIME=1 Build deep -> core-v2 strict opt-in
```

Rollback still prevents default v2 routing for normal supported rows. Saved
resume identity still wins for checkpoint resume:

```text
core-v2-marked checkpoint folder -> core-v2 resume
retained/v1 checkpoint folder -> retained resume
```

## Candidate Smoke Proof

`tests/runner/cli-v2-runtime.test.ts` now proves Build deep candidate behavior:

- candidate Build deep starts on core-v2;
- the run pauses with `outcome: checkpoint_waiting`;
- no `reports/result.json` is written while waiting;
- `runs show --json` projects `waiting_checkpoint`;
- checkpoint brief parses as `BuildBrief`;
- checkpoint request body stores the original project root and config layers;
- progress JSONL emits `checkpoint.waiting` and `user_input.requested`;
- resume follows the saved core-v2 run-folder marker;
- resume restores project root by running verification commands in the original
  project root, even when resume is invoked from a different cwd;
- resume restores selection config layers, observed through post-checkpoint
  relay selection;
- post-checkpoint relay, verification, review, close, result writing, and final
  status projection complete;
- Build result report parses as `BuildResult`.

The strict opt-in test also proves Build deep can pause through core-v2 with
`CIRCUIT_V2_RUNTIME=1`.

The default selector tests still prove Build deep stays retained when no v2
candidate or strict flag is set.

## Boundaries Preserved

Still not approved:

- Build deep default routing;
- Build tournament routing;
- retained/v1 checkpoint folders through core-v2;
- old runtime deletion;
- moving retained trace reader/writer;
- moving retained reducer/snapshot writer;
- moving retained progress projector;
- moving retained checkpoint handler;
- moving old runner or step handlers;
- moving connector subprocess modules, relay materializer, or registries.

## Validation

Passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts tests/core-v2/checkpoint-resume-v2.test.ts`
- `npx vitest run tests/core-v2 tests/parity`
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `git diff --check`

`npm run soak:v2` includes the focused soak suite, full `npm run verify`, and
`npm run check-flow-drift`.

## Next Recommended Action

Do not default-route Build deep yet.

Next should be a focused review of this candidate smoke. If approved, Phase 5.3
can decide whether Build deep should enter the default selector matrix.

