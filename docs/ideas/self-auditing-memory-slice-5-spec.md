# Slice 5 Spec: The Cited-Fact Producer (`kind:"project"`, propose-first)

Status: partially implemented. The operator-filed core, project store,
project identity, project-fact injection, deterministic distiller, envelope
schema prerequisites, and `circuit memory note|list|forget` exist. The
run-close auto write-back / full envelope-event integration remains deferred.
Date: 2026-05-29
Parent design: [`self-auditing-memory.md`](./self-auditing-memory.md) (section 4 step 1, produce cited facts from typed evidence; section 8, build sequence item 5, "in parallel"; section 9, refusals)
Source design: [`project-execution-memory.md`](./project-execution-memory.md) (the full producer design and its internal build sequence; this spec is its build-ready distillation in the Slice 1 shape)
Relates to: [`self-auditing-memory-slice-3-spec.md`](./self-auditing-memory-slice-3-spec.md) (the earned-precision gate the produced facts are injected through)

This is the concrete, schema-grounded build spec for Slice 5, verified against source at writing time. Slice 5 fills the unused `kind:"project"` seat with **cited execution facts distilled from typed evidence**, propose-first, with command output redacted at capture. It is the producer the rest of the loop measures: until it exists, the only memory in the system is `prior_run` lexical recall, and there is no non-`prior_run` fact worth aggregating effect over. The parent design (section 8) labels it "in parallel," but that is true only of its **operator-filed core** (note + store + ungated/staleness-only injection); its **shared-identity reuse** (`contentIdentityOf`) and its **gated injection** (`applyEarnedPrecision`) hard-depend on Slice 3 and sequence strictly after it. The auto-distillation + envelope-event write sequences later still (after the post-run write path settles, section 8).

## 1. What Slice 5 is

A project-scoped store of cited `MemoryInputV0` records with `kind:"project"`, written to `.circuit/memory/project.v1.jsonl`, produced by two paths — operator-filed (ships first, unimpeachably grounded) and deterministic auto-distillation (propose-first) — and surfaced into the selected flow through the existing run-start injection path. Every population action is **announced, never silent**: the phase-1 operator note by the `circuit memory note` command's own confirmation output (the operator initiated the write, so the CLI surface is the announcement), and — once the phase-2 envelope wiring lands — by a `RunMemoryUpdateEvent` in the run envelope's `memory_update_events` array, which is `[]` in every run today and which this slice is what fills.

The `MemoryInputKind` enum already defines `project` (`src/schemas/memory-input.ts:8-15`) and nothing emits it; `RunMemoryUpdateEvent` (`src/schemas/run-envelope.ts:357-390`) already encodes the `proposed | recorded | skipped | rejected` lifecycle with required `source_refs` and an operator indicator on `proposed`/`recorded`; `surface_output.memory_indicator` exists and is **wired but dormant** — `src/run-envelope/source-record.ts:637-639` already derives it from the first `proposed`/`recorded` `memory_update_event`'s `operator_indicator`, but no producer feeds `memoryUpdates`, so it stays empty. Slice 5 feeds these wired-but-dormant slots; it does not invent a parallel mechanism.

Deliverables:

- two schema prerequisites on the envelope (a `.max(1)` bound and a produce-side `staleness` field),
- a `circuit memory note` command (operator-filed facts, `recorded` directly),
- a project-fact store reader/writer over `project.v1.jsonl`,
- a deterministic auto-distillation pass (propose-first) for the one grounded signal (recurring abort cause),
- injection of project facts through the run-start path,
- the populated `memory_indicator` and `memory_update_events`,
- `circuit memory list` / `forget`,
- contract + unit + integration tests.

## 2. Decisions (default-and-flag, per Slice 1)

### D1 — Project identity: git-remote-derived, with an explicit config override

[`project-execution-memory.md`](./project-execution-memory.md) open question 1 flags that the repo-root path is a fragile project key because the working set spans multiple worktrees of one repo. Retrieval and storage both depend on a stable key.

