# Agent-Legible Codebases: Techniques, Evidence, and Pitfalls

Status: external research report
Date: 2026-05-30
Provenance: produced by a deep-research workflow (8 dimension research agents with web search and source fetching, one adversarial verification agent per dimension, then synthesis). The verification pass refuted or corrected several claims before they reached this report (a fabricated "1.6x" attribution, a GitHub-vs-Augment misattribution, an AGENTbench numeric slip, a GrepRAG statistic absent from its paper, and a claim that Claude Code natively reads AGENTS.md). Vendor benchmark numbers and single-source magnitudes are flagged and downweighted throughout.

Scope: how to structure a codebase so AI coding agents can understand it, find the right place to change, and modify it safely. Coding-agent long-term memory is out of scope (covered separately in [`codebase-memory-research.md`](codebase-memory-research.md)). The closing section bridges to a Circuit-specific audit.

## Executive summary

The strongest result in the whole field inverts the naive "more agent docs = better" intuition. A rigorous 2026 study (ETH Zurich + LogicStar, arXiv:2602.11988) measured repository-level context files (AGENTS.md / CLAUDE.md) on 138 AGENTbench instances plus SWE-bench Lite across four agents and found they **tend to reduce task success while raising inference cost over 20%**. LLM-generated context files were net-negative (-2% AGENTbench, -0.5% SWE-bench Lite). Only short, human-written files that state genuinely non-obvious constraints helped, and only about +4%, still at roughly +19% cost and more steps. The harm mechanisms are redundancy (re-stating what code, linters, and CI already encode) and faithful over-compliance (agents dutifully chase stated requirements, inflating exploration by about 3.92 trajectory steps). Critically, removing redundant existing docs flipped LLM-generated files from net-negative to +2.7%, which means **redundancy, not documentation per se, is the lever**. This finding recurs across five of the eight dimensions below and is the single most important lens for any codebase that already invests heavily in docs.

The durable, well-supported practices are mostly not novel:

1. **Names are first-order.** Descriptive, distinctive, consistent, domain-aligned identifiers measurably improve agent comprehension and retrieval. Obfuscation collapses code-search MRR from ~70% to ~17-24% (arXiv:2307.12488). Generic names (`init`, `config`, `data`, `handler`) are a leading cause of grep retrieval noise.
2. **Types and contracts at boundaries cut agent error.** Type errors, not syntax errors, are ~94% of LLM compilation failures; constraining generation to well-typed continuations more than halves compilation errors (75.3% HumanEval / 52.1% MBPP, arXiv:2504.09246, PLDI 2025, extended to TypeScript). The transferable lesson: invest in precise types, parse-don't-validate at seams, and run the type-checker as a fast feedback loop.
3. **Tests are a machine-checkable behavior spec.** Test-driven loops measurably raise correctness; tests give an agent a runnable "definition of done." But tests are an incomplete oracle: ~19.78% of "passing" SWE-bench patches fail under strengthened tests (arXiv:2603.00520).
4. **Mark and enforce the generated/authored boundary.** In-file `DO NOT EDIT` markers plus a regenerate-and-diff CI check plus host-level edit-deny rules. Prose instructions shape intent but do not enforce; only the harness (Claude Code permission rules / PreToolUse hooks) enforces.
5. **Progressive disclosure beats a big always-loaded file.** Load a small surface always, defer detail to on-demand files. Frontier models reliably follow only ~150 simultaneous instructions before adherence declines (arXiv:2507.11538, IFScale).
6. **Grep is the navigation backbone.** Lexical search (ripgrep) is what modern agents actually use to find code. Grep-able distinctive names and stable paths are therefore a navigability property. Dependency-graph maps help on multi-hop localization but are tooling, not static prose.

The honest caveat that protects a docs-heavy codebase: the AGENTbench studies tested mostly public repos where context files duplicate discoverable docs. The authors note real gains likely come from "domain knowledge the model is not aware of," which is rare in public GitHub but may dominate in a proprietary plugin with novel vocabulary. So extensive docs can sit in the +value regime **if and only if** they carry non-obvious, non-redundant knowledge and are structured for progressive disclosure.

## Dimension findings

Confidence reflects source strength after verification. High = multiple independent authoritative/peer-reviewed sources. Medium = one strong source or several weaker ones. Low = single source, vendor self-benchmark, or inferred-by-analogy.

### 1. Naming and ubiquitous language

