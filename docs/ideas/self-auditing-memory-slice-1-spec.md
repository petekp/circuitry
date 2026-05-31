# Slice 1 Spec: The Report-Only Memory-Merge Artifact

Status: implemented. Current code lives under `src/app/history/memory-merge.ts`,
`src/app/history/memory-identity.ts`, `src/schemas/history.ts`, and the
`circuit history memory-merge` CLI path. Some path references below use the
pre-`src/app/history` location from writing time.
Date: 2026-05-29
Parent design: [`self-auditing-memory.md`](./self-auditing-memory.md) (section 7, the keystone slice; section 8, build sequence item 1)

This is the concrete, schema-grounded build spec for Slice 1 of self-auditing memory. It is written against the real on-disk contracts as they exist on `main` today, not against the in-flight `architecture-hardening` refactor. Every field name and path in this doc was verified against source at writing time.

## 1. What Slice 1 is

A standalone, read-only history command that scans completed run folders and emits one cross-run report linking the memory each run used to that run's objective outcome. No behavior change, no judgment, no write to any run artifact, no post-run hook. The report is the substrate Slice 2 will aggregate over.

It delivers exactly the deliverables named in the design's build sequence:

- a `history.memory-merge@v1` report schema,
- a writer + path constant,
- contract tests,
- an envelope-aware extractor (per run folder),
- a cross-run reader (over all run folders),
- and the prerequisite it depends on: a **content-addressed, run-independent memory identity**.

## 2. Decisions (these resolve the two tensions in the handoff)

### D1 — Data sources: the envelope *and* the recall report, both read-only

The handoff said "scope it to read only the stable on-disk `run.envelope@v0` record" and also "first the content-addressed cross-run memory identity." These two are in direct tension: the envelope's `memory_context.memory_input_ids` are run-scoped strings (`prior-run-<sourceRunId>-<hash(sourceDocId)>`, built in `src/history/memory-preview.ts`). **A content-addressed identity is not derivable from the envelope alone** — the envelope stores ids, not the underlying source refs or content hashes.

Resolution: read two stable, schema-versioned, on-disk artifacts per run folder, both read-only and both outside the architecture-hardening blast radius:

1. `reports/run-envelope.json` → parsed as `RunEnvelopeRecord` (`run.envelope@v0`). The **authoritative per-run record**: `run_id`, `operator_intent`, `outcome` (`RunEnvelopeOutcome`), `memory_context.{used, memory_input_ids}`, plus a best-effort `flow_id` (from `process_attempts[0].process_id`, falling back to `process_plan.planned_attempts[0].process_id` when no attempt has executed) and `abort_reason` lifted from `process_attempts`.
2. `reports/history/recall.json` → parsed as `HistoryRecallReportV1`. The **enrichment record**: maps each `memory_input_id` to its `MemoryInputV0` (`source.ref`, `source.sha256`, `kind`, `staleness`), which is what makes the content-addressed identity computable.

This relaxes "envelope-only" to "envelope + the equally-stable recall report." It honors the actual intent of that constraint — *do not collide with the in-flight post-run extraction refactor, and do not import trace consumers, the private `sourceStaleness` helper, or history hashing internals*. Both reads are pure file reads of frozen schemas.

**Veto path (cheap):** if the operator insists on envelope-only, drop `content_id` to the run-scoped `memory_input_id` and everything else in the report stands unchanged. The recall read is confined to a few private helpers in `memory-merge.ts` (`readRecallInputs`, `resolveInput`, `contentIdentity`) and is removable without touching the linkage path.

### D2 — The content-addressed identity

```
content_id = "mem-c-" + sha256(JSON.stringify([ref.kind, ref.ref, contentSha])).slice(0, 16)
```

where `ref = memoryInput.source.ref` and `contentSha = memoryInput.source.ref.sha256 ?? memoryInput.source.sha256 ?? null`.

Properties:

- **Run-independent.** It deliberately excludes `ref.run_id`, `ref.flow_id`, `ref.step_id`, and the `memory_id` string — all of which embed the originating run. Two recalling runs that pulled the same source artifact get the **same** `content_id`. Two *different* source runs whose citations share the same `(ref.kind, ref.ref, content sha)` also collapse to one `content_id` — which the run-scoped `memory_id` does **not** do (its hash is over a `doc_id` that leads with the originating run), and which is the concrete improvement the design asked for ("the same fact in two runs gets [one] id").
- **Deterministic.** Pure function of the cited source ref. No model, no fuzzy matching, no fake precision.
- **Honestly scoped.** It groups by *source-artifact content*, not by semantic equivalence. Two semantically-equal but byte-different facts remain distinct. Semantic dedup across distinct source artifacts is explicitly **out of scope**: the identity is content-addressed and deterministic by design, with no fuzzy matching, consistent with the parent design's over-generalization guard (section 4 step 1).
- **Degrades safely, never fabricates.** `content_id` is null whenever the source cannot be content-addressed: `recall.json` missing (`recall_report_missing`) or present-but-unreadable (`source_invalid`, from the parse catch), the envelope id absent from a present recall (`memory_input_unmatched`), or the cited source carrying no content hash (`content_id_unhashed_source`). In every case the envelope-derived linkage still stands, keyed by `memory_input_id`; only the cross-run content join is withheld. It deliberately does **not** hash the path alone when no content sha exists. `contentSha` is `source.ref.sha256 ?? source.sha256`, and the null path is reached only when **both** are absent. A content-bearing ref kind (`report`, `evidence`, etc.) is schema-required to carry `ref.sha256`, so it is always content-addressed; a hashless-kind ref (`trace`/`policy`/`operator_input`) reaches the null path **unless** it independently carries a `source.sha256`. A path alone (e.g. a `trace` ref's `trace.ndjson#sequence=5`) is identical across runs, so hashing it without a content sha would falsely merge distinct artifacts. A non-null `content_id` is therefore always backed by a real content hash (from `ref.sha256` or `source.sha256`), which is the signal Slice 2 relies on.

**Forward note (cross-slice dependency).** `contentIdentity` is the **cross-run join key** every later slice depends on: Slice 2 groups effect cohorts by it, Slice 3 looks up per-flow verdicts by it, Slice 4 keys the pull-log by it, and Slice 5's project facts share its identity space. Slice 3 lifts it verbatim into a shared `src/history/memory-identity.ts` module so all consumers compute it identically; a contract test pins parity. Two consequences: its computation must stay **stable** (changing the hash basis silently re-buckets every cross-run comparison), and the section-7 non-goal against importing history hashing internals means *not coupling to the in-flight architecture-hardening hashing path* — it does **not** forbid `contentIdentity` itself, which is this slice's own small `sha256Hex`-over-a-cited-ref function and is the intended shared export.

### D3 — Shadow records need no special handling

The shadow record (`run.envelope-shadow@v0`, resume / non-source runs) writes to a **different** path: `reports/run-envelope-shadow.json` (`RUN_ENVELOPE_SHADOW_RELATIVE_PATH`). `reports/run-envelope.json` therefore only ever contains a `run.envelope@v0` record. The reader looks for `reports/run-envelope.json`; a run folder with only a shadow record contributes to `run_count` but not `envelope_count`, and emits an `envelope_missing` coverage warning. This makes the corpus-coverage caveat from the design observable in the report itself.

### D4 — Effect status is present but frozen at `not_enough_data`

The report carries the full `effect_status` enum (`not_enough_data | correlated_positive | correlated_negative | unresolved`) so Slice 2 reuses the schema unchanged. Slice 1's reader emits **only** `not_enough_data` (asserted by a contract test, not by the schema, so Slice 2 can populate the others). Each grouped item carries an `effect_note` stating the verdict requires cross-run aggregation.

## 3. The objective signals Slice 1 records

Per the design's honesty correction, only two per-run signals are honestly retrievable from the envelope today, so those are the only two recorded:

- `outcome` — `RunEnvelopeOutcome` (`complete | needs_attention | blocked | failed | handoff`). The binary-ish objective result.
- `abort_reason` — best-effort string, lifted from the first `process_attempts[]` entry with `outcome ∈ {blocked, failed}`, preferring its `blocked_reason` and falling back to its `summary`. Optional; absent when no attempt blocked or failed.

Deliberately **not** recorded (would be fake precision today): token counts (not captured anywhere), elapsed time (`started_at`/`completed_at` are the same snapshot), graduated `clean_streak` (hardcoded by outcome). These are named as future capture work in the parent design, not invented here.

## 4. Report schema: `history.memory-merge@v1`

Lives in `src/schemas/history.ts` (co-located with the other history schemas, already re-exported through `src/schemas/index.ts`). Reuses `Ref`, `RunEnvelopeOutcome`, `MemoryInputKind`, `MemoryStalenessStatus`, `HistoryWarningV1`, and `HISTORY_AUTHORITY_NOTICE`.

```
MemoryMergeEffectStatusV1 = enum(not_enough_data, correlated_positive, correlated_negative, unresolved)

MemoryMergeInputV1 {                     # one memory input as used by one run
  memory_input_id: string                # run-scoped id, from envelope.memory_context
  content_id: string | null              # content-addressed identity (D2); null if recall unavailable
  kind?: MemoryInputKind                 # from recall.json
  source_ref?: Ref                       # provenance, from recall.json
  staleness?: MemoryStalenessStatus      # recall-time staleness state
  resolved_from_recall: boolean          # true when recall.json supplied content_id/source_ref
}
  refine: content_id !== null  ⇒  resolved_from_recall === true

MemoryMergeRunLinkageV1 {                # one row per run that has a full envelope
  run_id: string
  flow_id?: string                       # best-effort: process_attempts[0].process_id ?? planned_attempts[0].process_id
  operator_intent: string
  outcome: RunEnvelopeOutcome
  abort_reason?: string                  # best-effort (section 3)
  memory_used: boolean                   # envelope.memory_context.used
  memory_inputs: MemoryMergeInputV1[]    # empty when memory_used is false
}
  refine: memory_used === false  ⇒  memory_inputs.length === 0

MemoryMergeItemV1 {                      # one row per content-addressed memory item, grouped across runs
  group_key: string                      # content_id, or "unresolved:<memory_input_id>" when content_id is null
  content_id: string | null
  memory_input_ids: string[] (min 1)     # run-scoped ids that mapped to this group
  kind?: MemoryInputKind
  source_ref?: Ref
  used_by_run_ids: string[] (min 1)
  outcome_counts: { outcome: RunEnvelopeOutcome, count: int>0 }[]
  effect_status: MemoryMergeEffectStatusV1     # always not_enough_data in Slice 1 (D4)
  effect_note: string
}
  refine: sum(outcome_counts[].count) === used_by_run_ids.length

HistoryMemoryMergeV1 {
  api_version: "history-memory-merge-v1"
  schema_version: 1
  generated_at: datetime
  runs_base: string
  authority_notice: HISTORY_AUTHORITY_NOTICE
  run_count: int>=0                      # candidate run folders scanned
  envelope_count: int>=0                 # folders with a readable run.envelope@v0
  memory_run_count: int>=0               # runs with memory_context.used === true
  linkages: MemoryMergeRunLinkageV1[]
  memory_items: MemoryMergeItemV1[]
  warnings: HistoryWarningV1[]
}
  refine: envelope_count === linkages.length
  refine: memory_run_count === linkages.filter(memory_used).length
  refine: run_count >= envelope_count
```

`HistoryWarningCodeV1` gains `envelope_missing`, `recall_report_missing`, `memory_input_unmatched`, `content_id_unhashed_source` (additive; the enum is the documented home for source-skipped reasons).

## 5. Modules and surface

- `src/history/memory-merge.ts` (new):
  - `extractRunMemoryLinkage(runFolder): { linkage?: MemoryMergeRunLinkageV1; warnings: HistoryWarningV1[] }` — reads the two files, builds one linkage row + warnings. Returns no linkage (only a warning) when the envelope is absent/invalid. (No `now` parameter — only `buildMemoryMergeReport` needs `now`, for `generated_at`.)
  - `buildMemoryMergeReport({ runsBase, indexDir?, repoRoot?, now? }): HistoryMemoryMergeV1` — reuses `listCandidateRunFolders` + `resolveHistoryPaths` from `indexer.ts` (stable history code), folds extractor output, groups items by `group_key` (`content_id` when content-addressed, else the `unresolved:<memory_input_id>` fallback).
  - `writeMemoryMergeReport(report, paths): string` — atomic tmp+rename write, re-parses to validate, returns the path.
  - Local `RUN_ENVELOPE_RELATIVE_PATH` / `RECALL_REPORT_RELATIVE_PATH` constants (decoupled from the in-flight files per the design's "target stable contracts, not current file locations"), with a contract test asserting they equal the canonical exports so drift is caught without a runtime import.
- `src/history/indexer.ts`: add `export const HISTORY_MEMORY_MERGE_FILE = 'memory-merge.v1.json';`.
- `src/cli/history.ts`: add a `memory-merge` subcommand — `--json` (required, consistent with the others), `--runs-base`, `--index-dir`, `--write` (also persist to `<index-dir>/memory-merge.v1.json`). Default prints the report to stdout like `query`/`status`.

## 6. Definition of done (verification surface)

- `tests/contracts/memory-merge-schema.test.ts` — valid report parses; every refine + literal + strict rule rejects its violation; `effect_status` enum accepts all four values.
- `tests/unit/history-memory-merge.test.ts` — temp `.circuit/runs/` with: a memory-on run (envelope + recall), a memory-off run, a shadow-only run (no envelope), and a memory-on run with missing recall.json. Asserts counts, linkage correctness, graceful degradation, grouping by `content_id`, the run-independence property (two runs, identical source content → one item, both run ids), and `effect_status === 'not_enough_data'` everywhere.
- `tests/runner/history-memory-merge-cli.test.ts` — `memory-merge --json` exits 0 with a valid `HistoryMemoryMergeV1`; `--write` persists a re-parseable file; missing `--json` exits 2; missing runs base returns an error envelope.
- `npm run check` (tsc), `npm run lint` (biome), and the targeted tests pass; then `npm run verify:fast` is clean.
- Two consecutive adversarial reviews against this spec with no medium-or-above findings.

## 7. Explicit non-goals

No write to any run artifact. No post-run hook. No change to `memory-preview.ts`, the envelope writer, or the recall path. No grouping semantics beyond content-addressing (intent-class grouping is Slice 2). No effect judgment. No import of trace consumers, `sourceStaleness`, or history hashing internals.
