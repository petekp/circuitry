# Fix-vs-Vanilla Eval

Status: claim-grade internal pilot.

This eval asks one narrow question: does Circuit Fix reduce babysitting on
reproducible bug-fix tasks compared with a strong direct agent prompt?

The main failure it watches for is a false fix: the agent says the bug is
fixed, but the objective checks still fail.

## Arms

- `circuit-claude-code`: Circuit Fix with its normal proof chain.
- `vanilla-claude-code`: direct Claude Code with a strong process prompt.

Both arms use the same task fixture, starting commit, model, effort, tools,
timeout, and objective check commands.

## Task Splits

- `discovery`: runner and prompt tuning only.
- `regression`: protects known behavior.
- `held-out`: measurement. Do not tune on these tasks.

If a held-out task is used for tuning, move it to regression and add a fresh
held-out task before making a claim.

## Run

Dry-run the held-out plan:

```bash
node evals/fix-vs-vanilla/run-fix-comparison.ts --set held-out --dry-run
```

Run held-out measurement:

```bash
node evals/fix-vs-vanilla/run-fix-comparison.ts \
  --set held-out \
  --provider claude-code \
  --model claude-haiku-4-5-20251001 \
  --effort medium
```

The matrix dry-run checks the outer loop across model rows:

```bash
npm run evals:fix:matrix:dry-run
```

Real matrix runs are explicit because they invoke live models.

## Claim Rule

Circuit only gets a positive held-out claim when:

- its false-fixed rate is lower than vanilla,
- its objective fixed rate is at least as high as vanilla's,
- environment failures are separated from model or flow failures.

Use generated run reports for current results. Do not keep stale result
summaries in this directory.
