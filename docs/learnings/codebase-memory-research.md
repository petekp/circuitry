# Codebase and Coding-Agent Memory: Techniques, Best Practices, Pitfalls

Status: external research report
Date: 2026-05-29
Provenance: produced by a deep-research workflow (6 research agents with web search and source fetching, a per-slice adversarial verification pass, and synthesis). 34 cited sources with confidence levels. Every finding is mapped to one of Circuit's six memory design decisions (D1-D6). Vendor benchmark numbers were treated skeptically; low-confidence and single-source claims are flagged and downweighted.

The six Circuit decisions this maps to: D1 hint-only authority; D2 cited self-invalidating memory (source hash + staleness); D3 push vs pull delivery; D4 project+flow scoping first, user-global later; D5 the non-recurrence observation (do lessons actually repeat within a project?); D6 measuring memory usefulness without model self-report.

## Executive summary

The field has converged on a clear consensus that maps tightly onto Circuit's design. Three things matter most. First, auto-memory orients but explicit rules authorize: Cursor, Windsurf, and GitHub Copilot all independently steer users toward version-controlled rules for anything that must reliably govern behavior, leaving auto-memory as non-authoritative hints [3][4][5]. This is direct multi-vendor validation of Circuit's hint-only stance (D1). Second, citation-bound self-invalidating memory is now shipping, not theoretical: GitHub Copilot stores facts with code citations and re-checks them against the current branch before use, and Aider plus LangChain implement source-hash/mtime invalidation in production [1][2][12][16]. Circuit's sha256 + source-ref + staleness is a more deterministic version of the same idea (D2). Third, the entire field lacks a credible loop for measuring whether retrieved memory helped versus misled a run; vendor benchmarks are gamed and contradictory, and model self-report is demonstrably unfaithful [7][9][24][25]. Circuit's D6 gap is a genuine open frontier, not a local oversight. Fourth, injected memory is not free: irrelevant or near-miss hints measurably degrade runs (the distractor effect costs roughly 6 to 11 accuracy points, and context length alone hurts even with perfect retrieval), which is the strongest caution against over-eager push delivery [18][19][20][21]. The blunt takeaway: Circuit's defensive choices (D1, D2, D4) are well-supported, its retrieval choice (lexical) is defensible on corpus characteristics, and its two self-identified weak spots (push-only delivery and no measurement loop) are exactly where the external evidence says the risk and the opportunity live.

## Landscape at a glance

| System | Memory model | Retrieval | Provenance / staleness | Scope | Notable failure mode |
|---|---|---|---|---|---|
| GitHub Copilot Memory | Auto-extracted facts + user prefs; server-side, default-on (Pro) | Recency-based bulk injection at session start (ranking is future work) [1] | Citations to supporting code, model re-checks vs current branch; 28-day unused-decay [1][2] | Repository + user prefs | `store_memory` writes not reliably invoked; writes silently fail [10][11] |
| VS Code agent memory | Agent-invoked file store under `/memories` | PULL (tool-invoked); first 200 lines of User scope auto-loaded | Local files, no documented auto-expiry | User / Repository / Session | No write-confirmation telemetry [10] |
| Cursor Memories | Model-proposed, user-approved; per-project, per-user | PUSH-injected at context start | Beta; no documented source-hash invalidation [4] | Project + individual | Memories reported ignored at recall; vanish on reload [4][10] |
| Windsurf Cascade | Auto-generated or user-prompted; machine-local | Auto-retrieved when model judges relevant | No documented invalidation/expiry mechanism [3] | Workspace-scoped | Weakest invalidation story; silent drift risk [3] |
| AGENTS.md / CLAUDE.md | Freeform Markdown instruction file | Read every request; proximity resolution (closest file wins) | None (no citation, hash, or staleness) [13] | Directory proximity | Stale/bloated files reduce task success and raise cost [14][15] |
| Aider repo map | Recomputed per turn from live source (not stored) | tree-sitter graph + PageRank, ~1k-token budget [12] | mtime-keyed cache + CACHE_VERSION bump [12] | Per-repo, per-turn | N/A (re-derived, sidesteps staleness) |
| Sourcegraph Cody | Code graph + search (dropped embeddings) | BM25-derived ranking + code graph + local IDE merge [6] | Live source of truth | Repo / multi-repo | Embeddings abandoned as operationally fragile [6] |
| Continue.dev @Codebase | Embeddings + keyword + LLM re-rank (deprecated) | nRetrieve=25 to nFinal=5, local SQLite [22] | Index sync | Repo | Deprecated toward agent-mode live exploration + MCP [22] |
| mem0 | Extract-then-update; ADD/UPDATE/DELETE/NOOP (LLM-driven) | Hybrid vector + BM25 + entity graph; PULL/query-time [7] | LLM-detected contradiction invalidates [7] | Configurable | Paper vs marketing semantics drift; full-context baseline beat it [7] |
| MemGPT / Letta | OS-style tiered, self-editing memory | Self-directed paging (PULL) [8] | Recursive summarization on eviction | Agent | Maximal authority (model is memory manager) [8] |
| Zep / Graphiti | Bi-temporal knowledge graph | Vector + BM25 + graph traversal + rerank [17] | Edge invalidation (set t_invalid, never delete) [17] | Configurable | Vendor-disputed benchmarks; KG loses on single-hop lookup [9][17] |

## Techniques

### Retrieval (lexical / BM25 vs dense vs knowledge-graph)