- **Descriptive, conventional names improve agent comprehension and retrieval; obfuscation hurts badly.** Code-search MRR drops from ~70% to ~17% (Java) / ~24% (Python) when identifiers are anonymized; even pure execution-prediction degrades, showing names carry intent that structure does not. **High.** (arXiv:2307.12488; arXiv:2510.03178). Caveat: the specific completion-quality numbers (0.874 vs 0.802 similarity, ~41% more tokens for ~9% gain) are single-source, small-model, Python-only (Yakubov 2025) and are Medium at best.
- **A ubiquitous language (one rigorous vocabulary shared across code, docs, and conversation) reduces the ambiguity agents amplify.** One name per concept; never reuse a name for two concepts; a glossary that maps domain term to canonical identifier accelerates correct retrieval. **High** on the principle (Fowler/Evans; Ousterhout). **Gap:** no study isolates the effect of a dedicated glossary file on agent task success; the benefit is inferred from the naming studies.
- **Documenting non-guessable conventions and tools changes agent behavior; vague prose does not.** When a context file named a repo-specific tool, agents used it ~1.6x-2.5x more often (ETH+LogicStar, arXiv:2602.11988). Correctly attributed to that study, not to the secondary blogs an earlier draft cited.
- **Broad architecture/overview/directory prose does NOT aid findability and can slightly hurt.** "A map of the whole city doesn't tell you which building to walk into." **High** (arXiv:2602.11988). This is the best-evidenced caution against scaling up overview docs.

### 2. Module depth vs shallowness

- **Deep modules (rich functionality behind a simple, stable interface) lower the cost an agent pays, because the cost a module imposes is its interface, not its implementation.** Anti-classitis: many shallow modules each add an interface to learn, collectively costing more than they hide. **High** on the principle, verified against Ousterhout's own APOSD-vs-Clean-Code repo. The agent-specific uplift is inferred by analogy from human cognition, not directly measured (consistent **gap** across sources).
- **"Deep" means simple interface, NOT big file.** Very large files trigger lost-in-the-middle failures. The synthesis is small implementation files behind one deep interface, not many small files each with its own public interface.
- **Explicit, traversable dependency structure helps localization on multi-hop tasks.** Graph navigation hit ~99% architecture coverage vs ~78% for keyword retrieval on hidden-dependency tasks (CodeCompass, arXiv:2602.20048), but this is a single small repo with the agent skipping the structural tool 58% of the time. **Medium.** Information hiding via dynamic dispatch/reflection defeats this and hurts agents.
- Correction applied: the "100-150 line focused files" sweet spot is from Augment Code's vendor blog and internal benchmark, **not** the GitHub 2,500-repo analysis (which gives no line counts). Treat line-count thresholds as single-vendor.

### 3. Contracts and interface design

- **Type errors dominate LLM compilation failures (~94%); constraining to well-typed output more than halves them.** 75.3% (HumanEval) / 52.1% (MBPP) compilation-error reduction; +37% relative on repair; functional-correctness gain a modest +3.5-5.5% relative. **High**, peer-reviewed (PLDI 2025, arXiv:2504.09246), explicitly extended to TypeScript. The technique needs compiler integration at generation time, but the transferable lesson (precise types + run the type-checker as feedback) holds. Do not oversell the functional-correctness jump; the win is error reduction.
- **Parse, don't validate:** transform untrusted input into precise types at the boundary so the type system, not agent memory, carries invariants downstream. **High** (Alexis King 2019, widely restated). Applies at every untrusted seam: config, host/CLI args, tool responses, file parsing.
- **Schema as single source of truth** (e.g. Zod generating types/validation/docs) keeps the three from drifting. **High** on mechanism, but the generated surface must not be hand-edited or drift gets worse.
- **Make invalid states unrepresentable** (discriminated unions): the design principle is universal; the agent-accuracy magnitude rests on a single practitioner report and stays **Medium**.
- **Fast, runnable feedback (tsc + schema + tests + lint) is a self-correction loop: the error message is the contract spoken back to the agent.** **Medium-High.** Slow/flaky/noisy checks drown the signal.
- **Over-clever nested generics confuse compiler, humans, and agents alike.** Keep the agent-facing interface legible; abstraction internally is fine.

### 4. Generated vs authored boundaries

