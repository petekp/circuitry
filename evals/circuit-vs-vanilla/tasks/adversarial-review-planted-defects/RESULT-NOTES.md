# Adversarial Review — Planted Defects

Comparison harness: `evals/circuit-vs-vanilla/run-comparison.ts` with `--provider claude-code --flow review`. Two runs to date: haiku-4.5 low (Run 1) and sonnet-4-6 medium (Run 2).

## Run 1 — claude-haiku-4-5 low effort

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

This was a real product defect — the operator's natural vocabulary collided with Circuit's narrowed enum. Fixed by widening the enum and updating the relay-hint prompt + verdict logic. Other Circuit flows already used the 4-level vocabulary; Review was the outlier.

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

## Suggested follow-ups (after Run 1)

- Run the same task at higher effort (medium / high) to see whether Circuit's lift over vanilla widens.
- Run with sonnet-4-6 instead of haiku to see whether the lift is model-dependent.
- Build a second adversarial-review task with different defect categories (concurrency, type confusion, supply-chain).
- Try one of the architectural changes above (adversarial second pass is cheapest) and re-measure.

## Run 2 — claude-sonnet-4-6 medium effort

Calibration run to test whether the haiku-low lift (~1.2x) widens or narrows at the real production model tier. The hypothesis was that a stronger reasoner might either (a) make Circuit's structured prompting matter more, or (b) close the gap because vanilla also gets smarter.

### Run

- Result root: `evals/circuit-vs-vanilla/results/2026-05-10T04-57-03-072Z-adversarial-review-planted-defects/`
- Repo commit at run time: `e177527` (after task fixture was added; same Review schema as Run 1).
- Wallclock: Circuit 55.4s, vanilla 43.7s.

### Scoring

| Defect | Subtlety | Vanilla | Circuit |
|---|---|---|---|
| D1 — eval RCE | obvious | ✓ CRITICAL @ line 11 | ✓ CRITICAL @ uploads.js:12 |
| D2 — SQL injection | obvious | ✓ CRITICAL @ line 16 | ✓ CRITICAL @ uploads.js:17 |
| D3 — counter race | moderate | ✓ HIGH @ lines 22-26 | ✓ HIGH @ uploads.js:22-26 |
| D4 — chunk off-by-one | subtle | ✓ HIGH @ line 31 | ✓ MEDIUM @ uploads.js:31 |
| D5 — finally swallows promise | subtle | ✓ MEDIUM @ line 38 | ✓ HIGH @ uploads.js:44, 62 |
| D6 — symlink-following in readPublicAsset | very subtle | ✗ missed | ✗ **affirmatively cleared** |

- Both arms: 5/6. Both missed D6.
- False positives: 0 on both arms.
- Severity grades: D4 and D5 swap between the arms — Circuit calls D4 medium and D5 high; vanilla flips it.

### The D6 regression (notable)

At haiku-low, Circuit caught D6 (the symlink-following defect that defeats the path-traversal check) and vanilla missed it. That single catch was the entire Circuit lift.

At sonnet-medium, **Circuit no longer catches D6, and worse, explicitly declares the function safe** in its `Verified` enumeration: *"Verified the path.resolve + startsWith(PUBLIC_ROOT + path.sep) guard in readPublicAsset for bypass edge cases; found it sound."* The Assessment paragraph echoes this: *"The path-traversal guard in readPublicAsset is correctly implemented and raised no finding."*

This is more confident wrongness than missing the defect would be. The Verified enumeration is intended to surface what the reviewer actually checked — when it asserts a function is sound and the function isn't, the operator gets actively misled.

### Lift comparison

| Metric | Haiku-low (Run 1) | Sonnet-medium (Run 2) |
|---|---|---|
| Circuit defects caught | 6/6 | 5/6 |
| Vanilla defects caught | 5/6 | 5/6 |
| Circuit-over-vanilla lift | +1 (subtle) | 0 |
| Wallclock cost | Circuit +40% | Circuit +27% |

**The lift narrowed to zero at sonnet-medium.** Direct prompting at the production tier matches Circuit's catch on the same model, while Circuit costs ~27% more wallclock.

### Honest read on the 10x thesis

The haiku-low result was 1.2x. The sonnet-medium result is 1.0x. This is the opposite of what the 10x thesis needs: Circuit's structured-prompting effect on Review does not survive the model-tier transition.

Two readings, both worth weighing:

1. **The structured-prompting lift is illusory at production tier.** A stronger model is already running an internal "structured" reasoning process that the prompt scaffold can't add to. The single subtle catch at haiku-low was the structured prompt compensating for a weaker reasoner — once the reasoner is strong enough, the scaffold is redundant.
2. **The Verified-list mechanic actively hurts.** When a strong model is asked to enumerate what it checked, it performs the enumeration without performing the checks deeply enough to catch the symlink case, then asserts a clean bill of health that's wrong. This is a flow-architecture defect, not a model defect.

Either way, **Review's structured prompting alone is not the path to a 10x bar.** What Circuit Review buys today is structured output formatting and an Assessment paragraph — both useful for human consumption, neither categorically better than direct prompting.

The architectural changes outlined in Run 1 (adversarial second pass, tool-grounded verification, multi-model voting) remain the only plausible paths to a real lift — and the second one (tool-grounded verification) is the one that would catch the D6-style "looks defended but the check doesn't actually defend" pattern, since the symlink defect is provable by `realpath` against the resolved path. That's what direct prompting structurally cannot replicate.

### Implication for flow choice

Build and Fix have plan-then-act and verification-gate steps that direct prompting cannot replicate by prompt engineering alone. They are structurally better testbeds for the 10x bar than Review.

Recommendation: stop iterating on Review structured prompting. Either commit to one architectural change on Review (tool-grounded verification is the candidate based on this evidence) or pick Build/Fix as the testbed for the 10x calibration and re-baseline there.

### What this experiment revealed

1. **Lift does not survive model-tier transitions.** The haiku-low Circuit lift was real but lost on the way to sonnet-medium.
2. **Circuit's Verified-list mechanic can produce confident false negatives.** The path-traversal guard is asserted sound when it isn't. Worth scoping the Verified list to claims the model can actually defend.
3. **The 10x thesis on Review needs flow-architecture changes, not prompt changes.** Direct prompting at production tier is already at parity.

## Suggested follow-ups (after Run 2)

- Pick a single architectural change for Review (tool-grounded verification is the leading candidate from D6 evidence) and run a third comparison.
- OR move calibration to Build/Fix — they have verification-gate steps that direct prompting cannot replicate.
- Build a second adversarial-review task and run sonnet-medium on it before committing to either path; one task is not a baseline.
- Audit the Verified-list mechanic for whether items in the list are actually defensible vs. confident-sounding placeholders.
