# Circuit Autonomy Continuation Loop — Migration Plan (Extension)

Status: implementation plan, not current behavior.

Date: 2026-05-28

## Purpose

Make Circuit continue intelligently from its own evidence — turning the Run
envelope from a single-shot *recorder* into a bounded, evidence-driven
*continuation loop* — without giving the completion decision to the host or to a
second goal runtime. This extends the Run-centered migration; it does not reopen
its decisions.

## Foundational correction (read first)

An earlier draft of this plan assumed the Goal flow authors a *decomposed,
multi-claim* `done_when` that could be lifted into Run. Source inspection shows
that is false, and the correction reshapes several slices:

- **Goal authors a single `done_when` claim**, `id: 'objective-proved'`
  (`src/flows/goal/writers/contract.ts:94-109`). It is not multi-claim. The Run
  envelope writer also emits exactly one generic claim
  (`src/run-envelope/source-record.ts:571-583`).
- **The real decomposition axis is `required_evidence` *within* the claim**,
  built from `clarified.proof_needed`
  (`src/flows/goal/writers/contract.ts:62-66`). Each entry has a `kind`
  (`command | report | review | source | checkpoint`), a description, and a
  `required` flag.
- **The decomposition intelligence lives upstream in the Clarify step**
  (`goal.clarified-task@v1`), not in the contract writer, which only transcribes
  it.
- **The evidence projection is kind-blind.** `ProcessEvidenceProjection`
  (`src/schemas/process-evidence.ts`) carries `outcome`, `evidence_refs`,
  `declared_report_paths`, and `missing_evidence: [{ claim_id, reason }]` — but
  it does **not** record which *evidence kind* was satisfied or missing. A naive
  "claim-aware router" therefore has nothing to route on.

Consequence: the semantic unit Run must learn is **task-specific
`required_evidence`**, not multiple claims; and the recovery router must route on
the **kind of the unmet required_evidence**, which requires a stable mapping from
each `required_evidence` entry to a declared evidence path so the writer can tell
*which* evidence is missing and *what kind* it is. This is the safe default that
makes S5 buildable on the existing projection without a schema change to the
projection itself.

## Relationship to existing specs

- **`docs/specs/run-centered-migration-plan-v1.md` — EXTENDS.** That plan already
  records the binding dispositions this plan implements: *"Goal contract and gate
  semantics | Move"* (`:235-236`) and *"Goal as public flow peer | Collapse
  later"* (`:238`). This plan does not rewrite either row; S1 ratifies them and
  S2–S7 implement the Move while S8 performs the Collapse-later structural cut.
- **`docs/specs/goal-block-v1.md` — EXTENDS (cite-only).** The host boundary
  (`:20-22`) — native host `/goal` "must not own Circuit's goal state, completion
  decision, proof standard, recovery policy, or final close" — and the host
  adapter responsibilities (`:536-556`) are the basis for naming the Run envelope
  the sole loop owner. No edit to this spec.
- **`docs/specs/run-centered-v1-migration-ledger.md` — AMENDS.** The Run envelope
  record (`run.envelope@v0`) and its source-owned writer
  (`src/run-envelope/source-record.ts`) are already implemented and recorded in
  the ledger. The `RunSupervisorRecord` / `run.supervisor@v0` named as the Move
  target remains spec-only (`docs/specs/run-supervisor-contract-sketch-v1.md:102`).
  **Ledger update needed:** add a Phase 13 block tracking S1–S9 with per-slice
  proof commands, and record that S2 advances the envelope's `done_when` from a
  single generic claim to task-specific `required_evidence`.

## Scope

**In scope** — the autonomy continuation loop, as nine slices (S1–S9):
ratify the Run envelope as loop owner (S1); author task-specific
`required_evidence` in Run's single `done_when` claim with a stable
evidence→path mapping (S2); lock the proof contract against mid-run weakening
(S3); add a contract-quality gate lens (S4); replace the hardcoded follow-up
with an evidence-kind-aware recovery router (S5); add no-progress / oscillation
escalation (S6); add the bounded in-process continuation loop (S7); freeze the
Goal flow's public visibility while preserving reader-compat (S8); gate
classifier selection away from `goal` (S9).