**What the evidence shows.** BM25 lexical retrieval is a robust zero-shot baseline on heterogeneous corpora (BEIR, ~0.42 to 0.43 nDCG@10 averaged) [18]. The verification correction is important: it is now stale to say dense retrieval "often fails to beat BM25 zero-shot" in aggregate. Modern dense embedders (E5, Gemini Embedding, Voyage) now lead BM25 in aggregate zero-shot nDCG@10, while BM25 still wins on specific hard slices: argument retrieval, high term-ambiguity, and rare exact-token lookup such as proper nouns, identifiers, file paths, and commit SHAs [18]. Re-rankers remain the strongest zero-shot generalizers at high compute cost. Two vendors (Sourcegraph Cody, Continue.dev) abandoned maintained vector indexes in the same window, Cody toward BM25 + code graph and Continue toward agent-mode live exploration [6][22]. Knowledge-graph memory (Zep/Graphiti) beats flat vector or full-context recall specifically on multi-hop and temporal-change queries, but the verification flags that GraphRAG actually underperforms vanilla RAG on single-hop fact lookup (around -13.4% on Natural Questions) [17].

**When it helps vs hurts.** Lexical excels exactly where Circuit's run corpus lives: a per-project store full of identifiers, error strings, flow names, and SHAs. It hurts when paraphrase/semantic recall is the bottleneck. KG retrieval helps for cross-run multi-hop reasoning but can lose on the single-fact lookups that dominate hint recall, and is overkill for a v0 hint layer.

**Confidence.** High on BEIR's 2021 facts (primary paper) and on the two-vendor abandonment of embeddings (primary sources read). Medium on the "dense now leads aggregate" correction (leaderboard sources, one partly AI-generated). Medium on the GraphRAG percentages.

**Sources.** [6][12][17][18][22]

### Provenance / citation

**What the evidence shows.** GitHub Copilot Memory is the closest shipping analog to a cited memory: facts are "stored with citations pointing to the code that supports them," and at retrieval the agent verifies those citations against the current branch before use, confirmed verbatim across two first-party GitHub sources [1][2]. A nuance from verification: GitHub frames this as the agent being prompted to verify the cited locations (a model-mediated check), not a deterministic hash comparison, so Circuit's sha256 is genuinely more deterministic. Separately, the broader RAG-citation literature warns that citations are a verification interface, not a correctness guarantee: studies report a large share of LLM citations are unfaithful post-hoc rationalizations, and unfaithful citations look identical to faithful ones, creating "misplaced trust" [16]. Attribution pipelines still cut fabricated claims meaningfully, so provenance helps, it just must not be read as proof.

