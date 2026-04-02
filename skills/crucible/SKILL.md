---
name: circuit:crucible
description: >
  Adversarial tournament circuit that pressure-tests solutions. 7 steps across
  4 phases: Framing -> Diverge -> Converge -> Harden. Throws N approaches into
  parallel exploration, stress-tests each via red-team review, strengthens
  survivors, selects and synthesizes the best, then hardens via pre-mortem.
  Use when facing a non-trivial problem, "crucible X", "pressure-test approaches
  for X", "explore and stress-test X". Do not use for simple questions,
  implementation tasks, architecture decisions (use circuit:decide), or bug
  fixes (use circuit:repair-flow).
---

# Crucible Circuit

An artifact-centric workflow that explores a problem from multiple angles using an
adversarial tournament bracket, then selects, synthesizes, and hardens the best approach.
It chains problem framing -> parallel exploration -> adversarial review -> strengthened
proposals -> selection synthesis -> pre-mortem -> final hardened proposal through 4 phases.

The tournament bracket structure prevents premature convergence. Instead of one worker
generating one answer, three independent workers develop genuinely different approaches.
Each is attacked by a reviewer who sees only that proposal. Each is revised to address
its review. Only then does the orchestrator see all approaches together, selecting the
strongest and stealing the best ideas from the losers. A pre-mortem assumes the result
failed and works backwards to find why, producing a final proposal that has survived
adversarial pressure from multiple angles.

## When to Use

- Non-trivial problem with multiple viable approaches and real tradeoffs
- Need adversarial stress-testing before committing to a direction
- User says "deliberate on X", "explore approaches for X", "think through X"
- Want to compare genuinely different solutions, not surface variations
- Problem where premature convergence would be costly

Do NOT use for:
- Simple questions with obvious answers
- Implementation/coding tasks (use `circuit:develop`)
- Architecture decisions with known tradeoffs (use `circuit:decide`)
- Bug fixes or broken flows (use `circuit:repair-flow`)
- Tasks that need execution, not deliberation

## Glossary

- **Artifact** -- A canonical circuit output file in `${RUN_ROOT}/artifacts/`. Each step
  produces exactly one artifact (or a set of parallel artifacts).
- **Worker report** -- The raw output a dispatched worker writes to its relay `reports/`
  directory. Worker reports are inputs to artifact synthesis, not artifacts themselves.
- **Synthesis** -- When the orchestrator reads prior artifacts and writes a new artifact
  directly, without dispatching a worker.
- **Pre-mortem** -- A retrospective failure narrative written from the perspective of
  someone who watched the proposal fail after implementation. Not a generic risk list.
- **Adversarial review** -- A red-team critique that stress-tests a proposal against
  specific criteria (coherence, assumptions, feasibility, failure modes). The goal is
  to find what is wrong, not to be balanced.
- **Selection criteria** -- The priority-ordered rubric used in Step 5 to choose the
  winning approach: first-principles fit > thoroughness > context fit > survivability.

## Principles

- **Artifacts, not commentary.** Every step exits with a durable file. No step ends
  without writing its output artifact to disk.
- **Genuine divergence.** Exploration workers must take genuinely different philosophical
  stances on the problem — different foundational assumptions, not surface variations
  of the same approach.
- **Worker isolation is structural.** Reviewers do not see other proposals. Revision
  workers do not see other revisions. The pre-mortem worker does not see the adversarial
  reviews. Independence is enforced by what is passed, not by instruction.
- **Steal from the losers.** Selection is not "pick the best." It is "pick the best,
  then absorb the strongest ideas from the non-selected proposals into the winner."
- **Pre-mortem, not risk list.** The pre-mortem worker assumes the proposal was
  implemented and failed. They write a specific failure narrative — not "it could be
  hard" but "the caching layer was added in week 3 without updating invalidation logic,
  causing stale data for 72 hours."
- **Reopen on disconfirming evidence.** If the pre-mortem or user review reveals
  invalidating evidence, the circuit reopens to the appropriate earlier step rather
  than patching locally.

## Setup

```bash
RUN_SLUG="<topic-slug>"
RUN_ROOT=".circuitry/circuit-runs/${RUN_SLUG}-crucible"
mkdir -p "${RUN_ROOT}/artifacts"
```

Record `RUN_ROOT` — all paths below are relative to it. Step 1 captures all runtime
inputs (problem description, goals, constraints).

