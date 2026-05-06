# Circuit core-v2 full-parity gameplan review

You are reviewing the `circuit-next` repository in a brand new thread. The attached zip contains the relevant source, tests, generated flow surfaces, contracts, selected migration docs, and current handoff. Please read the code before making recommendations.

## What Circuit is

`circuit-next` is a Claude Code / Codex plugin and CLI that runs configurable developer flows such as Build, Fix, Review, Explore, Migrate, Sweep, and Handoff. A run loads a compiled flow, executes steps such as compose, relay, verification, checkpoint, fanout, and sub-run, writes trace/progress/report artifacts, and exposes run status through CLI utilities and host wrappers.

The product vocabulary is in `UBIQUITOUS_LANGUAGE.md`. Use the repo's words: flow, schematic, block, route, relay, check, trace, report, evidence.

## The core-v2 initiative

The old runtime lives under `src/runtime/**`. It has carried the original behavior, but it is broad and hard to reason about.

The new runtime lives under `src/core-v2/**`. The goal is feature parity with a cleaner core runtime design, not a product retreat. If an existing behavior is currently retained, treat that as a parity obligation unless the code proves it is test-only, obsolete, or explicitly unsupported by product contract.

Please do not frame the remaining work as "product compatibility decisions" unless you mean "which existing behavior must be carried across and how." The preferred default is:

```text
full parity first
old runtime as temporary carrier
explicit evidence before deleting or retiring behavior
few external reviews, only for hard-to-revert architecture or behavior choices
implementation over more markdown-only migration slices
```

## Current state, as of 2026-05-05

Read `HANDOFF.md` first for the current two-paragraph state.

High-level progress:

- Matrix-supported fresh runs now default to `core-v2`.
- Build deep is included in the default core-v2 route.
- `npm run soak:v2` exists and has passed in the latest validation.
- Fresh core-v2 run folders have checkpoint pause/resume support for the fixture-level paths that were implemented.
- `runs show` and handoff continuity have a marker-gated v2 status fallback for core-v2-marked folders.
- `CIRCUIT_SHOW_RUNTIME_DECISION=1` is the preferred runtime-decision diagnostics flag.
- `CIRCUIT_V2_RUNTIME_CANDIDATE=1` remains as a temporary alias for the same diagnostics.
- Candidate diagnostics no longer widen routing; they show `runtime` and `runtime_reason`.
- The installed Codex plugin wrapper can mark its packaged generated flow mirror with `CIRCUIT_GENERATED_FLOW_MIRROR_ROOT`; the CLI trusts that mirror only when the marker exactly matches the wrapper-injected `--flow-root`.
- Arbitrary external `--fixture`, arbitrary external `--flow-root`, custom flow roots, rollback, unsupported modes, retained/v1 checkpoint folders, and programmatic `composeWriter` remain on the retained runtime by default.

