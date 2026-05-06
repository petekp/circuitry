# Review Prompt - Circuit core-v2 Phase 5.21 and Next Boundary

You are reviewing the `circuit-next` core-v2 migration after Phase 5.21.

The review package is scoped to the retained/v1 checkpoint folder compatibility
boundary and the next migration decision. It is not a request to approve old
runtime deletion.

## Current State

Generated public fresh runs route through core-v2 by default for the current
catalog. Retained compatibility still owns arbitrary fixtures, custom flow
roots, rollback, public `composeWriter`, retained/v1 checkpoint folders, old
oracle tests, retained trace/progress/checkpoint/status behavior,
connector subprocesses/materializer, and router/compiler compatibility.

Phase 5.21 added:

- `src/compat/retained-checkpoint-folders.ts` as the narrower boundary for
  retained/v1 checkpoint resume, retained snapshot derivation, retained trace
  reading, and retained trace reduction.
- Production imports from CLI resume, handoff, and run-status now go through
  that smaller boundary.
- The broader `src/compat/retained-runtime.ts` still re-exports the saved-folder
  helpers for compatibility, while keeping retained fresh-run fallback separate.
- Import guards and facade tests were updated.
- Saved-folder behavior was intentionally not changed.

Validation reported by the implementation pass:

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/runner/utility-cli.test.ts
npm run verify
git diff --check
```

All passed.

## Files To Inspect First

```text
HANDOFF.md
docs/architecture/v2-checkpoint-5.21.md
docs/architecture/v2-retained-checkpoint-folder-policy.md
docs/architecture/v2-retained-runtime-boundary.md
docs/architecture/v2-deletion-readiness-inventory.md
docs/architecture/v2-runner-handler-test-classification.md
docs/architecture/v2-worklog.md
src/compat/retained-checkpoint-folders.ts
src/compat/retained-runtime.ts
src/cli/circuit.ts
src/cli/handoff.ts
src/run-status/project-run-folder.ts
src/run-status/v1-run-folder.ts
src/run-status/v2-run-folder.ts
tests/runner/build-checkpoint-exec.test.ts
tests/runner/retained-compat-facade.test.ts
tests/runner/run-status-facade.test.ts
tests/runner/utility-cli.test.ts
```

## Review Questions

1. Are there any blocking correctness or compatibility findings in Phase 5.21?

2. Is `src/compat/retained-checkpoint-folders.ts` the right retained/v1 saved
   folder boundary, assuming no behavior change?

3. Did Phase 5.21 accidentally change saved-folder semantics, marker-gated
   resume, retained/v1 `runs show`, handoff fallback, rollback, `composeWriter`,
   arbitrary fixture/custom root routing, connector/materializer ownership,
   router/compiler ownership, or deletion status?

4. Is the broader retained facade still shaped correctly after this split?
   Should `src/compat/retained-runtime.ts` keep re-exporting saved-folder
   helpers for compatibility, or should future code be pushed exclusively to
   the smaller boundary?

5. What is the next highest-leverage checkpoint?

   Consider:

   - connector subprocess and relay materializer neutral ownership;
   - router/compiler ownership;
   - public compatibility behavior for `composeWriter`, rollback, arbitrary
     fixtures, and custom roots;
   - retained/v1 checkpoint folder policy changes;
   - more low-risk v2/shared oracle twins;
   - old runtime deletion readiness.

6. Which of those next steps requires review before implementation, and which
   can proceed autonomously as behavior-preserving cleanup?

7. How close is old runtime deletion now, and what exact blockers remain?

## Non-Approvals To Preserve

Do not approve any of these unless you explicitly call them out with required
tests and release/deprecation implications:

- checkpoint folder migration;
- retained/v1 checkpoint folder expiry;
- core-v2 resume for unmarked retained folders;
- status or handoff fallback widening;
- rollback behavior changes;
- public `composeWriter` behavior changes;
- arbitrary fixture or custom-root default v2 routing;
- connector subprocess or relay materializer movement;
- router/compiler movement;
- old runtime deletion;
- old oracle test deletion.

## Desired Output

Lead with an executive verdict. Then list blocking findings first, with file
and line references. If no blockers exist, say so plainly.

After findings, answer the review questions directly. End with a recommended
next checkpoint and whether it needs another review before implementation.

Separate verified facts from inference. Cite concrete files, symbols, and tests.
