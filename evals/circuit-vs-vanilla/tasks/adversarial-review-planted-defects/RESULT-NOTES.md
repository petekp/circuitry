# Adversarial Review — Planted Defects

First run of this task. Comparison harness: `evals/circuit-vs-vanilla/run-comparison.mjs` with `--provider claude-code --flow review`. Both arms ran on Claude Haiku 4.5 with low effort.

## Setup

- **Fixture**: a 70-line `uploads.js` file embedded directly in the prompt so both arms see byte-identical input.
- **Planted defects** (5 total, varying subtlety): see `defect-manifest.json`.
- **Intended red herring**: `readPublicAsset` was supposed to be safe (path-traversal defended via `path.resolve` + `startsWith`). On review: it is NOT actually safe. The check confirms the resolved path string sits under `PUBLIC_ROOT`, but `fs.readFileSync` follows symlinks. A symlink at `/var/www/public/foo -> /etc/passwd` passes the string check and leaks the symlink target. So the "red herring" turned out to contain a real subtle defect (D6, unintentional). Updating the manifest.

## Run

- Result root: `results/2026-05-10T04-34-13-354Z-adversarial-review-planted-defects/`
- Repo commit at run time: `921c041` (after severity-vocabulary widening — see below).
- Wallclock: Circuit 36.0s, vanilla 25.8s.

### First run (commit `921c041` pre-widening) aborted

Initial run hit a structural defect in Circuit's Review flow: the model produced findings using `severity: "medium"` (matching the prompt's industry-standard 4-level vocabulary), but Circuit's `ReviewFindingSeverity` schema only accepted `'critical' | 'high' | 'low'`. Run aborted with a Zod validation error. No findings rendered.

Vanilla on the same input produced a complete review.

This was a real product defect — the operator's natural vocabulary collided with Circuit's narrowed enum. Fixed by widening the enum and updating the relay-hint prompt + verdict logic. Other Circuit flows (build, fix, migrate, sweep) already used the 4-level vocabulary; Review was the outlier.

## Scoring (after fix)

| Defect | Subtlety | Vanilla | Circuit |
|---|---|---|---|
| D1 — eval RCE | obvious | ✓ CRITICAL @ line 8 | ✓ CRITICAL @ uploads.js:10 |
| D2 — SQL injection | obvious | ✓ CRITICAL @ line 13 | ✓ CRITICAL @ uploads.js:14 |
| D3 — counter race | moderate | ✓ HIGH @ line 18 | ✓ HIGH @ uploads.js:18-21 |
| D4 — chunk off-by-one | subtle | ✓ HIGH @ line 23 | ✓ HIGH @ uploads.js:27 |
| D5 — finally swallows promise | subtle | ✓ HIGH @ line 35 | ✓ HIGH @ uploads.js:41 |
| D6 — symlink-following in readPublicAsset (unintended) | very subtle | ✗ missed | ✓ MEDIUM @ uploads.js:44-47 |

- Both arms: 5/5 on the planted defects.
- Circuit: caught one additional real subtle defect (D6) that vanilla missed.
- False positives: 0 on both arms.
- Severity grades: vanilla rated D3/D4/D5 as HIGH, Circuit rated them HIGH except D6 at MEDIUM. Both defensible.

### Output artifacts beyond findings

Circuit additionally emitted:
- An `Assessment` paragraph summarizing what was checked and concluded.
- A `Verified` list of 5 concrete steps the reviewer performed.
- A `Confidence limitations` list of 6 named gaps.
- Three structural warnings (diff truncated, untracked-files truncated, untracked-content omitted).

Vanilla emitted only the finding bullets in the format the prompt requested.

## Honest read

Circuit beat vanilla on this task — caught one additional subtle defect, produced richer structured output. But it's not 10x. It's roughly 1.2x: same catches on the planted bugs, one extra catch from the structured-prompting effect, more bookkeeping around the answer. The wallclock cost was 40% longer.

The structural warnings (diff_truncated, untracked_files_truncated, untracked_file_content_omitted) are noise on this task — they refer to Circuit auto-scoping the working tree, which had nothing to do with the prompt content. Operators reading the output get told about evidence Circuit didn't actually need, which is a small distraction.

## What would 10x look like for Review?

Today's Review flow makes one model call to one reviewer. The structured prompt buys a marginal lift in catch quality (D6 above). To produce results that are categorically better than direct prompting, the flow would need to do something direct prompting cannot:

- **Adversarial second pass**: a second model call that tries to falsify the first reviewer's findings. Forces evidence anchoring, surfaces shaky claims.
- **Tool-grounded verification**: when the reviewer claims SQL injection at line X, run a static analyzer or grep for the pattern and cite the tool output as evidence. Findings without tool-confirmable grounding get downgraded.
- **Multi-model voting**: run two or three different model calls in parallel, take the union of findings that at least two reviewers caught. Catches model-specific blind spots.
- **Diff-aware scope discipline**: when reviewing changes (the natural Review use case), focus the model on the change boundary plus its blast radius, not the whole file. Vanilla can't easily do this without prompt engineering.

These are flow-architecture changes, not projector tweaks. The 10x bar means the flow itself has to do more work, not just shape the answer differently.

## What this experiment revealed

1. **Circuit's Review schema was incompatible with the standard severity vocabulary.** Fixed.
2. **Circuit's Review can structurally outperform vanilla on the same model** — but the lift is small (one extra subtle defect on a five-defect task). Not 10x.
3. **The structural warnings system surfaces noise on tasks that don't use the working tree.** Worth scoping the warning emitter to the actual scope the review was given.
4. **The "red herring" planning approach is fragile** — the function I planted as safe turned out to have a real subtle defect. For future adversarial tasks, the manifest needs review by someone other than the author.

## Suggested follow-ups

- Run the same task at higher effort (medium / high) to see whether Circuit's lift over vanilla widens.
- Run with sonnet-4-6 instead of haiku to see whether the lift is model-dependent.
- Build a second adversarial-review task with different defect categories (concurrency, type confusion, supply-chain).
- Try one of the architectural changes above (adversarial second pass is cheapest) and re-measure.
