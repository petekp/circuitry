# Pull Query Memory

Status: archived in place, superseded by implementation. The investigation led to
[`pull-query-memory-engineering-proposal.md`](pull-query-memory-engineering-proposal.md)
and then to the implemented `circuit history pull` surface documented in
[`../reference/history-pull.md`](../reference/history-pull.md).

Date: 2026-05-29.

This note explores a pull model for Circuit memory: giving the host agent a way
to ask for prior run evidence when it needs it, instead of only pushing a small
memory block into the run prompt at fresh run start.

No production code change is proposed as done here. The report writes no runtime
or host files.

## Boundary

The product boundary is the same one in `CONTEXT.md`: memory is agent-facing,
hint-only, execution-first, scoped first to project plus flow, and must not make
silent route changes or self-evolve flows. `CONTEXT.md:108-122` defines the
effectiveness ratchet, memory posture, memory scope, and memory use priority.
`CONTEXT.md:124-126` also requires a small operator-facing indicator when memory
influences a run.

The current history authority notice is already strict:
`src/schemas/history.ts:5-6` says history results are hint-only prior-run context
and cannot satisfy current proof, checkpoint, policy, route, recovery,
verification, or write authority.

## Short Answer

A pull model is viable, but the first useful form is small:

- Use the existing `circuit history query --json` data path as the evidence
  source.
- Add a dual-host wrapper only if the product chooses to expose it: a Claude
  slash command and a Codex skill/command mirror that return a compact cited
  packet.
- Keep the packet hint-only and source-first. It should answer "what should I
  inspect or rerun?" rather than "what is true now?"
- Do not route from pull results. Do not mutate memory. Do not generate typed
  flows from pull results.

This is not a replacement for run-start push recall. Push recall is a small,
automatic orientation step. Pull recall is a host-initiated evidence question.
The two can coexist if both use the same authority boundary.

## Claim Inventory

Confidence labels:

- Confirmed: directly verified in current source or local artifacts.
- Supported: strongly implied by source and artifacts, with a small design
  inference.
- Blocked: the source or artifacts do not support the claim today.
- Uncertain: not decidable from current source and artifacts.