**Per-step scaffolding** — before each dispatch step, create:
```bash
step_dir="${RUN_ROOT}/phases/<step-name>"
mkdir -p "${step_dir}/reports" "${step_dir}/last-messages"
```

## Domain Skill Selection

Exploration workers (Step 2) may benefit from domain skills depending on the problem:
- Research-heavy problems: `deep-research`
- Solution comparison: `solution-explorer`
- Both: `deep-research,solution-explorer`

Default: no domain skills. Max 2 skills per worker. Never append interactive skills
(like `proposal-review` or `grill-me`) to autonomous worker dispatches.

## Dispatch Backend

Dispatch steps use either **Codex CLI** or **Claude Code Agent** as the worker
backend. The backend is auto-detected: if `codex` is on PATH, use Codex; otherwise,
fall back to Agent. The assembled prompt is identical for both backends.

**Codex backend:**
```bash
cat ${step_dir}/prompt.md | codex exec --full-auto -o ${step_dir}/last-messages/last-message.txt -
```

**Agent backend:**
```
Agent(task=<contents of ${step_dir}/prompt.md>, isolation="worktree")
```

Or use the dispatch helper which auto-detects:
```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/dispatch.sh" \
  --prompt ${step_dir}/prompt.md \
  --output ${step_dir}/last-messages/last-message.txt
```

**Parallel dispatch:** Codex supports true parallel workers (`&` + `wait`). Agent
backend dispatches sequentially unless the orchestrator uses multiple Agent tool calls
in one response.

## Canonical Header Schema

Every dispatch step's prompt header includes: `# Step N: <title>`, then sections
`## Mission`, `## Inputs`, `## Output` (with **Path** and **Schema**),
`## Success Criteria`, `## Report Instructions`. The report section must include
these relay headings: `### Files Changed`, `### Tests Run`, `### Verification`,
`### Verdict`, `### Completion Claim`, `### Issues Found`, `### Next Steps`.

These headings prevent `compose-prompt.sh` from appending `relay-protocol.md` with
unresolved `{slice_id}` placeholders.

---

## Phase 1: Framing

### Step 1: Problem Intake — `interactive`

**Objective:** Turn a problem description into a structured brief that exploration
workers can act on independently.

**Conditional autonomy:** If the problem description is already detailed (clear
statement, goals, constraints) or the user requests autonomous mode, skip the
clarifying questions and generate the brief directly.

Otherwise, ask the user:

> We are opening the crucible. Please answer:
> 1. What is the core problem we need to solve?
> 2. What does a successful solution look like? (goals)
> 3. What constraints must any solution respect? (time, team, tech, etc.)
> 4. What context is relevant? (codebase, prior decisions, domain)
> 5. What is explicitly out of scope?
>
> Optional: any hints about approaches worth exploring? (these become
> exploration directives, not requirements)

Use predictive multi-select where possible — offer likely answers the user can
confirm or modify rather than open-ended prompts.

Write to `${RUN_ROOT}/artifacts/problem-brief.md`:

```markdown
# Problem Brief
## Problem Statement
## Goals
## Constraints
## Context
## Exclusions
## Exploration Directives
```

**Gate:** `problem-brief.md` exists with non-empty Problem Statement and Constraints
(Constraints may state "none identified" but must be present).

---

## Phase 2: Diverge

### Step 2: Parallel Exploration — `dispatch` (3 parallel workers)

**Objective:** Produce three genuinely different approaches to the problem.

**Setup (3 workers):**
```bash
for w in a b c; do
  mkdir -p "${RUN_ROOT}/phases/step-2${w}/reports" \
           "${RUN_ROOT}/phases/step-2${w}/last-messages"
done
```

**Header** (`${RUN_ROOT}/phases/step-2{a,b,c}/prompt-header.md`):

Each worker gets the full text of `problem-brief.md` plus a distinct exploration
directive. Assign each worker a different philosophical stance:
- Worker A: e.g., "Minimize complexity — the simplest solution that could work"
- Worker B: e.g., "Maximize robustness — handle every edge case and failure mode"
- Worker C: e.g., "Optimize for extensibility — build for the next three problems too"

Tailor stances to the problem domain. The key requirement: each stance leads to a
fundamentally different approach, not a surface variation.

Worker prompt rules:
- Frame each worker as writing the sole proposal (do not mention other workers)
- Instruct full commitment to their assigned stance — no hedging, no "it depends"
- Require explicit statement of what the approach is NOT doing and why
- Include `## Exploration Directives` from the problem brief as optional hints

