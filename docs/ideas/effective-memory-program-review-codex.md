# Effective Memory Program Review

Status: independent adversarial review
Date: 2026-05-31

## Bottom line

Do not adopt `effective-memory-program.md` as written. Also do not stay with
only `recall-to-lesson-gap.md`.

Adopt a named hybrid: **Canonical Lesson Hybrid**.

Ship the cheap recall-legibility fixes first because they address the live
circuit-land miss with the least risk. In parallel, start the kind-change, but
scope it to canonical, indexed report outputs and operator or agent proposed
lessons. Do not build Phase 2 around a blanket "review findings in
`reports/relay/` are deleted" premise. That premise is only partly true, and the
parts that are false are load-bearing.

The expensive idea is still directionally right. Circuit needs a
reasoning-bearing lesson path for defects that typed run outcomes cannot see.
But the first implementation should reuse the existing project memory store,
pull log, effect report, and canonical review reports before adding a new memory
kind or a new relay-only capture path.

## Make-or-break finding

The key Phase 2 claim is **partial, leaning refuted as stated**.

Confirmed half: `src/app/history/extract.ts` skips every JSON file whose
relative path starts with `reports/relay/` (`src/app/history/extract.ts:407-410`).
The indexer test also pins that relay requests are excluded
(`tests/unit/history-indexer.test.ts:180-184`).

Refuted or partial half: the typed finding shape and path are not uniform.

- Review flow has the exact `ReviewFinding` shape with `severity`, `id`, `text`,
  and `file_refs` (`src/flows/review/reports.ts:105-113`), but its relay result
  is written to `stages/analyze/review-raw-findings.json`, not `reports/relay/`
  (`src/flows/review/data.ts:141-154`, `tests/contracts/review-relay-shape.test.ts:15-31`).
- Build writes a review relay result under `reports/relay/build-review.result.json`
  (`src/flows/build/data.ts:288-309`), but `BuildReviewFinding` has
  `severity`, `text`, and `file_refs`, with no `id`
  (`src/flows/build/reports.ts:158-165`).
- Fix and Pursue have the same no-`id` review finding pattern
  (`src/flows/fix/reports.ts:699-706`,
  `src/flows/pursue/reports.ts:306-313`).
- Explore and Prototype have adversarial or comparison review steps, but their
  schemas are not `ReviewFinding` lists at all
  (`src/flows/explore/reports.ts:90-98`,
  `src/flows/explore/reports.ts:264-275`,
  `src/flows/prototype/reports.ts:629-647`).
- Canonical review outputs outside `reports/relay/` are indexable. The
  circuit-land history index contains `reports/build/review.json`
  (`/Users/petepetrash/Code/circuit-land/.circuit/history/documents.v1.jsonl:5`).

Conclusion: Phase 2 should not be "stop deleting review findings in relay."
The right first capture point is "read canonical review result reports, plus a
small allowlist for relay-only review outputs where no canonical report exists."
Relay capture is still useful, but it must be schema-probed per flow before it
becomes a design pillar.

## Claim inventory

