---
spec: explore-intent
status: draft
version: 1
last_updated: 2026-05-08
source: intent grill conducted 2026-05-07/2026-05-08; 19 questions across the foundational design tree
purpose: target intent for the Explore flow, written from first principles. Implementation reconciliation is a separate stage.
---

# Explore Flow Intent Spec v1

Research note: this draft records upstream Explore intent. It is not current
implementation truth until reconciled with code, tests, and generated surfaces.

This spec defines what the Explore flow *should be*. It is upstream of any
implementation choice. The current code may diverge from this spec; that
divergence is the harden-or-improve worklist for the next stage.

## Status

Draft. Produced from a 19-question intent grill on 2026-05-07 / 2026-05-08.
Awaits operator sign-off before reconciliation with the current
implementation begins.

## Cross-cutting spec dependencies

Four cross-cutting capabilities surfaced during this grill. Each is
upstream of any per-flow spec and needs its own spec document. This Explore
spec references them; it does not redefine them.

1. **3-axis depth/mode model** — replaces today's flat `Depth` enum. Three
   orthogonal axes: `Depth` (lite/standard/deep), `Tournament` (on/off),
   `Autonomous` (on/off).
2. **`--from-run <run-folder>` cross-flow composition** — single canonical
   flag for any flow to consume any other flow's prior-run report as
   input context. Operator-mediated; no auto-chaining.
3. **Structured human-in-the-loop checkpoint protocol** — flows emit
   structured question events with anticipated answers; host adapter
   renders via the host's native interactive surface (Claude Code's
   `AskUserQuestion`, Codex's plan/task/checkpoint surface, etc.). Never
   ad-hoc prose questions.
4. **Host-tool assumption with graceful degradation** — Circuit assumes
   the host agent's standard tools are available (web search, file ops,
   code execution). No Circuit-specific gating flags. On tool failure, use
   the structured checkpoint protocol with anticipated next-step options.

---

## 1. Purpose

Explore is for moments when the operator cannot yet name the action they
want to take. The trigger condition is **direction uncertainty** — a
question, a decision, a fuzzy area, or an unfamiliar system that needs
clarity *before* the operator can pick an action flow.

**Deliverable:** clarity, not code. If Explore produces code or modifies
the codebase, it has overstepped.

If the operator already knows what they want done and just needs it built or
fixed, Explore is the wrong flow — they reach for the action flow directly.

---

## 2. Output report

### Canonical sections

Every Explore run produces a single canonical report with these sections,
in this order. Sections are **present-or-absent based on content**, never
filled with hedge-language to satisfy a template:

- **Subject** — what we investigated (always present)
- **Findings** — grounded summary with structured evidence_refs (always present)
- **Options** — multi-option decision space (present only when prompt is
  decision-shaped)
- **Recommendation** — concrete recommendation with `confidence: high |
  medium | low` (present only when prompt asked for one)
- **Open Questions** — what we couldn't resolve, what needs operator
  follow-up (present when applicable; commonly present)
- **Auto-resolutions** — appears only in autonomous-mode runs that hit at
  least one auto-resolved checkpoint

A pure-question prompt ("how does X work?") produces Subject + Findings +
Open Questions only. A decision prompt produces all five (or six in
tournament).

### Frame's success-condition shape

The Subject is paired with a structured success condition emitted by the
Frame stage:

```
{
  "subject": "How auth integrates with the session middleware",
  "success_condition": {
    "summary": "Operator can decide whether to refactor the auth-session boundary, with the tradeoffs visible.",
    "must_answer": [
      "What does the current interface look like?",
      "What coupling exists between auth and session?",
      "What refactor approaches are plausible, and what are their tradeoffs?"
    ]
  }
}
```

The `summary` is operator-facing: it appears at the forced-Frame
checkpoint for confirmation. The `must_answer` list is reviewer-checkable:
the Review stage's coverage-adequacy dimension scores Findings against it.

### Three operator-facing surfaces

Every Explore run emits three coordinated views of the same data:

| Surface | Path | Purpose |
|---|---|---|
| **JSON** | `<run-folder>/reports/operator-summary.json` | Canonical structured data; consumed by other tools |
| **Markdown** | `<run-folder>/reports/operator-summary.md` | Terminal-rendered inline summary (host renders verbatim) |
| **HTML** | `<run-folder>/reports/operator-summary.html` | Rich browser view; host auto-opens via `open <path>` |