| ID | Claim | Confidence | Evidence |
| --- | --- | --- | --- |
| C01 | Circuit has a local JSON history CLI with `rebuild`, `query`, and `status`. | Confirmed | `src/cli/history.ts:95-120`, `src/cli/history.ts:167-179`, `src/cli/history.ts:198-239`, `src/cli/circuit.ts:180-185`, `src/cli/circuit.ts:753-755` |
| C02 | History query returns source refs, ranking reasons, staleness, warnings, and the hint-only authority notice. | Confirmed | `src/schemas/history.ts:117-142`, `src/history/query.ts:329-355` |
| C03 | History query is deterministic lexical retrieval, not embeddings or learned retrieval. | Confirmed | `src/history/query.ts:25-50`, `src/history/query.ts:62-185`, `docs/specs/circuit-history-v1.md:583-620` |
| C04 | Query can filter by flow and document kind, but not by arbitrary report schema, step, file path, command id, or event kind. | Confirmed | `src/cli/history.ts:109-120`, `src/cli/history.ts:145-163`, `src/history/query.ts:289-293` |
| C05 | The existing memory preview emits `MemoryInputV0` values with `kind: "prior_run"` and `authority: "hint_only"`; it skips memory-unsafe docs. | Confirmed | `src/history/memory-preview.ts:34-83`, `src/schemas/memory-input.ts:56-66` |
| C06 | Fresh `circuit run` can push prior history into relay prompts by querying the operator goal, capping memory inputs, writing `reports/history/recall.json`, and passing memory inputs to runtime. | Confirmed | `src/history/run-start-recall.ts:48-99`, `src/cli/circuit.ts:956-986`, `src/runtime/run/graph-runner.ts:676-693` |
| C07 | The relay prompt labels pushed history as "Prior Circuit History (hint-only)" and tells the model to rerun current checks before relying on prior evidence. | Confirmed | `src/shared/relay-support.ts:147-165`, `src/shared/relay-support.ts:170-209` |
| C08 | Circuit already has run artifacts that expose memory use in one local run: `memory_context.used: true`, three memory input ids, and no memory update events. | Confirmed | `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:7-15`, `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:191` |
| C09 | The run-envelope schema has slots for memory context, memory update events, and a small memory indicator, but those slots do not by themselves create project memory. | Confirmed | `src/schemas/run-envelope.ts:357-390`, `src/schemas/run-envelope.ts:392-400`, `src/schemas/run-envelope.ts:471-491` |
| C10 | The local history index currently contains 22 runs and 202 history documents, and its manifest says the index is possibly stale when checked through the CLI. | Confirmed | `.circuit/history/manifest.v1.json:4-13`; read-only command `node bin/circuit history status --json` returned `index_state: "possibly_stale"` on 2026-05-29 |
| C11 | The local corpus has 22 run folders, 22 traces, 776 trace entries, 257 JSON reports, 13 complete outcomes, and 4 aborted outcomes in closed-result artifacts. | Confirmed | Read-only corpus pass over `.circuit/runs` on 2026-05-29; example aborted trace at `.circuit/runs/81b8e94c-deba-4b3a-94c1-d1986f4c07a9/trace.ndjson:17-20` |
| C12 | The local history index is mostly report documents: 151 report docs, 22 run docs, 15 trace docs, and 14 checkpoint docs. | Confirmed | Read-only corpus pass over `.circuit/history/documents.v1.jsonl` on 2026-05-29; manifest count at `.circuit/history/manifest.v1.json:8-10` |
| C13 | Raw traces capture many lifecycle events, but the history extractor indexes only selected trace kinds and failed checks. | Confirmed | `src/schemas/trace-entry.ts:525-553`, `src/history/extract.ts:664-679`, `src/history/extract.ts:832-843` |
| C14 | Raw traces in the local corpus do not contain `verification.command_evaluated` events. | Confirmed | Read-only corpus pass over 776 trace entries on 2026-05-29 found count 0 for `verification.command_evaluated` |
| C15 | Current source can emit `verification.command_evaluated` for runtime verification commands, including command id, cwd, argv, exit code, status, duration, and output summaries. | Confirmed | `src/schemas/trace-entry.ts:87-99`, `src/runtime/executors/verification.ts:273-291` |
| C16 | Current history extraction does not index `verification.command_evaluated` as a trace document. | Confirmed | `src/history/extract.ts:664-679` |
| C17 | `check.evaluated` has optional fields for criterion id, criterion kind, exit code, status, and output summaries, but local corpus `check.evaluated` entries only used the core keys plus `reason` on 3 failures. | Confirmed | `src/schemas/trace-entry.ts:64-85`; read-only corpus pass over `.circuit/runs` on 2026-05-29 |
| C18 | File-level diffs are not available through history text because diff-like fields are pruned during extraction. | Confirmed | `src/history/extract.ts:31-44`, `docs/specs/circuit-history-v1.md:516-563` |
| C19 | `circuit runs show --json --run-folder <path>` exists and returns a run-status projection for one run folder. | Confirmed | `src/cli/runs.ts:44-75`; read-only command against `.circuit/runs/81b8e94c-deba-4b3a-94c1-d1986f4c07a9` returned `api_version: "run-status-v1"` on 2026-05-29 |
| C20 | Codex has host skills today; Claude has slash commands and compiled flow JSON mirrors. | Confirmed | `plugins/codex/.codex-plugin/plugin.json:11-12`, `plugins/codex/README.md:7-23`, `plugins/claude/README.md:12-25`, `docs/generated-surfaces.md:23-27`, `docs/generated-surfaces.md:40-43` |
| C21 | Only `run` and `handoff` are currently published as direct host command sources. There is no host-level history command or Codex history skill in the generated surface map. | Confirmed | `docs/generated-surfaces.md:59-74`, `plugins/codex/skills/run/SKILL.md:1-10`, `plugins/codex/skills/handoff/SKILL.md:1-10` |
| C22 | A dual-host pull wrapper is feasible without changing runtime authority because direct commands are already mirrored to Claude commands, Codex commands, and Codex skills. | Supported | `docs/generated-surfaces.md:34-35`, `docs/generated-surfaces.md:63-66`; design inference from existing generated direct-command pattern |
| C23 | A pure host wrapper over `history query` would not create new capture. It would only make existing indexed evidence easier to ask for. | Supported | C01 through C05, C20 through C22 |
| C24 | A richer pull packet that joins history hits to raw run artifacts is feasible, but would need a new schema or command shape to stay compact and auditable. | Supported | `src/schemas/history.ts:117-142`, `src/cli/runs.ts:44-75`, `docs/specs/circuit-history-v1.md:300-360`; design inference |
| C25 | An MCP or long-lived tool server for memory pull cannot be called a current shipped host surface from the host package maps reviewed here. | Blocked | No MCP server or tool-server surface is present in the cited host package maps at `docs/generated-surfaces.md:31-44`, `plugins/claude/README.md:12-25`, and `plugins/codex/README.md:7-23` |
| C26 | Pull results are not enough to tune retry budgets, update project memory, or crystallize typed flows unless later runs record whether the pulled evidence helped, misled, or changed execution. | Supported | `docs/ideas/longitudinal-evidence-memory.md:331-359`, `docs/ideas/dynamic-flow-ratchet.md:105-148`, `src/schemas/run-envelope.ts:357-390` |

