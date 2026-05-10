# Circuit-vs-Vanilla Comparison Runner

This is a small internal pilot harness. It runs the same prompt through:

1. `circuit-codex`: Circuit CLI with normal flow behavior.
2. `vanilla-codex`: direct `codex exec`, with no Circuit flow wrapper.

It is best for read-only review, planning, and synthesis tasks. Code-change
comparisons need a stricter worktree isolation story before the results are
fair.

## Run One Task

Create a task prompt:

```bash
mkdir -p evals/circuit-vs-vanilla/tasks/review-generated-surface-drift
$EDITOR evals/circuit-vs-vanilla/tasks/review-generated-surface-drift/prompt.md
```

Run the comparison with a cheap Codex model:

```bash
node evals/circuit-vs-vanilla/run-comparison.mjs \
  --task-id review-generated-surface-drift \
  --prompt-file evals/circuit-vs-vanilla/tasks/review-generated-surface-drift/prompt.md \
  --model gpt-5.4-mini \
  --effort low
```

By default, Circuit chooses the flow. To force Explore:

```bash
node evals/circuit-vs-vanilla/run-comparison.mjs \
  --task-id review-generated-surface-drift \
  --prompt-file evals/circuit-vs-vanilla/tasks/review-generated-surface-drift/prompt.md \
  --flow explore \
  --model gpt-5.4-mini \
  --effort low
```

Use `--dry-run` to prepare metadata and print the commands without invoking
either model.

## Outputs

Results land under:

```text
evals/circuit-vs-vanilla/results/<timestamp>-<task-id>/
```

Important files:

- `metadata.json` — repo commit, model, effort, versions, and commands.
- `prompt.md` — exact shared task prompt.
- `circuit-codex/final.md` — Circuit output for review.
- `vanilla-codex/final.md` — vanilla Codex output for review.
- `blind-review-A-then-B.md` — blinded comparison packet.
- `blind-review-B-then-A.md` — same outputs in swapped order.
- `blind-mapping.json` — arm labels for after judging.

Do not look at `blind-mapping.json` until after recording your preference.