For Explore specifically, **HTML always renders**, regardless of mode.
Other flows opt in via the `HTML_PROJECTORS` registry; Explore's projector
unifies tournament and non-tournament shapes (today's projector handles
tournament only; needs extension).

### Markdown structure

```markdown
**What you asked**
[1 sentence restating the prompt in plain language]

**What we found**
[2-4 sentences of headline findings]

**Recommendation** (when present)
[1-2 sentences with confidence: high / medium / low]

**Open questions**
- [bulleted, when present]

**Where to look**
- Full report: <path>
- Trace: <path>
- Key evidence: [top 3 file paths or report paths]
```

Tournament variant: replace "Recommendation" with "Tournament selection"
(or "No clear winner") + branch summaries.

Autonomous variant: add "Auto-resolutions" listing checkpoints the runtime
resolved without operator input.

Length cap: ~200-400 words. Plain prose, short sentences, no
project-internal jargon.

### Tournament report variant

When tournament is on, the Options section is replaced by:

```
Tournament/
  Branches             — N proposals (each: option, case, evidence, risks, next-action)
  Comparative Review   — review's tradeoff-question + objections + missing-evidence
  Selection            — selected option (operator-picked OR autonomous-resolved with rationale)
```

The report identity stays the same (`explore-result.json`) — tournament
is an in-shape variant, not a separate report type.

---

## 3. Stage path

Explore traverses five stages in order:

```
Frame  →  Analyze  →  Synthesize  →  Review  →  Close
```

| Stage | Role |
|---|---|
| **Frame** | Produces Subject + success condition (`summary` + `must_answer`). May force-checkpoint when prompt is too vague to bound. |
| **Analyze** | Decomposes the Subject; gathers evidence; produces Findings. |
| **Synthesize** | Produces Options + Recommendation. When tournament is on, fans out to N parallel branches. |
| **Review** | Adversarial pass against the 8-dimension quality rubric. Reviewer connector MUST be distinct from synthesizer. |
| **Close** | Aggregates prior reports, emits Open Questions, writes the final report + three operator-facing surfaces. |

### Depth honoring

Per the cross-cutting axis spec: depth is per-flow honored. Explore's
honoring:

| Depth | Frame | Analyze | Synthesize | Review | Close |
|---|---|---|---|---|---|
| **Lite** | Y | Y | Y (compact) | **Skipped** | Y |
| **Standard** | Y | Y | Y | Y | Y |
| **Deep** | Y | Y (extra evidence-gathering sub-steps) | Y (extra alternative-consideration) | Y (stricter rubric) | Y |

### Tournament honoring

