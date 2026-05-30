# Slice 4 Spec: The Gated Pull Surface (cited, hint-only, logged)

Status: build spec
Date: 2026-05-29
Parent design: [`self-auditing-memory.md`](./self-auditing-memory.md) (section 4 step 2 and section 6, the hybrid pull at decision points; section 8, build sequence item 4; section 13, open question 4)
Depends on: the existing `circuit history query --format memory-input` surface, the shared `content_id` identity (introduced in [`self-auditing-memory-slice-3-spec.md`](./self-auditing-memory-slice-3-spec.md), D4), and the Slice 2 effect verdicts ([`self-auditing-memory-slice-2-spec.md`](./self-auditing-memory-slice-2-spec.md)) for negative suppression.

This is the concrete, schema-grounded build spec for Slice 4, verified against source at writing time. Slice 4 adds the **pull** half of the hybrid delivery model: an agent-invoked, cited, hint-only query the agent can hit at a decision point, **logged back into the loop** so a later increment can learn whether a pulled hint correlated with a better outcome. It deliberately reuses the query surface that already exists rather than inventing a parallel one (the parent design's open question 4).

## 1. What Slice 4 is

Today an agent can already run `circuit history query --format memory-input --flow <id> <query>` and get back hint-only `MemoryInputV0` records (each `authority:"hint_only"`) inside a preview envelope that carries the `HISTORY_AUTHORITY_NOTICE` once (`HistoryMemoryInputPreviewV1.authority_notice`, not a per-record string) (`src/cli/history.ts`, `src/history/query.ts`, `src/history/memory-preview.ts`). What does **not** exist is (a) an affordance that tells the agent to do this at decision points, (b) a record that the pull happened, tied to the run, so the loop can later attribute outcomes to pulled hints, and (c) the same measured-negative suppression the push path applies, so a hint that historically misled comparable runs is not re-surfaced by the back door.

Slice 4 is a thin `circuit history pull` command that **wraps the existing query**, adds measured-negative suppression (reusing Slice 2's verdicts and Slice 3's loader), and appends a `history.pull-log@v1` entry to the active run folder as an atomic side effect of the pull. The pull result is the **existing** `HistoryMemoryInputPreviewV1` schema, unchanged — no new query engine, ranking, or result schema. This is the minimal version that does not duplicate the query schema (open question 4).

Deliverables:

- a `history.pull-log@v1` schema (the net-new contract),
- a pull-log writer (append-mostly, atomic),
- a `circuit history pull` subcommand that composes existing query + preview + suppression + log,
- an agent-facing affordance (a relay-prompt line plus a short skill) telling the agent it *may* pull at decision points,
- contract + unit + CLI tests.

## 2. Decisions (default-and-flag, per Slice 1)

### D1 — Reuse the existing query and preview schemas; add only the log (resolves open question 4)

The pull's *result* is `HistoryMemoryInputPreviewV1` exactly as `circuit history query --format memory-input` already emits it. Slice 4 introduces **one** new schema, `history.pull-log@v1`, for the audit record only. There is no new ranking, no new query parser, no second memory-input shape. `circuit history pull` is a composition of `queryHistory` + `historyMemoryInputPreview` (both reused verbatim) + suppression (D3) + a log append (D2).

**Veto path:** none needed — this is the resolution the open question asked for. If an operator wants the pull to return a richer envelope (e.g. including the suppression decisions inline), that is an additive wrapper around the same preview, not a fork of the query schema.

### D2 — Pull and log are one atomic command, so the agent never has a separate "remember to log" step

The "no user invocation" rule (parent design, section 9) is about not making *the operator* remember a command. The gated pull is **agent**-invoked by design (section 6, "a gated pull the agent hits at decision points"). To keep the logging from becoming its own forgettable step, the log append is a **side effect of the pull itself**: `circuit history pull` writes the `history.pull-log@v1` entry before it returns. The agent makes one call; the loop is fed automatically.

The command takes `--run-folder <path>` and appends to `<run-folder>/reports/history/pull-log.json`. The agent does not have to know or supply the run folder *or* the flow: `composeRelayPrompt` (`src/shared/relay-support.ts`) already receives the active run folder as its `runFolder` positional parameter (the call site `src/runtime/executors/relay.ts:520` passes `context.runDir`), and `context.flow.id` is available at that same call site and can be threaded into the composer alongside `runFolder`. The affordance is rendered as its **own always-on line** in `composeRelayPrompt` (D4, section 4) with **both** interpolated, so the copyable command the agent sees already reads `circuit history pull --run-folder <resolved path> --flow <resolved flow id> --decision-point <label> <query>` — only `<label>` and `<query>` are agent-supplied. This is the mechanism that makes logging and suppression actually work: the affordance the agent is shown is the one that logs (no `--run-folder`-less no-op) and suppresses against the correct flow (no wrong-`--flow` silent miss). If `--run-folder` is somehow absent or unwritable, the pull still returns results but emits a `pull_log_unavailable` warning in the preview's `warnings` (the pull is never blocked by a logging failure — orienting the agent outranks bookkeeping).

**Veto path:** an operator who wants the agent to choose what to log can split this into `query` + an explicit `history pull-log record` call; the schema is unaffected.

### D3 — The pull suppresses measured-negative hints, but applies no budget or tiering

The parent design (section 6) says precision "becomes a measured property: a hint that has historically misled comparable runs is suppressed, not surfaced" — *surfaced* covers both push and pull. So the pull consults the same Slice 2 verdicts (via Slice 3's `loadMemoryEffectReport`) and drops any returned `MemoryInputV0` whose verdict is `correlated_negative`. The lookup key is **identical to Slice 3's** (D3/D4 there): form each result's `group_key` — `content_id` via `contentIdentityOf` when content-addressed, else `unresolved:<memory_id>` — and match the Slice 2 `item_effects` row whose `(group_key, flow_id)` equals `(this group_key, --flow)`. Because the recalled `memory_id` is source-doc-scoped (stable across recalls; Slice 3 D3), a null-`content_id` result's `unresolved:<memory_id>` key *can* match a Slice 2 unresolved-group row, so such a hint is suppressed iff that row reaches `correlated_negative` — in practice almost always `not_enough_data`, so it stays reachable, but the rule is **uniform with Slice 3** rather than a categorical "null is never suppressed." Suppression requires a flow key, which is why `--flow` is required (section 4). When a result is dropped, its parallel `matches[]` entry (same `memory_id`) is dropped too, so the printed preview stays internally consistent (the preview schema has no length-binding refine, so this is test-enforced — section 6). The pull does **not** apply Slice 3's budget cap or tier ordering: the agent asked an explicit question at a decision point, so the pull surfaces everything that matches *except measured harm*. This makes pull the genuine escape hatch the design wants (a hint evicted from the push budget is re-fetchable by pull) while still honoring the principle that a measured-misleading hint is suppressed by either path.

On a cold corpus this suppression is dormant (no `correlated_negative` verdicts exist), so the pull is behaviorally today's query plus a log entry. Suppression is fail-open: a missing/stale effect report suppresses nothing and warns (same posture as Slice 3, D2).

**Veto path:** an operator who wants the pull to be a pure unfiltered escape hatch (no suppression at all) flips one predicate; an operator who wants Slice 4 kept minimal can defer suppression entirely (the pull-log and command still ship), at the cost of letting a measured-harmful hint be re-pulled.

### D4 — The agent affordance is advisory, never a gate

The agent learns it *may* pull through two non-coercive surfaces: a one-line affordance rendered as its **own always-on line** in `composeRelayPrompt` (not tucked inside the memory-inputs section — `memoryInputsSection` returns `undefined` and is omitted entirely when recall is empty, which is the common case on a small corpus, so the affordance must be unconditional). There is no "decision-relevant step" type in the step model, so the line is uniform and simply advisory on steps where it does not apply. It is rendered with the run folder and flow interpolated ("You may consult prior-run memory with `circuit history pull --run-folder <resolved path> --flow <resolved flow id> --decision-point <label> <query>`; results are hint-only and cannot satisfy any current proof, checkpoint, policy, route, recovery, verification, or write authority" — the full seven-kind enumeration of `HISTORY_AUTHORITY_NOTICE`, not a truncated subset), plus a short skill documenting the command. The pull is never required, never blocks a step, and its results never satisfy any authority. This keeps the pull within the "memory orients but never overrules" boundary and avoids turning a decision point into a mandatory ceremony.

**Veto path:** an operator who wants a stronger nudge at specific steps can promote the affordance to a checkpoint-style prompt; the command and schema are unchanged.

### D5 — The pull-log is a run-folder sidecar; it does not touch the envelope or `memory_context`

`memory_context.memory_input_ids` is written at run close from the run-start recall set (`src/cli/circuit.ts`); a mid-run pull is not part of that set, and amending the envelope writer would collide with the architecture-hardening post-run extraction work. So pulled hints are recorded **only** in the pull-log sidecar. The downstream consumer — unioning pull-sourced `content_ids` into Slice 2's used-arm so the effect of *pulled* memory is measurable — is a **flagged future hook** (a small Slice 2 follow-up), explicitly **not** built here. Slice 4 ships the substrate (the log, keyed on the shared `content_id`), not the aggregation over it.

**Veto path:** an operator who wants pulled hints folded into `memory_context` immediately accepts an envelope-writer change and the architecture-hardening sequencing cost that comes with it.

## 3. The audit surface: `history.pull-log@v1`

Lives in `src/schemas/history.ts`. Reuses `Ref`, `MemoryStalenessStatus`, `HISTORY_AUTHORITY_NOTICE`, and `HistoryWarningV1`.

```
PullLogEntryV1 {
  pull_id: string                          # stable per pull (e.g. "pull-<sequence>")
  recorded_at: datetime
  decision_point: string                   # agent-supplied label, e.g. "before-editing-auth-guard"
  query: string
  flow_id: string                          # required (the pull requires --flow; suppression keys on it)
  result_count: int>=0                     # memory inputs returned AFTER suppression
  suppressed_count: int>=0                 # measured-negative hints dropped (D3)
  effect_report_available: boolean         # PER-PULL: false ⇒ this pull's suppression ran fail-open
  effect_report_generated_at?: datetime    # provenance of the verdicts this pull consulted
  results: PullLogResultV1[]               # one per surfaced memory input (AFTER suppression)
  authority: "hint_only"
}

PullLogResultV1 {
  memory_input_id: string
  content_id: string | null                # via the shared contentIdentityOf (Slice 3 D4)
  staleness: MemoryStalenessStatus
  source_ref: Ref
}

HistoryPullLogV1 {                         # file-level header only; per-pull state lives on the entry
  api_version: "history-pull-log-v1"
  schema_version: 1
  run_id?: string
  authority_notice: HISTORY_AUTHORITY_NOTICE
  entries: PullLogEntryV1[]                 # append-ordered
  warnings: HistoryWarningV1[]             # file-level (e.g. a prior log was unreadable and reset)
}
  refine: every entry.result_count === entry.results.length
```

`effect_report_available` is **per-pull** (on `PullLogEntryV1`), not file-level: the log is append-mostly across many pulls, and pull #1 may find the effect report while pull #2 does not, so a single file-level boolean could not represent both. The log is append-mostly: each `pull` reads the existing `pull-log.json` (if any), validates it, appends the new entry, and atomically rewrites (tmp+rename, re-parse to validate — the Slice 1 write discipline). On the **first** pull the file does not exist, so the writer synthesizes the full `HistoryPullLogV1` header (the four literal/optional top-level fields plus the first entry); on later pulls it preserves the header and pushes the entry. `content_id` reuses the shared `contentIdentityOf`, so pull-sourced and push-sourced memory share one identity space — the property that makes the deferred Slice 2 union possible.

## 4. Modules and surface

- `src/schemas/history.ts`: add `HistoryPullLogV1`, `PullLogEntryV1`, `PullLogResultV1`, and the `pull_log_unavailable` warning code.
- `src/history/pull-log.ts` (new): `appendPullLogEntry(runFolder, { entry, runId? }): { path?: string; warnings }` (atomic, fail-soft; on the first write it synthesizes the full `HistoryPullLogV1` header from `runId` plus an empty file-level `warnings`, then pushes `entry`; on later writes it preserves the header and appends) and `readPullLog(runFolder): HistoryPullLogV1 | undefined`.
- `src/history/pull-suppression.ts` (new): `suppressMeasuredNegative({ preview, flowId, effect }): { preview: HistoryMemoryInputPreviewV1; suppressedCount: number }` — the **pure** suppression seam (mirroring Slice 3's pure gate). Given an already-projected preview, the selected flow, and a loaded effect report, it drops each `correlated_negative` result (keyed exactly as Slice 3, by `group_key` from `contentIdentityOf`, D3) **and its parallel `matches[]` entry by `memory_id`**, returning a consistent trimmed preview plus the count. No I/O — this is the seam `tests/unit/pull-suppression.test.ts` drives.
- `src/cli/history.ts`: add a `pull` subcommand — `--json` (required), `--flow <id>` (**required**: suppression keys on the flow, D3), `--decision-point <label>` (required; the audit needs a label), `--run-folder <path>`, `--runs-base`, `--index-dir`, `--limit`/`--per-run-limit` (passed through to `queryHistory`), `<query...>`. It runs `queryHistory({ flow, query, ... })`, projects with `historyMemoryInputPreview`, calls `suppressMeasuredNegative` (loading the report via `loadMemoryEffectReport`), appends the pull-log entry via `appendPullLogEntry` (D2), and prints the (possibly suppression-trimmed) `HistoryMemoryInputPreviewV1`.
- Agent affordance: a one-line, hint-only addition rendered as its **own always-on line** in `composeRelayPrompt` (`src/shared/relay-support.ts`), **not** inside `memoryInputsSection` (which returns `undefined` and is dropped from the prompt when recall is empty — the common case, so the affordance must be unconditional). There is no "decision-relevant step" classification in the step model — `composeRelayPrompt` is a single static composer over every step — so the line is uniform and advisory on steps where it does not apply. It is rendered with the run folder and flow interpolated: `composeRelayPrompt` already receives the run folder as its `runFolder` parameter (passed `context.runDir` at the call site `src/runtime/executors/relay.ts:520`), and `context.flow.id` is threaded in alongside, so the agent's copyable command already includes `--run-folder <resolved path> --flow <resolved flow id>`. Plus a short skill documenting `circuit history pull` (D4). Advisory only.
- Reuses (no change): `queryHistory`, `historyMemoryInputPreview`, `loadMemoryEffectReport` (Slice 3), `contentIdentityOf` (Slice 3), the `HistoryMemoryInputPreviewV1` schema.

## 5. The cold-start reality, stated plainly

With no `correlated_negative` verdicts in the corpus, the pull suppresses nothing, so Slice 4 is today's `query --format memory-input` plus a pull-log entry and a decision-point label. The value Slice 4 adds *immediately* is the **logged substrate** (every pull recorded against the run, keyed on `content_id`) and the **affordance** (the agent can re-fetch evicted context at the moment it matters). The measured-negative suppression and the outcome attribution are dormant until the corpus has verdicts and the deferred Slice 2 union is built. The spec does not claim Slice 4 improves outcomes today; it claims Slice 4 makes the pull *cited, governable, and observable* so that improvement is possible and auditable later.

## 6. Definition of done (verification surface)

- `tests/contracts/pull-log-schema.test.ts` — a valid log parses; the `result_count === results.length` refine rejects its violation; `authority` is the `hint_only` literal; `authority_notice` is the canonical notice.
- `tests/unit/history-pull-log.test.ts` — `appendPullLogEntry` synthesizes a valid `HistoryPullLogV1` header (incl. `run_id` when supplied) on the first pull and appends on subsequent pulls (order preserved, header preserved); a missing/unwritable `--run-folder` yields a warning and no throw; `content_id` is computed via the shared identity for hashed sources and null for unhashed; each entry carries its own `effect_report_available`.
- `tests/unit/pull-suppression.test.ts` — drives the **pure** `suppressMeasuredNegative` seam from a hand-built `HistoryMemoryInputPreviewV1` + `HistoryMemoryEffectV1`: a `correlated_negative` `(group_key, flow)` result is dropped from `memory_inputs` **and** its matching `matches[]` entry (same `memory_id`), counted in `suppressedCount`, and after suppression every surviving `matches[].memory_id` still has a `memory_inputs[]` entry (test-enforced, since the schema has no length refine); a null-`content_id` result is suppressed **iff** its `unresolved:<memory_id>` group carries a `correlated_negative` verdict (the uniform rule, D3) — so it is *not* suppressed when no such verdict exists; passing no effect report suppresses nothing (`suppressedCount === 0`). (The per-pull `effect_report_available` flag is built by the CLI, not the pure seam, so it is asserted in the CLI test below, not here.)
- `tests/runner/history-pull-cli.test.ts` — `pull --json --flow <id> --decision-point <label> --run-folder <path> <query>` over a temp corpus exits 0 with a valid `HistoryMemoryInputPreviewV1` and writes a re-parseable `pull-log.json` whose entry carries `flow_id`, `decision_point`, and `effect_report_available` (which is `false` when no effect report is present — the fail-open case built by the CLI); missing `--flow` exits 2; missing `--decision-point` exits 2; missing `--json` exits 2; the pull result carries the authority notice.
- `tests/runner/relay-pull-affordance.test.ts` — `composeRelayPrompt` renders the pull affordance as an **always-on line even when recall is empty** (`memoryInputs.length === 0`, so the conditional memory section is absent), with `--run-folder` and `--flow` interpolated from the `runFolder` parameter and `context.flow.id`; the line is hint-only and asserts no authority.
- Boundary assertions: every returned `MemoryInputV0.authority` is `hint_only`; the preview carries `HISTORY_AUTHORITY_NOTICE`; the pull never blocks on a logging failure; suppression is fail-open.
- `npm run check`, `npm run lint`, targeted tests, then `npm run verify:fast` clean.
- Two consecutive adversarial reviews against this spec with no medium-or-above findings.

## 7. Explicit non-goals

- **No new query/ranking/result schema.** The pull result is the existing `HistoryMemoryInputPreviewV1` (D1).
- **No envelope or `memory_context` change.** Pulled hints live only in the sidecar; the Slice 2 union is a flagged future hook (D5).
- **No authority.** Pull results are hint-only and carry the authority notice; they cannot satisfy proof, checkpoint, policy, route, recovery, verification, or write authority. The affordance is advisory and never gates a step (D4).
- **No mandatory invocation.** The agent *may* pull; nothing requires it, and a run with zero pulls is normal.
- **No budget/tiering on the pull** (D3); that is the push path's job (Slice 3).
- **No outcome attribution in Slice 4.** Measuring whether pulled hints correlated with better outcomes is the deferred Slice 2 union, not built here.

## 8. Sequencing against the in-flight architecture-hardening work

Slice 4 reuses `queryHistory`, which imports the indexer/extract source enumerators **SD-FIX-1** is consolidating, so the `pull` command sits adjacent to that churn; it must land **after** SD-FIX-1/2 settle (or be scoped to import only the public `queryHistory`/`historyMemoryInputPreview` entry points, never the private `sourceStaleness` or hashing internals — it reuses the `staleness` already attached to each hit). It depends on Slice 3's shared `memory-identity` module and `loadMemoryEffectReport`, and on Slice 2's `memory-effect.v1.json`, all of which are stable on-disk contracts. It writes only a run-folder sidecar and adds no post-run hook, so it does not collide with the post-run extraction refactor. Like the other slices, it targets stable contracts — the preview schema, the effect report, the `content_id` identity, the run-folder layout convention `reports/history/*.json` — not current file locations. It can land any time after Slices 2-3, in any order relative to the remaining hardening phases.