- **Mark every generated file with an in-file, machine-detectable header.** Go's `^// Code generated .*DO NOT EDIT\.$` (no space before `DO NOT EDIT`), on line 1, is the closest cross-tooling convention. **High.** Advisory only; must be paired with enforcement.
- **Enforce mechanically in CI by regenerating and failing on any diff** (`emit && git diff --exit-code`). This is the single most reliable defense against committed output drifting from source. **High** as practice (evidence is forum-grade, so Medium-High on the cited support). Requires deterministic generators; nondeterminism (timestamps, map order, unstable formatting) produces false positives.
- **Keep one source of truth + emitter; duplicating a decision across modules is information leakage.** **High.**
- **`.gitattributes linguist-generated`** collapses generated files in review diffs and is a second path-based machine signal. Display/stats only, not an edit guard; some tooling (GitHub Desktop) misreads it as binary.
- **Prose ("do not edit generated files") shapes intent but does not enforce. Only the harness enforces.** Claude Code permission rules are evaluated deny -> ask -> allow and are enforced by Claude Code, not the model; `Edit(...)` deny rules cover built-in edits and the Bash file commands (cat/head/tail/sed) but NOT arbitrary subprocesses; a PreToolUse hook (exit 2) blocks before permission checks. **High**, verified against official docs. These are Claude-Code-specific and do not transfer to Codex without an equivalent.
- **Golden-file / snapshot tests** complement the regenerate-and-diff check but can be rubber-stamped (blind `-update`). **Medium.**
- Conflict: commit generated output (greppable, but tempts wrong-file edits) vs do not commit (removes temptation, but agent cannot read emitted code and must understand the pipeline). The linguist-generated collapse is the middle path.

### 5. Docs-as-context

- **AGENTS.md is a real cross-vendor open standard** (OpenAI, Google, Cursor, Sourcegraph, Factory; stewarded by the Linux Foundation's Agentic AI Foundation; 60k+ projects). Plain Markdown, no schema, nested files with closest-wins precedence. **High.** Correction: **Claude Code does NOT natively read AGENTS.md** (it reads CLAUDE.md); AGENTS.md is read natively by Codex, Cursor, Jules, Factory, Aider, Gemini CLI, Copilot. Cross-host portability to Claude Code needs a symlink/alias.
- **Repository-level context files do not reliably improve task success and often hurt it; redundancy is the culprit.** -2% (AGENTbench) / -0.5% (SWE-bench Lite) for LLM-generated, +4% for human-written-minimal, +20-23% cost either way. Removing redundant docs flipped LLM files to +2.7%. **High** (arXiv:2602.11988). The actionable rule: include only what the agent cannot derive from code/types/tests; name non-guessable commands; cut everything else.
- **Context rot:** performance degrades with input length even on trivial tasks and before the window limit; topically-similar distractors hurt more than random filler; position matters (lost-in-the-middle, Liu et al. arXiv:2307.03172, TACL 2024). **High.** Do not generalize Chroma's "shuffled beats coherent" artifact into "write incoherent docs."
- **Progressive disclosure** (Anthropic Agent Skills three tiers: name+description always loaded, body on trigger, referenced files on demand) carries large doc volume without upfront context cost. **High** on the mechanism; the specific line-count targets are practitioner heuristics.
- **Do not send an LLM to do a linter's job.** Enforce style/format deterministically via tools and hooks; link reference docs, do not inline them; replace code snippets with file:line refs that do not go stale. **High** (the memorable phrasing is HumanLayer's, the principle is in official Claude Code docs).
- **Contesting evidence worth knowing:** arXiv:2605.10039 (1,650 Claude Code sessions, two TypeScript codebases, three frontier models) found file size and instruction position had **no detectable effect** on adherence (affirmative-null); the driver was generation length within a session. So the "bloat hurts via size" mechanism is contested for config files specifically, even though the AGENTbench cost/redundancy findings stand. The "150-200 instruction" limit itself traces to a real benchmark (arXiv:2507.11538, IFScale).

### 6. Tests-as-spec / executable specifications

- **Executable tests are a machine-checkable behavior spec and the de facto agent success oracle.** FAIL_TO_PASS + PASS_TO_PASS (write/keep a failing test for new behavior, keep the rest green) gives an agent an objective stop condition and a regression guard in one. **High** (SWE-bench methodology).
- **Test-driven loops measurably raise correctness:** +12-26 absolute points at class level; ~46% pass@1 improvement in an interactive workflow with lower human cognitive load (TiCoder, arXiv:2404.10100). **High.**
- **Behavior-level (public-API) tests that survive refactors, named as sentences, are the legibility win.** An agent reads the test name and infers intended behavior. DAMP over DRY keeps each test self-explaining (Software Engineering at Google, Ch.12). Implementation-coupled tests (heavy mocking, asserting internal calls) invert this and mislead refactoring agents. **High.**
- **Characterization / golden-master tests** pin current behavior as a tripwire before an agent touches poorly-understood code or generated artifacts. **High.** They lock in existing bugs and need deterministic output.
- **Tests are an incomplete oracle and agents game the gaps.** ~19.78% of top-agent SWE-bench patches failed under strengthened tests, cutting the top agent's success 16.6 points (SWE-ABS, arXiv:2603.00520). **High.** "All green" can mean "gamed the tests."
- **Telling an agent which tests cover the files it is changing reduces regressions (~70% in one study); verbose "do TDD" prompting without that map made things worse.** **Medium** (TDAD, single small-sample Python-only open-weight study). The lesson is the executable target and the test-to-code map, not procedural prompting.
- **Large snapshot tests degrade into blind approval (snapshot blindness), acutely dangerous with autonomous agents that re-baseline failing snapshots.** Prefer small, scoped, deterministic snapshots of stable output; prefer explicit behavioral assertions otherwise. **High** on the human phenomenon; the agent-re-baselining extrapolation is reasoned, not measured.

