# Pull Query Memory Engineering Proposal

Status: partially implemented. The bounded `history pull` substrate exists and
is documented in [`../reference/history-pull.md`](../reference/history-pull.md).
The broader host-facing "History Ask" wrapper remains proposal material.
Date: 2026-05-29

## Decision

Build the first pull/query memory application as a dual-host **Circuit History Ask** surface.

The surface should let Claude Code and Codex ask a focused question about prior Circuit runs and get back a compact, cited, hint-only evidence packet. It should read the existing history index and run artifacts. It should not update memory, route flows, satisfy checks, resolve checkpoints, change retry budgets, or promote a pattern into a typed flow. See C01, C12, and C18.

This is the best first application because it turns existing run evidence into on-demand agent context without adding new capture authority. It also creates the right product shape for later learning: agents can pull cited evidence during execution, and future work can record whether a pulled packet helped or misled the run. See C16 and C17.

## Evidence Boundary

| ID | Claim | Confidence | Evidence |
| --- | --- | --- | --- |
| C01 | Circuit already has an explicit local history query CLI. | confirmed | `src/cli/history.ts:95-120` defines `rebuild`, `query`, and `status`; `src/cli/circuit.ts:753-755` routes the top-level `history` command. |
| C02 | The current query output already carries rank, score, source document, snippet, matched terms, ranking reasons, staleness, warnings, and an authority notice. | confirmed | `src/history/query.ts:329-355`; `src/schemas/history.ts:117-142`; `docs/specs/circuit-history-v1.md:300-337`. |
| C03 | The query CLI only exposes `flow` and document `kind` filters today. | confirmed | `src/cli/history.ts:95-120` declares `--flow` and `--kind`; `src/history/query.ts:289-293` applies only those filters. |
| C04 | Query results are explicitly hint-only and cannot satisfy current proof, checkpoint, policy, route, recovery, verification, or write authority. | confirmed | `src/schemas/history.ts:5-6`; `docs/specs/circuit-history-v1.md:316-320`; `tests/contracts/history-schema.test.ts:90-118`. |
| C05 | Circuit already converts some history query hits into strict `MemoryInputV0` preview objects. | confirmed | `src/history/memory-preview.ts:34-83`; `docs/specs/circuit-history-v1.md:680-700`; `tests/runner/history-cli.test.ts:170-187`. |
| C06 | Run-start push recall already exists and injects prior-run hints into relay prompts when enabled. | confirmed | `src/history/run-start-recall.ts:48-84`; `src/cli/circuit.ts:956-986`; `src/shared/relay-support.ts:147-164`; `tests/runner/history-run-start-recall.test.ts:147-206`. |
| C07 | Run-start recall records only memory context and leaves memory updates empty in the verified path. | confirmed | `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:7-15` and `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:190-191`; `tests/runner/history-run-start-recall.test.ts:194-203`. |
| C08 | Current host packages expose generated command surfaces for Claude and generated command plus skill surfaces for Codex. | confirmed | `docs/generated-surfaces.md:23-27`; `docs/generated-surfaces.md:34-43`; `plugins/codex/.codex-plugin/plugin.json:12`. |
| C09 | Today only `handoff` and `run` are host direct commands. | confirmed | `scripts/flows/emit.ts:116-117`; `docs/generated-surfaces.md:61-66`; `rg --files plugins/codex/skills plugins/codex/commands plugins/claude/commands` returned only `handoff` and `run` surfaces. |
| C10 | Adding a new host direct command is feasible but requires source and emitter changes, not hand-edits to generated host files. | supported | Direct command rows are generated from `HOST_DIRECT_COMMANDS` in `scripts/flows/emit.ts:116-123` and `scripts/flows/emit.ts:470-480`; drift tests assert the list and generated map at `tests/contracts/catalog-completeness.test.ts:434-467`. |
| C11 | The plugin wrappers can forward non-run CLI commands to the bundled runtime. | confirmed | Codex wrapper forwards raw args when no run/create injection applies in `plugins/codex/scripts/circuit.ts:607-656`; Claude wrapper forwards raw args outside `present` in `plugins/claude/scripts/circuit.ts:889-912`. |
| C12 | The current history index in this checkout has 22 runs and 202 documents, and `history status` reports it as `possibly_stale`. | confirmed | `.circuit/history/manifest.v1.json:9-10`; `./bin/circuit history status --json` on 2026-05-29 returned `index_state: "possibly_stale"` with the same counts. |
| C13 | A read-only corpus pass found 22 run folders, 776 trace entries, 257 JSON report files, and 202 history documents. | confirmed | Read-only pass over `.circuit/runs` and `.circuit/history/documents.v1.jsonl` on 2026-05-29; the manifest confirms the indexed run and document counts at `.circuit/history/manifest.v1.json:9-10`; the prior pull report records the same count family at `docs/ideas/pull-query-memory.md:87-105`. |
| C14 | The local index contains queryable report, run, checkpoint, and trace documents. | confirmed | Read-only pass over `.circuit/history/documents.v1.jsonl` on 2026-05-29 found 151 reports, 22 runs, 14 checkpoints, and 15 trace docs; the schema allows those kinds at `src/schemas/history.ts:53-90`; the option-space report lists the same indexed document kinds at `docs/ideas/pull-query-memory.md:87-105`. |
| C15 | The existing query output is too raw for a normal host answer because it returns full document fields and long extracted text. | supported | `./bin/circuit history query verification --json --limit 2 --kind report` returned full `HistoryDocumentV1` objects, including long `doc.text`; `src/schemas/history.ts:53-90` includes full document fields. |
| C16 | The current data can answer "what prior evidence may be relevant?" better than a flat notes file because hits are cited to source refs, hashes, staleness, and ranking reasons. | confirmed | `src/history/query.ts:329-355`; `src/schemas/history.ts:53-90` and `src/schemas/history.ts:117-142`; `docs/ideas/pull-query-memory.md:28-44`. |
| C17 | The current data cannot prove that pulled evidence helped or misled a later run. | confirmed | The pull report identifies helped/misled capture as future work at `docs/ideas/pull-query-memory.md:254-262` and recommends recording usefulness later at `docs/ideas/pull-query-memory.md:422-444`; no current schema field in `src/schemas/history.ts:117-142` records pull use outcome. |
| C18 | Runtime self-query, adaptive defaults, and typed-flow crystallization should not be in this first slice. | confirmed | `CONTEXT.md:108-122` sets the memory posture and near-term boundaries; `docs/specs/circuit-history-v1.md:889-915` keeps adaptive defaults, promotion, and future runtime consumption out of v1. |