## Local Corpus Pass

Read-only pass over `.circuit/runs` and `.circuit/history` on 2026-05-29:

| Measurement | Count | Notes |
| --- | ---: | --- |
| Run folders | 22 | All 22 had `trace.ndjson`. |
| Trace entries | 776 | Raw trace kinds included `step.entered`, `step.completed`, `step.report_written`, `check.evaluated`, relay events, guidance decisions, checkpoints, fanout, sub-runs, aborts, and run closes. |
| JSON reports | 257 | 1 `run-envelope.json`, 1 `process-evidence.json`, and 1 `reports/history/recall.json` were present. |
| Closed outcomes | 13 complete, 4 aborted | Five run folders did not have `reports/result.json`, so outcome rates over closed results are 13 of 17 complete and 4 of 17 aborted. |
| `check.evaluated` entries | 64 | 46 `result_verdict` pass, 2 `result_verdict` fail, 6 `schema_sections` pass, 3 `checkpoint_selection` pass, 6 `fanout_aggregate` pass, 1 `fanout_aggregate` fail. |
| `step.aborted` entries | 4 | Four distinct human-readable abort reasons. Example: `.circuit/runs/81b8e94c-deba-4b3a-94c1-d1986f4c07a9/trace.ndjson:18-20`. |
| `relay.failed` entries | 4 | Indexed by history because `src/history/extract.ts:664-679` includes `relay.failed`. |
| `verification.command_evaluated` trace entries | 0 | Current source can emit them per C15, but this local corpus does not contain them per C14. |
| History documents | 202 | Manifest confirms 22 runs and 202 docs at `.circuit/history/manifest.v1.json:8-10`. |
| History doc kinds | 151 report, 22 run, 15 trace, 14 checkpoint | This makes history strongest for report search and weaker for raw trace exploration. |
| Memory-safe docs | 194 true, 8 false | Checkpoint request docs are intentionally unsafe for memory preview through `src/history/extract.ts:640-642`. |
| History warning | 1 source-pruned warning | `.circuit/history/manifest.v1.json:15-21` records pruning for `reports/review-intake.json`. |

This corpus is enough to compare pull delivery mechanisms and queryable data
classes. It is too small to claim general outcome rates across all Circuit use.

## Data Classes

