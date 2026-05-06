# Review Prompt: circuit-next core-v2 remaining compatibility plan

You are reviewing the current `circuit-next` core-v2 migration after Phase 5.12.

This is a strategic implementation review, not a request to approve old runtime
deletion immediately. The user is frustrated by earlier review frequency and
docs-only slices. Please focus on what implementation work remains to reach full
feature parity and a credible old-runtime retirement path.

## Project Context

`circuit-next` is a developer-flow runner. It has an older retained runtime under
`src/runtime/**` and a newer core-v2 runtime under `src/core-v2/**`.

The goal is feature parity through a better runtime design. Retained runtime
behavior should be treated as a temporary parity carrier unless there is an
explicit product decision to deprecate or retire a feature.

## Current State

Core-v2 now owns the generated public fresh-run catalog by default.

The selector matrix in `src/cli/circuit.ts` routes these generated fresh runs
through core-v2 by default:

- Review default
- Fix default/lite/deep/autonomous
- Build default/lite/deep/autonomous
- Explore default/lite/deep/autonomous/tournament
- Migrate default/deep/autonomous
- Sweep default/lite/deep/autonomous

Phase 5.11 moved Explore tournament to core-v2 by default after hardening v2
relay fanout branch execution. That slice was externally reviewed and approved.

Phase 5.12 added retained/v1 checkpoint folder compatibility proof:

- retained waiting folders project through `runs show`;
- retained waiting folders resume through retained compatibility when rollback
  and runtime diagnostics are enabled;
- corrupted unmarked retained folders do not fall through to marker-gated v2
  handoff status fallback.

The release Fix golden proof no longer uses public `composeWriter`; it uses
internal v2 executor injection, and the release test asserts the script no
longer imports `dist/runtime/runner.js` or passes `composeWriter`.

Recent validation passed:

```bash
npm run verify
npm run lint
git diff --check
```

Phase 5.11 also passed `npm run soak:v2`, which includes full `npm run verify`
and `npm run check-flow-drift`.

## Remaining Retained Responsibilities

Old runtime deletion is still blocked by live responsibilities:

- arbitrary external fixtures and custom flow roots default to retained runtime;
- retained/v1 checkpoint folders are still supported through retained resume and
  retained status/progress infrastructure;
- public `main(..., { composeWriter })` remains retained-runtime-only
  compatibility;
- rollback via `CIRCUIT_DISABLE_V2_RUNTIME=1` still uses retained runtime;
- old runner/handler tests remain fallback or oracle coverage;
- retained trace/reducer/snapshot/progress/checkpoint/status/result behavior is
  still live for retained folders and retained fallbacks;
- connector subprocesses and relay materialization still live under
  `src/runtime/**`;
- registries, router, catalog, and compiler modules still live under
  `src/runtime/**`, though many are product infrastructure rather than
  old-runtime debris.

## Important Scope Guardrails

Do not recommend broad deletion unless the proof gate is actually green.

Do not treat this as approval to:

- remove rollback casually;
- route arbitrary external fixtures or custom flow roots through v2 by default;
- clone the old `composeWriter` hook into core-v2 without evidence of a real
  external need;
- move connector subprocess modules or relay materialization without a focused
  safety plan;
- move registries/router/catalog/compiler without a focused ownership plan;
- delete old runner/handler tests just because v2 tests pass.

The user wants fewer strong-model reviews. Recommend review checkpoints only for
hard-to-reverse public semantics or architecture boundaries.

## Files Included

The zip includes the current relevant source, tests, release proof script/tests,
and architecture notes. It excludes old review zips/prompts and generated
example run dumps.

## Review Questions

Please answer with concrete implementation guidance.

1. **How far along is the migration now?**
   Give separate estimates for:
   - generated public fresh-run parity;
   - full product parity;
   - old-runtime deletion readiness.

2. **What are the remaining true parity obligations?**
   Distinguish:
   - behavior v2 must implement;
   - compatibility that can remain behind a smaller retained package;
   - product surfaces that need an explicit deprecation/retirement decision;
   - infrastructure that should move to neutral ownership rather than core-v2.

3. **What should the next three implementation checkpoints be?**
   For each checkpoint, specify:
   - goal;
   - files likely touched;
   - tests/proof required;
   - whether strong-model review is needed before or after implementation.

4. **What should happen to public `composeWriter`?**
   It is still accepted by `main(..., options)` and currently forces retained
   runtime. Release proof no longer needs it. Should it remain retained-only,
   move behind a smaller compatibility module, be deprecated, or get a v2
   replacement? Be concrete.

5. **What should happen to rollback?**
   `CIRCUIT_DISABLE_V2_RUNTIME=1` currently routes supported rows to retained
   runtime. Should rollback become a permanent safety feature, a temporary
   transition feature, or something else? What proof or release note is needed?

6. **What should happen to arbitrary fixtures and custom flow roots?**
   Should they remain retained by default, get a v2 support contract, or be
   deprecated/fail-closed if retained runtime is retired?

7. **What is the right retained/v1 checkpoint folder strategy?**
   Should old folders remain supported through a smaller compatibility package,
   be migrated, or eventually expire? What tests must exist before any change?

8. **Which `src/runtime/**` clusters are not old-runtime debris?**
   Identify which should move to neutral ownership:
   - connector subprocesses;
   - relay materializer;
   - registries;
   - router/catalog/compiler;
   - trace/status/progress/checkpoint helpers.

9. **What is the old-runtime deletion gate now?**
   List the exact conditions that must be true before deletion can start.

10. **Where should strong-model reviews be used from here?**
    Name the few checkpoints that deserve review, and name work that should just
    be implemented and validated without another review loop.

## Expected Output

Please return:

- executive verdict;
- migration status table;
- remaining blockers table;
- recommended next implementation sequence;
- review checkpoint policy;
- old-runtime deletion gate;
- direct answers to the ten questions.

Use verified facts with file references where possible. Label inference as
inference. Be direct and avoid recommending another documentation-only slice
unless it clearly unblocks implementation.