**Example header** (`${RUN_ROOT}/phases/step-2a/prompt-header.md`):
```markdown
# Step 2: Parallel Exploration — Worker A

## Mission
Develop a proposal for solving the problem described below. Your stance:
minimize complexity — find the simplest solution that could work. Commit fully
to this philosophy. Do not hedge. State explicitly what you are NOT doing and why.

## Inputs
[Full text of problem-brief.md]

## Output
- **Path:** `${RUN_ROOT}/phases/step-2a/proposal-a.md`
- **Schema:**
  `# Proposal A: <approach name>`, `## Approach`, `## Rationale`,
  `## Tradeoffs`, `## Implementation Sketch`

## Success Criteria
The proposal commits to a distinct stance, covers all four schema sections,
and explicitly states what it excludes.

## Report Instructions
Write your primary output to the path above. Also write a standard report to
`reports/report.md` with these exact section headings:

### Files Changed
### Tests Run
### Verification
### Verdict
### Completion Claim
### Issues Found
### Next Steps
```

**Output schema** for each `proposal-{a,b,c}.md`:
```markdown
# Proposal {A/B/C}: <approach name>
## Approach
## Rationale
## Tradeoffs
## Implementation Sketch
```

**Compose and dispatch (repeat for each worker {a, b, c}):**
```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/compose-prompt.sh" \
  --header ${RUN_ROOT}/phases/step-2${w}/prompt-header.md \
  --skills <domain-skills> \
  --root ${RUN_ROOT}/phases/step-2${w} \
  --out ${RUN_ROOT}/phases/step-2${w}/prompt.md

"$CLAUDE_PLUGIN_ROOT/scripts/relay/dispatch.sh" \
  --prompt ${RUN_ROOT}/phases/step-2${w}/prompt.md \
  --output ${RUN_ROOT}/phases/step-2${w}/last-messages/last-message.txt
```

Dispatch all three in parallel (background + wait, or concurrent Agent calls).

**Verify and promote:**
```bash
for w in a b c; do
  cp ${RUN_ROOT}/phases/step-2${w}/proposal-${w}.md ${RUN_ROOT}/artifacts/proposal-${w}.md
done
```

**Fallback:** If a worker only wrote `reports/report.md` instead of the primary
artifact, read the report content, extract the approach narrative, and write it
into the standard proposal schema (Approach, Rationale, Tradeoffs, Implementation
Sketch). The orchestrator performs this extraction — do not re-dispatch the worker.

**Gate:** All three proposals exist. Each contains Approach, Rationale, Tradeoffs,
and Implementation Sketch.

### Step 3: Adversarial Review — `dispatch` (3 parallel workers)

**Objective:** Stress-test each proposal independently via red-team review.

Reference Step 2 for dispatch recipe. Per-worker setup:
```bash
step_dir="${RUN_ROOT}/phases/step-3${w}"  # w in {a, b, c}
```

Each reviewer receives exactly ONE proposal (`proposal-{x}.md`). No cross-contamination.

**Example header** (`${RUN_ROOT}/phases/step-3a/prompt-header.md`):
```markdown
# Step 3: Adversarial Review — Worker A

## Mission
You are a red-team reviewer. Your job is to find what is wrong with this
proposal, not to be balanced. Stress-test it against the criteria below.

## Inputs
[Full text of proposal-a.md]

## Output
- **Path:** `${RUN_ROOT}/phases/step-3a/review-a.md`
- **Schema:**
  `# Review A: <proposal name>`, `## Strengths`, `## Weaknesses`,
  `## Hidden Assumptions`, `## Feasibility Assessment`, `## Verdict`

## Success Criteria
The review names specific failure conditions (not generic risks), identifies
at least one hidden assumption, and delivers a justified verdict.