## Why This First

The prior pull-query investigation recommended a dual-host wrapper over current `circuit history query --json` as the safest next product move, with a compact cited packet and no routing, mutation, or authority change (`docs/ideas/pull-query-memory.md:28-44`, `docs/ideas/pull-query-memory.md:422-444`). I agree with that recommendation.

Other candidates are weaker as first applications. The ranks below are product judgment based on the evidence boundary, not claims that every candidate is already implemented.

| Candidate | Value | First-slice problem | Rank |
| --- | --- | --- | --- |
| Raw CLI access only | Already exists and is useful for debugging. | It is too large and schema-shaped for routine host use, and it leaves each host to invent rendering rules. See C01, C02, and C15. | 3 |
| More run-start push memory | Already reaches relays without the host asking. | It only runs at fresh run start and matches on goal wording. It also risks prompt clutter before the host knows what question matters. See C05, C06, and `docs/ideas/pull-query-memory.md:124-146`. | 4 |
| Dual-host History Ask evidence packet | Gives the agent cited, current-demand context with existing data and strict authority limits. | Needs a packet projection and host command source, but no new run capture. See C08 through C16. | 1 |
| Runtime self-query during flows | Could support process tuning later. | It touches runtime authority boundaries and needs helped/misled capture before it can compound safely. See C17 and C18. | 5 |
| Pattern crystallization into typed flows | Strongest long-term ratchet. | It needs comparable typed episodes plus success/failure signals across runs. The pull report treats it as later work, not a host query first slice (`docs/ideas/pull-query-memory.md:254-262`). | 6 |
| Host-readable artifact browser | Useful for inspection. | It is broad browse UI, not a focused memory pull. It gives less execution guidance per unit of implementation. | 2 |

