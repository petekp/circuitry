# Longitudinal Evidence Memory

Status: archived in place. This idea seed has been absorbed into the
self-auditing memory specs, the effective-memory program, and current history
memory implementation. Keep it only as historical lineage for cited memory
design ideas.

Idea seed for evolving Circuit's longitudinal evidence and memory system.
Captured 2026-05-27 from a discussion about Karl Friston's Free Energy
Principle, active inference, and evidence-based context engineering.

This is not an implementation spec. It is a product and architecture
brainstorm for the next layer after the current history recall system.

## Short Version

Circuit already has the beginning of a longitudinal evidence system:
run folders, traces, reports, a local history index, queryable recall, and
`MemoryInputV0` hints that can orient later runs. The important next step is
not "make memory bigger." It is "make memory more disciplined."

The useful Friston-inspired lens is:

- An agent should reduce uncertainty by choosing actions that produce useful
  evidence, not just actions that look locally productive.
- Some evidence deserves more weight than other evidence. Reliability matters.
- Surprise is signal. Repeated failure, contradiction, stale assumptions, and
  changed outcomes should shape future attention.
- Memory needs boundaries. It should not silently become authority.

For Circuit, that suggests a longitudinal system that can:

- Query prior evidence with provenance.
- Score evidence by freshness, relevance, reliability, and surprise.
- Show why a memory item was included or rejected.
- Ask for new evidence when old evidence is too weak.
- Consolidate repeated, verified patterns into stronger project memory only
  through an explicit, reviewable step.

The current `hint_only` boundary should stay. Memory can guide attention.
It should not authorize route selection, checkpoints, recovery, proof claims,
policy changes, or writes by itself.

## Current Ground Truth

Circuit's current history and memory behavior is narrower, and that is good.
The next design should build on these constraints rather than bypass them.

The V1 history spec defines local recall over `.circuit/runs` and
`.circuit/history`. It answers a bounded set of questions: which prior runs
look relevant, where the source evidence lives, whether it is stale, why it
ranked, and what a memory preview would look like.
See [`docs/specs/circuit-history-v1.md`](../specs/circuit-history-v1.md).

Run-start recall is already implemented for fresh `circuit run` sessions.
It runs before the flow graph, uses the operator goal as the query, limits
model-facing memory to a small number of memory-safe inputs, writes
`reports/history/recall.json`, and keeps going if history is missing,
empty, stale, or corrupt.
See [`docs/specs/circuit-history-run-start-recall-v1.md`](../specs/circuit-history-run-start-recall-v1.md).

The current query path is deterministic and lexical. It uses weighted terms,
phrase and bigram boosts, facet boosts for failures, checkpoints, and
verification, plus staleness and safety penalties.
See [`src/history/query.ts`](../../src/history/query.ts).

The current memory preview converts history hits into `MemoryInputV0` values
with `kind: "prior_run"` and `authority: "hint_only"`.
See [`src/history/memory-preview.ts`](../../src/history/memory-preview.ts)
and [`src/schemas/memory-input.ts`](../../src/schemas/memory-input.ts).

The relay prompt renders a "Prior Circuit History (hint-only)" section and
tells the model to re-run current checks before relying on prior evidence.
See [`src/shared/relay-support.ts`](../../src/shared/relay-support.ts).

V1 explicitly does not ship general recall blocks, resume-time recall,
embeddings, cross-repo memory, remote sync, memory-derived route authority,
checkpoint authority, recovery authority, proof authority, or silent
background recall.

That last point is the design spine. Longitudinal memory should make Circuit
more context-aware without making it less auditable.

## Friston-Inspired Lens

This section is an analogy, not a claim that Circuit is biologically modeled.
The useful pieces are design ideas.

Friston's Free Energy Principle and active inference literature frame living
systems as continually trying to reduce uncertainty about hidden causes of
their observations. In active inference, action is not only about getting an
expected outcome. It can also be about gathering evidence that improves the
agent's model of the world.