Resolution: the project id is the **normalized git remote `origin` URL hashed to a short id** (stable across worktrees and clones of the same repo), with two fallbacks: an explicit `project_id` in **`.circuit/config.yaml`** (operator-set, wins when present), then — only if there is no remote and no config — the absolute runs-base path, accompanied by a loud `project_id_unstable` warning that project memory will not be shared across worktrees. Circuit's project config is the single YAML file `.circuit/config.yaml` (loaded by `src/shared/config-loader.ts`; there is no `config.json`), so `project_id` is a **new additive field on the `Config` schema** (`src/schemas/config.ts`), read through the existing YAML loader — not a new config file.

The store is **local-only and physically per-project**: it lives at `.circuit/memory/project.v1.jsonl` (D6), so the **store location is the project scope** for reads, and `readProjectFacts` filters only by `flow_id` (a real per-record property, derivable from `source.ref.flow_id`) — it does **not** filter by a per-record `projectId`, which a `.strict()` `MemoryInputV0` has nowhere to hold. The resolved `projectId` is recorded **once** in a sibling `.circuit/memory/manifest.json` (with its resolution `source`) as provenance and as the key a *future* cross-worktree shared store would use; cross-worktree/clone sharing of project memory is **deferred** in this cut (one worktree's `.circuit/memory/` is its own store). The `project_id_unstable` warning still fires when that local identity is ambiguous, so the operator knows the store will not migrate cleanly.

**Veto path:** the resolver is one function; an operator who wants the explicit config to be mandatory (no git-remote inference) sets `project_id` and the fallback never fires.

### D2 — Propose-first for all auto-distilled facts; operator-filed facts are `recorded` directly

[`project-execution-memory.md`](./project-execution-memory.md) open question 2 asks how aggressive auto-record should be. The handoff for this work resolves it: **propose-first**. Every auto-distilled fact enters as `action:"proposed"` and waits for the operator; it is injected (if at all) only with an explicit unverified marker until confirmed. Operator-filed facts (via `circuit memory note`) enter `action:"recorded"` directly, because the operator is the source of authority — but they remain hint-only and stale-checkable like any other fact. Auto-record for deterministic signals is **deferred** until an acceptance-rate signal proves it safe (a future tightening of the gate, not this slice).

This is deliberately more conservative than [`project-execution-memory.md`](./project-execution-memory.md) section 4 (which auto-records deterministic two-run clusters). The reason is the same one the soundness reviews pressed throughout the program: the corpus does not yet show recurrence, so a first cut should never auto-write a fact the operator has not seen. The lifecycle's load-bearing `proposed → recorded` guard (parent design, section 5) therefore stays operator-gated in Slice 5.

**Veto path:** an operator who wants auto-record must accept that the parent design's `proposed → recorded` guard (section 5, 60) requires more than the two-run/fresh-source/no-contradiction *proposal* bar — it additionally requires "measured non-negative effect across at least N comparable runs," which is Slice 2's verdict. That guard is **not** yet built (Slice 2 produces the verdict; wiring it into a promotion gate is unbuilt), so flipping the auto-signal to `recorded` on the weaker proposal bar alone is a deliberate deviation from the design's effectiveness ratchet, not a one-line action. The honest default stays propose-first; promoting to auto-record is earned only once the effect guard exists and the acceptance rate proves the signal.

### D3 — Two envelope schema prerequisites, added as part of this slice

Both are real contract gaps the reviews confirmed (`memory_update_events` is unbounded; `RunMemoryUpdateEvent` has no `staleness`), and both are additive:

- `.max(1)` on `RunEnvelopeRecord.memory_update_events` (`src/schemas/run-envelope.ts:490`): at most one memory update per run, so "fire on signal, not on completion" is enforced by Zod, not narrated. An empty array (every run today) still satisfies `.max(1)`, so this breaks nothing.
- An optional `staleness` object on `RunMemoryUpdateEvent` (`src/schemas/run-envelope.ts:357-390`), mirroring `MemoryStaleness`, so a `proposed`/`recorded` event surfaces source freshness at write time. Optional, so existing (empty) histories are unaffected.

**Veto path:** an operator who wants more than one update per run raises the bound to a named `N`; the producer already caps at one, so this is a ceiling change only.

### D4 — The one grounded auto-signal, and reason normalization

Only signals that exist in typed evidence today are mined (matching [`project-execution-memory.md`](./project-execution-memory.md) section 4 and the trace shapes in `src/schemas/trace-entry.ts`):

- **Recurring failure cause.** Cluster `step.aborted.reason` (a `z.string().min(1)`, `src/schemas/trace-entry.ts:382-388`) per `(flow_id, normalized_reason)` across runs of the project. The normalization (open question 3) defaults to **the prefix before the first colon, lowercased, whitespace-collapsed**, which groups "sub-run step 'goal-run-build': child result body lacks..." by its stable head while dropping run-specific tails. When the same normalized reason appears in **two or more independent runs** with fresh sources and no contradiction, emit a `proposed` `prior_failure` proposal whose `MemoryInputV0.source.ref` is a single *trace* ref for the head run (a `MemoryInputV0` has exactly one `source.ref`; see section 3), paired with a matching `RunMemoryUpdateEvent` whose `source_refs` array (`.min(1)`) cites **both** contributing runs' trace refs (the array is the schema-legal home for the two-run citation — see section 4).

This is deterministic and citable, and does not invent the command/timing facts the four candidate designs in [`project-execution-memory.md`](./project-execution-memory.md) section 2 were sunk by. The corpus reality (section 5) is that the cluster does not currently reach two independent runs, so the producer emits nothing today — by design.

**The "risky subsystem" signal is deferred, not shipped.** [`project-execution-memory.md`](./project-execution-memory.md) section 4 proposed a second auto-signal — grouping `outcome:aborted` documents by `(flow_id, source_path)` to flag a "risky file." It is **dropped from Slice 5** because it is not actually grounded: `HistoryDocumentV1.source_path` is always a *run-artifact* slot path (`trace.ndjson`, `reports/result.json`, `reports/<flow>/<report>.json` — e.g. the run doc at `src/history/extract.ts:549`, the report doc field assignment at `:627`, the trace doc at `:729`), **never a repo source file**. The same flow writes the same artifact slots on every run by construction, so this grouping would fire trivially on any shared artifact slot and would name an audit-log path, not a risky subsystem. There is no repo-path-bearing field in `HistoryDocumentV1` today, so an honest "risky subsystem" signal must wait for such a primitive — deferred alongside the command/timing facts (section 7), not faked here.

**Veto path:** the normalization is one function; a reason taxonomy or a different cut point replaces it without touching the cluster logic.

### D5 — Redaction at capture: facts are built from typed fields, never raw output

The parent design (section 9) and the Codex review both require redaction on any path that feeds memory. The **primary leak vector for this producer is the raw `step.aborted.reason` string itself**: it is a free-form `z.string().min(1)` that, in the real corpus, inlines stdout/stderr fragments and session ids directly in its tail (it is not a pre-redacted summary field). Resolution: a project fact's `summary` and `hints[].text` are composed from **normalized typed fields only** — the normalized reason *head* (the prefix before the first colon, D4), the flow id, and the cited run ids — and **never** from the raw reason tail, an un-normalized reason string, or raw `stdout`/`stderr`. The capture path asserts (in a test) that no stored hint contains the raw reason tail (anything after the first colon of a source `reason`), and additionally that no `stdout_summary`/`stderr_summary` substring reaches a hint (a secondary vector for any future signal that reads those fields). This is a verification obligation on the producer, matching the parent design's reframed leakage bullet (summaries can leak; raw output is already redacted at the history layer; verify redaction on the memory path).

**Veto path:** none — redaction is a hard boundary, not a tunable.

### D6 — Storage, scope, and the single injection door

Storage is `.circuit/memory/project.v1.jsonl` (line-delimited `MemoryInputV0` `kind:"project"` records), gitignored, local-only, parallel to `.circuit/history/documents.v1.jsonl`. Scope is `(project, flow_id)` — a review run sees review facts, a goal run sees goal facts. Each record is an existing `MemoryInputV0` with `kind:"project"`; the existing `superRefine` is reused unchanged — no new memory schema. The refines that fire for a `kind:"project"` record are `source.sha256 === source.ref.sha256` when both are present, staleness reason-code consistency, and unique hint ids; the same `superRefine` also carries `continuity`/`handoff_brief` kind-binding checks (`src/schemas/memory-input.ts:81-109`) that are inert for `kind:"project"`.

Project facts are surfaced through the **same run-start injection path** the prior-run recall uses, **routed through Slice 3's earned-precision gate** (`applyEarnedPrecision`), which is producer-agnostic (it keys on `content_id`, staleness, and the per-flow verdict, all of which project facts have). This keeps one injection door (parent design section 3, "one door"). If Slice 5 lands before Slice 3, it injects project facts with staleness sinking only (no verdict gate yet) and the gate is retrofitted when Slice 3 lands; either way the producer's value (a cited fact recorded with provenance and an indicator) does not depend on the gate.

**Veto path:** an operator who wants project facts in their own prompt block separate from prior-run recall adds a second block; the store and producer are unchanged.

## 3. What a stored fact looks like

An auto-distilled recurring-failure fact (the target shape; see [`project-execution-memory.md`](./project-execution-memory.md) section 3 for the full JSON):

- `kind:"project"`, `authority:"hint_only"`.
- `source.ref` matches the cited evidence's actual ref kind. The recurring-failure (abort-cluster) fact cites a **trace ref** (`kind:"trace"`, `run_id`, `sequence`), which by the `Ref` schema carries **no `ref.sha256`** (the trace branch keys on `run_id`+`sequence`); the content hash lives on `source.sha256` (the trace file's sha), and the `MemoryInputV0` `source.sha256 === source.ref.sha256` refine simply does not fire because `ref.sha256` is absent. An operator-filed fact citing a report instead carries a **report ref** (`kind:"report"`, `sha256`), where the refine does bind `source.sha256 === source.ref.sha256`. So "report ref" is the operator-note shape, not the abort-cluster shape.
- `summary` and `hints[].text` are composed from the normalized reason head, the flow id, and the cited run ids — never raw output (D5).
- `staleness` is re-verified against the cited source at injection (reusing the *behavior* of `sourceStaleness`, not its private symbol): file present and hash matches → `fresh`/`source_hash_verified`; deleted or changed → `stale`/`memory_stale`; unreadable or no hash → `unknown`/`memory_unverified`.
- the matching `RunMemoryUpdateEvent` is `action:"proposed"` (auto) or `"recorded"` (operator-filed), with `source_refs.min(1)`, `authority:"hint_only"`, an `operator_indicator`, and the new optional `staleness` (D3).