**This is a plan for future implementation. S1 includes a documentation edit; slices S2–S9 are code/schema implementation tasks, gated by tests and verification checks.**

### Deferred (stays with the existing Run-centered plan)

- Full deletion of the Goal flow (removing `goal` from the catalog, deleting
  `src/flows/goal/`, renaming `goal.*@v1` schemas). S8 performs only the
  visibility flip and keeps the runtime/reader intact.
- Enriching `ProcessEvidenceProjection` to natively report per-`required_evidence`
  satisfaction. S2/S5 work around the kind-blind projection via the
  evidence→path mapping; native enrichment is a later refinement.
- Flow-specific final-report scraping → process evidence projection (Collapse
  row); verbose operator-summary collapse; host-surface rendering changes;
  `scope.in/out` drift detection. None are touched here.

## Dependency order

Strict forward chain — no slice depends on a later slice's output:

```
S1 ─┬─────────────────────────────────────────────► S8 ──► S9
    └► S2 ─┬─► S3 ─┬─► S5 ─► S6 ─► S7
           └► S4 ──┘
```

- S2 and S4 depend on S1's ratified contract shape; S2 has no code dependency on
  S4.
- **S5 depends on S2 + S3**: a router needs task-specific, locked
  `required_evidence` to route on; on a single generic claim it can only
  retry-or-quit.
- S9 is a **successor** of S8 (not a forward dependency of it). S8 is complete on
  its own; *migration close* — a separate milestone outside these slices —
  requires S9.

## Slices

### S1 — Ratify envelope-as-loop

- **Purpose.** Make binding, in one place, that the Run envelope (not host
  `/goal`, not a separate public Goal peer) owns the autonomy goal loop.
- **Scope.** Add a one-paragraph "Ratification: envelope-as-loop" note to
  `docs/specs/run-centered-migration-plan-v1.md` immediately after its header,
  citing the Move row (`:235-236`) and Collapse-later row (`:238`) and the host
  boundary (`goal-block-v1.md:20-22`). Name the rejected alternatives (separate
  Goal flow peer; host `/goal` as authority) and why. Documentation only.
- **Dependencies.** None.
- **Proof gate.** Doc review: the note exists, cites the three anchors, and adds
  a Phase 13 ledger entry. The Phase 13 entry is a new section in
  `docs/specs/run-centered-v1-migration-ledger.md` titled "Phase 13 — Autonomy
  Continuation Loop" with a Slice Order table (rows S1–S9, each with State,
  Depends On, Scope, Proof Gate, Rollback) mirroring the existing Slice Order
  table format, the per-slice proof commands from this plan, and a ledger-update
  gate row stating that each slice updates its row on completion. Verify the
  Phase 13 block is appended after the existing ledger content with "Slice 12
  Unified host command surface" (the ledger's current terminal slice row) named
  as the prior anchor. `git diff --check` clean.
- **Rollback.** Revert the doc edit; no code touched.
- **Residual risk.** A doc note has no runtime enforcement; the dual-writer risk
  is closed by S8 + S9, not S1.

### S2 — Author task-specific `required_evidence` in Run's `done_when`

- **Purpose.** Replace Run's generic single claim ("normalized process evidence
  projection exists", `source-record.ts:571-583`) with a claim whose
  `required_evidence` is task-specific, mirroring how Goal derives evidence from
  `clarified.proof_needed`.
- **Scope.** In the Run intake path, the source-owned writer
  `writeRunEnvelopeRecord` (`src/run-envelope/source-record.ts:497`, which today
  emits the generic `process-evidence` claim at `:571-583`) derives
  `required_evidence[]` (each with `kind`, `description`, `required`) for the
  single `done_when` claim from the task context. Establish a **stable mapping**,
  stored as a constant/type in `src/run-envelope/source-record.ts`, from each
  `required_evidence` entry's `kind`+`description` to a `declared_report_paths`
  index, so later slices can identify *which* evidence is unmet and *what kind*
  it is. No envelope schema change is required — the schema already permits N
  claims and rich evidence (`src/schemas/run-envelope.ts:102`); this slice
  changes the *writer*, not the schema.