The closest bridge to Circuit is "self-evidencing." In the source literature,
the term points at systems that act and update themselves in ways that increase
model evidence. Circuit should use a weaker, practical version of that idea:
each flow should leave behind enough cited evidence that later work can
understand what the run learned, what it failed to learn, and what would need
fresh proof. This is not confirmation bias. A good Circuit memory should make
wrong assumptions easier to detect.

Translated into Circuit language:

- A run should not only produce an answer. It should improve the next run's
  ability to attend to the right evidence.
- A checkpoint should not only pause work. It should capture what uncertainty
  remains and what evidence would reduce it.
- A report should not only summarize what happened. It should leave behind
  structured evidence that later runs can query.
- A memory item should not only be retrieved. It should carry a reason,
  source, staleness state, and authority limit.

Three concepts are especially useful.

### Precision

In Friston's models, precision roughly means how much weight a prediction
error should get. Noisy evidence should not dominate stable evidence.

Circuit translation: each memory hit could carry a precision estimate.
Not as authority, but as an explanation of how much attention it deserves.

Useful precision signals:

- Fresh source hash.
- Same repo root and flow.
- Same files, commands, checks, or failure class.
- Confirmed by multiple independent runs.
- Followed by a passing verification step.
- Accepted or repeated by the operator.
- Contradicted by newer evidence.
- Stale, missing, or unverifiable source.

The product should avoid fake math here. A qualitative label may be enough:
`high_precision`, `medium_precision`, `low_precision`, plus reasons.

### Surprise

Surprise is useful because it tells the system where the current model failed.
In Circuit, surprise often appears as:

- A check failed after the plan said it should pass.
- A route looked right but the evidence favored another flow.
- A checkpoint changed the work direction.
- The operator corrected a repeated assumption.
- A prior fix regressed.
- A stale memory item conflicted with current source.
- A "done" claim turned out to be unsupported.

Today, history ranking already boosts failure, checkpoint, and verification
facets. The next version could make that more explicit:

- Store a `surprise_reason` for each salient event.
- Prefer surprising evidence when it has current relevance.
- Decay surprise when later runs show it no longer matters.
- Treat contradictions as first-class memory events.

This would help Circuit remember the places where future work is most likely
to go wrong.

### Epistemic Value

Active inference distinguishes between actions that exploit what is already
known and actions that gather useful information. That maps cleanly to
developer work.

Circuit should sometimes say: "The best next action is to gather evidence."

Examples:

- Re-run a specific check because prior memory is stale.
- Inspect a named report before choosing a route.
- Ask the operator a narrow checkpoint question because the memory evidence
  conflicts.
- Search prior runs for a repeated failure before proposing a fix.
- Refuse to load a memory hint into the relay prompt because its source cannot
  be verified.

This is the big shift: memory does not only answer. Memory can recommend the
next evidence to collect.

### Boundaries

Friston-adjacent writing often uses the "Markov blanket" idea to describe a
boundary between a system and its environment. Circuit does not need the full
math, but it does need the discipline.

Useful boundary questions:

- What is inside a run's evidence boundary?
- What is project-local memory versus cross-project memory?
- What memory is allowed into the relay prompt?
- What memory can be shown to the operator but not the model?
- What memory can suggest a route but not choose one?
- What memory can suggest a project convention but not write it?

The current `hint_only` contract is already a boundary. We should keep it
visible, cited, and enforced.

## Other Context Engineering Lessons

Good long-context systems do not dump everything into the model. They curate.

The practical lessons from AI context engineering are consistent with
Circuit's current direction:

- Keep retrieval explicit and inspectable.
- Prefer small, source-backed context packets over large transcripts.
- Preserve provenance for every memory item.
- Separate stable instructions from run-specific evidence.
- Treat stale context as dangerous unless it is clearly labeled.
- Compact only after preserving the decision, evidence, and uncertainty.
- Measure whether retrieved context helped or misled the run.

Anthropic's context-engineering guidance is especially aligned here: context
is a finite resource, long-horizon agents need compaction or structured notes,
and just-in-time retrieval can keep lightweight references such as file paths,
stored queries, and web links outside the model until they are needed.

This fits Circuit well because Circuit already has typed evidence surfaces:
trace, report, checkpoint, verification output, and memory input.

## Product Directions

### 1. Precision-Weighted Recall

