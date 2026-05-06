# Review Prompt: circuit-next core-v2 Phase 5.11

You are reviewing a focused post-implementation checkpoint in the
`circuit-next` core-v2 migration.

The goal of the migration is feature parity through a cleaner core runtime
design. Retained runtime behavior is a temporary parity carrier unless a feature
has an explicit deprecation path. This checkpoint is not an old-runtime deletion
proposal.

## Current Migration Context

Core-v2 already owns many generated fresh-run rows by default, including Review
default, Fix default/lite/deep/autonomous, Build default/lite/deep/autonomous,
Explore default/lite/deep/autonomous, Migrate default/autonomous, and Sweep
default/lite/autonomous.

Retained runtime still owns or carries:

- arbitrary external fixtures and custom flow roots by default;
- retained/v1 checkpoint folder resume;
- public `composeWriter` compatibility;
- rollback via `CIRCUIT_DISABLE_V2_RUNTIME=1`;
- release proof code that still imports retained runtime helpers;
- old runner/handler oracle tests;
- connector subprocesses, relay materializer, registries, router/catalog/compiler,
  and retained trace/progress/checkpoint internals until those have separate
  reviewed ownership plans.

The previous strategy review said Explore tournament should not be default-routed
until v2 relay fanout branches used the production relay path and ran the same
safety checks as retained fanout. This Phase 5.11 slice implements that
hardening and then routes Explore tournament through core-v2 by default.

## What Changed In Phase 5.11

### Selector

`src/cli/circuit.ts` now includes Explore tournament in
`V2_RUNTIME_SUPPORT_MATRIX`:

```text
explore + tournament depth -> core-v2
```

Rollback still forces retained runtime for normal routing. Strict v2 remains the
explicit force-v2 test lane.

### Fanout Relay Correctness

`src/core-v2/executors/relay.ts` now exposes a production relay attempt helper.
`src/core-v2/fanout/branch-execution.ts` uses that helper for compiled-flow relay
fanout branches, so branch relays now:

- build a synthetic relay step such as `proposal-fanout-step-option-1`;
- compose the full production relay prompt;
- invoke the public `relayer` when one is supplied;
- preserve resolved connector compatibility;
- write retained-compatible branch relay artifacts:
  `request.txt`, `receipt.txt`, `result.json`, and admitted `report.json`;
- admit branch reports only after parse/schema, provenance, and cross-report
  validation pass;
- avoid writing admitted reports for invalid JSON, bad schema, provenance
  mismatch, or cross-report validator failure.

### Tournament Operator Context

`src/core-v2/projections/tournament-checkpoint-context.ts` enriches checkpoint
projection from:

```text
reports/decision-options.json
reports/tournament-review.json
```

`src/core-v2/projections/progress.ts` and `src/run-status/v2-run-folder.ts` now
use those dynamic labels and the tradeoff question for tournament checkpoints,
with static policy fallbacks when reports are missing or malformed.

### Tests

New and updated tests cover:

- v2 relay fanout branch use of the production relayer prompt path;
- invalid JSON, schema failure, provenance mismatch, and cross-report validation
  failure aborting branches without writing admitted branch reports;
- generated `generated/flows/explore/tournament.json` through normal v2
  executors reaching a waiting checkpoint;
- four branch reports, aggregate report, tournament review, progress labels, and
  run-status labels;
- marker-gated v2 resume with `option-2` writing final decision and result
  reports;
- CLI default routing for `circuit-next run explore --mode tournament`;
- rollback retaining Explore tournament.

## Validation Passed

The implementation branch passed:

```bash
npx vitest run tests/core-v2/fanout-v2.test.ts tests/parity/explore-v2.test.ts
npm run check
npm run lint
npm run build
npx vitest run tests/core-v2/fanout-v2.test.ts tests/parity/explore-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts
npm run soak:v2:fast
npx vitest run tests/runner/cli-router.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts
npm run soak:v2
git diff --check
```

`npm run soak:v2` includes full `npm run verify` and `npm run check-flow-drift`.

## Files Included

The zip contains only relevant source, tests, flow definitions, retained oracle
references, and Phase 5.11 architecture notes. It intentionally excludes old
review zips/prompts, broad misc docs, and generated examples.

## Review Questions

Please review this as a narrow post-implementation default-route checkpoint.

1. Does v2 relay fanout branch execution now match the retained runtime's safety
   intent for production Explore tournament branches?
   Check prompt construction, public `relayer` use, connector fallback,
   report parsing, provenance validation, cross-report validation, and report
   write gating.

2. Is the generated Explore tournament production proof strong enough to justify
   default-routing this public mode through core-v2?
   Focus on fresh run, waiting checkpoint, progress JSONL, `runs show`, saved
   marker resume, decision/result writing, and final trace state.

3. Is the tournament checkpoint operator context good enough for default routing?
   Specifically: dynamic option labels and the tradeoff question should appear in
   progress and run-status projection, with safe fallback behavior.

4. Are rollback, strict opt-in, and diagnostics still correct after adding the
   Explore tournament row?

5. Is there any hidden deletion, arbitrary fixture widening, custom flow-root
   widening, `composeWriter` behavior change, connector/materializer movement,
   registry/router/catalog/compiler movement, or retained runtime-internal
   movement?

6. If approved, what is the next highest-leverage implementation checkpoint for
   reaching full parity? Please avoid recommending another documentation-only
   slice unless it unblocks a concrete implementation.

## Expected Output

Please return:

- verdict: approved, conditionally approved, or blocked;
- blocking findings first, each with file and line references where possible;
- non-blocking notes;
- direct answers to the six review questions;
- recommended next implementation slice and what proof it needs;
- old runtime deletion status.

Do not treat this as an old-runtime deletion review. Deletion remains blocked
unless you explicitly find that all retained parity carriers now have tested v2
equivalents or approved deprecation paths.
