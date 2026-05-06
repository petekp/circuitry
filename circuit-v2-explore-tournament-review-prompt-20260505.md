# Core-v2 Explore Tournament Review Prompt

You are reviewing `circuit-next`, a TypeScript CLI/plugin that runs developer
flows. The project is migrating from the retained runtime under `src/runtime/**`
to a cleaner `core-v2` runtime under `src/core-v2/**`.

The operator is frustrated with review checkpoints that do not move product
parity. Please make this review practical. Do not ask for another abstract
disposition pass. Judge whether Explore tournament can be moved toward
core-v2 default routing, and name the exact proof or code work needed.

## Current Migration State

Matrix-supported fresh runs now route to `core-v2` by default. The current
default matrix includes:

```text
Review default
Fix default/lite/deep/autonomous
Build default/lite/deep/autonomous
Explore default/lite/deep/autonomous
Migrate default/deep/autonomous
Sweep default/lite/deep/autonomous
```

Explore tournament is still retained. This is intentional. It is the next
review checkpoint because it combines:

```text
dynamic fanout
relay branch execution
tournament aggregate reports
tournament review relay
human checkpoint wait/resume
checkpoint progress/status projection
final decision/result composition
```

The latest completed batch routed Explore lite/deep/autonomous through
core-v2. Those modes share the non-tournament Explore compose/relay graph.
Focused validation and full validation passed:

```bash
npx vitest run tests/parity/explore-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

No old runtime deletion is approved. No arbitrary external fixture/custom-root
routing change is approved. Do not propose connector/materializer/registry
movement unless it is strictly necessary for Explore tournament parity.

## What I Need From You

Review the included files and answer:

1. Is Explore tournament ready to become core-v2 by default after focused tests,
   or is there a parity blocker?
2. If blocked, what are the exact blockers? Separate correctness blockers from
   UX/progress polish.
3. Does core-v2 fanout currently match retained fanout behavior closely enough
   for Explore tournament?
4. Does core-v2 call the same cross-report validation/provenance checks that
   retained fanout relies on, or is there a missing safety check?
5. Does core-v2 checkpoint wait/resume/status/progress currently provide enough
   tournament-specific operator context?
6. What is the smallest implementation slice that should happen next?
7. What tests must pass before default-routing Explore tournament?
8. What should still wait for a later review?

## Review Rules

Use verified facts from the code first. Cite file paths and line numbers.
Clearly label inference where you are inferring from patterns or tests.

Do not recommend:

```text
old runtime deletion
default-routing arbitrary external fixtures
removing rollback
changing public composeWriter behavior
moving connector subprocess modules
moving relay materialization
moving registries/router/catalog/compiler
large runtime-internal relocation
```

Those are separate review checkpoints.

## Key Files To Inspect First

Start with:

```text
HANDOFF.md
src/cli/circuit.ts
generated/flows/explore/circuit.json
generated/flows/explore/tournament.json
tests/parity/explore-v2.test.ts
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
```

Then compare the v2 and retained tournament/fanout/checkpoint paths:

```text
src/core-v2/executors/fanout.ts
src/core-v2/fanout/branch-execution.ts
src/core-v2/fanout/aggregate-report.ts
src/core-v2/executors/checkpoint.ts
src/core-v2/projections/progress.ts
src/run-status/v2-run-folder.ts
src/runtime/step-handlers/fanout.ts
src/runtime/step-handlers/checkpoint.ts
src/runtime/runner.ts
src/runtime/registries/cross-report-validators.ts
```

## Desired Output

Please structure your answer like this:

```text
1. Executive verdict
   - Ready / not ready / conditionally ready.

2. Blocking findings
   - Ordered by severity.
   - Include file and line citations.

3. Parity checklist
   - fanout branch expansion
   - branch relay/provenance validation
   - aggregate report shape
   - cross-report validation
   - tournament review relay
   - checkpoint request/response
   - progress JSONL
   - runs show projection
   - resume by saved engine marker
   - final result writing

4. Recommended next implementation slice
   - Files likely touched.
   - Tests to add/update.
   - Validation commands.

5. What not to do yet

6. Next review checkpoint
```

Keep the answer direct and decision-grade. The goal is to unblock implementation,
not to produce another general migration essay.
