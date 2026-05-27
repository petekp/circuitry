# Verdict-Correctness Eval

Status: Review regression eval.

This eval asks whether a reviewer catches known defects planted into prior
Explore review inputs. It is internal only. It is not claim-grade today because
it has no frozen held-out policy or public claim gate.

## What It Measures

For each saved Explore review request, the runner mutates the compose JSON to
plant one known defect, sends the prompt through a reviewer, and checks whether
the reviewer surfaces the defect.

Current defect families:

- fabricated evidence references,
- weak success-condition alignment,
- wrong subject,
- false certainty,
- internal contradiction.

## Run

Build first because the runner imports compiled connector code:

```bash
npm run build
```

Then run a dry plan or a small live slice:

```bash
node --experimental-strip-types evals/verdict-correctness/index.ts \
  --max-composes 3 --dry-run

node --experimental-strip-types evals/verdict-correctness/index.ts \
  --max-composes 3 --defects fabricated-evidence-ref --no-control
```

Full runs and cross-judge runs are explicit because they invoke live models:

```bash
node --experimental-strip-types evals/verdict-correctness/index.ts
node --experimental-strip-types evals/verdict-correctness/index.ts --judge claude-code
```

Outputs land in `evals/verdict-correctness/results/<timestamp>-<judge>/`.

## Reading Results

Treat catch rate as a regression signal, not a broad quality claim. Small source
pools can saturate quickly, and string-match scoring can miss unusual reviewer
phrasing. Audit misses by hand before changing prompts or scoring.
