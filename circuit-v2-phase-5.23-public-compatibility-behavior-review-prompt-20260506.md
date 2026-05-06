# Review Prompt - Circuit core-v2 Public Compatibility Behavior

You are reviewing the next decision point in the `circuit-next` core-v2
migration.

Phase 5.22 is behavior-preserving. It centralizes public compatibility policy
strings in `src/cli/runtime-compatibility-policy.ts` so runtime reasons, CLI
usage, and custom-flow summaries share one source. It does not change routing,
fallback, rollback, `composeWriter`, fixture/root handling, checkpoint-folder
behavior, ownership boundaries, or deletion status.

Validation reported by the implementation pass:

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/utility-cli.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/release/release-infrastructure.test.ts
npm run verify
git diff --check
```

All passed.

## Current Public Compatibility Policy

Current behavior is:

```text
composeWriter: retained-only compatibility
rollback: retained safety switch while retained compatibility is bundled
arbitrary external fixtures: retained by default
custom flow roots: retained by default
old public runtime paths: explicit compatibility paths until retired
retained/v1 checkpoint folders: retained compatibility, marker-gated away from v2
```

The next implementation should not change any of those behaviors unless this
review explicitly approves the change and names the required tests/release
steps.

## Files To Inspect First

```text
HANDOFF.md
docs/architecture/v2-checkpoint-5.22.md
docs/architecture/v2-retained-fallback-policy.md
docs/architecture/v2-compose-writer-disposition.md
docs/architecture/v2-arbitrary-fixture-policy.md
docs/architecture/v2-retained-checkpoint-folder-policy.md
docs/architecture/v2-deletion-readiness-inventory.md
docs/architecture/v2-runner-handler-test-classification.md
docs/architecture/v2-worklog.md
src/cli/runtime-compatibility-policy.ts
src/cli/circuit.ts
src/cli/create.ts
src/compat/retained-runtime.ts
src/compat/retained-checkpoint-folders.ts
src/runtime/runner.ts
src/runtime/runner-types.ts
tests/runner/cli-v2-runtime.test.ts
tests/runner/utility-cli.test.ts
tests/runner/fix-report-writer.test.ts
tests/runner/retained-compat-facade.test.ts
tests/soak/v2-runtime-surface.test.ts
tests/contracts/codex-host-plugin.test.ts
tests/release/release-infrastructure.test.ts
```

## Review Questions

1. Are there any blocking findings in Phase 5.22?

2. Is `src/cli/runtime-compatibility-policy.ts` the right place for the live
   public compatibility policy strings?

3. Should the next implementation change any public compatibility behavior, or
   should it keep the current policy and continue with non-behavior cleanup?

4. For public `main(..., { composeWriter })`, choose one:

   ```text
   keep retained-only compatibility
   add a v2 support contract/hook
   deprecate with release notes and tests
   fail closed after an approved transition
   ```

   Name the required tests for the choice.

5. For rollback via `CIRCUIT_DISABLE_V2_RUNTIME=1`, choose one:

   ```text
   keep retained safety switch while bundled
   convert to a legacy-compatibility-package switch
   deprecate/remove with release notes
   replace with documented pin-previous-version guidance
   ```

   Name the required tests for the choice.

6. For arbitrary external fixtures and custom flow roots, choose one:

   ```text
   keep retained by default
   define and implement a v2 support contract
   deprecate with migration guidance
   fail closed after an approved transition
   ```

   Name the required tests for the choice.

7. Should old public runtime import paths remain explicit compatibility paths?
   In particular, should `writeComposeReport` stay covered by
   `tests/runner/fix-report-writer.test.ts`?

8. What next work can proceed autonomously after this review, and what still
   requires review first?

9. How close is old runtime deletion after Phase 5.22, and what exact blockers
   remain?

## Non-Approvals Unless Explicitly Stated

Do not approve any of these silently:

- removing or deprecating `composeWriter`;
- adding a v2 `composeWriter` hook;
- changing rollback behavior;
- routing arbitrary fixtures or custom roots through v2 by default;
- failing closed arbitrary fixtures or custom roots;
- changing retained/v1 checkpoint-folder semantics;
- moving connector subprocesses or relay materialization;
- moving router/compiler ownership;
- deleting retained runtime files;
- deleting old oracle tests.

## Desired Output

Lead with an executive verdict. Then list blocking findings first, with file
and line references. If no blockers exist, say so plainly.

Answer each review question directly. End with the recommended next checkpoint,
including whether it needs another review before implementation.

Separate verified facts from inference. Cite concrete files, symbols, and tests.