| Claim | Status | Evidence | Review |
|---|---|---|---|
| Circuit skips `reports/relay/` from history indexing. | Confirmed | `src/app/history/extract.ts:407-410`; `tests/unit/history-indexer.test.ts:180-184` | True. Any relay-only review signal is invisible to history recall. |
| Build, fix, explore, prototype, and pursue all emit `ReviewFinding{severity,id,text,file_refs}` into `reports/relay/`. | Refuted | Build path: `src/flows/build/data.ts:304-309`, schema without `id`: `src/flows/build/reports.ts:158-165`; Fix without `id`: `src/flows/fix/reports.ts:699-706`; Pursue without `id`: `src/flows/pursue/reports.ts:306-313`; Explore/Prototype different shapes: `src/flows/explore/reports.ts:90-98`, `src/flows/prototype/reports.ts:629-647` | The broad schema claim is false. The path claim is partial. This weakens but does not kill the lesson-capture direction. |
| The exact `ReviewFinding` shape exists. | Confirmed | `src/flows/review/reports.ts:105-113` | It exists for the Review flow, not as a universal flow review primitive. |
| Canonical review findings are not all deleted by relay skipping. | Confirmed | Circuit-land indexed `reports/build/review.json`: `/Users/petepetrash/Code/circuit-land/.circuit/history/documents.v1.jsonl:5`; skip only covers `reports/relay/`: `src/app/history/extract.ts:407-410` | The effective doc misses the more stable capture surface: canonical reports. |
| Execution memory is outcome-keyed and blind to silent quality or architectural defects. | Partial | Effect measurement counts `RunEnvelopeOutcome` arms only (`src/app/history/memory-effect.ts:53-65`, `src/app/history/memory-effect.ts:112-116`); Build can continue on `accept-with-fixes` (`src/flows/build/data.ts:304-310`) | True for the measurement loop. Less true for the history corpus, which indexes canonical review reports. The blind spot is not "Circuit has no signal"; it is "the memory ratchet does not turn that signal into lessons." |
| Run-start recall is goal-lexical BM25 at `perRunLimit: 1`. | Partial | Query scoring is lexical over title, summary, text, and facets (`src/app/history/query.ts:79-99`, `src/app/history/query.ts:137-185`); run start sets `perRunLimit: 1` (`src/app/history/run-start-recall.ts:79-88`) | It is lexical and per-run-limited, but current run start also passes `flowId`, so it is no longer unscoped goal recall (`src/cli/circuit.ts:926-934`). |
| `score > 0` drops zero-overlap lessons. | Confirmed | `src/app/history/query.ts:306` | True for `queryHistory`. Important nuance: project facts loaded by `loadProjectFactCandidates` bypass this lexical query path (`src/app/history/run-start-recall.ts:99-109`). |
| The live circuit-land recall surfaced the envelope, not the fix. | Confirmed | Run 2 recall summary and hint point at `reports/run-envelope.json` and say "Run closed with outcome aborted" (`/Users/petepetrash/Code/circuit-land/.circuit/runs/3696aec1-505a-4fff-84ac-2ae5dd838548/reports/history/recall.json:27-32`, `/Users/petepetrash/Code/circuit-land/.circuit/runs/3696aec1-505a-4fff-84ac-2ae5dd838548/reports/history/recall.json:45-59`) | This is the real user-facing miss. |
| The fix text was present in typed artifacts. | Confirmed | `result.json` has the missing-script reason (`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/result.json:6-11`); run envelope has the completion gate gap (`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/run-envelope.json:125-145`) | This supports the cheap plan's correction: the first bug was retrieval and presentation, not pure capture. |
| The fix-vocabulary query returns zero results. | Refuted in current state | The current circuit-land history index contains trace docs with the exact missing-script reason (`/Users/petepetrash/Code/circuit-land/.circuit/history/documents.v1.jsonl:37-38`). Code path supports this because trace summaries include `reason` (`src/app/history/extract.ts:501-507`). | This older empirical claim is stale or depended on a different index state. The structural issue remains because run-start recall queries the goal, not the fix words. |
| `RunClosedOutcome` admits `aborted`, while `RunEnvelopeOutcome` does not. | Confirmed | `RunClosedOutcome` includes `aborted` (`src/schemas/trace-entry.ts:387-388`); `RunEnvelopeOutcome` is `complete`, `needs_attention`, `blocked`, `failed`, `handoff` (`src/schemas/run-envelope.ts:8-15`) | This is a real vocabulary split. |
| Circuit-land uses `aborted` in result and `failed` in the envelope for the same stopped build run. | Confirmed | Result outcome `aborted` (`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/result.json:6-11`); envelope attempt and surface output `failed` (`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/run-envelope.json:75-84`, `/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/run-envelope.json:154-158`) | The cheap plan's `isFailureOutcome` helper is warranted. |
| `buildFacets` misses failed envelopes because it checks only `outcome === 'aborted'`. | Confirmed | `src/app/history/extract.ts:313-338` | The winning run-envelope doc lacked the `failure` facet in recall. That is why the hint was classified as `context` (`/Users/petepetrash/Code/circuit-land/.circuit/runs/3696aec1-505a-4fff-84ac-2ae5dd838548/reports/history/recall.json:27-32`). |
| `distillProjectFacts` has zero non-test callers. | Confirmed | `rg "distillProjectFacts\\(" src tests docs/ideas docs/learnings docs/flows docs/contracts` finds the definition (`src/memory/project-distill.ts:187`), tests (`tests/unit/project-distill.test.ts:88`, `tests/unit/project-distill.test.ts:121`, `tests/unit/project-distill.test.ts:144`, `tests/unit/project-distill.test.ts:157`, `tests/unit/project-distill.test.ts:166`, `tests/unit/project-distill.test.ts:180`, `tests/unit/project-distill.test.ts:188`), and docs (`docs/ideas/self-auditing-memory-slice-5-spec.md:98`, `docs/ideas/recall-to-lesson-gap.md:82`), but no `src/` caller besides the definition. | The producer is built but unwired. |
| `distillProjectFacts` mines `step.aborted` clusters and defaults to a two-run threshold. | Confirmed | `DEFAULT_MIN_DISTINCT_RUNS = 2` (`src/memory/project-distill.ts:35`); it parses `StepAbortedTraceEntry` and clusters normalized heads (`src/memory/project-distill.ts:164-184`, `src/memory/project-distill.ts:187-237`) | This is useful for recurring aborts, not for one-off silent defects. |
| `memory-merge` and `memory-effect` are written only by manual CLI. | Confirmed | CLI write calls are in `src/cli/history.ts:461-477`; post-run artifact emission writes operator summary, shadow envelope, process evidence, and run envelope only (`src/cli/post-run-artifacts.ts:96-139`) | No run-close byproduct exists yet. |
| `readProjectFacts` filters only by `flow_id`; file-scoped injection does not exist. | Confirmed | Comment and implementation state flow-only filtering (`src/memory/project-store.ts:5-13`, `src/memory/project-store.ts:73-121`); injection requires `flowId` and reads those facts (`src/memory/project-injection.ts:61-89`) | File-scoped lessons are net-new work. |
| The project fact reader is already wired into run start. | Confirmed | `loadProjectFactCandidates` is called before earned precision (`src/app/history/run-start-recall.ts:99-115`) | This lowers the need for a brand-new retrieval surface. The missing part is write-back and file scope. |
| `classifyEffect` needs both arms at the default size of 2. | Confirmed | `DEFAULT_MIN_ARM_SIZE = 2` (`src/app/history/memory-effect.ts:21-26`); both arms below the floor return `not_enough_data` (`src/app/history/memory-effect.ts:89-116`) | The measurement loop cannot rank a first run or a one-run arm. |
| The first run of a flow has no prior memory and no effect report. | Confirmed | First circuit-land run recall had zero inputs and unavailable history (`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/history/recall.json:4-15`); precision failed open with no effect report (`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/history/recall-precision.json:6-21`) | This confirms the cold-start gap. |
| Circuit-land proves better memory would have prevented run 2. | Refuted | The first-use note says the orchestrator already read the cause and repeated because an edit silently failed (`/Users/petepetrash/.claude/projects/-Users-petepetrash-Code-circuit/memory/project_memory_first_use.md:23`) | The corpus still proves the recall presentation defect. It is weaker as causal product evidence. |
| The existing pull surface is unfinished. | Refuted in current source | `history pull` exists, suppresses measured-negative hints, and appends a pull log (`src/cli/history.ts:360-443`, `src/cli/history.ts:481-491`) | The effective doc should reuse and extend this, not propose it as future ground-up work. |
| Hint-only, cited, and staleness invariants exist. | Confirmed | `MemoryInputV0` requires `authority: 'hint_only'`, a source ref, staleness, and hash equality when both hashes exist (`src/schemas/memory-input.ts:31-79`, `src/schemas/memory-input.ts:111-144`); recall artifacts carry the hint-only notice (`/Users/petepetrash/Code/circuit-land/.circuit/runs/3696aec1-505a-4fff-84ac-2ae5dd838548/reports/history/recall.json:6-9`) | Any lesson program must preserve these. |
| The current write-side memory update adapter can carry full cited distiller events. | Refuted | `WriteRunEnvelopeRecordInput.memoryUpdates` omits `source_refs` and `staleness` (`src/app/run-envelope/source-record.ts:42-50`); `memoryUpdateEvents` replaces citations with the process-evidence ref (`src/app/run-envelope/source-record.ts:489-509`) while `distillProjectFacts` produces richer source refs and staleness (`src/memory/project-distill.ts:284-303`) | This is a missed integration risk. A write-back plan must not squeeze rich events through the current narrow adapter. |