## Proposed User Experience

The normal user-facing move should be:

- Claude Code: `/circuit:history <question>`
- Codex: `Circuit History` skill, invoked by a natural-language request such as "Ask Circuit history what usually fails in review verification here."

The host should run a safe command and return a compact packet, not raw JSON:

```bash
node "<plugin root>/scripts/circuit.ts" history query '<question>' --json --format evidence-packet --limit 5 --per-run-limit 1
```

For Claude Code, the direct command source should use the existing wrapper path style from `plugins/claude/commands/run.md:139-152`. For Codex, the generated skill should use the plugin-root wording style from `plugins/codex/skills/run/SKILL.md:12-27` and `plugins/codex/skills/run/SKILL.md:145-176`. The source of truth should be a new `src/commands/history.md`, mirrored through `scripts/flows/emit.ts` the same way `run` and `handoff` are mirrored today. That is supported by C08 through C11.

The host answer should be short:

```text
Circuit History Ask
Question: what usually fails in review verification here?
Index: possibly_stale
Authority: hint-only prior-run context. Rerun current checks before relying on it.

1. Prototype variant verification, prior prototype run
   Source: reports/prototype/variant-verification.json, run e235d399...
   Why this matched: exact phrase matched; verification facet matched; source hash verified.
   Hint: A branch can abort without a verdict while provider evidence is present.
   Next check: inspect the cited report, then rerun the current verification.

Warnings:
- history index may be stale; run circuit history rebuild --json to refresh it
```

That answer must never say the prior packet proves the current run. It should use the same authority notice as the current history result schema, or a stricter restatement of it. The schema and tests already enforce the exact notice for current query results (C04).

## Packet Shape

Add a new query output projection, not a new capture artifact:

```ts
type HistoryEvidencePacketV1 = {
  api_version: "history-evidence-packet-v1";
  schema_version: 1;
  query: string;
  format: "evidence-packet";
  index_state: "fresh" | "possibly_stale";
  rebuilt: boolean;
  authority_notice: string;
  warnings: HistoryWarningV1[];
  results: Array<{
    rank: number;
    source: {
      run_id?: string;
      flow_id?: string;
      source_path: string;
      source_ref: Ref;
      source_sha256?: string;
      staleness: HistoryQueryHitV1["staleness"];
      memory_safe: boolean;
    };
    title: string;
    summary: string;
    snippet: string;
    matched_terms: string[];
    ranking_reasons: string[];
    suggested_next_checks: string[];
  }>;
};
```

The packet should be a projection of `HistoryQueryResultV1`, not a replacement. It should keep `rank`, `source_ref`, `snippet`, and `staleness`, because those are the parts that make the answer auditable. It should drop the long `doc.text` field by default, because the host answer is meant to guide the next read or check, not paste an entire report into the conversation. Current `HistoryQueryHitV1` already has every required source field except the packet-specific `suggested_next_checks` strings (C02 and C15).

`suggested_next_checks` should be mechanical and conservative:

- stale or unknown staleness: rebuild or inspect the cited source first.
- `verification` facet: rerun current verification before relying on the hint.
- `failure` facet: inspect the cited failure source before treating it as recurring.
- `checkpoint` or `operator-note` facet: use it only as context for asking the operator, not as checkpoint authority.

These strings are presentation guidance. They are not memory, policy, or runtime decisions.

## CLI Shape

Prefer an additive format on the existing query command:

```bash
circuit history query "<question>" --json --format evidence-packet
```