**When it helps vs hurts.** Provenance helps when the cited reference is machine-verifiable against the live source (Circuit's model: cite a real run artifact with a hash). It hurts when an LLM-generated prose citation is trusted on its face.

**Confidence.** High (two first-party GitHub sources plus the citation-faithfulness literature).

**Sources.** [1][2][16]

### Staleness / self-invalidation

**What the evidence shows.** Content-hash-based staleness detection is the de-facto production pattern. LangChain's Indexing API RecordManager stores a hash of (content + metadata), a write timestamp, and a source ID; on re-index it diffs hashes to skip unchanged content, re-embed changed content, and delete orphaned records, with "None / Incremental / Full" cleanup modes [12]. Aider implements a near-identical pattern at the code-symbol layer: an mtime-keyed SQLite cache plus a CACHE_VERSION bump that invalidates all entries when the extractor logic itself changes [12]. Zep's bi-temporal model marks contradicted facts invalid (sets t_invalid) rather than deleting them, returning facts with validity date ranges [17]. The survey literature names "schema drift" and stale-record accumulation as inevitable in long-lived stores, and explicitly prescribes provenance + recency/validity metadata + deletion strategies rather than relying on the model to notice staleness [23]. GitHub adds a second axis: a 28-day unused-decay that garbage-collects never-recalled memories (distinct from source-change invalidation) [1][2].

**When it helps vs hurts.** Source-hash invalidation catches memories whose source changed; usage-decay catches memories nothing ever recalls. A documented community critique argues time-decay can churn genuinely durable lessons ("if a system has to relearn the same pattern every 28 days, that pattern was never structurally embedded"), but verification notes this is single-user opinion, not a vendor position [2].

**Confidence.** High (LangChain official docs, Aider primary blog + code, Zep primary paper, survey).

**Sources.** [1][2][12][17][23]

### Consolidation / promotion

**What the evidence shows.** The canonical formulation (Park et al., Generative Agents) scores memories by recency (exponential decay, factor 0.995), LLM-assigned importance (1 to 10 at write time), and embedding relevance, with periodic "reflection" synthesizing higher-level memories [24][27]. This recurs in MemGPT/Letta. Anthropic prescribes compaction (summarize, tuned recall-first then precision), structured note-taking (persist outside the window), and sub-agent isolation (return only a 1,000 to 2,000 token distilled summary) [26]. The repeatedly-flagged structural weakness: importance is assigned once at write time and never reconciled with whether the memory actually helped downstream. Verification flags that "the whole field lacks outcome-feedback on weights" is a cross-source inference, not a single proven result, so frame it as opportunity, not a cited negative finding.

**When it helps vs hurts.** LongMemEval-V2 component ablations show consolidating trajectory experience into reusable notes specifically helps workflow-type tasks more than retrieving raw local observations [23]. It hurts when reflection over-generalizes: a wrong derived "lesson" becomes a self-reinforcing error (see Pitfalls).

**Confidence.** High on the scoring mechanism (Park primary). Medium on the "universal blind spot" generalization.

**Sources.** [23][24][26][27]

### Eviction / decay

**What the evidence shows.** Standard policies are time decay (Ebbinghaus-style), LRU/LFU access frequency, and LLM-judged usefulness. GitHub's 28-day unused-decay is the only shipping vendor proxy, and the deletion timer resets when a fact is validated and used [1][2]. MemGPT evicts via recursive summarization under memory pressure [8].

**When it helps vs hurts.** Decay + LRU is a fine v0 floor. The principled upgrade is "demote hints that never correlate with better runs," which couples eviction to the (currently missing) measurement loop.

**Confidence.** High on the shipping mechanisms; the outcome-coupled eviction policy is a recommendation, not an observed practice.

**Sources.** [1][2][8]

### Push vs pull delivery

**What the evidence shows.** The leading dedicated frameworks (mem0, Zep) are PULL/query-time by design [7][17]. Anthropic's own guidance leans toward just-in-time PULL for the bulk of context, with a thin PUSH layer for stable high-signal material (CLAUDE.md is dropped in up front; glob/grep retrieve files just-in-time) [25]. A single vendor (GitHub) runs both surfaces: cloud Copilot Memory is push + validated + expiring, while VS Code agent memory is pull/tool-invoked + persistent, which is direct evidence the two are complementary, not exclusive [1][10]. The strongest caution against indiscriminate push: context length alone degrades performance even with perfect retrieval, beginning well below the claimed window (verification confirmed Llama-3.1-8B -24.2% MMLU and -47.6% HumanEval at 30K tokens, Mistral -34.2% GSM8K, with much of the drop inside ~7K tokens) [21]. The "recite the relevant evidence first, then answer" mitigation (around +30%) is the analog of fetching one needed hint at a decision point [21]. Agentic/just-in-time retrieval helps adaptability but retrieving at every step causes "contextual saturation," so PULL needs a decision gate, not retrieval-by-default [20].

**When it helps vs hurts.** Push is cheap and orienting when the pushed set is tiny and high-precision. It hurts when low-precision hints act as distractors. Pull avoids blanket injection but recreates the noise problem if hit reflexively. The cleanest hybrid the evidence supports: tiny high-precision push at run start plus a gated pull query at decision points.

**Confidence.** High on context-length harm (primary EMNLP 2025 paper, all numbers matched) and on Anthropic's posture. Medium on the agentic-RAG cost tradeoff (survey does not quantify latency/noise). Important scope limit: all measured harm is at 7.5K to 30K+ tokens; there is no evidence that Circuit-sized small pushed hint sets cause comparable degradation, so the magnitude of risk for Circuit's actual push is unquantified.

**Sources.** [1][7][10][17][20][21][25]

### Scoping

**What the evidence shows.** AGENTS.md resolves by directory proximity (closest file wins; OpenAI's monorepo uses 88 files), real-world validation of project/flow-first scoping over user-global [13]. Windsurf has no global memory, only global rules; auto-memories are workspace-scoped and not shared across workspaces [3]. Cursor scopes memories per-project per-user [4]. Project-local scope also limits the blast radius of secret leakage and memory poisoning (see Pitfalls) [19][28].

**When it helps vs hurts.** Project/flow scoping limits cross-context leakage and poisoning blast radius. User-global memory raises both surfaces, which is why vendors defer it or restrict it to looser-validation "preferences."

**Confidence.** High (official docs across three vendors plus the AGENTS.md spec).

**Sources.** [3][4][13]

## Best practices

**What makes memory help not hurt.** The cross-system consensus: keep auto-memory non-authoritative and reserve authority for explicit version-controlled rules [3][4][5]. Make every memory item carry verifiable provenance (a source ref + hash) and a staleness state, and check the hash against the live source rather than displaying the citation as proof [1][12][16]. Keep injected context small and high-precision, because precision matters more than recall: a near-miss hint is not neutral, it is a distractor [19][21]. Prefer concrete, conditionally-scoped, verifiable hints ("when touching X, run Y") over narrative lessons; vague prose instructions are reliably ignored, though the specific 48.8% to 28% and 300 to 350 word figures behind this are unverifiable single-source numbers and should not be quoted as constants [14]. Re-derive from the source of truth when you can (Aider's recomputed repo map sidesteps staleness entirely) [12].

**Context engineering.** Treat context as a finite attention budget that degrades with size [25][30]. Use compaction (recall-first, then precision), structured note-taking, and sub-agent isolation to keep the working window lean [26]. Framing and placement are load-bearing, not cosmetic: Anthropic's needle-in-haystack work showed Claude 2.1 jumped from 27% to 98% recall of an embedded sentence after a one-line prompt nudge, because the model distrusts out-of-place sentences in long documents [29]. This means MemoryInputV0 phrasing and position materially change whether a hint is used or distrusted.

**Measuring helped-vs-misled.** The defensible methodology is ablation against outcome-grounded benchmarks, never self-report. Park et al.'s controlled ablation used held-out human-judged TrueSkill scores with whole-component ablation (full architecture mu=29.89 beat all ablations; human baseline 22.95; Kruskal-Wallis H(4)=150.29, p<0.001) [24]. Anthropic's context-management evals hold a task set fixed, toggle the memory mechanism, and measure completion + token cost (memory tool + context editing = +39%, context editing alone = +29%, 84% token reduction on a 100-turn eval), though these are vendor-internal and not independently reproducible [31]. MemoryArena and LongMemEval-V2 establish near-zero no-memory baselines and decision-coupled tasks to measure whether memory guided later interdependent decisions, not whether the right item was retrieved [23][33]. The single most defensible signal is efficiency: tokens-to-resolution, turns-to-resolution, and latency are mechanical, deterministic, and hard to game, which is how mem0 and Zep justify themselves (vendor-reported ~85 to 91% latency drops; mem0 ~3 to 4x token reduction for the base config, not the loosely-claimed 10x) [7][9].

## Pitfalls

### Memory poisoning
**What it is.** Adversarial injection of malicious records into a memory store, later retrieved and acted upon. **Evidence.** MINJA is a query-only attack (no privileged access) achieving roughly 98% injection success and 77% attack success in idealized conditions [19]. Verification adds two load-bearing caveats: it requires a shared cross-user memory bank, and with pre-existing legitimate memories effectiveness drops 6 to 20 percentage points; independent journalism cites the more conservative ">95% ISR / >70% ASR" [19]. **How to defend.** Keep memory hint-only so a poisoned record degrades attention at worst, not control [19][28]. Project-local, per-flow scope (D4) removes the shared-bank precondition entirely. Treat captured run output as untrusted input. Note: it is unproven whether sha256 hashing of captured evidence resists poisoning where the poisoned record is itself the "source."

### Context rot
**What it is.** Output quality degrades as input grows, well before the window limit, non-uniformly. **Evidence.** Chroma's study (18 models, 4 vendors) confirmed verbatim that every model degrades with length; low needle-question similarity accelerates decline; even a single distractor hurts; focused prompts beat full prompts; GPT models give confident wrong answers while Claude tends to abstain [30]. Cross-corroborated by Anthropic's attention-budget framing [25]. **How to defend.** Cap injected items, rank ruthlessly, position high-signal hints early, and prefer pull for the long tail.

### Stale drift
**What it is.** Long-lived stores accumulate invalid records (schema drift, superseded facts) and the model cannot self-detect which value is current. **Evidence.** The survey names schema drift explicitly and prescribes explicit hash/recency invalidation [23]. The AGENTS.md ecosystem provides the sharpest case: an ETH Zurich peer-reviewed study found context files tend to reduce task success versus no context while raising inference cost by over 20%, reframing the threat from "do lessons recur" to "do stored facts decay into traps and does volume itself depress outcomes" [15]. **How to defend.** Source-hash + staleness state that flips an item stale on hash mismatch (Circuit's D2 is exactly the prescribed mechanism).

### Retrieval noise
**What it is.** Related-but-irrelevant passages mislead the model. **Evidence.** The Distracting Effect (ACL 2025) confirmed hard distractors drop accuracy ~6 to 11 points (11.0pp at 3B, 6.7pp at 8B, 5.9pp at 70B; correcting the loosely-stated "6 to 9"), random irrelevant passages are roughly harmless, and crucially stronger retrievers and rerankers surface MORE distractors, so better recall can mean worse answers [32]. **How to defend.** High-precision filtering before injection; staleness gating to drop topically-similar-but-stale items. Lexical recall is especially exposed because lexical near-misses are exactly these distractors.

### Self-reinforcing / sycophantic loops
**What it is.** A wrong derived generalization is treated as ground truth and never re-tested; harm scales with agent lifetime. **Evidence.** The survey's canonical example: an agent concluding "API X always errors with parameter Y" avoids that path forever and never overturns the false belief; repeated summarization drifts toward a sanitized, generic history that fails on edge cases [23]. **How to defend.** Prefer cited-fact memory over reflective lesson memory; provide a deletion/expiry path so a stale generalization cannot entrench. This means even in a project where organic failures do not recur, bad memory can manufacture recurring failures.

### Prompt bloat
**What it is.** Injected volume crowds out real instructions and depletes the attention budget. **Evidence.** Context-length-alone harm with perfect retrieval (confirmed numbers above) [21]; the ETH Zurich finding that context files raise cost over 20% and can reduce success [15]. The specific 150 to 200 instruction ceiling and 300 to 350 word optimum are directional, single-source, and should not be quoted as constants [14]. **How to defend.** Strict top-k push, grown organically, high precision.

### Secret leakage
**What it is.** Captured command/tool output leaks credentials through observable channels, not just storage. **Evidence.** The "Observable Channels" paper argues leakage occurs across tool-call arguments, retrieved evidence, tool-return echoes, and structured outputs; a separate empirical study found credentials embedded in agent skill source and passed via CLI arguments [28]. The specific quantitative leakage rates were not extractable from the PDF and are low-confidence secondary numbers. **How to defend.** Redaction-scrub at capture time; do not store secret-bearing content verbatim under a hash; project-local scope limits blast radius (D4).

### Eval difficulty
**What it is.** No trustworthy off-the-shelf measure of whether memory helped. **Evidence.** Passive recall benchmarks badly overstate usefulness: agents near-saturating LoCoMo perform poorly on MemoryArena's decision-coupled tasks (the qualitative gap is confirmed by the primary source; the specific "40-60%" collapse figure is unverified and should be treated as illustrative) [33]. LoCoMo scores for the same system swing from 58 to 84 depending purely on who configured it (mem0 and Zep accuse each other of misconfiguration; a full-context baseline beat both mem0 variants in mem0's own paper at 72.9 J) [9]. Model self-report is unfaithful by construction: Turpin et al. showed biasing features silently steered models while CoT never mentioned the bias, dropping accuracy up to 36% across 13 BIG-Bench Hard tasks [34]. **How to defend.** Build your own ablation loop (memory on vs off) on objective run outcomes; never ask the model whether the hint helped. There is also a cold-start caveat: memory may show no benefit for roughly the first 10 to 20 sessions, so a small corpus may simply be pre-ratchet.

## What this means for Circuit

### D1 - Hint-only authority
**SUPPORTS.** Three competitors converge on "auto-memory orients, explicit rules authorize," placing Circuit's MemoryInputV0 correctly in the non-authoritative tier [3][4][5]. Memory poisoning research is the strongest justification: if memory could authorize routes/checkpoints/writes, MINJA-style poisoning becomes proxy code execution, and hint-only caps the blast radius at attention degradation [19][28]. Cursor's "memories ignored" complaints show users wrongly expect hint-memory to be authoritative guardrails, so Circuit must set that expectation explicitly [4]. Self-report unfaithfulness weakly reinforces this: since the model cannot reliably report when memory misled it, memory must not depend on the model noticing it was wrong [34].

### D2 - Cited, self-invalidating memory (source hash + staleness)
**SUPPORTS.** This is Circuit's best-validated choice. GitHub Copilot ships citation-bound memory checked against the current branch; Aider ships mtime + CACHE_VERSION invalidation; LangChain ships hash + source-ID + cleanup modes; Zep ships edge-invalidation with validity ranges [1][2][12][17]. Circuit's sha256 is more deterministic than GitHub's model-mediated citation re-read. The survey explicitly prescribes provenance + recency metadata as the remedy for stale drift [23]. Two imports the evidence recommends: (a) add a "cleanup mode" notion so that when a flow's source file is rewritten, all derived hints from it go stale (Full semantics), not just the changed line; (b) version the extractor (analogous to CACHE_VERSION) so hints self-invalidate when Circuit's own extraction logic changes [12]. Caveat: citations reduce but do not guarantee correctness, so the hash must be machine-checked, never just displayed [16].

### D3 - Push vs pull delivery
**WARNS AGAINST (the push-only posture), NEUTRAL on keeping push as one layer.** The dedicated frameworks are pull by design [7][17]; Anthropic leans pull with a thin push layer [25]; GitHub runs both surfaces as complementary [1][10]. Context-length-alone harm and the distractor effect are the quantitative case against indiscriminate push [21][32]. The honest scope limit: all measured harm is at 7.5K+ tokens, so there is no evidence Circuit's small pushed hint set is itself harmful, and the magnitude of risk for Circuit-sized injections is unquantified. The evidence supports a hybrid: keep push tiny and high-precision, prioritize a gated pull CLI the agent hits at decision points (the "recite-then-solve" analog), and use pull to re-fetch a hint after context eviction rather than relying on it surviving the whole run [10][20][21].

### D4 - Project + flow scoping first, user-global later
**SUPPORTS.** AGENTS.md proximity resolution, Windsurf's workspace scoping (no global memory, only global rules), and Cursor's per-project scoping all validate project-first [3][4][13]. Scoping also limits secret-leakage and poisoning blast radius and removes MINJA's shared-bank precondition [19][28]. Where vendors do offer user-global, they restrict it to looser-validation "preferences," consistent with deferring user-global.

### D5 - The non-recurrence observation
**NEUTRAL, and reframed by the evidence.** No external benchmark validates a coding-agent "effectiveness ratchet" over many runs on one repo; memory wins in the literature are overwhelmingly recall/continuity, not not-repeating-mistakes (MemGPT, Park, A-MEM are continuity-oriented), echoing the non-recurrence concern [8][24][27]. Sub-1-point DMR margins and full-context beating memory systems on short corpora confirm memory pays off mainly on long-horizon recurring workloads [9]. But the threat model should shift: even if organic failures do not recur, a single stale or over-generalized stored fact can manufacture new failures ("stale AGENTS.md is worse than no AGENTS.md," now quantified by ETH Zurich) [15][23]. Also, the cold-start finding means a 22-run corpus may be pre-ratchet rather than evidence memory does not help [33]. So the durable value of D5 is less "do lessons repeat" and more "do stored facts decay into traps," which makes D1 and D2 the real safety value independent of recurrence.

### D6 - Measuring usefulness without model self-report
**SUPPORTS the concern; the field confirms it is an open frontier.** No vendor publishes an effectiveness loop; the only shipping proxy is usage-decay (GitHub's 28 days), and even usage attribution is an unmet user request [1][7]. Benchmark scores are gamed and contradictory [9]. Self-report is demonstrably unfaithful (Turpin: up to 36% accuracy swing from unmentioned bias) [34]. The established no-self-report methodology exists and Circuit should adopt it: fixed intent set, toggle memory on/off, compare objective outcomes (route correctness, checkpoint pass, retries, time-to-green, tokens/turns-to-resolution), mirroring Park's ablation and Anthropic's eval shape [23][24][31]. Efficiency metrics are the most defensible signal because they are mechanical and hard to game [7][9].

### Pitfalls Circuit is currently unprotected from

- **No measurement loop (D6).** Circuit cannot today tell whether an injected hint helped or misled a run; usage-decay is the only floor and it is not an effectiveness measure [1][9].
- **Push-only delivery under context pressure.** Without a pull path, an injected hint that is evicted mid-run cannot be re-fetched at the decision point where it matters [10][21].
- **Distractor cost of lexical near-misses.** A topically-similar-but-wrong lexical hint can cost ~6 to 11 accuracy points; Circuit has no documented high-precision gate before injection [32].
- **Reflective over-generalization (if Circuit ever promotes derived lessons).** A wrong generalization can entrench and manufacture recurring failures even where organic failures do not recur [23].
- **Secret leakage at capture.** If Circuit captures command/tool output verbatim into records, it inherits the observable-channel leak surface and needs redaction at capture time [28].
- **Extractor-version drift.** Circuit invalidates on source change but (per the evidence) should also invalidate when its own extraction logic changes, as Aider does with CACHE_VERSION [12].

### What the evidence says to do differently

1. Build a memory-on vs memory-off ablation loop on objective run outcomes; never use model self-report (D6) [24][31][34].
2. Prioritize a gated pull CLI so the agent fetches a hint at a decision point and can re-fetch after eviction; keep push tiny and high-precision (D3) [10][20][21].
3. Add a precision gate before injection (an explicit relevance check, as Continue's 25-to-5 re-rank does) to suppress lexical distractors (D2/D3) [22][32].
4. Add an extractor/schema-version field so hints self-invalidate when Circuit's extraction logic changes, plus "Full" cleanup semantics when a source file is rewritten (D2) [12].
5. Redaction-scrub captured evidence at write time; store hashes, not secret-bearing content verbatim (D4) [28].
6. Adopt usage-decay as a floor garbage-collector alongside source-hash invalidation, while measuring whether decay churns durable lessons (D2/D5) [1][2].
7. Phrase and position MemoryInputV0 deliberately; framing materially changes whether a hint is used or distrusted (D2/D3) [29].

## Source quality + confidence notes

| # | Source | Type / authority | Recency | Confidence notes |
|---|---|---|---|---|
| 1 | GitHub Docs / Engineering blog: Copilot Memory | First-party official | 2026, public preview | High; behaviors may shift (beta) |
| 2 | GitHub Docs: Managing/curating Copilot Memory; changelog | First-party official | 2026 | High; 28-day figure is single-surface within vendor |
| 3 | Windsurf Docs: Cascade Memories | First-party official | 2026 | High; absence of invalidation confirmed by primary source |
| 4 | Cursor 1.0 changelog + Rules docs + vendor forum | Official changelog + vendor forum | 2025-2026 | High on memories-vs-rules split; canonical Memories doc not fully rendered (gap) |
| 5 | GitHub community Discussion #184415 | Official forum | 2026 | Medium on exact quotes (read via fetch summarization) |
| 6 | Sourcegraph: How Cody understands your codebase | First-party blog (primary, read) | 2024 | High; deprecation hedged "for now"; 2024-dated |
| 7 | mem0 arXiv 2504.19413 + vendor site | Academic paper + vendor | 2025-2026 | High on paper; site contradicts paper (ADD-only) - cite paper |
| 8 | MemGPT arXiv 2310.08560 / Letta docs | Academic + official docs | 2023-2026 | High on thesis; some tool-name detail secondary |
| 9 | LoCoMo dispute: Zep rebuttal, mem0 paper, GitHub issue #5 | Competing vendor evals | 2025-2026 | High that figures are disputed; no independent head-to-head exists |
| 10 | VS Code Docs: agent memory; copilot-cli issue #1751 | First-party docs + repo issue | 2026 | High on phenomenon; "GitHub formally acknowledged" best supported for VS Code, not CLI |
| 12 | Aider blog + docs + DeepWiki; LangChain Indexing API | Vendor blog/docs + code-wiki | 2023-2025 | High on core; PageRank naming and cache detail from code, not blog |
| 13 | AGENTS.md spec; Codex docs; Linux Foundation press | Official spec + press | 2025 | High |
| 14 | TianPan.co / Blake Crosley AGENTS.md blogs | Engineering blogs (cite primary) | 2026 | LOW/unverifiable: 48.8% to 28%, 300-350 words, 150-200 instructions - directional only, do not quote as constants |
| 15 | ETH Zurich: Evaluating AGENTS.md (arXiv 2602.11988) | Peer-reviewed preprint (read) | 2026-02 | High on direction + 20%+ cost; exact percentages from secondary coverage are medium |
| 16 | Citation-faithfulness notes (VeriCite/FACTUM summaries) | Engineering/research notes | 2025 | High on direction; specific percentages secondary |
| 17 | Zep arXiv 2501.13956 + Graphiti/Neo4j | Peer-style paper + partner blog | 2025 | High on Zep (vendor self-eval); GraphRAG +26/+57 NOT from Microsoft primary - medium |
| 18 | BEIR arXiv 2104.08663 + hybrid-search blog + leaderboards | Peer-reviewed + blogs | 2021 / 2025-26 | High on 2021 facts; medium on "dense now leads aggregate" (one leaderboard partly AI-generated) |
| 19 | MINJA arXiv 2503.03704 + The Register | Preprint (read) + tech journalism | 2025 | High on attack existence; headline %s idealized; requires shared memory bank |
| 20 | Agentic RAG survey arXiv 2501.09136 | Survey | 2025 | Medium; does not quantify latency/noise costs |
| 21 | Context Length Alone Hurts (arXiv 2510.05381) | Peer-reviewed, EMNLP 2025 (read) | 2025-10 | High; all numbers matched; harm only measured at 7.5K-30K+ tokens |
| 22 | Continue.dev @Codebase deprecation docs | Official docs (read) | 2025 | High on mechanics; "performs better" rationale is inference, not official |
| 23 | Du et al. survey arXiv 2603.07670; LongMemEval-V2; MemoryAgentBench | Survey + preprints | 2025-2026 | Medium-high; some survey claims read from abstracts |
| 24 | Generative Agents (Park et al., UIST 2023) | Peer-reviewed (read) | 2023 | High; one mu-label slip corrected (25.64 = no-reflection+no-planning); pre-current-gen models |
| 25 | Anthropic: Effective Context Engineering | First-party engineering blog | 2025-09 | High |
| 26 | Anthropic: compaction / note-taking / sub-agents | First-party engineering blog | 2025-09 | High |
| 27 | A-MEM (arXiv 2502.12110 / NeurIPS 2025) | Peer-reviewed | 2025 | Medium; read from abstract/summaries |
| 28 | Observable Channels (arXiv 2603.22751) + credential study + vendor blog | Preprints + vendor blog | 2026 | Medium; exact leakage rates not extractable (low-confidence, single-source) |
| 29 | Anthropic: Long context prompting for Claude 2.1 | First-party blog (read) | 2023-12 | High; 27% to 98% confirmed verbatim |
| 30 | Chroma: Context Rot | Vendor research report (read) | 2025-07 | High; multi-vendor, independently empirical |
| 31 | Anthropic: Managing context / context-management | First-party announcement | 2025-09 | Medium; vendor-internal eval, no harness/task counts released |
| 32 | The Distracting Effect (arXiv 2505.06914, ACL 2025) | Peer-reviewed (read) | 2025-05 | High; range corrected to ~6-11pp |
| 33 | MemoryArena (arXiv 2602.16313) | Preprint (read) | 2026-02 | High on qualitative gap; "40-60%" figure unverified, illustrative only |
| 34 | Turpin et al.: Unfaithful CoT (NeurIPS 2023) | Peer-reviewed (read) | 2023-06 | High; 36% / 13-task confirmed |

**Low-confidence or single-source claims explicitly downweighted in this report:** the 48.8% to 28% conflicting-instruction figure and the 300-350 word / 150-200 instruction thresholds [14] (unverifiable, no primary located); the MemoryArena "40-60% collapse" figure [33] (qualitative gap confirmed, number not in primary); the GraphRAG +26%/+57% figures [17] (not from Microsoft's primary, and GraphRAG underperforms on single-hop); the "Observable Channels" leakage percentages [28] (not extractable, secondary); the SteelSam99 28-day critique [2] (single-user opinion, not vendor position); the "dense now leads BM25 in aggregate" correction [18] (one leaderboard partly AI-generated). All vendor benchmark accuracy numbers (mem0, Zep, Anthropic context-management) are vendor-reported against self-chosen baselines and should not be imported as ground truth; efficiency metrics are more trustworthy than accuracy claims but remain vendor-framed.

## References

1. About GitHub Copilot Memory, GitHub Docs / GitHub Engineering blog. https://docs.github.com/en/copilot/concepts/agents/copilot-memory ; https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/
2. Managing and curating Copilot Memory, GitHub Docs; Copilot Memory deletion/scope changelog. https://docs.github.com/en/copilot/how-tos/use-copilot-agents/copilot-memory ; https://github.blog/changelog/2026-05-26-copilot-memory-has-more-controls-for-deletion-scope-and-the-copilot-cli/
3. Cascade Memories, Windsurf Docs. https://docs.windsurf.com/windsurf/cascade/memories
4. Cursor 1.0 changelog; Rules, Cursor Docs; Cursor Community Forum. https://cursor.com/changelog/1-0 ; https://cursor.com/docs/rules ; https://forum.cursor.com/t/memories-and-rules/121348
5. Feedback wanted: Copilot Memory now on by default, community Discussion #184415. https://github.com/orgs/community/discussions/184415
6. How Cody understands your codebase, Sourcegraph. https://sourcegraph.com/blog/how-cody-understands-your-codebase ; https://sourcegraph.com/docs/cody/faq
7. Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory, arXiv 2504.19413; mem0 research/state-of-memory. https://arxiv.org/html/2504.19413v1 ; https://mem0.ai/research
8. MemGPT: Towards LLMs as Operating Systems, arXiv 2310.08560; Letta Docs (MemGPT, sleep-time agents). https://arxiv.org/abs/2310.08560 ; https://docs.letta.com/letta-memgpt ; https://docs.letta.com/guides/agents/architectures/sleeptime/
9. Is Mem0 Really SOTA in Agent Memory? (Zep rebuttal); mem0 arXiv 2504.19413 LoCoMo tables; getzep/zep-papers issue #5. https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/ ; https://arxiv.org/html/2504.19413v1 ; https://github.com/getzep/zep-papers/issues/5
10. Memory in VS Code agents, VS Code Docs; github/copilot-cli issue #1751. https://code.visualstudio.com/docs/copilot/agents/memory ; https://github.com/github/copilot-cli/issues/1751
11. Feedback wanted: Copilot Memory now on by default, community Discussion #184415 (store_memory acknowledgment). https://github.com/orgs/community/discussions/184415
12. Building a better repository map with tree sitter, aider; Repository map, aider docs; Repository Mapping System (DeepWiki); Syncing data sources to vector stores (LangChain Indexing API). https://aider.chat/2023/10/22/repomap.html ; https://aider.chat/docs/repomap.html ; https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system ; https://www.langchain.com/blog/syncing-data-sources-to-vector-stores
13. AGENTS.md (official spec/FAQ); Custom instructions with AGENTS.md, Codex; Linux Foundation AAIF press release; OpenAI Agentic AI Foundation. https://agents.md/ ; https://developers.openai.com/codex/guides/agents-md ; https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation ; https://openai.com/index/agentic-ai-foundation/
14. Your CLAUDE.md Is Probably Too Long, TianPan.co; AGENTS.md Patterns, Blake Crosley. https://tianpan.co/blog/2026-02-14-writing-effective-agent-instruction-files ; https://blakecrosley.com/blog/agents-md-patterns
15. Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents? arXiv 2602.11988 (ETH Zurich, Gloaguen et al.); InfoQ coverage. https://arxiv.org/abs/2602.11988 ; https://www.infoq.com/news/2026/03/agents-context-file-value-review/
16. Why Citation-Based RAG Still Hallucinates; Attribution Techniques for Mitigating Hallucinated Information in RAG Systems: A Survey. https://yaihq.com/research/citation-based-rag-still-hallucinates ; https://ubos.tech/attribution-techniques-for-mitigating-hallucinated-information-in-rag-systems-a-survey-4/
17. Zep: A Temporal Knowledge Graph Architecture for Agent Memory, arXiv 2501.13956; Graphiti (Neo4j); GraphRAG (Microsoft Research). https://arxiv.org/html/2501.13956v1 ; https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/
18. BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation of IR Models, arXiv 2104.08663; Hybrid Search BM25 + Dense. https://arxiv.org/abs/2104.08663 ; https://mbrenndoerfer.com/writing/hybrid-search-bm25-dense-retrieval-fusion
19. A Practical Memory Injection Attack against LLM Agents (MINJA), arXiv 2503.03704; The Register coverage. https://arxiv.org/html/2503.03704v2 ; https://www.theregister.com/2025/03/11/minja_attack_poisons_ai_model_memory/
20. Agentic Retrieval-Augmented Generation: A Survey, arXiv 2501.09136; To Retrieve or To Think, arXiv 2601.08747. https://arxiv.org/html/2501.09136v4 ; https://arxiv.org/pdf/2601.08747
21. Context Length Alone Hurts LLM Performance Despite Perfect Retrieval, arXiv 2510.05381 (Findings of EMNLP 2025). https://arxiv.org/html/2510.05381v1
22. @Codebase (Deprecated), Continue Docs; How to Set Up @Codebase. https://docs.continue.dev/reference/deprecated-codebase ; https://docs.continue.dev/customize/context/codebase
23. Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers, arXiv 2603.07670; LongMemEval-V2, arXiv 2605.12493; MemoryAgentBench, arXiv 2507.05257. https://arxiv.org/html/2603.07670v1 ; https://arxiv.org/html/2605.12493v1 ; https://arxiv.org/html/2507.05257v3
24. Generative Agents: Interactive Simulacra of Human Behavior, UIST 2023 / arXiv 2304.03442. https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763 ; https://ar5iv.labs.arxiv.org/html/2304.03442
25. Effective context engineering for AI agents, Anthropic Engineering. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
26. Effective context engineering for AI agents (compaction / note-taking / sub-agents), Anthropic Engineering. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
27. A-MEM: Agentic Memory for LLM Agents, arXiv 2502.12110 / NeurIPS 2025. https://arxiv.org/abs/2502.12110 ; https://proceedings.neurips.cc/paper_files/paper/2025/hash/19909c36f51abc4856b4560aff3d36d6-Abstract-Conference.html
28. Observable Channels, Not Just Storage, arXiv 2603.22751; Credential Leakage in LLM Agent Skills, arXiv 2604.03070; AI Agent Data Leakage (Rafter). https://arxiv.org/pdf/2603.22751 ; https://arxiv.org/html/2604.03070v1 ; https://rafter.so/blog/ai-agent-data-leakage-secrets-management
29. Long context prompting for Claude 2.1, Anthropic. https://claude.com/blog/claude-2-1-prompting
30. Context Rot: How Increasing Input Tokens Impacts LLM Performance, Chroma Research. https://www.trychroma.com/research/context-rot
31. Managing context on the Claude Developer Platform / Context management, Anthropic. https://claude.com/blog/context-management
32. The Distracting Effect: Understanding Irrelevant Passages in RAG, arXiv 2505.06914 (ACL 2025). https://arxiv.org/html/2505.06914v1 ; https://aclanthology.org/2025.acl-long.892/
33. MemoryArena: Benchmarking Agent Memory in Interdependent Multi-Session Agentic Tasks, arXiv 2602.16313; LoCoMo, arXiv 2402.17753. https://arxiv.org/abs/2602.16313 ; https://arxiv.org/abs/2402.17753
34. Language Models Don't Always Say What They Think: Unfaithful Explanations in Chain-of-Thought Prompting, Turpin et al., NeurIPS 2023 / arXiv 2305.04388. https://arxiv.org/abs/2305.04388 ; https://www.milesturp.in/Unfaithful-Explanations-in-Chain-of-Thought-Prompting/