## Answers to section 7 open decisions

### 1. Kind-change versus cheap plan

Choose the **Canonical Lesson Hybrid**.

The cheap plan should ship first because it fixes the proven defect: the hint
that won recall said only "Run closed with outcome aborted" and was classified
as context. The evidence for that is direct in the circuit-land recall artifacts
(`/Users/petepetrash/Code/circuit-land/.circuit/runs/3696aec1-505a-4fff-84ac-2ae5dd838548/reports/history/recall.json:27-32`,
`/Users/petepetrash/Code/circuit-land/.circuit/runs/3696aec1-505a-4fff-84ac-2ae5dd838548/reports/history/recall.json:45-59`). The typed cause was already present
(`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/result.json:6-11`,
`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/run-envelope.json:125-145`).

But the cheap plan is not enough. It mainly fixes recurring typed aborts. It
does not make a first review finding, a silent quality issue, or an
architectural mismatch reusable on the next run. The kind-change is justified
for that class, but only after correcting its capture premise.

### 2. Prose-trust posture

Start propose-only for agent-authored `fix` and `reasoning`.

A cited source proves the cited bytes have not drifted. It does not prove the
agent's prose diagnosis is correct. Store these lessons as hint-only proposals,
with citations and a clear indicator, until either the operator records them or
a narrow code-owned remediation constant applies. Do not auto-record freeform
reasoning from a single agent pass.

