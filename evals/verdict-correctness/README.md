# Verdict-Correctness Eval

Internal eval (not for public marketing). Measures whether the explore-flow
review step (`reports/relay/review.request.json` → `reports/review-verdict.json`)
catches mechanically-planted defects in compose outputs.

## What it measures

For each historical explore run, we take its real `review.request.json`
prompt, mutate the compose JSON inside it to inject a known defect, send
the mutated prompt back through a connector (codex by default,
claude-code with `--judge claude-code`), and check whether the
reviewer's verdict surfaced the planted defect in `objections` or
`missed_angles`.

Defect catch rate = caught / (caught + missed). Errors are excluded from
the denominator. Per-defect rates expose which failure modes the
reviewer is good at catching and which it lets through.

## Defect taxonomy

| ID | Property the reviewer should be guarding |
| --- | --- |
| `fabricated-evidence-ref` | Evidence groundedness — citations should resolve. |
| `stripped-success-condition-alignment` | Alignment justification, not a vacuous restatement. |
| `wrong-subject` | Subject fidelity — compose subject must match the brief. |
| `added-false-certainty` | Epistemic calibration — claims should not exceed the evidence (no overclaiming). |
| `internal-contradiction` | Internal consistency — the recommendation should not negate itself. |

See `defect-taxonomy.ts` for the planting functions and
`scorer.ts` for the per-defect catch heuristics.

## Running

Build first (the runner imports connectors from `dist/`):

```bash
npm run build
```

Then:

```bash
# Full run with default judge (codex): every explore review request,
# every defect, plus controls.
node --experimental-strip-types evals/verdict-correctness/index.ts

# Cross-judge arm: same prompts, claude-code as the reviewer-under-test.
# Use this to check whether catch-rate findings survive a different
# model family or were artifacts of self-grading bias.
node --experimental-strip-types evals/verdict-correctness/index.ts \
  --judge claude-code

# Smaller run for iteration:
node --experimental-strip-types evals/verdict-correctness/index.ts \
  --max-composes 3 --defects fabricated-evidence-ref --no-control

# Dry run — show planned cases and source-pool size without invoking the LLM:
node --experimental-strip-types evals/verdict-correctness/index.ts \
  --max-composes 3 --dry-run
```

Outputs land in `evals/verdict-correctness/results/<timestamp>-<judge>/`:

- `partial-results.json` — per-case results, written incrementally
- `results.json` — final per-case results
- `summary.json` — aggregated metrics
- `report.md` — human-readable report

## Cost and wallclock

Each case is one connector subprocess call.

- **codex judge**: empirically ~50s per case, ~30K input + ~500–1000
  output tokens. A full 48-case run is ~40 min wallclock and ~$1.50 at
  codex pricing.
- **claude-code judge**: median wallclock measured on first cross-judge
  arm; record actuals in the run summary so cost+wallclock per judge are
  comparable. Same prompt, same N — the only delta should be model
  family.

Track cost+wallclock per run to avoid silent suite bloat. The Markdown
report includes both.

Before adding judges, flows, or a pre-flight gate, run `--dry-run` and
check the source count, distinct subject count, and planned case count. The
current smoke-sized run is cheap; a broader suite scales roughly with
case count and connector wallclock.

## Source pool

The eval can saturate if it keeps reusing the same small set of historical
composes. Expanding the source pool is a prerequisite to subtler mutators:
capture more real explore review requests first, then compare catch rates on
that frozen source pool.

The report records source compose runs and distinct subjects so a 100% catch
rate can be read against the pool size instead of treated as a broad claim.

## Limitations

- **String-match scoring** is generous on purpose (false negatives are
  the failure mode we guard against), but it can miss reviewer language
  that uses unusual phrasing. Audit misses by hand.
- **Self-grading risk**: when judge equals the connector that produced
  the historical composes, bias toward not catching same-family failures
  is plausible. The `--judge` flag exists to address this directly:
  running the same 48 cases with `--judge claude-code` gives a
  cross-family read on whether headline findings survive.
- **One-shot mutations**: each defect is planted in isolation. Real
  compose failures often combine multiple subtle issues at once.