Add an experimental precision layer to history recall.

Each query result could include:

- `precision`: `high`, `medium`, or `low`.
- `precision_reasons`: short reasons tied to concrete evidence.
- `contradictions`: newer evidence that weakens the memory item.
- `missing_proof`: checks that would be needed before relying on it.

The relay prompt should still say `hint_only`. Precision changes attention,
not authority.

Operator value:

- Fewer stale or weak memories in prompts.
- Clearer explanation for why a prior run matters.
- Better confidence when a memory item repeats across runs.

Implementation shape:

- Start in `reports/history/recall.json`.
- Do not change `MemoryInputV0` first.
- Add the extra fields to the report-only match metadata.
- Promote only after tests show the scoring is stable and useful.

### 2. Surprise Ledger

Create a small, queryable ledger of salient surprises across runs.

Candidate event types:

- `check_failed_after_expected_pass`
- `route_changed_by_evidence`
- `checkpoint_reversed_plan`
- `operator_corrected_assumption`
- `stale_memory_conflict`
- `verification_changed_claim`
- `repeated_failure_pattern`

Each event should point back to source evidence:

- Run id.
- Flow.
- Report path.
- Check output path.
- Source hash when available.
- Short explanation.

Operator value:

- Circuit remembers where work got expensive.
- Future runs can front-load the risky evidence.
- The operator can query "what keeps going wrong here?"

Guardrail:

- Surprise is not blame. It is a signal for attention.

### 3. Evidence Acquisition Recommendations

When recall finds weak or conflicting evidence, Circuit could recommend the
next evidence to gather.

Examples:

- "Prior memory says `npm run verify` failed on this path, but the source hash
  is stale. Re-run `npm run verify:fast` before using it."
- "Two prior runs disagree about the route. Inspect their recall reports before
  selecting a flow."
- "The same operator correction appears in three runs. Consider proposing a
  project doc update."

This could appear first in the history report, not in the relay prompt.

Operator value:

- Less silent uncertainty.
- Better handoffs between runs.
- Fewer repeated investigations.

### 4. Hierarchical Memory Consolidation

Circuit should distinguish between levels of memory:

1. Raw evidence: trace entries, command output, reports, checkpoints.
2. Run memory: a cited summary of what mattered in one run.
3. Pattern memory: repeated evidence across runs.
4. Project memory: a proposed convention, preference, or constraint.
5. Published memory: a human-reviewed update to project docs or agent memory.

Today, V1 intentionally stops near levels 1 and 2 for `prior_run` hints.
The next evolution could add level 3 without automatically jumping to level 4.

Promotion rules should be strict:

- Multiple independent supporting runs.
- Current source still matches, or staleness is explicit.
- No unresolved contradictory evidence.
- Operator-visible proposal before any write.
- Cited source paths for every claim.
- A clear rollback path.

This connects to the existing idea in
[`self-improving-circuit.md`](./self-improving-circuit.md): propose a diff,
never auto-apply it.

### 5. Memory Merge Reports

When a run uses prior memory, it should leave behind a merge report.

Possible file:

`reports/history/memory-merge.json`

Possible fields:

- `inputs_considered`
- `inputs_used`
- `inputs_rejected`
- `rejection_reasons`
- `precision_before`
- `surprise_reasons`
- `current_run_outcome`
- `verification_outcome`
- `memory_helped`
- `memory_misled`
- `follow_up_evidence_needed`

Operator value:

- Circuit can learn which memories actually helped.
- Bad memories become visible instead of lingering.
- Later runs can query the effect of prior recall, not just its existence.

Guardrail:

- `memory_helped` and `memory_misled` should start as explicit report fields,
  not hidden model judgments.

### 6. Return Briefs

Add a "since last attention" view for long-running or resumed work.

The brief should answer:

- What changed since the operator last looked?
- Which evidence is new?
- Which prior assumptions were confirmed?
- Which prior assumptions were weakened?
- Which decisions now need the operator?
- Which checks are still missing?

This is the operator-facing side of longitudinal memory. It turns memory into
calm situational awareness rather than raw recall.

### 7. Cross-Run Query Interface

The history query surface could grow into a small evidence query interface.