This is smaller than a new `history ask` subcommand because the current parser already has a `--format` option for `json` and `memory-input` (`src/cli/history.ts:95-120`, `src/cli/history.ts:145-163`). It also keeps the current mental model: one query engine, multiple projections. The v1 spec already made `memory-input` a projection rather than a separate command (`docs/specs/circuit-history-v1.md:148-158`, `docs/specs/circuit-history-v1.md:340-365`).

A later alias can add:

```bash
circuit history ask "<question>" --json
```

That alias should wait until the packet format has real host use.

## Host Surface Shape

Implement one new direct command source:

- `src/commands/history.md`
- generated Claude mirror: `plugins/claude/commands/history.md`
- generated Codex mirror: `plugins/codex/commands/history.md`
- generated Codex skill: `plugins/codex/skills/history/SKILL.md`

The source should tell the host to:

1. Treat the user question as literal input.
2. Single-quote it using the same rules as `run` and `handoff`.
3. Run the plugin wrapper with `history query`.
4. Render the packet in prose.
5. Preserve warnings and authority text.
6. Do not use the packet as proof, route authority, checkpoint authority, recovery authority, or permission to write.

To ship it, the implementation would add `history` to `HOST_DIRECT_COMMANDS` in `scripts/flows/emit.ts:116`, regenerate with `npm run emit-flows`, and satisfy the existing host surface tests that read the direct-command list (`tests/contracts/catalog-completeness.test.ts:434-467`). This is supported, not confirmed, because the new command has not been implemented.

## Implementation Plan

Phase 1: Packet projection

- Add `HistoryEvidencePacketV1` to `src/schemas/history.ts`.
- Add a pure projector under `src/history/` that maps `HistoryQueryResultV1` to `HistoryEvidencePacketV1`.
- Extend `src/cli/history.ts` so `--format` accepts `evidence-packet`.
- Keep default `--format json` unchanged.

Phase 2: Host command

- Add `src/commands/history.md`.
- Add `history` to `HOST_DIRECT_COMMANDS`.
- Regenerate host surfaces.
- Keep `create` CLI-only and keep routed flows unpublished as direct host commands.

Phase 3: Tests

- Schema test: packet accepts the intended shape and rejects a wrong authority notice.
- Projector test: long `doc.text` is excluded, source refs and staleness survive, warnings survive.
- CLI test: `history query q --json --format evidence-packet` returns the packet.
- Host surface test: generated Claude command and Codex command plus skill exist for `history`; generated Codex skill has no `$ARGUMENTS`, no slash-command wording, and uses the plugin wrapper.
- Regression test: default `history query q --json` still returns `HistoryQueryResultV1`; `--format memory-input` still returns strict `MemoryInputV0` values.
- Drift proof: `npm run check-flow-drift`.
- Final implementation proof: `npm run verify`.

These tests fit existing patterns in `tests/runner/history-cli.test.ts:115-224`, `tests/contracts/history-schema.test.ts:90-165`, `tests/contracts/codex-host-plugin.test.ts:254-322`, and `tests/contracts/claude-host-plugin.test.ts:136-147`.

## Migration And No-op Behavior

This proposal needs no stored-run migration. It reads the existing index and run artifacts. Existing `.circuit/runs/<id>` folders, `trace.ndjson`, reports, and `.circuit/history/documents.v1.jsonl` remain valid.

Default behavior should not change:

- `history query --json` still returns `history-query-result-v1`.
- `history query --json --format memory-input` still returns `history-memory-input-preview-v1`.
- fresh run-start recall still uses `MemoryInputV0[]` through `prepareRunStartHistoryRecall`.
- relay prompt injection remains push-only and hint-only.
- no memory update event is recorded.
- no route, recovery, checkpoint, proof, verification, or write authority is granted.

