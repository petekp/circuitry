---
name: cloudflare-glasswing-block-review
description: Repo-backed review of Cloudflare Project Glasswing harness stages against Circuit's block set.
type: product-architecture
date: 2026-05-18
status: reviewed
---

# Cloudflare Glasswing Block Review

## Scope

Source: Cloudflare's ["Project Glasswing: what Mythos showed us"](https://blog.cloudflare.com/cyber-frontier-models/) post, published 2026-05-18.

Local context:
[docs/learnings/cloudflare-glasswing-harness-confirmation.md](../learnings/cloudflare-glasswing-harness-confirmation.md),
[docs/flows/](./), `src/flows/*`, [docs/ideas/](../ideas/), eval notes, and
local repo search.

Cloudflare's harness stages map loosely to Circuit block concepts. The
Cloudflare post does not define them as Circuit-style blocks, so Circuit should
borrow useful shapes without copying names blindly.

This is a design report only. It does not request or assume any runtime behavior
change.

Claim labels:

- **Confirmed**: directly stated by the Cloudflare source or current Circuit
  docs/code.
- **Supported**: backed by repo evidence plus a clear inference.
- **Uncertain**: plausible, but needs a design, implementation, or eval before
  Circuit should treat it as true.

## Cloudflare Source Facts

The Cloudflare post makes five source claims that matter for Circuit:

- A generic coding agent pointed at a repository can produce findings, but
  Cloudflare says that shape does not produce meaningful coverage or enough
  valuable findings on real codebases. The stated causes are context limits and
  throughput limits.
- Cloudflare's four harness lessons are narrow scope, adversarial review,
  splitting different reasoning questions across agents, and parallel narrow
  tasks followed by dedupe.
- The named vulnerability-discovery stages are Recon, Hunt, Validate, Gapfill,
  Dedupe, Trace, Feedback, and Report.
- Validate is narrower than generic review: an independent agent tries to
  disprove the original finding and cannot emit new findings.
- Report writes structured data against a predefined schema; Cloudflare also
  warns that fast patching without regression discipline can break dependent
  behavior.