Useful questions:

- "Show prior failures for this command."
- "Show checkpoints that changed the route."
- "Show memories about this file path."
- "Show repeated operator corrections."
- "Show stale memories touching this source file."
- "Show memory items that were later contradicted."

This should return cited evidence packets, not prose only.

### 8. Cross-Machine Memory, Later

Cross-machine memory is valuable, but it should come late.

Before sync, Circuit needs:

- Stable local provenance.
- Source hashes.
- Redaction boundaries.
- Project identity rules.
- Explicit import/export.
- Operator review before model-facing use.

The first version should probably be portable evidence bundles, not ambient
cloud memory.

## Evaluation Ideas

Memory work needs evaluation early, because bad memory feels helpful while it
is quietly steering the run wrong.

Useful measurements:

- Did recall reduce repeated investigations?
- Did it reduce repeated operator corrections?
- Did it catch a prior failure before the same check failed again?
- Did it choose fresher evidence over stale evidence?
- Did it suppress unverifiable memories?
- Did it surface contradictions?
- Did it add too much prompt weight?
- Did it ever authorize a decision it should only have hinted at?

Test fixtures could compare:

- Current lexical top-three recall.
- Precision-weighted recall.
- Surprise-weighted recall.
- Recall with contradiction suppression.
- Recall with evidence-acquisition recommendations.

The key metric is not "more memories retrieved." It is "fewer unsupported
claims and fewer repeated mistakes."

## Suggested First Prototype

Start with a report-only experiment. Do not change relay prompts yet.

Prototype:

1. Extend history recall report metadata with `precision`, `precision_reasons`,
   and `surprise_reasons`.
2. Add contradiction and staleness explanations when available.
3. Add a small `recommended_evidence` array when memory is relevant but weak.
4. Compare the new metadata against existing recall fixtures and a few real
   `.circuit/runs` examples.
5. Keep `MemoryInputV0` unchanged until the report-only shape proves useful.

This keeps the risk low. It improves observability before it changes behavior.

## Design Constraints

- Memory remains `hint_only`.
- Every memory item has provenance.
- Staleness is shown, not hidden.
- Current checks outrank prior memory.
- The operator can inspect why memory was used.
- The system can explain why memory was rejected.
- Project memory promotion is explicit and reviewable.
- No silent background recall.
- No route, checkpoint, recovery, proof, policy, or write authority from
  memory alone.

## Open Questions

- Should precision live only in reports, or eventually in `MemoryInputV0`?
- What is the smallest surprise taxonomy that would actually help?
- How should Circuit detect contradictions across runs?
- Should memory consolidation propose updates to `AGENTS.md`, project docs, or
  a separate local memory store first?
- What should the operator be able to delete, pin, or demote?
- How should private command output be redacted before any portable bundle?
- Can we evaluate memory usefulness without relying on subjective model
  self-report?

## Sources

Circuit sources:

- [`docs/specs/circuit-history-v1.md`](../specs/circuit-history-v1.md)
- [`docs/specs/circuit-history-run-start-recall-v1.md`](../specs/circuit-history-run-start-recall-v1.md)
- [`src/history/query.ts`](../../src/history/query.ts)
- [`src/history/memory-preview.ts`](../../src/history/memory-preview.ts)
- [`src/schemas/memory-input.ts`](../../src/schemas/memory-input.ts)
- [`src/shared/relay-support.ts`](../../src/shared/relay-support.ts)
- [`docs/ideas/self-improving-circuit.md`](./self-improving-circuit.md)

External sources:

- Karl Friston et al.,
  [Active Inference and Epistemic Value](https://pubmed.ncbi.nlm.nih.gov/25689102/).
- Karl Friston et al.,
  [The Free Energy Principle Made Simpler but Not Too Simple](https://arxiv.org/abs/2201.06387).
- Karl J. Friston et al.,
  [Active Inference and Intentional Behaviour](https://arxiv.org/abs/2312.07547).
- Maxwell J. D. Ramstead et al.,
  [Neural and Phenotypic Representation Under the Free-Energy Principle](https://arxiv.org/abs/2008.03238).
- Anthropic,
  [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).