## 4. Modules and surface

- `src/schemas/run-envelope.ts`: add `.max(1)` to `memory_update_events`; add optional `staleness` to `RunMemoryUpdateEvent` (D3).
- `src/memory/project-store.ts` (new): read/append/rewrite `project.v1.jsonl`; `readProjectFacts({ flowId })` (filters by `flow_id` only — the local store *is* the project scope, D1), `appendProjectFact(record)`, `rewriteProjectFacts(records)` (eviction is a rewrite). Atomic tmp+rename + re-parse, the Slice 1 write discipline.
- `src/memory/project-identity.ts` (new): `resolveProjectId(repoRoot): { projectId; source: 'git_remote'|'config'|'runs_base'; warnings }` (D1); on first store write it stamps `.circuit/memory/manifest.json` with `{ project_id, source }` as provenance (the projectId is not stored per-record).
- `src/memory/project-distill.ts` (new): the consolidation pass — `distillProjectFacts({ runsBase, flowId, projectId }): { proposals: MemoryInputV0[]; events: RunMemoryUpdateEvent[] }` over `step.aborted` clusters (the one grounded signal, D4), propose-first (D2), redacted (D5). Pure over the history index + run folders; no auto-write.
- `src/cli/` memory command (new, e.g. `src/cli/memory.ts`): `circuit memory note --flow <id> --applies-to <enum> "<text>"` — **phase 1** writes the `kind:"project"` record to the store and prints a confirmation; it does **not** itself write the run envelope (a `RunMemoryUpdateEvent` exists only inside `RunEnvelopeRecord.memory_update_events`, which is written exclusively by `writeRunEnvelopeRecord` at run close — a standalone CLI subcommand cannot append it). **Phase 2** (with the source-record extension): a note issued during an active run **stages a pending memory-update** that the run-close envelope writer consumes into the single `memory_update_events` slot (`.max(1)`, D3), emitting the `action:"recorded"` event and the derived `memory_indicator`. Plus `circuit memory list`, `circuit memory forget <memory_id>`.
- Run-start path: `prepareRunStartHistoryRecall` (or a sibling) also loads project facts for `(project, flow)` and contributes them as candidates into `applyEarnedPrecision` (D6).
- `src/run-envelope/source-record.ts` (the envelope-event write — phase 2, see section 8): today `memoryUpdateEvents` hardcodes `source_refs: [input.processEvidence.ref]` (`source-record.ts:511`) and `MemoryUpdateInput` (`:41-49`) has no `source_refs` field, so it can emit only the *current* run's process-evidence ref. Extend `MemoryUpdateInput` and the builder to accept (a) a caller-supplied `source_refs` array (`.min(1)`) so an auto fact can cite *both* contributing runs and a note can cite its chosen source, and (b) the optional `staleness` object D3 adds to `RunMemoryUpdateEvent`, so the produce-side freshness the schema now carries can actually be populated (without this forwarding the new field would be unreachable). The derived `surface_output.memory_indicator` (`:637-639`, taken from the first `proposed`/`recorded` event's `operator_indicator`) then follows automatically once an event is written — no separate indicator plumbing is needed.
- Reuses: `MemoryInputV0` and its `superRefine`, `RunMemoryUpdateEvent`, the `contentIdentityOf` identity (Slice 3 D4) so project facts share the effect-measurement identity space, the staleness *behavior* from `query.ts`.

