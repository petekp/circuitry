# Core-v2 Migration Review: Public Compatibility Decisions After Phase 5.14

You are reviewing the `circuit-next` core-v2 migration. You have a focused zip
of relevant files from the repo. Please ground every claim in specific files,
symbols, and tests. Separate verified facts from inference.

## Context

`circuit-next` is a developer-flow runner. It is migrating from the retained
runtime under `src/runtime/**` to the newer `core-v2` runtime under
`src/core-v2/**`.

Current migration state:

- Generated public fresh-run parity is effectively complete for the current
  catalog. The CLI selector routes Review default; Fix default/lite/deep/
  autonomous; Build default/lite/deep/autonomous; Explore default/lite/deep/
  autonomous/tournament; Migrate default/deep/autonomous; and Sweep default/
  lite/deep/autonomous through core-v2 by default.
- Retained/v1 checkpoint folders remain supported through retained
  compatibility. Core-v2 resumes only core-v2-marked run folders.
- The installed plugin generated mirror can follow the selector matrix only when
  the wrapper injects the trusted mirror marker. Arbitrary external roots and
  custom flow roots remain retained by default.
- Public `main(..., { composeWriter })` remains accepted, but it is
  retained-runtime-only compatibility. Strict v2 plus `composeWriter` fails
  closed.
- Rollback via `CIRCUIT_DISABLE_V2_RUNTIME=1` remains an operator safety feature
  that forces default routing to retained compatibility. Strict v2 still wins
  over rollback.
- Release proof no longer imports `dist/runtime/runner.js` or passes public
  `composeWriter`; it uses internal v2 executor injection.
- Phase 5.13 moved shared registry/catalog derivation ownership to
  `src/flows/**`, with old `src/runtime/**` registry paths left as compatibility
  re-exports.
- Phase 5.14 added `src/compat/retained-runtime.ts` as the facade for retained
  fresh-run fallback, retained/v1 checkpoint resume, retained snapshot
  derivation, retained trace reading, and retained trace reduction.

The user is frustrated by review checkpoints that only produce markdown. Please
recommend implementation-first next steps and reserve strong review for real
behavior/API/architecture decisions.

## Non-goals

Do not recommend:

- deleting old runtime code now;
- routing arbitrary external fixtures or custom roots through core-v2 by
  default without a precise support contract;
- removing rollback without an operator-facing transition;
- cloning `composeWriter` into core-v2 just to preserve the old hook;
- moving connector subprocesses or relay materialization in this review;
- moving router/catalog/compiler ownership in this review;
- deleting old runner/handler oracle tests without mapping their coverage.

## Review Questions

1. Is the Phase 5.14 retained compatibility facade the right boundary?
   - Is it narrow enough?
   - Did it introduce any hidden behavior or API change?
   - Are there facade improvements that should happen before public
     compatibility behavior changes?

2. What is the next highest-leverage implementation checkpoint?
   - Option A: public compatibility policy implementation for `composeWriter`,
     rollback, arbitrary fixtures, and custom roots.
   - Option B: old runner/handler oracle-test mapping and migration, with no
     public behavior changes yet.
   - Option C: another neutral ownership move.
   - Pick one and explain why.

3. What should happen to public `composeWriter`?
   - Keep as legacy compatibility behind the retained facade?
   - Deprecate with a release path?
   - Replace with a v2-native public API?
   - What tests and docs are required before any behavior change?

4. What should happen to rollback?
   - Keep as a transition safety feature?
   - Later convert to a legacy-compatibility-package switch?
   - Retire with release notes?
   - What proof is required before changing it?

5. What should happen to arbitrary external fixtures and custom flow roots?
   - Keep retained by default?
   - Define a v2 support contract?
   - Deprecate/fail closed after retained compatibility is retired?
   - What exact contract and tests would be required for v2 support?

6. What should happen to retained/v1 checkpoint folders?
   - Keep supported through the retained compatibility facade?
   - Migrate to core-v2?
   - Expire/deprecate old folders?
   - What proof is required before changing this saved-state behavior?

7. What is still blocking old runtime deletion?
   - List the blockers as concrete responsibilities, not vague modules.
   - Say which blockers can be moved to neutral ownership, which belong in a
     smaller compatibility package, and which require product deprecation.

8. Where should strong-model reviews be used from here?
   - Name the next review-worthy checkpoints.
   - Name work that should proceed by implementation and tests without another
     strong review.

## Expected Output

Please use this structure:

1. Executive verdict
2. Blocking findings, if any
3. Assessment of the retained compatibility facade
4. Recommended next three implementation checkpoints
5. Public compatibility disposition table
6. Old runtime deletion gate
7. Review checkpoint policy from here
8. Direct answers to the review questions

Keep the response decision-grade. Cite files and tests. Avoid generic cleanup
advice.