The exception can be code-owned deterministic remediations. For example, the
missing-script failure can safely carry a code-owned line such as "Add one of
verify, test, or check to package.json scripts before Build can verify." That
is not mined prose.

### 3. Fund the ablation harness?

Fund passive measurement byproduct early. Delay the full ablation harness.

The effect loop is currently real code but not a real field verdict. It needs a
persisted effect report and both arms at size two before it can say anything
(`src/app/history/memory-effect.ts:21-26`, `src/app/history/memory-effect.ts:89-116`).
The first circuit-land run had no prior, and its precision report failed open
because `memory-effect.v1.json` did not exist
(`/Users/petepetrash/Code/circuit-land/.circuit/runs/6c2fc43a-eda3-4491-b2f8-232fa7494a79/reports/history/recall-precision.json:6-21`).

So build the report-byproduct and consumption logs as soon as behavior changes.
Do not make the full synthetic ablation harness block the lesson capture work.
The harness is valuable once there are lessons to test, but it is not the next
highest leverage move.

## Is the rank, retrieve, capture, consume, measure sequencing sound?

Mostly yes as a dependency graph, but not as a delivery plan.

The dependency is real: you cannot measure a lesson until something consumed it,
and you cannot consume a lesson until it was captured and retrievable. But
demoting measurement to the very end is risky if it means lessons start shaping
runs without consumption logs and fail-open effect reports from day one.

Use this order instead:

1. Make existing recall legible and failure-aware.
2. Capture canonical lessons as proposed, hint-only, and cited.
3. Retrieve by project, flow, and later file scope.
4. Log every push and pull consumption immediately.
5. Keep measurement passive and fail-open until enough comparable runs exist.
6. Let measurement demote or suppress only after it has enough data.

That preserves the self-auditing thesis without pretending the first few runs
can produce a verdict.

## Under-counted risks

**Prose trust.** This is the biggest new risk in the effective program. A
hash-verified citation can still support a wrong agent-authored fix. Mitigation:
propose-only first, code-owned remediation constants where possible, and require
grounding citations.

**Distractor resurfacing.** Recency without recurrence can keep showing a fixed
one-off issue. The effective doc names this, but the mitigation needs a concrete
resolve marker or retirement rule. Source hashes only prove the old evidence did
not change. They do not prove the condition still applies.

**File-scoped injection.** The signature value of review-derived lessons is
"warn me when I touch this file again." Current project facts filter only by
flow, not file (`src/memory/project-store.ts:73-121`). This is net-new and should
be a named slice, not a footnote.

**Capture compliance on real flows.** Flow review schemas are not uniform.
Build, Fix, and Pursue have no finding `id`; Explore and Prototype do not use
finding lists for their review outputs. Any capture code must either normalize
per flow or restrict v1 to the schemas it can prove.

