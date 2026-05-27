# False-Done Fix Bar

Status: regression bar.

This bar protects Circuit Fix from saying "fixed" when the evidence does not
support that claim. It is not a Circuit-vs-vanilla benchmark and cannot support
a fresh product claim.

## What It Checks

A Fix run can only close as fixed when the proof chain is honest:

- the regression was shown failing before the fix,
- the verification command passed after the fix,
- the changed files match what the agent declared,
- review accepted cleanly when review ran.

The task files under `tasks/` cover six known false-done patterns, such as
undeclared extra files, missing declared files, deferred regression tests, and
mid-run commits.

## Run

```bash
npx vitest run tests/integration/fix-false-done-bar.test.ts \
              tests/integration/fix-false-done-bar-live.test.ts
```

The stubbed test makes the six scenarios deterministic. The live test runs a
smaller set against a real temporary git repo so the same writers see real git
state.