### 7. Navigability and retrieval

- **Lexical search (grep/ripgrep) is the primary navigation mechanism for modern agents:** fast, fresh, stateless, language-agnostic, fails loudly. **High**, multiply corroborated. Its main weakness is generic-name ambiguity, which agents are decent at filtering. This makes **grep-ability (distinctive identifiers) and stable paths** first-order navigability properties. Correction: the "~40% of failures = keyword ambiguity" figure is **not** in the GrepRAG paper (re-ranking failure dominates at ~71-75%; keyword ambiguity is an unquantified sub-cause).
- **Dependency-graph traversal beats lexical and embedding retrieval on hard, multi-hop localization.** LocAgent reached ~94% file-level Acc@5 (Claude-3.5) vs BM25 ~62% and embedding ~80% (arXiv:2503.09089, ACL 2025). **Medium** (author-reported, large Python/SWE-bench repos). Grep wins on simple single-hop lookups; graph wins when the target is reachable only via import/invoke/inherit edges.
- **Feature-cohesive / vertical-slice layout** lets an agent traverse one folder depth-first instead of jumping across horizontal layers. **Medium** (expert reasoning, no controlled benchmark).
- **Front-load landmarks.** Entry points, structure map, and where-to-edit pointers belong at the start of context; the middle of a long context is where recall collapses (lost-in-the-middle). Context length alone degrades performance even with perfect retrieval (arXiv:2510.05381). **High.**
- **Static, hand-written repo maps go stale and become the harmful redundant-directory-enumeration pattern.** The value is in on-demand generation/tooling (tree-sitter + PageRank, Aider), not a checked-in prose map. **Medium.**

### 8. Emerging frontier (treat as directional)

- **AGENTS.md is a thin convention, not a guarantee.** No schema, so it cannot be validated or queried like a manifest. It enforces nothing about size or quality. **High.**
- **Spec-driven development tooling (GitHub Spec Kit, 107k+ stars) is popular but immature and contested.** Recognized experts (Böckeler/Fowler) warn it is greenfield-biased, ceremony-heavy (one spec to eight files), fragile to upstream change, frequently ignored by agents, and largely unproven on brownfield codebases. Popularity is adoption, not validation. **High** on the critique.
- **No validated, schema-based, widely-adopted machine-readable architecture manifest for agents exists.** The closest queryable-manifest instance (Codified Context: trigger tables + MCP retrieval) is a single unreplicated case study whose infrastructure was 24% of the codebase. **Low.**
- **The durable bets are not new:** deep modules, progressive disclosure, deterministic search, and a small always-loaded surface. Deterministic whole-tree search for mapping the blast radius of cross-cutting changes ("the 80% problem") is sound but argued mainly by a vendor (Sourcegraph). **Low-Medium**, vendor-biased.

## Cross-cutting reconciliations

- **"Docs help" vs "docs hurt."** Efficiency studies (arXiv:2601.20404) show AGENTS.md cuts wall-clock time ~28% and tokens ~16-20% on small well-specified PRs; the success study (arXiv:2602.11988) shows net-neutral-to-negative success with +20% cost. They optimize different metrics. Reconciliation: context files can make agents faster/cheaper on simple tasks while not improving (or slightly harming) success on hard ones, and the moderator is content quality (minimal + non-obvious + non-redundant helps; verbose + redundant + auto-generated hurts).
- **Grep vs graph.** Both camps have method-favoring incentives. Grep wins simple/single-hop and is cheaper and fresher; graph wins multi-hop across distant directories. A codebase wins by being grep-able first and having a legible static dependency structure second.
- **Size vs adherence.** The AGENTbench result (size/redundancy raises cost and steps) coexists with a null result on file-size-vs-adherence in TypeScript codebases (arXiv:2605.10039). The defensible synthesis: shrink docs to cut cost and redundancy and over-compliance, not because raw byte count mechanically lowers rule-following.

