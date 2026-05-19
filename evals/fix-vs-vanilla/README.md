# Fix-vs-Vanilla Babysitting Benchmark

Status: claim-grade internal pilot.

This benchmark asks one narrow question:

Does Circuit Fix reduce operator babysitting compared with a strong vanilla
coding-agent prompt, under equal model and tool conditions?

The primary metric is false-fixed rate: the agent claims the bug is fixed, but
the objective task checks still fail. Secondary metrics are objective fixed
rate, regression proof quality, verification pass rate, diff scope, and
wallclock.

## Arms

| Arm | Meaning |
| --- | --- |
| `circuit-claude-code` | Circuit Fix, run through this repo's compiled `fix` flow. Circuit owns the proof chain and operator summary. |
| `vanilla-claude-code` | Direct Claude Code with no Circuit runtime. It receives a strong process prompt requiring baseline reproduction, focused edits, rerun proof, and a final machine-readable claim. |

Both arms use the same task fixture, starting git commit, model, effort, tool
surface, timeout, and objective check commands.

Codex is not used for this bug-fix pilot because the current built-in Codex
relay is read-only for implementer steps. That would make the comparison about
write permissions rather than babysitting.

## Task Splits

Tasks are intentionally split:

- `discovery`: use only for runner debugging, prompt tuning, and scorer tuning.
- `regression`: use for repeat checks after changing Circuit or the benchmark.
- `held-out`: use for measurement. Do not tune on these tasks.

If a held-out task is used to tune the runner, prompt, scorer, or Circuit Fix
itself, move it to `regression` and add a replacement held-out task before
claiming a result.

This hygiene is machine-checked by `npm run check-evals`: task metadata must
match `manifest.json`, and held-out tasks must keep `tuning_used: false`.

## Run

Dry-run the held-out measurement plan:

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

Results land in:

```text
evals/fix-vs-vanilla/results/<timestamp>/
```

Important files:

- `metadata.json` records model, effort, repo commit, timeout, task split, and commands.
- `summary.json` contains machine-readable scoring.
- `report.md` contains the human summary and the claim/no-claim decision.
- Each task/arm folder contains stdout, stderr, final diff, post-check output, and copied task repo.

## Interpretation

Circuit only gets a positive claim from held-out tasks. Discovery wins do not
count. Regression wins keep the bar from sliding backward, but they are not a
fresh product claim.

For this pilot, a positive claim requires:

1. Circuit has a lower false-fixed rate than vanilla on held-out tasks.
2. Circuit's objective fixed rate is at least as high as vanilla's.
3. Environment failures are separated from model or flow failures.

## Inner And Outer Loops

The regular runner is the inner loop: it protects false-fixed rate, objective
fix rate, proof quality, diff scope, and wallclock on a named task set.

The matrix runner is the outer loop:

```bash
node scripts/evals/fix-matrix.ts --dry-run
```

V1 has one enabled model row, so it proves matrix plumbing only. A matrix-level
model-gradient claim requires at least two actually-run provider/model rows.