| Data a host might pull | Availability today | Evidence | What it can answer | What it cannot answer |
| --- | --- | --- | --- | --- |
| Indexed history documents | Captured today | `src/schemas/history.ts:53-90`, `.circuit/history/manifest.v1.json:8-10` | Relevant prior reports, runs, selected trace failures, checkpoint docs, source refs, facets, staleness. | Full raw trace reconstruction, arbitrary aggregate stats, exact command history when not in indexed reports. |
| History query hits | Captured today | `src/cli/history.ts:109-120`, `src/history/query.ts:242-355` | "Show prior failures/checkpoints/verification docs relevant to this query." | Semantic retrieval, schema-specific filtering, learned usefulness. |
| Memory input preview | Captured today | `src/cli/history.ts:224-235`, `src/history/memory-preview.ts:34-106` | "What would this query look like as hint-only memory?" | Project memory, memory promotion, process tuning. |
| Run-start push recall | Captured today for runs that used it | `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/history/recall.json:1-10`, `src/history/run-start-recall.ts:48-99` | "What memory was pushed into this run?" | Whether that memory helped or misled later execution. |
| Run envelope memory context | Partial | `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:7-15`, `src/schemas/run-envelope.ts:478-490` | "Was memory used, and which memory ids were loaded?" | Why the host used it, whether it improved the work, or what changed because of it. |
| Process evidence | Partial | `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/process-evidence.json:1-42` | Declared report paths, missing evidence, outcome, result refs. | Fine-grained command/test/file causes. |
| Raw trace lifecycle | Captured today in artifacts | `src/schemas/trace-entry.ts:525-553`, example `.circuit/runs/81b8e94c-deba-4b3a-94c1-d1986f4c07a9/trace.ndjson:1-20` | Step flow, relay lifecycle, failed checks, abort reasons, checkpoints, fanout/sub-run linkage. | Full prompts, full stdout/stderr, file diffs, failing file/test names unless an event/report records them. |
| Command observations | Partial | `src/schemas/trace-entry.ts:87-99`, `src/runtime/executors/verification.ts:273-291`; corpus count 0 for that event | Future runtime verification command id, cwd, argv, exit code, status, duration, summaries. | Historical command data for old runs, and history query access unless extraction grows. |
| File-level diffs | Not captured for pull memory | `src/history/extract.ts:31-44`, `docs/specs/circuit-history-v1.md:516-563` | Nothing reliable through history. | "What files changed?" and "Which diff caused this failure?" |
| Host skill surface for history | Not captured today | `docs/generated-surfaces.md:59-74`, `plugins/codex/skills/run/SKILL.md:1-10`, `plugins/codex/skills/handoff/SKILL.md:1-10` | None directly. Hosts can still run the raw CLI if instructed. | A native "ask Circuit history" affordance with consistent output. |

## Pull Versus Push

Push recall exists today. At fresh run start, Circuit queries history with the
operator goal, caps memory inputs, and injects a relay prompt section. Evidence:
`src/history/run-start-recall.ts:48-99`, `src/cli/circuit.ts:956-986`, and
`src/shared/relay-support.ts:147-165`.

Pull recall would differ in three ways:

1. The host asks a narrower question when it needs evidence.
2. The result is an evidence packet or memory preview, not automatic model
   context unless the host decides to read it.
3. The query can happen outside a Circuit run, during a host conversation, or
   while inspecting a run artifact.

Push is good for orientation. Pull is better for targeted questions:

- "Have prior Build runs aborted at `act-step`?"
- "Show prior memory that mentioned verification."
- "Which prior run supplied this hint?"
- "Find checkpoint operator notes about prototype variants."
- "Show evidence for recurring `relay.failed` reasons."

Pull also reduces prompt noise. The host does not need every plausible prior
hint upfront. It needs a way to ask for cited evidence when a question appears.

## Option Space

| Option | Host delivery | Feasibility | Tradeoff |
| --- | --- | --- | --- |
| Use raw `circuit history query --json` | Manual shell invocation outside a dedicated host surface. | Confirmed by C01 and the successful read-only query command. | Lowest cost, but raw JSON is too verbose and easy to misuse as proof. |
| Add a direct `history` host command and Codex skill | Claude gets `/circuit:history`; Codex gets a `history` skill and command mirror. | Supported by C20 through C22. | Good parity. Needs generator work and host wording. No runtime change. |
| Add `history packet` or `history ask` CLI output | Both hosts call one shared CLI and render a compact cited packet. | Supported by C24. | Strong auditability. Higher schema and test cost than a wrapper over current query. |
| Teach existing `run` skill/command to suggest pull queries | Same existing host surfaces. | Supported by C20 and C21. | Low surface cost, but mixes running Circuit with asking history. It can blur the operator's intent. |
| Use `runs show` plus direct artifact reads | Host shell plus file reads. | Confirmed by C19. | Good for debugging one run. Weak as memory because every host must know report shapes. |
| Session-start hook advertises pull availability | Claude and Codex hooks already call `handoff brief`. | Confirmed hook shape at `plugins/claude/hooks/session-start.ts:20-29`, `plugins/claude/hooks/session-start.ts:58-67`, `plugins/codex/hooks/session-start.ts:20-29`, `plugins/codex/hooks/session-start.ts:58-67`. | Could teach availability without dumping memory. Risk: turns pull into another push surface if it starts injecting evidence. |
| MCP or local tool server | Tool call instead of shell. | Blocked by C25 for current shipped host surfaces. | Could be clean later, but the reviewed host package maps do not ship it now. |
| Runtime relay self-query | A Circuit step asks history while running. | Supported as possible but not recommended by C06, C07, C26. | Higher authority risk. It can make memory look like runtime evidence unless carefully fenced. |
| Pattern crystallization into typed flows | Pull finds motifs, then a later flow proposes static typed flows. | Supported as later-stage design by `docs/ideas/dynamic-flow-ratchet.md:105-148`. | Strongest ratchet path, but not a pull query first slice. Needs motif detection, operator curation, and typed contracts. |