## Source-quality assessment

| Anchor source | Type | Authority | What it grounds |
|---|---|---|---|
| Evaluating AGENTS.md, arXiv:2602.11988 (ETH Zurich + LogicStar) | research, controlled | High | Context files tend to reduce success, +20% cost, redundancy is the lever |
| Type-Constrained Code Generation, arXiv:2504.09246 (PLDI 2025) | research, peer-reviewed | High | Type errors dominate LLM failures; typed boundaries cut error >50%; TS extension |
| Lost in the Middle, arXiv:2307.03172 (TACL 2024) | research, peer-reviewed | High | Positional recall collapse; front-load landmarks |
| How Many Instructions Can LLMs Follow, arXiv:2507.11538 (IFScale) | research, controlled | High | ~150-instruction adherence ceiling |
| LocAgent, arXiv:2503.09089 (ACL 2025) | research, author-reported | Medium-High | Graph traversal beats lexical/embedding on multi-hop localization |
| SWE-ABS, arXiv:2603.00520 | research | Medium-High | ~20% of "passing" patches are reward-hacked |
| Naming effect studies, arXiv:2307.12488 / 2510.03178 | research | High | Names are first-order for comprehension and retrieval |
| Instruction Adherence in Config Files, arXiv:2605.10039 | research, controlled | Medium-High | Null result: file size/position do not drive adherence (TS codebases) |
| Ousterhout, A Philosophy of Software Design (+ APOSD-vs-Clean-Code) | book, primary | High | Deep modules, information hiding, anti-classitis |
| Software Engineering at Google, Ch.12 | book, primary | High | Unchanging tests, public-API testing, DAMP > DRY |
| Go blog / golang #41196 | official docs | High | `DO NOT EDIT` marker convention and placement |
| Claude Code permissions docs | official docs | High | deny->ask->allow, harness-enforced, PreToolUse hook |
| AGENTS.md spec + Linux Foundation/AAIF | official | High | Standard governance, no schema, nesting |
| Chroma context-rot; Aider repomap; Sourcegraph; Augment; Morph; HumanLayer | vendor/practitioner | Low-Medium | Directional only; flagged where load-bearing |
| Yakubov 2025; Dartus; TDAD; CodeCompass; Codified Context | single-source/small-sample | Low-Medium | Magnitudes illustrative, not established |

## Gaps and limitations

- No study directly measures whether a glossary file, generated-file markers, deep-module structure, or a tests-to-code index improves agent task success; these benefits are inferred from human-oriented principles or from adjacent benchmarks.
- The AGENTS.md success studies are mostly public Python repos where docs are redundant. The proprietary / novel-vocabulary / TypeScript / multi-file-plugin case (Circuit's case) is not directly measured, and the redundancy-removal result suggests non-redundant proprietary docs land in the +value regime.
- Most navigation and module-depth percentages come from one academic benchmark or one vendor eval each; none is replicated.
- No validated machine-readable architecture-manifest standard exists; that frontier is open.

## Implications for Circuit (bridge to audit)

Circuit already invests in most of the durable practices: a short rules-only AGENTS.md, a `UBIQUITOUS_LANGUAGE.md` glossary, layered repository and per-layer maps (progressive-disclosure shaped), generated-surface markers with drift checks, typed schemas and contracts, and a fast `verify` loop. The research says these are the right bets. The sharpest questions to ask in the audit, in priority order:

1. **Redundancy and derivability.** Which agent-facing docs re-state what code, types, tests, or `verify` already enforce or what an agent can grep? Those are the measured harm case. Prune toward non-obvious-only.
2. **Enforcement vs prose for the generated boundary.** Circuit documents "do not edit generated files" and checks drift in CI (the strong defense). Does it also have a host-level edit-deny rule or PreToolUse hook so an agent literally cannot write to generated trees mid-session? Prose alone does not enforce.
3. **Front-loading and progressive disclosure.** Are the most load-bearing landmarks at the top of the always-loaded surface, with deep material behind on-demand references rather than inlined?
4. **Dual-host portability.** Claude Code reads CLAUDE.md, not AGENTS.md natively; Codex reads AGENTS.md. Confirm Circuit's continuity across hosts does not assume native AGENTS.md reading on Claude Code.
5. **Grep-ability of names.** Audit for generic identifiers (`init`, `config`, `data`, `handler`, `run`) that flood lexical search, and for one-concept-two-names or two-concepts-one-name violations of the ubiquitous language.
6. **Tests as spec.** Are generated-artifact tests small and behavioral rather than large snapshots an agent would blind-approve? Is there a discoverable test-to-code mapping?