**Write-side citation loss.** The current run-envelope writer's memory update
adapter cannot carry the rich `source_refs` and `staleness` that the distiller
already produces (`src/app/run-envelope/source-record.ts:42-50`,
`src/app/run-envelope/source-record.ts:489-509`,
`src/memory/project-distill.ts:284-303`). A naive wire-up would violate the cited
memory invariant.

**A stale empirical claim.** The "fix vocabulary returns zero hits" claim no
longer holds in the current corpus. The structural retrieval problem remains,
but the review should not repeat that exact claim.

**Boundary and redaction drift.** Lesson capture should live in history,
memory, and report normalization code, not as flow-specific runtime branching.
The catalog is the engine's source of flow truth, and the engine should not
import flow modules directly (`src/flows/catalog.ts:1-6`, `AGENTS.md:109-116`).
The existing distiller also redacts at capture by composing hints from
normalized typed fields only (`src/memory/project-distill.ts:23-28`). Review
lesson capture needs the same rule, especially if relay outputs are ever
allowlisted.

## Higher-leverage direction missed

The higher-leverage path is not raw relay capture. It is canonical report
capture.

Use indexed, schema-validated reports first:

- `reports/build/review.json`
- `reports/fix/review.json`
- `reports/pursuit/review.json`
- `reports/review-result.json`

Then add a small relay allowlist only where the canonical output lacks the
needed finding detail. This keeps the capture path closer to stable contracts,
reduces prompt-output noise, and avoids making `reports/relay/` a special memory
source before each flow's schema is probed.

Also reuse what already exists:

- Project facts are already loaded at run start outside the lexical query gate
  (`src/app/history/run-start-recall.ts:99-115`).
- `history pull` already exists and writes a pull log (`src/cli/history.ts:360-443`).
- The effect report already has fail-open suppression semantics
  (`src/app/history/memory-effect-read.ts:15-21`).

The missing work is write-back, normalization, file scope, and passive
measurement byproduct, not a brand-new memory world.

## Recommendation

Proceed with the **Canonical Lesson Hybrid**:

1. Build the cheap plan's Step 1 first: failure outcome predicate, failure-aware
   summaries, and prior-failure hint text that leads with the diagnostic.
2. Auto-write memory-merge and memory-effect as post-run byproducts, but keep
   them passive and fail-open.
3. Wire distiller write-back for recurring typed aborts through a rich event path
   that preserves source refs and staleness. Do not use the current narrow
   `memoryUpdates` adapter as-is.
4. Add proposed-only, redacted canonical review lesson capture for non-low
   findings from report outputs, with per-flow schema normalizers. Generate
   stable ids where a flow schema lacks `id`.
5. Add file-scoped injection before claiming the review lesson path delivers its
   signature value.
6. Keep the work in history, memory, and report-normalization paths. Do not add
   flow-specific branches to the runtime engine.
7. Use measurement to suppress or demote only after consumption logs and arm
   sizes exist. Until then, surface lessons as cited hints, not earned truth.

Strongest counter-argument: this hybrid may be too cautious. The effective
program is right that a single critical review finding can be valuable on the
very next run, and propose-only capture may leave the best lesson out of the
prompt when the operator is not watching. If the team optimizes for maximum
agent autonomy rather than evidence discipline, it should auto-inject non-low
canonical review lessons immediately as hint-only, with a loud indicator and a
resolve marker. I do not recommend that as v1 because the flow schemas are
heterogeneous and the current write-side adapter would lose citation detail.

## Self-review log

Pass 1 finding, medium: The first draft over-weighted the relay skip claim. I
rechecked flow schemas and circuit-land index output, then changed the
recommendation from "proceed with effective program" to the Canonical Lesson
Hybrid.

Pass 2 finding, medium: The first draft did not account for existing project
fact injection and `history pull`. I added those as reuse points and changed the
implementation order to avoid re-building existing surfaces.

Pass 3: no medium-or-above findings.

Pass 4: no medium-or-above findings.

Pass 5 finding, medium: The assessment did not make the engine-boundary and
redaction constraints explicit, and a few corpus citations used shorthand line
refs instead of full file:line refs. I added the boundary and redaction risk,
tightened the recommendation, and expanded the citations.

Pass 6: no medium-or-above findings.

Pass 7: no medium-or-above findings.