Recent validation reportedly passed:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/contracts/codex-host-plugin.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/soak
npm run soak:v2:fast
npm run soak:v2
npm run test:fast
npm run check-flow-drift
npm run verify
git diff --check
```

## Important current boundaries

Do not recommend old runtime deletion until parity proof is much stronger.

Do not recommend selector widening as a substitute for parity.

Do not route arbitrary external fixtures or custom flow roots through core-v2 by default unless you can name the precise support contract and proof required.

Do not remove rollback casually. `CIRCUIT_DISABLE_V2_RUNTIME=1` remains an operator safety feature while retained runtime fallback exists.

Do not add a v2 `composeWriter` hook just to clone the old extension point. Current policy is: public `composeWriter` remains retained-runtime-only compatibility for now; internal v2 customization should use executor injection or generated reports if feasible.

Do not move connector subprocesses, relay materialization, registries, router/catalog/compiler, trace/reducer/snapshot/progress/checkpoint/runner/handler internals without a concrete reviewed plan.

## Why this review is being requested

The migration has become too long and too review-heavy. Several recent phases were mostly disposition docs. The operator wants an updated gameplan that gets to full parity with fewer review checkpoints and more concrete implementation progress.

The most valuable answer is not another narrow disposition review. It is a clear map of what remains, which pieces are real parity gaps, which pieces are just old-runtime implementation details waiting to be moved, and which few checkpoints actually deserve strong-model review before implementation.

## What to inspect first

Start with:

```text
HANDOFF.md
AGENTS.md
package.json
src/cli/circuit.ts
src/core-v2/**
src/runtime/**
src/run-status/**
src/cli/handoff.ts
plugins/circuit/scripts/circuit-next.mjs
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
tests/core-v2/**
tests/parity/**
tests/runner/**/*checkpoint*
tests/runner/**/*runner*
tests/runner/**/*handler*
scripts/release/capture-golden-run-proofs.mjs
docs/architecture/v2-worklog.md
docs/architecture/v2-deletion-readiness-inventory.md
docs/architecture/v2-retained-fallback-policy.md
docs/architecture/v2-arbitrary-fixture-policy.md
docs/architecture/v2-compose-writer-disposition.md
docs/architecture/v2-runtime-import-inventory.md
docs/architecture/v2-runner-handler-test-classification.md
docs/contracts/**
specs/reference/legacy-circuit/**
```

Then inspect other files as needed.

## Questions to answer

### 1. How far along is the migration really?

Give a candid percentage-style or milestone-style assessment. Separate:

- core-v2 architecture completeness
- default selector coverage
- parity coverage
- old runtime deletion readiness
- operator safety and rollback maturity
- test/proof maturity

Do not count docs-only dispositions as parity progress unless they directly protect behavior.

### 2. What remains for full feature parity?

Produce a table of remaining parity obligations. Include at least:

- unsupported public modes
- Build autonomous
- Explore tournament
- any checkpoint/tournament/autonomous mode behavior
- retained/v1 checkpoint folder resume
- arbitrary external fixtures
- custom flow roots from `circuit-next create`
- public programmatic `composeWriter`
- release proof use of `writeComposeReport` / `composeWriter`
- rollback
- candidate diagnostics alias removal or transition
- old runner/handler tests and oracle tests
- trace, reducer, snapshot, progress, checkpoint, runner internals
- connector subprocesses
- relay materialization
- registries, router, catalog, compiler
- run-status projection
- host wrapper and installed plugin surfaces

For each item, classify it as:

```text
already v2-owned
partially v2-owned
retained as temporary parity carrier
test-only oracle/support
true behavior gap
deletion blocker
unclear, needs code inspection
```

If you think an item does not need parity, explain why with evidence and name the release/deprecation path needed. Do not assume behavior can be dropped silently.

### 3. What should the next implementation checkpoint be?

Recommend the next concrete implementation slice. It should move real behavior or proof toward parity, not just update docs.

For each candidate slice, include:

- why it reduces retained-runtime dependence
- files likely touched
- tests to add or update
- validation commands
- risks
- whether it needs strong-model review before implementation

Please bias toward bounded work that can ship with code and tests.

### 4. What are the next big review checkpoints?

We want fewer reviews. Name only the review checkpoints that are genuinely worth pausing for.

Use this bar:

```text
Review before implementation only if the decision is hard to reverse, changes product behavior, changes public contracts, deletes old runtime code, moves high-risk internals, or alters checkpoint/rollback semantics.
```

Everything else should be handled by implementation plus tests plus `npm run verify`.

Please provide a short list, ideally 3 to 5 checkpoints, such as:

- checkpoint semantics parity / retained folder strategy
- connector and relay materializer ownership transfer
- registry/router/compiler ownership transfer
- public compatibility API retirement or replacement, if any
- old runtime deletion plan

Revise that list based on the code, not on this prompt.

### 5. What should we stop doing?

Identify any migration habits that are slowing this down. Be direct. Especially call out:

- docs-only slices that do not create proof
- repeated reviews that `npm run verify` could replace
- overly cautious "policy" framing where feature parity should be assumed
- inventory work that is useful once but should not become a loop

### 6. What proof is required before old runtime deletion?

Give a deletion-readiness checklist that is concrete and testable. Include:

- behavior parity proof
- fallback/rollback decision
- retained/v1 run folder decision
- public API compatibility proof
- old test classification
- release proof migration or retention decision
- generated-flow and plugin-wrapper proof
- verification commands

## Answer format

Please respond in this structure:

```text
1. Executive verdict
2. Migration status
3. Remaining parity obligations
4. Recommended next implementation slice
5. Fewer-review checkpoint plan
6. Old runtime deletion gate
7. Files or tests you would inspect next if given more time
```

Requirements:

- Cite concrete files, symbols, and tests.
- Separate verified facts from inference.
- Prefer plain English.
- Be explicit about what should not get another review.
- Do not recommend code deletion unless you can name the parity proof that makes it safe.
- Do not treat "retained-only today" as "not part of parity" without evidence.