## 5. The cold-start reality, stated plainly

The producer's two auto-signals require recurrence the corpus does not show: the worked verdict-missing abort appears in **one** run (the only goal run on record), and the one genuinely repeated structured signal is a fanout-serialization warning across five runs — an environmental constraint, a weak first fact, not an outcome-learned failure ([`project-execution-memory.md`](./project-execution-memory.md) sections 2, 3). So on today's corpus auto-distillation **proposes nothing**. The value that ships immediately is the **operator-filed core**: an operator can teach the repo one durable, cited fact (e.g. "this repo verifies with `npm run verify`") and see it written to the project store with full provenance and confirmed by the `circuit memory note` command's own output, before any mining engine produces a single proposal. The in-envelope audit trail (the `RunMemoryUpdateEvent` and the derived `surface_output.memory_indicator`) is wired in **phase 2**, alongside the source-record `source_refs` extension (section 4), because it touches the post-run write path the architecture-hardening branch is refactoring (section 8); phase 1 does not depend on it. The spec does not claim the auto-producer is active today; it claims the seat is live, the operator core delivers a real cited fact now, and the auto path and envelope-event wiring follow.

## 6. Definition of done (verification surface)

- `tests/contracts/run-envelope-memory-update-bounds.test.ts` — `memory_update_events` rejects length > 1; an empty array still parses; `RunMemoryUpdateEvent` accepts and round-trips the new optional `staleness`; `proposed`/`recorded` still require `operator_indicator` (D3 leaves the existing refines intact).
- `tests/unit/project-store.test.ts` — append then read round-trips a `kind:"project"` record; `flow_id` scoping filters correctly (the local store location is the project scope; no per-record `projectId` filter); eviction rewrites without the forgotten id; an invalid line is reported, not silently dropped.
- `tests/unit/project-identity.test.ts` — git-remote present → stable id; config override wins; neither → runs-base id plus `project_id_unstable` warning (D1).
- `tests/unit/project-distill.test.ts` — a synthetic two-run fixture sharing a normalized abort reason → exactly one `proposed` `prior_failure` proposal whose `source.ref` is a single **trace ref** (no `ref.sha256`; content hash on `source.sha256`), with its matching `RunMemoryUpdateEvent.source_refs` array citing **both** runs' trace refs; a single isolated abort (the real-corpus case) → no proposal; **redaction (D5)**: no produced hint contains the raw reason tail (text after the first colon) of any source `reason`, and no `stdout_summary`/`stderr_summary` substring reaches a hint; auto facts are `proposed`, never `recorded` (D2). (No risky-subsystem test — that signal is deferred, D4.)
- `tests/runner/memory-note-cli.test.ts` — **phase 1 (core):** `circuit memory note` writes a valid `kind:"project"` record citing the current run to `project.v1.jsonl` and prints a confirmation; `list` shows it; `forget` removes it. **Phase 2 (envelope wiring):** once the source-record `source_refs` extension lands, a note issued during a run is consumed at run close into the envelope's single `memory_update_events` slot — the test drives a full run after the note and asserts the `action:"recorded"` `RunMemoryUpdateEvent` (with `operator_indicator` and the caller-supplied `source_refs`) and the derived `surface_output.memory_indicator`.
- `tests/runner/project-injection.test.ts` — a filed fact is loaded at the next same-flow run start and written into `memory_context.memory_input_ids` (routed through Slice 3's gate when present; surfaced via the recall indicator then); a different flow does not see it.
- Boundary assertions: `process_plan.selection_source` never references memory; `memory_context.authority` is always `hint_only`; `.circuit/memory/` is mutated only by the note and consolidation paths, never by relay or agent output.
- `npm run check`, `npm run lint`, targeted tests, then `npm run verify:fast` clean.
- Two consecutive adversarial reviews against this spec with no medium-or-above findings.

## 7. Explicit non-goals

- **No auto-record in this slice.** All auto-distilled facts are `proposed`; only operator-filed facts are `recorded` (D2).
- **No mined command, timing, or risky-subsystem facts.** Deferred until Circuit emits a structured per-check primitive that names what failed (and, for risky-subsystem, a `HistoryDocumentV1` field that names a repo path rather than a run-artifact slot); the producer consumes only `step.aborted` clusters and operator-filed facts (D4).
- **No routing or flow-selection change.** Execution-first only; the selected flow runs better, selection is untouched.
- **No self-evolving flows, no schematic mutation.**
- **No operator-level or cross-repo memory.** Scope is `(project, flow)`, local-only under `.circuit/memory/` (D6).
- **No new memory schema.** Facts are existing `MemoryInputV0` with `kind:"project"`; only the two additive envelope prerequisites change (D3).
- **No raw output in stored facts** (D5), and **no silent meaningful update** — every produced fact is announced: phase-1 operator notes by the `circuit memory note` CLI confirmation, and (once phase-2 envelope wiring lands) by a `RunMemoryUpdateEvent` and the derived one-line `memory_indicator` (parent design, section 9). The section-9 obligation is honored in both phases; only the *carrier* of the announcement differs by phase.

## 8. Sequencing against the in-flight architecture-hardening work

Slice 5 touches `src/schemas/run-envelope.ts` (the two additive prerequisites), adds new `src/memory/` modules and a `circuit memory` command, and extends the run-start/close path. The schema edits are additive and on the **stable** envelope contract the hardening plan does not relocate (MACRO-2's run-envelope relocation is defaulted to defer/drop). The producer reads the history index and run folders and re-verifies staleness by **behavior** (it does not import the private `sourceStaleness` or history hashing internals while SD-FIX-1/2 are unlanded). Because it writes a `RunMemoryUpdateEvent` into the envelope at run close, it touches the post-run artifact path the hardening branch is actively refactoring; to avoid that collision, the **operator-filed core (`circuit memory note` + store + injection) lands first and independently**, and the **auto-distillation + envelope-event write lands after the post-run extraction settles**. Slice 5's injection reuses Slice 3's gate, so it sequences naturally after Slice 3 for the gated path while its producer core can proceed in parallel. Target stable contracts — `MemoryInputV0`, `RunMemoryUpdateEvent`, the `kind:"project"` seat, the `content_id` identity, the `.circuit/memory/` layout — not current file locations.
