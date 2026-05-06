# Review Prompt: Circuit core-v2 Phase 5.18 public compatibility policy

You are reviewing the `circuit-next` core-v2 migration after the generated public
fresh-run matrix has moved to core-v2 by default and after several low-risk
oracle-test mapping batches.

Please review the included files and give a decision-grade recommendation for
the next implementation checkpoint. Focus on public compatibility policy, not
another broad inventory.

## Current context

Core-v2 now owns the current generated public fresh-run catalog by default:

```text
Review default
Fix default/lite/deep/autonomous
Build default/lite/deep/autonomous
Explore default/lite/deep/autonomous/tournament
Migrate default/deep/autonomous
Sweep default/lite/deep/autonomous
```

The retained runtime is still intentionally live for:

```text
retained/v1 checkpoint folders
arbitrary external fixtures
custom flow roots
rollback via CIRCUIT_DISABLE_V2_RUNTIME=1
public composeWriter compatibility
old public runtime import paths
retained trace/progress/checkpoint/status behavior
connector subprocesses and relay materializer
router/compiler compatibility wrappers
old runner/handler oracle tests
```

Recent checkpoints:

- Phase 5.13 moved shared registry/catalog derivation ownership to `src/flows/**`
  with old `src/runtime/**` registry paths kept as compatibility re-exports.
- Phase 5.14 introduced `src/compat/retained-runtime.ts` as the narrow retained
  facade.
- Phase 5.15 started old runner/handler oracle-test mapping and added v2 twins
  for terminal outcomes, rich checkpoint route labels, bounded retry loops,
  relay verdict admission, connector identity, and connector provenance.
- Phase 5.16 added v2 twins for relay recovery routes, canonical report gating,
  and connector invocation failure recovery/abort behavior. It also made
  `relay.completed.report_path` appear only when the relay report is admitted.
- Phase 5.17 added strict v2 final-result proof for executor throws and
  pass-route cycles.

Latest validation passed:

```bash
npm run check
npx vitest run tests/core-v2/control-loop-v2.test.ts
npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts
npx vitest run tests/runner/check-evaluation.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/pass-route-cycle-guard.test.ts
npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/pass-route-cycle-guard.test.ts
npm run lint
npm run build
git diff --check
npm run verify
```

`npm run verify` passed with 126 test files, 1400 tests passed, and 6 skipped.

## What you should inspect first

Start with:

```text
HANDOFF.md
docs/architecture/v2-checkpoint-5.13.md
docs/architecture/v2-checkpoint-5.14.md
docs/architecture/v2-checkpoint-5.15.md
docs/architecture/v2-checkpoint-5.16.md
docs/architecture/v2-checkpoint-5.17.md
docs/architecture/v2-runner-handler-test-classification.md
docs/architecture/v2-deletion-readiness-inventory.md
docs/architecture/v2-retained-fallback-policy.md
docs/architecture/v2-arbitrary-fixture-policy.md
docs/architecture/v2-compose-writer-disposition.md
docs/architecture/v2-retained-checkpoint-folder-policy.md
```

Then inspect the policy and compatibility code:

```text
src/cli/circuit.ts
src/cli/create.ts
src/compat/retained-runtime.ts
src/core-v2/run/checkpoint-resume.ts
src/run-status/project-run-folder.ts
src/run-status/v1-run-folder.ts
src/run-status/v2-run-folder.ts
src/cli/handoff.ts
src/runtime/runner.ts
src/runtime/runner-types.ts
scripts/release/capture-golden-run-proofs.mjs
tests/release/release-infrastructure.test.ts
```

Use the included tests as evidence:

```text
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
tests/runner/retained-compat-facade.test.ts
tests/runner/run-status-facade.test.ts
tests/runner/build-checkpoint-exec.test.ts
tests/runner/utility-cli.test.ts
tests/core-v2/control-loop-v2.test.ts
tests/core-v2/core-v2-baseline.test.ts
tests/contracts/codex-host-plugin.test.ts
```

## Review questions

1. Are there blocking correctness findings in the Phase 5.16/5.17 work?

2. Has the low-risk old-oracle mapping lane reached diminishing returns for now,
   or should one more implementation-only batch happen before policy work?

3. What should happen to public `main(..., { composeWriter })`?

   Consider:

   ```text
   keep retained-only behind the facade
   deprecate with release notes and fail-closed tests
   build a v2 equivalent only if there is real external demand
   ```

4. What should happen to rollback via `CIRCUIT_DISABLE_V2_RUNTIME=1` while the
   retained runtime is still bundled, and what should happen when it is not?

5. What should happen to arbitrary external `--fixture` and custom `--flow-root`
   roots from `circuit-next create`?

   Please decide whether the next implementation should:

   ```text
   keep them retained by default
   define a v2 support contract first
   deprecate/fail-closed with release notes
   ```

6. What should happen to retained/v1 checkpoint folders?

   Is the current marker-gated split enough for now, or should the next
   implementation build a smaller compatibility package around old folders?

7. Are old public runtime import paths ready to be narrowed to compatibility
   re-exports/facade imports, or should that wait until the public compatibility
   decisions are made?

8. What is the next best implementation checkpoint?

   Please choose one:

   ```text
   A. public compatibility policy implementation for composeWriter/rollback/arbitrary roots/custom roots
   B. old public import compatibility tightening
   C. retained/v1 checkpoint folder compatibility package boundary
   D. connector/materializer ownership review and implementation
   E. router/compiler ownership review and implementation
   F. more old-oracle v2/shared twins before policy work
   ```

9. For your chosen checkpoint, list:

   ```text
   exact files likely touched
   tests that must change or be added
   validation commands
   whether another strong-model review is required before implementation
   what must not be changed in that slice
   ```

10. Is old runtime deletion any closer after 5.16/5.17?

    Please answer plainly and list the remaining hard blockers.

## Output format

Please return:

1. Executive verdict.
2. Blocking findings, if any.
3. Direct answers to the ten questions.
4. Recommended next implementation checkpoint.
5. Explicit “do not change yet” list.
6. Old-runtime deletion status.

Separate verified facts from inference. Cite concrete files, symbols, and tests.