## Depth Analysis

### Option A: raw CLI pull

Confirmed by C01 and C02, this works today. A host can run:

```bash
node bin/circuit history query verification --json --limit 3 --kind report
```

The command returned three report hits on 2026-05-29. Each hit included a
source ref, ranking reasons, staleness, warnings, and the authority notice. The
index was `possibly_stale`, so the result was useful as a pointer, not as a
fresh claim.

Best use:

- local investigation by a careful host;
- tests and examples;
- proving the data path before making a host surface.

Main risk:

- raw JSON is long and includes fields the host may over-read as stronger than
  they are.

Boundary:

- safe if the host repeats the authority notice and reruns current checks.

### Option B: dual-host `history` wrapper

This is the cleanest host-level option if Circuit wants a product surface.

Feasibility is supported by C20 through C22 and by the existing direct command pattern. Direct command
sources under `src/commands/<id>.md` can be mirrored to Claude commands, Codex
commands, and Codex skills. Evidence: `docs/generated-surfaces.md:34-35`,
`docs/generated-surfaces.md:63-66`, `plugins/codex/.codex-plugin/plugin.json:11-12`.

The wrapper should:

- ask the host to quote the user's query safely;
- call `circuit history query <query> --json`;
- render only the top few hits with source path, run id, staleness, matched
  terms, and ranking reasons;
- repeat the authority notice;
- say when the index is stale;
- avoid turning results into proof or checkpoint authority.

Tradeoffs:

- Good dual-host parity.
- Low runtime risk.
- No new capture.
- Still limited by the current index shape.

Design caution:

- Claude and Codex are not symmetric. Codex has generated `SKILL.md` files;
  Claude has generated slash commands and compiled flow JSON mirrors. Evidence:
  `plugins/codex/README.md:7-23`, `plugins/claude/README.md:12-25`.

### Option C: history evidence packet

Feasibility is supported by C24.

A richer CLI could return a compact packet, for example:

```text
history-evidence-packet-v1
query
index_state
authority_notice
hits[]
  source_ref
  source_path
  staleness
  why_included
  snippet
  suggested_next_check
```

This would build on `HistoryQueryResultV1` rather than replacing it.
`src/schemas/history.ts:130-142` already defines the query result envelope, and
`src/schemas/history.ts:117-127` defines hit shape. The packet would be a
host-friendly projection with stronger wording and less JSON bulk.

Tradeoffs:

- Better host UX and auditability.
- More schema and tests.
- Still no new capture unless paired later with command-event indexing or
  memory-use outcome fields.

Good first packet questions:

- "prior failures for this flow or step"
- "verification evidence for this query"
- "checkpoint operator notes"
- "memory that was pushed into a named run"
- "runs with stale or pruned sources"

### Option D: raw artifact pull

Confirmed by C19, `circuit runs show --json --run-folder <path>` exists and can
report a run's state. Evidence: `src/cli/runs.ts:44-75`.

This is useful for one-run inspection, not broad memory. To answer cross-run
questions, the host would need to inspect many report shapes and trace events.
That repeats work the history index already did.

Good use:

- "what happened in this run folder?"
- "is this run inspectable, terminal, or waiting?"
- "where is `result.json`?"

Weak use:

- "what tends to fail over time?"
- "what prior evidence should I consider?"

### Option E: session-start pointer

The hook behavior is confirmed: Claude and Codex hooks already read host input,
derive the project root from the hook input, and call
`handoff brief --json --project-root <cwd>`. Evidence:
`plugins/claude/hooks/session-start.ts:20-29`,
`plugins/claude/hooks/session-start.ts:58-67`,
`plugins/codex/hooks/session-start.ts:20-29`,
`plugins/codex/hooks/session-start.ts:58-67`.

A hook could announce that pull history is available. It should not dump query
results by default. That would recreate the push model, increase prompt weight,
and risk silent memory influence.

Good use:

- "Circuit history is available. Ask for it when needed."

Bad use:

- inject a changing set of prior run hits on every session start.

### Option F: runtime self-query

Supported by C06, C07, and C26, this is the riskiest direction for the first
slice. If a relay step can query history while running, prior evidence may feel
like current evidence. The existing prompt text goes out of its way to prevent
that:
`src/shared/relay-support.ts:159-163`.

This may be useful later as a flow step, but only after Circuit records how
pulled evidence affected execution. Today, the relevant "memory helped" and
"memory misled" fields are design ideas, not captured data.
`docs/ideas/longitudinal-evidence-memory.md:331-359` names those fields as a
future merge report shape.

## Prior Art Lens

This section is not a claim about current Circuit capability.