The no-op path for missing or stale indexes should reuse existing query behavior. Missing index remains an error unless `--rebuild-if-stale` is present, and stale index returns a warning while continuing. This is the current spec at `docs/specs/circuit-history-v1.md:167-174` and the current CLI test at `tests/runner/history-cli.test.ts:189-224`.

## Risks And Controls

| Risk | Control |
| --- | --- |
| The host treats old evidence as current proof. | Repeat the existing authority notice in every packet and host answer. Keep suggested actions phrased as checks to run now. |
| The packet duplicates `MemoryInputV0` and blurs schema purpose. | Keep packet fields outside `MemoryInputV0`. The spec already says score, rank, and snippet stay outside strict memory inputs (`docs/specs/circuit-history-v1.md:364-365`). |
| The host surfaces drift between Claude and Codex. | Use direct command generation and drift checks, not hand-edits. See C08 through C10. |
| Stale indexes produce misleading results. | Preserve `index_state`, `warnings`, and per-hit staleness. The local status is already `possibly_stale` in C12, so this cannot be hidden. |
| The packet looks like automatic learning. | Do not write a memory event. Do not update `memory_context`. Do not claim compounding yet. This is pull access to prior evidence, not learning from whether it helped. |
| The packet omits a necessary detail from `doc.text`. | Include source refs and paths so the agent can inspect the cited report. Keep raw JSON query available for debugging. |

## Open Questions

1. Should the first shipped host command be named `history` or `ask`? I recommend `history`, because it maps to the existing CLI namespace and leaves room for future subcommands.
2. Should `evidence-packet` be a CLI `--format` value or a new `history ask` subcommand? I recommend `--format evidence-packet` first because it is additive and fits the current query architecture.
3. Should packets include `memory_safe: false` hits? I recommend yes for explicit query packets, with a warning in rendering. The skip rule belongs to `MemoryInputV0` preview and run-start injection, not necessarily to read-only inspection (`docs/specs/circuit-history-v1.md:684-687`). This should get a product decision before implementation.
4. Should hosts auto-run `history rebuild --json` when the index is stale? I recommend no for the first slice. Show the warning and let the host or operator choose, because rebuild writes the history index.
5. Should packet use be recorded later? Yes, but not in this slice. A future trace event such as `history.pull.used` could record query, packet id, source refs, and later helped/misled feedback. That capture is required before pull memory becomes a real process-tuning ratchet, per C17.

## Recommendation

Proceed with Circuit History Ask as the first pull/query memory application.

It gives the host agent a useful question-answering tool over real Circuit evidence. That data value is grounded in C16. The implementation feasibility is grounded in C10 and C11. It honors the memory posture in `CONTEXT.md:108-126`: agent-facing, hint-only, execution-first, project and flow scope first, with no hidden self-editing or silent routing.

The strongest version of the effectiveness ratchet still needs more data later. In particular, Circuit must eventually know which pulled packets were used, ignored, helpful, or misleading. That is not captured today, and this proposal should not pretend otherwise. The first slice should make pull evidence usable and auditable; the next slice can measure whether it improved execution.

## Verification Notes

- Read `CONTEXT.md`, `docs/ideas/pull-query-memory.md`, `docs/specs/circuit-history-v1.md`, history CLI/source/schema files, host plugin files, generated-surface docs, history tests, and local history artifacts.
- Ran `./bin/circuit history status --json` on 2026-05-29. It returned `index_exists: true`, `index_state: "possibly_stale"`, `run_count: 22`, and `document_count: 202`.
- Ran `./bin/circuit history query verification --json --limit 2 --kind report` on 2026-05-29. It returned cited report hits with source refs, staleness, ranking reasons, warnings, and the authority notice.
- Ran a read-only corpus pass over `.circuit/runs` and `.circuit/history/documents.v1.jsonl`. The pass counted run directories, non-empty `trace.ndjson` entries, `reports/**/*.json` files, and JSONL rows. It found 22 run folders, 776 trace entries, 257 JSON report files, and 202 indexed history documents.
- Wrote only this proposal file under `docs/ideas/`.