When tournament is on: Synthesize fans out into N parallel branches (default
N=3, capped at 4). Each branch makes the strongest case for one option.
Review becomes the comparative-review-and-tradeoff-checkpoint stage.
Selection happens at the tradeoff checkpoint (operator picks, or autonomous
auto-resolves per the comparative review's recommendation).

### Stages NOT in Explore

- **No Plan stage** — Explore surfaces clarity, doesn't plan execution.
- **No Verify stage** — Explore produces findings, not executable
  reports; nothing to verify mechanically. Review is the quality check.
- **No Act stage** — Explore is read-only on the codebase.

### Drift to reconcile

`contract.md` describes two divergent canonical stage sets. `schematic.json`
compiles to one set. Neither matches this 5-stage path. Reconciling the
contract + schematic + this spec is part of the harden-or-improve worklist.

---

## 4. Posture & checkpoints

Default posture is **long-arc**: the LLM runs end-to-end without operator
input. Operator interaction is the exception, not the default.

### Canonical checkpoints (only these)

1. **Forced-Frame checkpoint** — when Frame cannot produce a defensible
   Subject + success condition (vague or too-large prompt). Operator picks
   from anticipated narrowings via the structured checkpoint protocol.
2. **Tournament tradeoff checkpoint** — when tournament is on and the
   comparative review surfaces a tradeoff for the operator to resolve.
   Operator picks among branches via the structured checkpoint protocol.

Both checkpoints are auto-resolved in autonomous mode (per the autonomous
behavior in the cross-cutting axis spec).

### What posture is NOT

- Not per-stage operator approvals — operator does not approve every stage
- Not back-and-forth chat — the LLM doesn't ask for input when it could
  just produce output
- Not silent — trace stream surfaces progress; operator sees what's
  happening, just doesn't have to respond

### Mid-flight redirection

Not supported in MVP. Operator interrupt aborts the run (trace preserved);
operator starts a fresh run with the redirected prompt, optionally
`--from-run` on the prior partial run.

---

## 5. Scope of investigation

Scope is bounded by the operator's prompt + pointers, not by an arbitrary
project boundary.

| Scope | Always available | When activated |
|---|---|---|
| Current project codebase | Yes | Default for every Explore run |
| Auto-memory | Yes | Auto-loaded; provides operator/project context |
| Web (via host tools) | Yes | LLM uses when relevant; same as any other tool |
| Other local paths | When operator points at them | Prompt names them |
| External repos / URLs | When operator points at them, read-only | Via host file ops, web, GitHub API, etc. |

### Constraints

- **Read-only on everything.** No clones, no writes, no state-changing
  actions to gain access.
- **Memory is first-class evidence.** Memory pointers appear as
  `evidence_refs` alongside file:line cites.
- **Tool failure → structured checkpoint.** When a needed host tool
  fails (web fetch fails, external resource unreachable), use the
  structured checkpoint protocol with anticipated next-step options.

### Run folder location

The report + trace live in the current project's run folder regardless
of how broadly the investigation scope reaches.

---

## 6. Quality bar

Eight dimensions tied to specific failure modes. Review stage scores each
dimension independently as `pass | concern | fail`; overall verdict is
computed from per-dimension scores.

| Dimension | What it catches |
|---|---|
| **Evidence depth** | Invention; cites that don't actually support the claim |
| **Project-specificity** | Generic best practices substituted for project analysis |
| **Insight density** | Restating the prompt; trivial summaries |
| **Actionability** | Vague recommendations |
| **Honest calibration** | Hedge-language masking "I don't know"; stated confidence > evidence weight |
| **Coverage adequacy** | Major angles silently dropped (scored against `must_answer`) |
| **Scope discipline** | Drift into adjacent areas the prompt didn't ask about |
| **Branch distinctness** (tournament only) | Branches that are reskins of one approach |

### Verdict computation

| Per-dimension scores | Overall verdict | Routing |
|---|---|---|
| All `pass` | `pass` | Proceed to Close |
| Any `concern`, none `fail` | `pass-with-objections` | Proceed to Close; objections carried in report |
| Any `fail`, ≤ 2 dimensions | `needs-revision` | Retry Synthesize (autonomous) or abort (otherwise) |
| Any `fail`, ≥ 3 dimensions | `fail` | Abort regardless of mode |

### Report contracts derived from the rubric

- **`evidence_refs` is required and structured.** Each ref has `kind`
  (file/report/memory) + `pointer` + `supports` (what claim it backs).
  Empty arrays are not valid.
- **`Recommendation.confidence` is mandatory when Recommendation is
  present.** Forces explicit commitment to a confidence level.
- **`review-summary` section in the report** carries per-dimension
  scores so the operator sees the quality signal.

### What passes Review as honest-thin

The rubric tests for *fakery*, not *honest limits*. These pass:

- Thin findings in a small codebase (when honest about thinness)
- "I cannot recommend without more info" (when prompt was under-specified)
- Tournament `no-clear-winner` verdict
- Recommendation declined with a clear reason

---

## 7. Failure modes

### Hard refusals (Explore MUST NOT)

- Produce code or code patches
- Modify the codebase (read-only on everything except its own run folder)
- Reach into operator's other projects without explicit pointing
- Invent findings without evidence
- Give a Recommendation when the prompt is asking for understanding
- Proceed past Frame on a too-vague prompt
- Chain into action flows (Build/Fix/etc.) on its own

### Positive obligations (Explore MUST always)

- Produce a report, even on degraded outputs
- Cite evidence for every Finding
- Honor the depth/tournament/autonomous axes per the cross-cutting spec
- Trace what it did (every stage emits its report; every auto-resolved
  checkpoint is recorded)

### Accepted thin outputs (degraded but valid)

- Findings limited because evidence is thin
- Recommendation declined because question is under-specified
- Tournament `no-clear-winner` outcome
- Out-of-codebase subject with `confidence: low` and an Open Question
  flagging the gap

### Hard runtime aborts

- Auth failure on a connector
- Schema-parse / verdict failures past the autonomous retry budget
- Operator interrupt
- Run-budget exhausted
- Forced-Frame checkpoint cannot be answered (operator declines, or
  autonomous can't safely commit)

---

## 8. Hand-off & composition

Explore stops at Close. The operator reads the report, decides whether
to act, and invokes the next flow themselves. **No auto-chaining.**

### Structured next_action

Recommendation includes a structured `next_action` field:

```json
{
  "recommendation": {
    "summary": "...",
    "confidence": "medium",
    "next_action": {
      "flow": "build",
      "goal": "implement the inventory relay step using the codex adapter",
      "depth_hint": "standard",
      "tournament_hint": false
    }
  }
}
```

When Recommendation is omitted (explanatory prompts), `next_action` is
also omitted.

### Cross-flow consumption

Per the cross-cutting `--from-run` spec: action flows MAY consume an
Explore report via `--from-run <explore-run-folder>`. Explore's
`explore-result.json` is shaped to support this consumption. Mechanics
live in the cross-cutting spec, not here.

---

## 9. Mode-axis behavior in Explore

### Depth

Per cross-cutting spec semantics. Explore-specific honoring is in §3
(Stage path > Depth honoring).

### Tournament

Per cross-cutting spec semantics. Explore-specific defaults:

- **Default N = 3 branches.** Caps at 4 per cross-cutting spec.
- **Fanout point: Synthesize stage.** Branches argue independently;
  Review converges via comparative review.
- **Tournament-not-applicable handling:** when prompt is non-decision-shaped
  but tournament is requested, structured checkpoint to confirm
  proceed-non-tournament; default proceed-non-tournament with note in Open
  Questions.

### Autonomous

Per cross-cutting spec semantics. Explore-specific behaviors:

- Forced-Frame checkpoint: Frame commits to best-guess Subject with
  `confidence: low` and proceeds
- Tournament tradeoff checkpoint: auto-pick per comparative review's
  recommendation; if review verdict is `no-clear-winner`, default to
  commit-with-flag (highest-scoring branch with low-confidence marker)
- Verification-fail retries: re-run Synthesize with Review's objections as
  input, within the depth-scaled retry budget

---

## 10. Edge case behaviors

| # | Edge | Behavior |
|---|---|---|
| 1 | Vague prompt | Forced-Frame checkpoint via structured-question protocol with anticipated subjects. Autonomous: best-guess Subject with `confidence: low`. |
| 2 | Mixed prompt ("explore X and then fix Y") | Honor explore portion only. Recommendation names action flow as `next_action`. No chaining. |
| 3 | Out-of-codebase subject | Use web seamlessly via host tools. On tool failure, structured checkpoint (try again / proceed without / abort). |
| 4 | Codebase too small to investigate | Proceed with honest-thin output. Findings short, Recommendation declines or low-confidence. |
| 5 | Operator interjects mid-flight | Interrupt aborts; trace preserved; operator runs fresh with redirected prompt (optionally `--from-run`). No mid-flight redirection in MVP. |
| 6 | Subject too large | Forced-Frame checkpoint to narrow. Autonomous: pick most-evidence-rich slice, note in Open Questions. |
| 7 | Cross-project dependencies | Explore reaches into named external resources via read-only host tools. On unreachable resource, structured checkpoint. |
| 7a | External resource unreachable read-only | Structured checkpoint: clone/auth manually then rerun / proceed without / abort. Autonomous default: proceed without with `confidence: low`. |
| 8 | Prompt asks for action work directly | Honor explore portion only. Recommendation names action flow. Hard refusal on writes. |
| 9 | Tournament with no plausible alternatives | Structured checkpoint to confirm proceed-non-tournament. Autonomous default: proceed-non-tournament with note. |
| 10 | All tournament branches fail Review | Honest report with no Selection. Open Questions explains impasse. Autonomous behaves the same. |
| 11 | Memory has strong opinions on topic | Memory is first-class evidence. Findings surface tension explicitly when memory contradicts prompt premise. |
| 12 | Re-explore (operator wants follow-up) | Always a fresh run, optionally `--from-run` prior. Run folders are immutable. |

---

## 11. Run folder lifecycle

### Organization (in scope for MVP)

```
.circuit-next/runs/
  explore/
    2026-05-08/
      T1432-auth-session-investigation/
      T1605-server-component-research/
    2026-05-07/
      ...
```

- **Top-level grouping by flow** (`explore/`, `fix/`, etc.)
- **Second-level grouping by date** (`YYYY-MM-DD`)
- **Run folder name:** `T<HHMM>-<slug>` where slug derives from Subject
  (or prompt) for navigability

### Out of scope for MVP

- Automatic cleanup
- CLI discovery surface (`runs list / show / clean`)
- Index/registry

These earn their way back when growth or discovery becomes painful on real
usage. Current state is "no organization, no cleanup, no CLI" — adding
organization+naming alone is the minimum-viable improvement.

### Constraints

- Run folders are gitignored (`.circuit-next/` is in `.gitignore`)
- Per-machine; not multi-machine
- Never mutated after a run completes (re-explore is a fresh run, not an
  in-place reopen)

---

## 12. Naming

The flow is named **Explore**. Slash command: `/circuit:explore`.

Rationale: matches the openness of direction uncertainty; action-neutral;
already in the operator's vocabulary; friendly verb on thorough flow is
preferable to a heavy verb (Investigate / Diagnose) that scares operators
away from a useful tool.

---

## 13. Reconciliation needed with current implementation

The harden-or-improve worklist for the next stage. None of these are
addressed by this spec; they are the diff between this spec and current
code.

1. **Flat `Depth` enum → 3-axis decomposition.** Today's
   `Depth = z.enum(['lite', 'standard', 'deep', 'tournament', 'autonomous'])`
   collapses three orthogonal concepts. Refactor to `Depth` (lite/standard/deep)
   + `tournament: bool` + `autonomous: bool`.
2. **Contract drift.** `src/flows/explore/contract.md` describes two
   canonical stage sets; `EXPLORE-I1` enforces only one; `schematic.json`
   compiles to that one. Neither matches the 5-stage path here. Reconcile.
3. **HTML projector is tournament-only.** `exploreTournamentProjector`
   today renders only tournament-shape data. Extend to handle
   non-tournament Explore (Subject + Findings + Options + Recommendation +
   Open Questions + review-summary).
4. **Operator-summary markdown structure.** Today's markdown shape needs
   alignment with the §2 markdown structure (5 sections, plain prose,
   ~200-400 words).
5. **Frame's success-condition shape.** Today's Frame may not produce the
   structured `summary + must_answer` shape. Add to schema.
6. **Quality rubric.** Review today scores against `explore.review-verdict@v1`.
   Replace with 8-dimension per-dim scoring + computed verdict.
7. **Run folder organization.** Today flat under `.circuit-next/runs/<run-id>`.
   Move to flow + date + timestamp+slug structure.
8. **Tournament default N.** Confirm today's default; set to 3.
9. **--web flag.** Remove if present; web becomes implicit via host tools.
10. **`evidence_refs` structure.** Today may be loose strings; tighten to
    structured `{kind, pointer, supports}` objects.

The four cross-cutting specs (axis model, --from-run, structured
checkpoint protocol, host-tool assumption) need their own spec documents
before reconciliation begins, since this Explore spec depends on them.

---

## 14. Reopen conditions

This spec is reopened if any of:

1. **The trigger condition shifts.** If "direction uncertainty" stops
   being the canonical trigger (e.g., we discover Explore is being used
   for understood-action prep), reopen §1.
2. **Cross-cutting specs land with shapes that conflict with assumptions
   here.** This spec assumes specific shapes for the 4 cross-cutting
   capabilities; if the cross-cutting specs differ, reconcile.
3. **A new failure mode emerges in dogfooding** that the rubric doesn't
   catch. Add a 9th dimension or rework existing ones.
4. **Tournament default N changes** based on real usage data.
5. **Operator-summary surfaces grow** — e.g., a fourth surface (TUI? Slack
   message?) is added.
6. **A second flow's intent spec** reveals a block that should
   generalize (e.g., a different success-condition shape that fits all
   flows).

---

## Authority

- This spec — for intent
- Cross-cutting spec docs (forthcoming) — for axis model, composition,
  checkpoint protocol, host-tool assumption
- `src/flows/explore/contract.md` — for the implementation contract
  (must be reconciled with this spec)
- `src/flows/explore/schematic.json` — for the compiled flow shape
  (must be reconciled with this spec)
