# Circuit-vs-Vanilla Eval

Status: discovery only.

This eval compares the same task in two working environments:

- Circuit: the agent works through a Circuit flow.
- Vanilla: the agent works directly from the task prompt.

Use this eval to learn where Circuit helps, where it adds friction, and what a
future claim-grade eval should measure. Do not use it for public product claims.
It has no frozen claim gate.

## Good Tasks

This harness is best for read-only review, planning, and synthesis tasks.
Code-changing comparisons need stricter worktree isolation before the result is
fair.

## Run One Task

Create a prompt file:

```bash
mkdir -p evals/circuit-vs-vanilla/tasks/review-generated-surface-drift
$EDITOR evals/circuit-vs-vanilla/tasks/review-generated-surface-drift/prompt.md
```

Run a dry check first:

```bash
node evals/circuit-vs-vanilla/run-comparison.ts \
  --task-id review-generated-surface-drift \
  --prompt-file evals/circuit-vs-vanilla/tasks/review-generated-surface-drift/prompt.md \
  --model gpt-5.4-mini \
  --effort low \
  --dry-run
```

Remove `--dry-run` to invoke the model. Add `--flow explore` when the task
should start from Explore instead of the intent front door.

## Outputs

Results land under:

```text
evals/circuit-vs-vanilla/results/<timestamp>-<task-id>/
```

Read the blinded review packets before opening `blind-mapping.json`.