## Report Instructions
Write your primary output to the path above. Also write a standard report to
`reports/report.md` with relay headings per the canonical schema.
```

**Adversarial review criteria** (embed in each worker's header):
- **Internal coherence:** Does the approach contradict itself?
- **Hidden assumptions:** What must be true for this to work? Are those stated?
- **Feasibility:** Can a normal team implement this? Where is complexity underestimated?
- **Failure modes:** Under what specific conditions does this fail? Not "it could be
  hard" but "if X happens, this fails because Y."
- **Verdict:** Select (with modifications), revise significantly, or discard. Justify.

Reviews should be adversarial in the sense of a red team — the goal is to find what
is wrong, not to provide balanced feedback.

**Output schema** for each `review-{a,b,c}.md`:
```markdown
# Review {A/B/C}: <proposal name>
## Strengths
## Weaknesses
## Hidden Assumptions
## Feasibility Assessment
## Verdict
```

Compose, dispatch, verify, and promote per Step 2 pattern with paths adjusted to
`step-3{w}` and output `review-{w}.md`.

**Gate:** All three reviews exist. Each contains Strengths, Weaknesses, Hidden
Assumptions, Feasibility Assessment, and Verdict.

### Step 4: Strengthened Proposals — `dispatch` (3 parallel workers)

**Objective:** Each worker produces the strongest possible version of their assigned
approach, addressing the review findings.

Reference Step 2 for dispatch recipe. Per-worker setup:
```bash
step_dir="${RUN_ROOT}/phases/step-4${w}"  # w in {a, b, c}
```

Each worker receives their proposal AND its paired review (`proposal-{x}.md` +
`review-{x}.md`). Workers do not see other proposals or reviews.

**Example header** (`${RUN_ROOT}/phases/step-4a/prompt-header.md`):
```markdown
# Step 4: Strengthened Proposal — Worker A

## Mission
Revise this proposal to address every weakness and assumption identified in
its adversarial review. Strengthen the approach — do not abandon it or merge
it with other approaches. Your job is to produce the strongest possible
version of THIS specific approach.

## Inputs
[Full text of proposal-a.md]
[Full text of review-a.md]

## Output
- **Path:** `${RUN_ROOT}/phases/step-4a/revised-a.md`
- **Schema:**
  `# Revised Proposal A: <approach name>`, `## Approach`, `## Rationale`,
  `## Tradeoffs`, `## Implementation Sketch`, `## Changes from Original`

## Success Criteria
Every weakness from the review is either addressed or explicitly rebutted.
The Changes from Original section names what changed and why.