- **Dependencies.** S1.
- **Proof gate.** Fixture (to be written) against `writeRunEnvelopeRecord`
  asserting: (1) the writer emits task-specific `required_evidence` derived from
  the operator intent / run context / clarified input — not the hardcoded generic
  entry from today's writer. The fixture constructs a Run envelope with a known
  operator intent (e.g. `"implement feature X"`) and asserts that the
  `required_evidence` array in the claim's `done_when[0].required_evidence`
  contains at least one entry with a distinct `kind` and description that differ
  from the current generic `"Normalized process evidence projection exists."`
  claim; (2) each `required_evidence` entry in the claim can be looked
  up by `kind`+`description` in the mapping constant, and the mapped index exists
  in `declared_report_paths`; (3) a missing *required* evidence entry yields the
  gate verdict `needs_followup` (never `complete`). `npm run verify:fast`.
- **Rollback.** Restore the generic-claim writer branch behind the existing code
  path; fixture deleted.
- **Residual risk.** Derivation quality is bounded by the intake signal Run has;
  where Run lacks a Clarify step, evidence may be coarse. Tracked as the
  projection-enrichment deferral.

### S3 — Lock the proof contract at intake

- **Purpose.** Close the self-authored-success-criteria risk: an autonomous loop
  must not be able to weaken its own bar mid-run.
- **Scope.** Snapshot the `done_when` (claim + `required_evidence`) at intake and
  treat it as immutable for the run. Any attempt to remove/relax/reorder a
  required evidence entry becomes a checkpoint, never a silent edit. Legitimate
  scope change routes through the existing checkpoint mechanism.
- **Dependencies.** S2.
- **Proof gate.** Fixture rejecting a post-intake contract whose required
  evidence was weakened (removed entry, flipped `required: true→false`), and
  asserting a checkpoint is emitted for a legitimate scope change. `npm run
  verify:fast`.
- **Rollback.** Disable the immutability check; contract becomes mutable again.
- **Residual risk.** Locks *structure*; prose-only weakening of a description is
  not mechanically caught — S4 covers that qualitatively.

### S4 — Contract-quality gate lens

- **Purpose.** Attack the `done_when` itself for weakness (is each
  `required_evidence` strong enough that satisfying it really means done?), not
  just evidence-against-contract.
- **Scope.** Add a **new** `'contract-quality'` `attack_lens` to `gateFor`
  (`src/run-envelope/source-record.ts:182`), distinct from the existing
  presence-oriented lenses (`'required-evidence-present'`,
  `'child-outcome-consistent'`), invoked before close. It flags contracts whose
  required evidence is too weak to defend the objective even when that (weak)
  evidence is present, using a minimum-evidence-by-objective-kind rule:
  a code-change / implementation objective requires at least one `required`
  `command` (passing test/verification) entry, not merely a `report` entry.
  The contract-quality lens uses a mapping function
  `objective_kind(objective_text: string): "implementation" | "review" | "explore" | other`
  to classify the run objective. For proof, define this function in
  `src/run-envelope/source-record.ts` with the rule: objectives containing
  `[build|fix|implement|add|change|create|refactor|ship|integrate|update]`
  trigger `implementation` classification.
- **Dependencies.** S2.
- **Proof gate.** Fixture defining a weak contract — only `kind=report`
  required for a code-change objective — and asserting that `gateFor` produces a
  blocking finding from the `'contract-quality'` lens despite the report evidence
  being present (mapping: code-change objective → minimum required evidence kinds
  `{command}`). The fixture constructs a Run envelope with
  `objective: "Implement feature X"`, asserts `objective_kind` returns
  `"implementation"`, and tests the lens accordingly. The lens is tested in
  isolation: the fixture builds the weak contract directly and does not assume
  S3's intake lock is active, so S4's blocking logic is provable without S3 in
  place. `npm run verify:fast`.
- **Rollback.** Remove the lens from the gate lens set.
- **Residual risk.** The lens is qualitative (author-judgment); a rubber-stamp
  pass is possible. Mitigated by requiring it as a named pass with recorded
  reasoning, not a boolean.

### S5 — Evidence-kind-aware recovery router