- Claude Code's current memory model combines startup loading with on-demand
  file reads. Its docs say `MEMORY.md` is partly loaded at conversation start,
  while topic files are read on demand during the session:
  [Claude Code memory docs](https://code.claude.com/docs/en/memory).
  That supports Circuit's split between push orientation and pull evidence.
- Browserbase Autobrowse frames durable skills as the artifact that stops agents
  from rediscovering the same path on each run:
  [Autobrowse](https://www.browserbase.com/blog/autobrowse/). That maps more
  to Circuit's later pattern-crystallization stage than to a basic pull query.
- ACE treats changing context as evolving playbooks built from execution
  feedback:
  [Agentic Context Engineering, arXiv:2510.04618](https://arxiv.org/abs/2510.04618).
  The useful lesson for Circuit is not "store more text." It is "record feedback
  about whether context changed future execution."

## Relation To Ratcheting Mechanisms

| Ratchet mechanism | Does pull help? | Data needed | Data availability |
| --- | --- | --- | --- |
| Cited self-invalidating memory | Yes. Pull can show source refs, hashes, staleness, and warnings on demand. | Source refs, source hashes, staleness, memory-safe flag. | Captured today in history docs and query results. C02, C05, C10. |
| Statistics over a comparable run corpus | Partially. Pull can expose history docs, but there is no aggregate query CLI yet. | Comparable run ids, flow ids, outcomes, event kinds, report schemas, abort reasons. | Captured in artifacts and partly indexed. Requires aggregation outside current CLI. C11, C12, C13. |
| Process-tuning memory | Not enough yet. Pull can reveal prior failures, but not whether a prior pulled item improved a later run. | Failure recurrence, checks rerun, retry counts, memory-used ids, helped/misled outcomes. | Partial. Memory ids and run outcomes exist; helped/misled is not captured. C08, C17, C26. |
| Pattern crystallization into typed flows | Pull helps discovery, not crystallization itself. | Repeated typed step sequences, contracts, motif detection, operator curation, proposed static flow. | Design only. Current dynamic-flow doc says closed typed alphabets make motifs detectable, but crystallization is future work. `docs/ideas/dynamic-flow-ratchet.md:105-148`. |

## Boundary Implications

Pull memory should preserve these rules:

- Always show source ref and staleness.
- Always repeat the hint-only notice.
- Prefer "inspect" and "rerun" wording over "trust" wording.
- Never mark proof, checkpoint, route, recovery, verification, policy, or write
  authority as satisfied.
- Never update memory as a side effect of a query.
- Never silently alter flow selection.
- Keep host parity explicit: Claude command, Codex skill/command, same CLI data.

These rules are grounded in `CONTEXT.md:108-126`,
`src/schemas/history.ts:5-6`, `src/schemas/memory-input.ts:56-66`, and
`src/shared/relay-support.ts:159-163`.

## Roadmap Options

These are options, not a selected plan.

### Phase 0: Use Today

Use `circuit history query --json` manually during investigations. Keep it
read-only and treat `possibly_stale` as a visible caution. This is available
now. It is not a polished host feature.

### Phase 1: Host Pull Wrapper

Add a direct `history` command source and generated host mirrors:

- Claude: `/circuit:history <question>`
- Codex: `history` skill plus command mirror

Output should be a short cited packet, not raw JSON. No runtime behavior changes
are needed. This is the best value-to-risk path if a product surface is wanted.

### Phase 2: Evidence Packet Schema

Add a first-class `history-evidence-packet-v1` projection. It can include
selected source refs, staleness, ranking reasons, and suggested next checks.
This improves auditability and makes both hosts render the same shape.

### Phase 3: Capture Whether Memory Helped

Add report fields or a merge report for whether a pulled or pushed memory item
helped, misled, or was ignored. Without this, Circuit can accumulate memory but
cannot tune process from memory with confidence. The prior design names
`memory_helped` and `memory_misled` as explicit report fields:
`docs/ideas/longitudinal-evidence-memory.md:331-359`.

### Phase 4: Pattern Crystallization

Use pull and corpus statistics to surface repeated typed motifs, then propose
static typed flows for operator review. This belongs after the query and
feedback loop, not before. The dynamic-flow ratchet doc explains why a closed
alphabet of typed steps and contracts is the key prerequisite:
`docs/ideas/dynamic-flow-ratchet.md:132-148`.

## Open Questions

- Should a host wrapper ever pass `--rebuild-if-stale`, or should stale index
  warnings be shown until the operator explicitly asks to rebuild?
- Should pull output be `HistoryMemoryInputPreviewV1`, a new evidence packet, or
  a prose projection over `HistoryQueryResultV1`?
- Should the pull wrapper support `--flow` and `--kind` directly, or infer those
  from natural language?
- Should command observations be indexed once newer runs contain
  `verification.command_evaluated`, or should they stay in raw trace only?
- What is the smallest "memory helped or misled" field that can be filled
  honestly without asking the operator to manage memory?
- Can dual-host parity be kept through generated surfaces without making Claude
  and Codex docs diverge?

## Final Recommendation

Reachable on today's data, grounded in C01, C02, C05, C08, C19, and C22 through
C24:

- raw `history query` pull;
- host-rendered cited packets over indexed history;
- run-status inspection through `runs show`;
- targeted inspection of recall reports and run envelopes.

Requires capture or schema investment:

- process tuning from memory usefulness;
- aggregate query commands over outcomes and failure recurrence;
- command-level history through indexed `verification.command_evaluated` events;
- file-diff or file-level causal memory;
- typed-flow crystallization.

The safest next product move, if any move is made, is a dual-host pull wrapper
over current history query output. It compounds only weakly by itself, but it
creates the habit and surface for cited evidence questions without pretending
memory is proof. The stronger ratchet begins only after Circuit records whether
the pulled evidence changed execution and whether that change helped.

## Verification Notes

- Read required source files and docs: `CONTEXT.md`,
  `src/cli/history.ts`, `src/history/*`, `src/shared/relay-support.ts`,
  `src/schemas/memory-input.ts`, `docs/specs/circuit-history-v1.md`,
  `docs/ideas/longitudinal-evidence-memory.md`,
  `docs/ideas/project-execution-memory.md`,
  `docs/ideas/self-improving-circuit.md`,
  `docs/ideas/dynamic-flow-ratchet.md`, and the relevant Claude and Codex
  host manifests, READMEs, command files, skills, and session-start hooks.
- Ran a read-only corpus pass over `.circuit/runs` and `.circuit/history` on
  2026-05-29.
- Confirmed `node bin/circuit history status --json`,
  `node bin/circuit history query verification --json --limit 3 --kind report`,
  `node bin/circuit history query verification --json --format memory-input --limit 1`,
  and `node bin/circuit runs show --json --run-folder ...` all ran read-only.
- This investigation edited only `docs/ideas/pull-query-memory.md`. Existing
  dirty production, schema, generated host, or artifact files in the checkout
  were not part of this report-only change.