## Report Instructions
Write your primary output to the path above. Also write a standard report to
`reports/report.md` with relay headings per the canonical schema.
```

The worker's job: address every weakness and assumption identified in the review.
Strengthen the approach — do not abandon it or merge it with other approaches.

**Output schema** for each `revised-{a,b,c}.md`:
```markdown
# Revised Proposal {A/B/C}: <approach name>
## Approach
## Rationale
## Tradeoffs
## Implementation Sketch
## Changes from Original
```

Compose, dispatch, verify, and promote per Step 2 pattern with paths adjusted to
`step-4{w}` and output `revised-{w}.md`.

**Gate:** All three revised proposals exist. Each contains Approach, Rationale,
Tradeoffs, Implementation Sketch, and Changes from Original.

---

## Phase 3: Converge

### Step 5: Selection + Synthesis — `synthesis`

**Objective:** Select the strongest approach, absorb the best ideas from losing
proposals, and produce a merged proposal.

The orchestrator reads all six artifacts: `revised-{a,b,c}.md` and `review-{a,b,c}.md`.

**Selection criteria** (priority order):
1. **First-principles fit** — Does it address the root cause, not symptoms?
2. **Thoroughness** — Does it handle edge cases and the full problem scope?
3. **Context fit** — Given the constraints in the problem brief, is it realistic?
4. **Adversarial survivability** — Which approach held up best under review?

**Steal from the losers:** After selecting, explicitly name 2-3 ideas from the
non-selected proposals that strengthen the winner. The synthesis is not "pick the
best" — it is "make the best even better using what the others got right."

Write to `${RUN_ROOT}/artifacts/selection-synthesis.md`:

```markdown
# Selection + Synthesis
## Selection Rationale
## Synthesized Elements
## Merged Proposal
```

**Gate — `verdict-reopen`:** `selection-synthesis.md` exists with non-empty Selection
Rationale (names the chosen approach), Synthesized Elements (lists absorbed ideas),
and Merged Proposal.

If the orchestrator determines that all three revised proposals are fundamentally
inadequate — no approach is viable even after adversarial strengthening — trigger
reopen to Step 2. Optionally update `problem-brief.md` with sharper constraints
before re-exploring.

| Trigger | Target | Behavior |
|---------|--------|----------|
| All approaches inadequate | Step 2 | Delete from `proposal-*.md` forward, re-explore |
| Viable winner exists | Continue | Proceed to Phase 4: Harden |

---

## Phase 4: Harden

### Step 6: Pre-mortem Review — `dispatch` (single worker)

**Objective:** Identify how the synthesized proposal would fail if implemented.

Reference Step 2 for dispatch recipe. Single worker setup:
```bash
step_dir="${RUN_ROOT}/phases/step-6"
```

The worker receives `selection-synthesis.md` only. Prior adversarial reviews are
intentionally withheld for a fresh perspective.

**Pre-mortem framing** (embed in worker header):

> Assume this proposal was fully implemented six months ago. It failed. The team is
> doing a retrospective. You are the person who saw the failure coming but didn't
> speak up loudly enough. Your job is to explain exactly why it failed.

This framing is critical. Without it, workers produce generic risk lists. With it,
they produce specific, situated failure narratives.

**Output schema** for `pre-mortem.md`:
```markdown
# Pre-mortem Review
## Failure Scenarios
## Edge Cases
## Blind Spots
## Environmental Risks
```

Failure Scenarios must be 3-5 specific, plausible failure modes with concrete
mechanisms (not "insufficient testing" but "the caching layer was added in week 3
without updating the invalidation logic, causing stale data for 72 hours").

Compose, dispatch, verify, and promote per Step 2 pattern with paths adjusted to
`step-6` and output `pre-mortem.md`.

**Gate:** `pre-mortem.md` exists with all four sections populated.

### Step 7: Final Revision — `dispatch` (single worker)

**Objective:** Harden the proposal by addressing pre-mortem findings.

Reference Step 2 for dispatch recipe. Single worker setup:
```bash
step_dir="${RUN_ROOT}/phases/step-7"
```

The worker receives `selection-synthesis.md` and `pre-mortem.md`. The worker
addresses each failure scenario, edge case, and blind spot — either by modifying
the proposal or by explicitly acknowledging the risk with a mitigation strategy.

Write to `${RUN_ROOT}/artifacts/final-proposal.md`.

**Gate — `verdict-reopen`:** `final-proposal.md` exists. The orchestrator evaluates
whether pre-mortem findings are adequately addressed.

**Reopen paths:**

| Trigger | Target | Behavior |
|---------|--------|----------|
| Pre-mortem gaps: findings partially addressed | Step 6 | Delete `pre-mortem.md` + `final-proposal.md`, re-run pre-mortem |
| Synthesis flawed: wrong winner or bad merge | Step 5 | Delete from `selection-synthesis.md` forward, re-do synthesis |
| Fundamentally unsatisfied: all approaches inadequate | Step 2 | Delete from `proposal-*.md` forward, optionally update brief, re-explore |

Reopen always deletes artifacts from the target forward. Never delete upstream artifacts.

---

## Artifact Chain Summary

```text
problem-brief.md                              [Step 1: interactive]
  -> proposal-a.md || proposal-b.md || proposal-c.md    [Step 2: parallel dispatch]
  -> review-a.md   || review-b.md   || review-c.md      [Step 3: parallel dispatch]
  -> revised-a.md  || revised-b.md  || revised-c.md     [Step 4: parallel dispatch]
  -> selection-synthesis.md                              [Step 5: orchestrator synthesis]
  -> pre-mortem.md                                       [Step 6: dispatch]
  -> final-proposal.md                                   [Step 7: dispatch + verdict-reopen]
```

## Resume Awareness

If `${RUN_ROOT}/artifacts/` already has files, determine the resume point by checking
artifacts in chain order:

1. `problem-brief.md` missing? -> resume at Step 1
2. Any `proposal-{a,b,c}.md` missing? -> resume at Step 2
3. Any `review-{a,b,c}.md` missing? -> resume at Step 3
4. Any `revised-{a,b,c}.md` missing? -> resume at Step 4
5. `selection-synthesis.md` missing? -> resume at Step 5
6. `pre-mortem.md` missing? -> resume at Step 6
7. `final-proposal.md` missing? -> resume at Step 7
8. All artifacts present -> circuit complete; surface `final-proposal.md`

**Partial parallel resume:** For Steps 2, 3, and 4, check individual worker artifacts.
If 2 of 3 proposals exist, dispatch only the missing worker. Completed workers are
not re-run.

**Reopen resume:** If artifacts exist from a reopen target forward, they are stale.
Delete from the reopen target forward and resume at that step.

## Circuit Breaker

Escalate to the user when:
- A dispatch step fails twice with no valid output
- All three proposals converge on the same approach despite different stances
- The pre-mortem identifies a fundamental flaw that no revision can address
- The problem brief is too vague to produce meaningfully different explorations