- **Purpose.** Replace `followupProcessId()`'s hardcoded `return 'review'`
  (`src/run-envelope/source-record.ts:296-298`) with routing driven by the
  *kind* of the unmet required evidence.
- **Scope.** Using the S2 evidence→path mapping, identify the unmet
  `required_evidence` entries and route by kind: unmet `command` (e.g.
  test/verification) → `fix`; unmet `report` for an implementation objective →
  `build`; unmet `review` → `review`; unmet `source`/decision → `explore`; scope
  ambiguity → `checkpoint`. Encode this routing as a single source-level constant
  `RECOVERY_ROUTE_FOR_UNMET_EVIDENCE_KIND` in
  `src/run-envelope/source-record.ts` with type:
  `const RECOVERY_ROUTE_FOR_UNMET_EVIDENCE_KIND: Readonly<Record<RunRequiredEvidenceKind, CompiledFlowId>> = { command: "fix", report: "build", review: "review", source: "explore", checkpoint: "checkpoint" }`.
  When multiple kinds are unmet, `followupProcessId()` consults the priority
  array `[command, report, review, source, checkpoint]` to select the first
  matching kind and returns the corresponding route. This constant replaces the
  current hardcoded `return "review"` at
  `src/run-envelope/source-record.ts:297`.
- **Dependencies.** S2, S3.
- **Proof gate.** Fixture that iterates `RECOVERY_ROUTE_FOR_UNMET_EVIDENCE_KIND`,
  injects unmet evidence of each kind, and asserts `followupProcessId()` returns
  the mapped route; plus a multi-unmet case asserting the declared priority order
  `[command, report, review, source, checkpoint]` selects the highest-priority
  route. `npm run verify:fast`.
- **Rollback.** Restore the constant `'review'` follow-up.
- **Residual risk.** Routing granularity is bounded by the single-claim model;
  finer routing awaits projection enrichment (deferred).

### S6 — No-progress / oscillation detection

- **Purpose.** Prevent the loop from burning attempts on no real progress or
  oscillating (e.g. fix↔review) — and from completing by exhaustion.
- **Scope.** Track per-attempt the set of unmet *required* evidence entries.
  **Progress** is defined as that set shrinking by at least one entry between
  consecutive attempts. Escalate to checkpoint/handoff/blocked instead of another
  retry when either: (a) the unmet-required-evidence set is identical across two
  consecutive attempts (no progress), or (b) the recovery route oscillates (e.g.
  `fix → review → fix`).
- **Dependencies.** S5.
- **Proof gate.** Fixture injecting a repeated attempt with an identical
  unmet-required-evidence set and asserting escalation to checkpoint/blocked (not
  another retry), and an oscillation case asserting the same. `npm run
  verify:fast`.
- **Rollback.** Disable the detector; loop relies on `max_process_attempts` alone.
- **Residual risk.** Subtle progress (partial evidence) may be misread as
  no-progress; threshold tuned conservatively to prefer escalation over false
  completion.

### S7 — Bounded in-process continuation loop

- **Purpose.** Run the loop inside one Run invocation so the host does not need
  to "keep taking turns".
- **Scope.** In the run *orchestration* path (the code that today invokes the
  selected child flow once and records the envelope — **not** the pure record
  builder `buildRunEnvelopeRecord`), add: invoke attempt → build process
  evidence → re-evaluate `done_when` via the existing `gateFor` logic → if
  `needs_followup` and within `recovery_policy.max_process_attempts`, select the S5
  recovery route and run the next attempt → stop on `complete` / `blocked` /
  `failed` / `handoff` / checkpoint. Never close `complete` by exhaustion;
  exhaustion → `needs_attention`/`blocked` with honest summary.