The existing local learning note records the same high-level takeaways:
Cloudflare moved from broad repo prompts to recon, narrow hunt tasks,
independent validation, requeueing, dedupe, reachability tracing, feedback, and
structured reports
([docs/learnings/cloudflare-glasswing-harness-confirmation.md:19-34](../learnings/cloudflare-glasswing-harness-confirmation.md#L19-L34)).
It also explicitly warns that Circuit does not already have Cloudflare's full
dynamic fanout, gapfill, dedupe, reachability, or scale shape
([docs/learnings/cloudflare-glasswing-harness-confirmation.md:104-114](../learnings/cloudflare-glasswing-harness-confirmation.md#L104-L114)).

## Executive Recommendation

Borrow Cloudflare's harness ideas selectively.

The most useful concepts for Circuit are:

1. **Claim Validation**: a separate block or Review submode that tries to
   disprove a submitted claim and cannot emit unrelated new findings.
2. **Coverage Map**: a structured report, and possibly a later block, that says
   which surfaces were inspected, which were skipped, and why.
3. **Gap Queue**: a bounded Queue extension that turns uncovered surfaces into
   new work without creating an infinite loop.
4. **Reachability Check**: a future block that asks whether a confirmed issue
   can actually affect the operator's system.
5. **Finding Cluster**: a future block for same-root-cause grouping before
   findings reach an operator-facing queue.

Do not borrow the whole Cloudflare scanner shape as a default Circuit flow.
Cloudflare's harness is tuned for large-scale vulnerability discovery. Circuit's
current product promise is broader: run developer flows with durable evidence,
typed reports, honest closeout, and lower babysitting. The transferable lesson is
that scoped blocks plus typed evidence beat broad prompts when the task is too
large for one coherent model pass.

## Current Circuit Baseline

Circuit already has a canonical reusable block catalog. The current documented
set includes Intake, Route, Frame, Human Decision, Gather Context, Diagnose,
Plan, Act, Run Verification, Review, Pursue, Coordinate Pursuits, Queue, Batch,
Risk/Rollback Check, Close With Evidence, and Handoff
([docs/flows/blocks.md:72-88](blocks.md#L72-L88),
[docs/flows/block-catalog.json:5-374](block-catalog.json#L5-L374)).

The authoring model says a block has stable identity, expected inputs, one
output contract, valid routes, and evidence requirements
([docs/flows/authoring-model.md:64-70](authoring-model.md#L64-L70)). It also
says custom flows should compose built-in blocks first
([docs/flows/authoring-model.md:74-75](authoring-model.md#L74-L75)) and that
many tiny branches usually mean the block model is missing a better reusable
block ([docs/flows/authoring-model.md:149-150](authoring-model.md#L149-L150)).

Pursue is Circuit's closest existing match for broad work. It creates an
ownership contract, coordinates dependencies and conflicts, serializes
code-changing work, verifies, reviews, and closes with evidence
(`src/flows/pursue/data.ts:42-64`). Its schemas already model estimated touch
sets, proof plans, check-in triggers, read-only parallelism, blocked parallel
writes, pursuit graphs, batch results, review severity, and close evidence
(`src/flows/pursue/reports.ts:46-65`, `src/flows/pursue/reports.ts:117-124`,
`src/flows/pursue/reports.ts:230-239`, `src/flows/pursue/reports.ts:305-347`,
`src/flows/pursue/reports.ts:390-402`).

The important limit: Pursue V1 deliberately serializes code-changing work.
Current docs allow read-only discovery to be marked parallel-safe, but they do
not run a separate parallel discovery fanout yet
([docs/flows/pursue.md:24-27](pursue.md#L24-L27),
[docs/flows/pursue.md:47-52](pursue.md#L47-L52)). The sandboxed parallel Pursue
design says the missing piece is safe apply; only Circuit should apply verified
change packets after isolation and disjointness checks
([docs/ideas/sandboxed-parallel-pursuits.md:18-28](../ideas/sandboxed-parallel-pursuits.md#L18-L28),
[docs/ideas/sandboxed-parallel-pursuits.md:54-59](../ideas/sandboxed-parallel-pursuits.md#L54-L59)).

Review is useful but narrower than Cloudflare's Validate. The Review flow is
audit-only and does not implement, rerun verification, or nest another review
stage (`src/flows/review/data.ts:58`, `src/flows/review/data.ts:96`). It does
have reviewer identity separation and severity-based verdict determinism
(`src/flows/review/contract.md:64-82`), but current eval notes show Review's
structured prompting alone does not reliably beat a strong direct prompt and can
produce confident false negatives (`evals/circuit-vs-vanilla/tasks/adversarial-review-planted-defects/RESULT-NOTES.md:61-66`,
`evals/circuit-vs-vanilla/tasks/adversarial-review-planted-defects/RESULT-NOTES.md:111-137`).

Fix is the stronger proof precedent. The held-out Fix eval showed Circuit had
zero false-fixed outcomes across five held-out tasks while the strong vanilla
prompt had one false-fixed outcome; the documented explanation is that Circuit
ran objective checks and closed only after they passed
(`evals/fix-vs-vanilla/RESULTS.md:10-20`,
`evals/fix-vs-vanilla/RESULTS.md:44-45`). That supports borrowing Cloudflare's
proof-first posture more than borrowing raw parallelism.

## Cloudflare Block Mapping

| Cloudflare stage | Purpose in Cloudflare harness | Closest Circuit shape | Adversarial failure mode | Recommendation | Claim label |
|---|---|---|---|---|---|
| Recon | Build shared architecture context, trust boundaries, entry points, likely attack surface, and the initial queue. | Frame + Gather Context + Pursue contract + Queue. | A bad map can create false confidence. If the map misses generated code, runtime config, or an entry point, every downstream worker inherits that blind spot. | **Adapt** as a Coverage Map report first. Make it record inspected, skipped, and unknown surfaces. Promote to a block only after it proves useful in Pursue or Review. | Confirmed for Cloudflare source; supported for Circuit adoption. |
| Hunt | Run many narrow tasks, each pairing one attack class with one scope hint. | Queue + Batch + Act, with Pursue as the coordinator. | Parallel narrow tasks can multiply low-value findings. A hunter can optimize for "find something" instead of "prove something important." | **Adapt** the scoped task contract. Do not adopt Cloudflare's high-concurrency pattern as a default until Circuit has safe fanout and clear proof gates. | Confirmed for Cloudflare source; supported for Circuit adoption. |
| Validate | Independent agent rereads code and tries to disprove the original finding. It cannot emit new findings. | Review, but only partially. Circuit Review can emit findings and is audit-only rather than claim-validation-only. | A validator can rubber-stamp the first model, or become confidently wrong if it lacks a reproduction path. If it can emit new findings, it stops being a disproof block and becomes another noisy hunter. | **Borrow strongly** as Claim Validation. This is the clearest new block candidate. It should accept one claim, evidence, scope, and proof target; output upheld, disproved, or inconclusive with tool-backed reasons. | Confirmed for Cloudflare source; supported for Circuit gap. |
| Gapfill | Requeue areas touched but not covered thoroughly. | Queue + Batch retry paths + Pursue skipped/blocked accounting. | Without a stop rule, gapfill becomes endless churn. Without a coverage map, it just revisits whatever the model found interesting. | **Adapt** as a bounded Gap Queue extension. It should require a Coverage Map and cap retry rounds. | Confirmed for Cloudflare source; supported for Circuit gap. |
| Dedupe | Collapse findings with the same root cause into one record. | Coordinate Pursuits can model conflicts and composition; Review findings have IDs; Pursue de-dupes pursuit IDs, not root causes. | Over-merge hides distinct bugs. Under-merge inflates the queue and wastes operator attention. Root-cause grouping can be wrong when based only on prose similarity. | **Add later** as Finding Cluster for review/fleet work. It should require source references and a root-cause rationale, not just matching words. | Confirmed for Cloudflare source; supported for Circuit gap. |
| Trace | Decide whether attacker-controlled input reaches a confirmed issue from outside the system. | Risk/Rollback Check + Gather Context + Review, but no direct equivalent. Circuit already uses "trace" for run records, so this should not become a Circuit block named Trace. | Static reachability can miss runtime configuration, feature flags, generated routes, and data-dependent paths. It can also overstate impact by assuming every caller is attacker-reachable. | **Adapt later** as Reachability Check or Impact Check. Put it after Claim Validation, not before. | Confirmed for Cloudflare source; supported for Circuit gap. |
| Feedback | Turn reachable traces into new hunt tasks in affected consumer repos. | Routes + Queue + Batch + future dynamic fanout. | Feedback can become blind retry. It can amplify a false positive if validation or reachability is weak. | **Adapt as route policy**, not a standalone block yet. It should feed only validated, bounded gaps back into Queue. | Confirmed for Cloudflare source; supported for Circuit adoption. |
| Report | Write a structured report against a predefined schema and submit queryable data. | Circuit typed reports, report schemas, run folders, evidence links, and Close With Evidence. | A schema can make wrong claims look more trustworthy. Validation proves shape, not truth. | **Keep and strengthen**. Add fields for coverage, claim validation, gap reasons, finding clusters, and reachability when those concepts exist. | Confirmed for both Cloudflare and Circuit. |

## Per-Block Analysis

### Recon -> Coverage Map

Cloudflare uses Recon to stop downstream workers from wandering. It creates the
shared context and initial task queue. Circuit already has Frame and Gather
Context for narrowing, and Pursue can create a contract with scope, proof plan,
and touch sets ([docs/flows/blocks.md:76-84](blocks.md#L76-L84),
`src/flows/pursue/reports.ts:46-65`).

What Circuit lacks is a durable coverage object. A context packet says what was
found. It does not necessarily say what was searched, what was skipped, and
which surfaces remain unknown. That matters because Cloudflare's main critique
of a generic coding agent is coverage, not intelligence alone. The existing
Cloudflare learning note already calls out coverage accounting as a first-class
Pursue pressure
([docs/learnings/cloudflare-glasswing-harness-confirmation.md:78-89](../learnings/cloudflare-glasswing-harness-confirmation.md#L78-L89)).

Recommendation: add a `coverage-map@v1` report shape before adding a new block.
Potential fields:

- `scope`: paths, symbols, generated outputs, commands, docs, or repos in scope.
- `covered`: surfaces inspected enough to support a claim.
- `partial`: surfaces touched but not enough to close.
- `unknown`: surfaces named by the task but not inspected.
- `gap_reasons`: time, missing dependency, unsafe action, insufficient evidence,
  or intentionally out of scope.
- `next_queue_candidates`: bounded items for Queue.

Adversarial check: Coverage Map is dangerous if it becomes decorative. It should
only be trusted when each covered or partial surface has evidence pointers.

### Hunt -> Scoped Probe Items

Cloudflare's Hunt stage works because each worker gets a narrow question: attack
class plus scope hint. Circuit's closest current primitives are Queue and Batch:
Queue turns broad work into ordered items, and Batch processes a bounded set
with completed, skipped, blocked, and failed states
([docs/flows/blocks.md:84-85](blocks.md#L84-L85)).
Pursue adds graph coordination and serial execution for code-changing work
(`src/flows/pursue/data.ts:178-218`).

Recommendation: do not add a generic Hunt block. Add a stronger Queue item
contract for scoped probes:

- `probe_question`
- `scope_hint`
- `evidence_target`
- `allowed_tools`
- `stop_condition`
- `validation_required`

This preserves Circuit vocabulary and avoids importing a security-specific word
into general developer flows.

Adversarial check: High concurrency is not the lesson to borrow first. The
sandboxed parallel Pursue design explicitly warns that shared worktrees are the
wrong default for parallel writes
([docs/ideas/sandboxed-parallel-pursuits.md:61-81](../ideas/sandboxed-parallel-pursuits.md#L61-L81)).
Circuit should parallelize read-only probes earlier than writes, and keep write
application behind safe apply.

### Validate -> Claim Validation

This is the strongest adoption candidate.

Cloudflare's Validate stage is not just "review." It is constrained disproof:
an independent agent rereads the code, tries to falsify the original finding,
uses a different prompt, and cannot emit new findings. Circuit's Review block
independently judges a result ([docs/flows/blocks.md:81](blocks.md#L81)) and the Review flow
has reviewer identity separation (`src/flows/review/contract.md:64-72`), but
Review currently remains an audit surface that can produce findings. It is not
a one-claim disproof block.

The eval evidence makes this urgent. Circuit Review's structured prompt gave a
small lift at one setting, then lost that lift at a stronger model tier, and the
Verified list asserted a vulnerable function was sound
(`evals/circuit-vs-vanilla/tasks/adversarial-review-planted-defects/RESULT-NOTES.md:111-137`).
Cloudflare's validator design attacks exactly that class of problem: it narrows
the second pass to disproof instead of asking a reviewer to both discover and
judge.

Recommendation: create a conceptual `claim-validation` block before broadening
Review. It should be usable by Review, Fix, Pursue, and future fleet flows.

Potential contract:

- Input: one claim, source refs, evidence packet, scope, allowed commands, and
  validation question.
- Output: `upheld`, `disproved`, or `inconclusive`.
- Evidence: reproduction attempt, static search, command output, contradictory
  source refs, or reason the claim cannot be tested.
- Routes: Close, Act retry, Queue gap, Human Decision.
- Guardrail: no unrelated findings in the primary output. New issues can be
  emitted only as follow-up queue candidates.

Adversarial check: A validator without tools can still be confidently wrong. The
block should prefer tool-backed checks and mark unsupported reasoning as
inconclusive rather than upheld.

### Gapfill -> Gap Queue

Cloudflare's Gapfill requeues touched but under-covered areas. Circuit already
has enough state to notice partial work: Pursue Batch records skipped, blocked,
and failed items plus actual touch set and proof evidence
(`src/flows/pursue/reports.ts:230-239`). Pursue Result also prevents complete
outcomes when pursuits are skipped, blocked, or failed
(`src/flows/pursue/reports.ts:430-441`).

What Circuit lacks is a semantic gap record. "Skipped" says an item did not
complete. It does not say what part of the surface remains uncovered, whether
the gap matters, or what should be requeued.

Recommendation: model Gap Queue as an extension of Queue and Batch before adding
a standalone block. It should consume Coverage Map plus Batch Result and emit
bounded queue items with a retry budget.

Adversarial check: Gapfill must have a stop condition. If a flow can always say
"coverage incomplete," it can always avoid closing. Close With Evidence should
allow honest residual risks instead of forcing endless pursuit.

### Dedupe -> Finding Cluster

Cloudflare dedupes same-root-cause findings so variant analysis does not inflate
the queue. Circuit has some related machinery, but not the same concept. Pursue
Graph can express dependencies, conflicts, and composition
(`src/flows/pursue/reports.ts:98-124`). Pursue Batch prevents duplicate pursuit
IDs inside one batch (`src/flows/pursue/reports.ts:283-299`). That is not a
root-cause dedupe model.

Recommendation: add Finding Cluster later, after Claim Validation and Coverage
Map. The useful contract is:

- Input: validated findings or claims.
- Output: clusters with root-cause rationale, representative finding, variants,
  and merge confidence.
- Evidence: shared source refs, shared data path, shared failing test, or shared
  dependency.
- Routes: Report, Queue variant analysis, Human Decision.

Adversarial check: Dedupe is a high-risk summarizer. It can hide separate
operator decisions behind one neat root-cause story. It should preserve every
member finding and explain what would disprove the merge.

### Trace -> Reachability Check

Cloudflare's Trace stage asks whether a confirmed finding is reachable from
outside the system. This is different from Circuit's current word "trace,"
which means the serialized run record
([UBIQUITOUS_LANGUAGE.md:43-44](../../UBIQUITOUS_LANGUAGE.md#L43-L44)). Circuit
should avoid naming a new block Trace.

Circuit has adjacent blocks: Gather Context can collect source facts, Review can
judge risk, and Risk/Rollback Check can decide whether continuing is safe
([docs/flows/blocks.md:76](blocks.md#L76),
[docs/flows/blocks.md:81](blocks.md#L81),
[docs/flows/blocks.md:86](blocks.md#L86)).
None of these directly answer reachability.

Recommendation: add Reachability Check or Impact Check later. It should run only
after Claim Validation, because tracing an unvalidated claim wastes attention.

Potential contract:

- Input: validated claim, affected symbol/path, possible entry points, config
  facts, generated routes, and caller graph if available.
- Output: reachable, not reachable, unknown, or environment-dependent.
- Evidence: source refs, search output, call path, config condition, or test.
- Routes: Report, Queue consumer probe, Human Decision, Close.

Adversarial check: Reachability can be expensive and brittle. Static call paths
are not enough for web apps with routing, build-time transforms, feature flags,
or generated surfaces. Unknown must stay an allowed outcome.

### Feedback -> Typed Recovery Routes

Cloudflare's Feedback stage turns reachable traces into new hunt tasks. Circuit
already has route vocabulary and Queue/Batch can represent follow-up work. The
Pursue design also models blocked and partial work explicitly
([docs/flows/pursue.md:134-146](pursue.md#L134-L146),
`src/flows/pursue/reports.ts:230-239`).

Recommendation: do not add Feedback as a block yet. Treat it as route policy:
validated, bounded new work may go to Queue; unclear work goes to Human
Decision; unimportant residual risk goes to Close With Evidence.

Adversarial check: Feedback without validation compounds noise. Feedback without
a budget compounds cost. Feedback without operator-facing salience becomes
babysitting by another name.

### Report -> Stronger Structured Reports

Cloudflare's Report stage writes schema-backed output to queryable data. Circuit
already has typed reports and close evidence as core product machinery. The
authoring model says reports are useful only when each block writes structured
facts that later steps consume
([docs/flows/authoring-model.md:178-196](authoring-model.md#L178-L196)). The
future-proofing notes also argue that proof-carrying claims, schemas, and run
records become more important as models improve
([docs/ideas/future-proofing-circuit.md:25-41](../ideas/future-proofing-circuit.md#L25-L41),
[docs/ideas/future-proofing-circuit.md:134-137](../ideas/future-proofing-circuit.md#L134-L137)).

Recommendation: keep Report as a strength, but make the new concepts explicit
when they exist. Do not bury coverage, validation, dedupe, or reachability in
free-form prose.

Adversarial check: Schema validity is not truth. A report that validates but has
weak evidence should be visibly weak.

## Concrete Block-Set Changes Worth Pursuing

### 1. Add Claim Validation

Decision: **borrow strongly**.

This is the most immediately valuable Cloudflare concept. It is smaller and
sharper than Review. It also directly attacks current Review eval weaknesses.

First implementation shape:

- Add `claim-validation@v1` report schema.
- Use it as an optional Review/Pursue sub-step before making it a public block.
- Require one claim per validation run.
- Prohibit unrelated findings in the main result.
- Require tool-backed evidence or `inconclusive`.

Why it helps Circuit: it reduces confident false clearance and turns Review from
"model gives an opinion" toward "model tests a claim."

### 2. Add Coverage Map As A Report

Decision: **adapt now as a report, not a block**.

Coverage Map should start inside Pursue or Review experiments. If it becomes
reused across flows, promote it to a block.

Why it helps Circuit: it gives the operator an honest answer to "what did this
actually look at?" and gives Queue a principled source for follow-up work.

### 3. Add Gap Queue Semantics To Queue/Batch

Decision: **adapt, do not add a separate block yet**.

Queue already owns ordered work. Batch already owns completed/skipped/blocked/
failed states. Gap Queue should extend those contracts with coverage reasons and
retry limits.

Why it helps Circuit: it creates typed recovery instead of blind retry.

### 4. Plan Finding Cluster For Fleet Review

Decision: **add later**.

This should wait until Circuit has more repeated Review/Pursue evidence. It is
valuable when many workers can produce overlapping findings. It is unnecessary
for small single-change Fix runs.

Why it helps Circuit: it protects operator attention when there are many
findings, but it can be harmful if introduced before findings are validated.

### 5. Plan Reachability Check For Impact-Focused Work

Decision: **add later**.

Reachability is product-relevant beyond security. It can answer "does this bug
matter here?" or "can this generated-surface drift reach the published plugin?"
But it needs careful naming because Circuit already uses Trace for run records.

Why it helps Circuit: it turns "a flaw exists" into "this flaw affects this
operator decision."

## Concepts To Reject Or Defer

- **Reject Cloudflare's security-specific names as generic Circuit names.**
  Hunt and Trace are accurate in their domain but do not map cleanly to
  Circuit's product vocabulary.
- **Defer high-concurrency code-changing work.** Current Pursue docs are right
  to keep code writes serial until safe apply exists.
- **Reject broad "multi-agent is better" claims.** The evidence supports narrow
  roles with proof and validation, not agent count as a standalone virtue.
- **Reject autopatch-first as a default.** Cloudflare explicitly warns that fast
  patching without regression discipline can break dependent behavior. Circuit's
  Fix eval strength is objective proof before close, so keep that center of
  gravity.

## Eval Implications

New evals should test the block concepts directly:

- **Claim Validation eval**: seed one real issue, one plausible false issue, and
  one inconclusive issue. Score upheld/disproved/inconclusive, not finding count.
- **Coverage Map eval**: give a repo with generated surfaces and hidden entry
  points. Score whether the map names covered, partial, and unknown surfaces.
- **Gap Queue eval**: force an initial pass to miss a declared surface. Score
  whether the next queue item is targeted and bounded.
- **Finding Cluster eval**: seed duplicate findings with one shared root cause
  and one superficially similar distinct cause.
- **Reachability Check eval**: seed a real bug in an unreachable helper and a
  weaker bug reachable through a public route. Score the impact call.

The product claim should remain bounded: Circuit can reduce false-done and
babysitting when it converts broad work into typed, evidence-bearing blocks and
routes. The current repo supports that claim for Fix more strongly than Review.

## Uncertain Claims

These claims are intentionally left uncertain until Circuit has implementation
or eval evidence:

- **Uncertain**: Claim Validation will materially improve Review outcomes. The
  repo evidence shows why current Review needs a sharper validation path, but
  the new block still needs an eval.
- **Uncertain**: Coverage Map will reduce operator babysitting in Pursue. The
  need is supported by Cloudflare and current Pursue gaps, but the operator
  value needs a task-level measurement.
- **Uncertain**: Finding Cluster and Reachability Check generalize cleanly
  outside security work. They look useful for fleet review and impact triage,
  but should be proven on concrete Circuit tasks before becoming public blocks.

## Recommendation Summary

| Cloudflare concept | Circuit action |
|---|---|
| Recon | Add Coverage Map report; possible future block. |
| Hunt | Use scoped Queue items; do not import the name. |
| Validate | Add Claim Validation as the highest-priority block candidate. |
| Gapfill | Extend Queue/Batch with gap semantics and retry budgets. |
| Dedupe | Add Finding Cluster later for fleet review. |
| Trace | Add Reachability Check later; avoid the name Trace. |
| Feedback | Model as typed routes from validation/gap reports into Queue. |
| Report | Keep typed reports; strengthen evidence fields for new concepts. |

The near-term move is small: prototype Claim Validation and Coverage Map as
report schemas inside Review or Pursue. That gives Circuit the Cloudflare lesson
with the least runtime risk.

## Implementation Status

| Concept | Status in Circuit today | Proposed next step | Confidence |
|---|---|---|---|
| Claim Validation | Not first-class. Review is independent but broader and audit-only. | Design `claim-validation@v1` report schema and trial it inside Review/Pursue. | Supported, high priority. |
| Coverage Map | Not first-class. Gather Context and Pursue touch sets cover adjacent facts. | Add report shape before adding a new block. | Supported, high priority. |
| Gap Queue | Partially covered by Queue/Batch/Pursue skipped, blocked, and failed states. | Extend Queue/Batch with gap reasons and retry budgets. | Supported, medium priority. |
| Finding Cluster | Not first-class. Current de-dupe is item-id-level, not root-cause-level. | Defer until fleet or multi-review work produces repeated findings. | Supported, later. |
| Reachability Check | Not first-class. Adjacent to Risk/Rollback Check and Review. | Defer until validated claims need impact triage. | Supported, later. |
| High-concurrency code writes | Intentionally blocked by current Pursue policy. | Keep blocked until safe apply exists. | Confirmed current limit. |

## Adversarial Review Log

### Pass 1

Findings:

- **Medium - Cloudflare source support was too implicit.** The draft linked the
  article, but it did not separately list the source facts being used. That made
  it harder to audit whether every mapped stage came from Cloudflare or from a
  Circuit inference. Fixed by adding "Cloudflare Source Facts."
- **Medium - Recommendation status could be overread as implementation-ready.**
  The first draft recommended new concepts but did not clearly distinguish
  current behavior from proposed report/block work. Fixed by adding
  "Implementation Status" and an explicit no-runtime-change statement.

Resolution: all medium findings from pass 1 are resolved. No high or critical
findings were found.
