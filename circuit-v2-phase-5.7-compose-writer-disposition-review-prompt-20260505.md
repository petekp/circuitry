# Circuit Core-v2 Phase 5.7 ComposeWriter Disposition Review

You are reviewing `/Users/petepetrash/Code/circuit-next`.

Please review the Phase 5.7 composeWriter API disposition. This is not an old
runtime deletion proposal.

## Prior Review Verdict Applied

The chosen posture was:

```text
Keep arbitrary fixtures retained by default.
Keep strict v2 opt-in as the fixture experiment lane.
Keep rollback.
Keep unsupported modes retained.
Keep candidate diagnostics for now, but plan to rename or retire them.
Tackle programmatic composeWriter first.
```

Phase 5.7 applies only the `composeWriter` part:

```text
composeWriter remains retained-runtime-only compatibility.
core-v2 does not get a matching composeWriter hook.
internal v2 customization should use executor injection or generated reports.
release proof stays retained for now.
```

## Files To Review

Primary:

- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-checkpoint-5.7.md`
- `tests/runner/cli-v2-runtime.test.ts`

Supporting docs:

- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Important existing surfaces:

- `src/cli/circuit.ts`
- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/compose.ts`
- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `scripts/release/capture-golden-run-proofs.mjs`
- `tests/soak/v2-runtime-surface.test.ts`

## Current Inventory Command

Phase 5.7 used this current-only inventory command before writing the new
disposition docs:

```bash
rg -n "composeWriter|ComposeWriterFn|writeComposeReport" \
  src tests scripts docs specs README.md commands plugins .claude-plugin generated package.json
```

The disposition doc classifies each source-bearing consumer as programmatic
API, retained runtime implementation, release proof, retained fallback test,
oracle test, direct-handler test support, or documentation/history.

## Behavior Proven

`tests/runner/cli-v2-runtime.test.ts` now proves:

- normal routing plus `composeWriter` stays retained;
- candidate diagnostics plus `composeWriter` stays retained;
- strict v2 plus `composeWriter` fails closed;
- rollback plus `composeWriter` stays retained.

`tests/soak/v2-runtime-surface.test.ts` continues to prove the retained
composeWriter path at soak level.

## Validation

All requested Phase 5.7 validation passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

## Review Questions

Please answer plainly and cite concrete files, symbols, and tests.

1. Does Phase 5.7 correctly encode `composeWriter` as retained-runtime-only
   compatibility without accidentally creating a new core-v2 support promise?
2. Are any current `composeWriter`, `ComposeWriterFn`, or `writeComposeReport`
   consumers misclassified?
3. Are the four selector cases covered strongly enough?
4. Is it correct to leave release proof on retained `composeWriter` for now?
5. Is there any hidden deletion, routing, rollback, arbitrary-fixture,
   candidate-diagnostics, connector, registry, or runtime-internal movement in
   this slice?
6. What is the next safest migration slice after this checkpoint?

Do not recommend old runtime deletion unless you can name every retained
fallback and compatibility surface that has been migrated, retired, or moved
behind a smaller retained module.