- **Dependencies.** S5, S6, S4.
- **Proof gate.** Fixture driving the loop to a terminal state under a hard
  attempt cap, plus an exhaustion fixture that runs to
  `recovery_policy.max_process_attempts` with unmet evidence at each step and
  asserts: (1) `outcome` is NOT `complete`; (2) `outcome` is one of
  `needs_attention` / `blocked` / `failed` / `handoff` with an honest
  reason/`next_action` set; (3) `process_attempts.length` equals
  `max_process_attempts`; (4) the summary describes exhaustion (e.g. "Ran 2
  attempts; required evidence remains unmet; stopping per recovery policy"). Also
  asserts a clean `complete` when evidence is satisfied within budget. Also
  asserts that when a Run enters the loop with a weak contract (report-only for a
  code-change objective), the contract-quality lens (S4) produces a blocking
  finding before the loop completes, forcing escalation to checkpoint rather than
  silent looping to completion. This confirms S4's lens integrates correctly into
  S7's loop decisions. `npm run verify:fast`.
- **Rollback.** Gate the loop behind a flag defaulting off (single-attempt
  behavior preserved).
- **Residual risk.** A long in-process loop has weaker progress observability
  than per-turn host rendering; deferred to the host `/goal` V2 observability work.

### S8 — Freeze the Goal flow's public visibility

- **Purpose.** Stop the Goal flow competing with Run as the product surface,
  without breaking old run folders.
- **Scope.** Flip the `visibility` field at line 82 of `src/flows/goal/data.ts`
  (inside the `goalFlowData` object that opens at line 80) `'public' →
  'internal'`, regenerate host mirrors and the block catalog, and keep the
  in-catalog runtime/reader so old `goal.*@v1` artifacts still load. Here the
  **reader** is the in-catalog Goal runtime/deserializer that loads a run
  folder's `goal.contract@v1` / `goal.gate@v1` artifacts; it is retained
  unchanged by the visibility flip. Distinguish reader-compat (kept) from dual
  active writers (the second-runtime risk — stopped). Given the project's low
  back-compat burden, the reader can be minimal.
- **Dependencies.** S1.
- **Proof gate.** `npm run check-flow-drift` green after regen; a reader test
  that loads a pre-built sample run folder containing `goal.contract@v1` and
  `goal.gate@v1` artifacts, deserializes them without error, and asserts the Goal
  flow can still be started via explicit routing (e.g. `--flow goal`) after the
  visibility flip — verifying backward compat (old runs load, Goal runs
  explicitly) while the flow no longer appears in auto-select routing or as a
  public host surface. `npm run verify`.
- **Rollback.** Flip visibility back to `'public'` and regenerate.
- **Residual risk.** Visibility alone does not stop the classifier routing new
  work into `goal` — that is S9.

### S9 — Gate classifier selection away from `goal`

- **Purpose.** Fully retire the dual-writer risk: ensure new work is not routed
  into the (now internal) Goal flow.
- **Scope.** Make the process classifier/router never select `goal` for
  classifier-based routing of new runs. Document explicit / non-classifier paths
  (e.g. the `--flow goal` CLI flag) as internal-only and out of the supported
  surface. Record in the ledger as the gate for migration close.
- **Dependencies.** S8.
- **Proof gate.** Two gates. *Classifier gate:* a fixture asserting the
  classifier never returns `goal` for a representative intent set. *Explicit
  entry gate:* a separate test/note confirming explicit-request entry paths (e.g.
  `--flow goal`) are unsupported / internal-only, so the dual-writer risk is
  fully closed rather than merely reduced. Plus a ledger entry marking
  migration-close readiness. `npm run verify`.
- **Rollback.** Restore prior classifier selection set.
- **Residual risk.** Classifier coverage is sampled; the fixture must include the
  intents most likely to mis-route.

## Completion / value test

Closure of this migration is judged by the existing false-done value test, not by
slice count: after each slice lands, the false-done fixtures must stay green, and
the end-to-end measure is **fewer `complete` outcomes without required evidence**
on the held-out false-done set (the Fix class anchored by
`evals/false-done-fix/README.md`). Autonomy depth (S7's attempt budget) may be
raised only while the false-complete count stays at zero.

Local proof for each slice and at close:

```bash
git diff --check
npm run check-flow-drift
npm run verify:fast
npm run verify
```

## Residual risks (plan-level)

- The single-claim + kind-blind-projection model bounds routing granularity;
  S2's evidence→path mapping is the load-bearing workaround and must be robust.
- The contract-quality lens (S4) and no-progress detector (S6) are partly
  qualitative; both are tuned to prefer escalation/blocking over false
  completion.
- S7 trades observability for in-process autonomy; host `/goal` V2 is the
  intended mitigation, explicitly deferred.
