# Align flow — operator/model intent alignment

Idea for a Circuit flow dedicated to establishing and maintaining
shared understanding of project goals, principles, and intent — the
foundational context that prevents agent drift over the long run.
Captured 2026-05-07.

## The gap this fills

Circuit currently has nothing upstream of task work. AGENTS.md and
CLAUDE.md capture procedural guidance — how we work. Auto-memory
captures fragmentary facts as they emerge. Neither carries the
philosophical foundation: what we're building, for whom, why it
matters, what would count as failure, what we'd refuse to do even if
asked.

That foundation gets re-derived implicitly every session, which is
when drift happens. A new agent reads the code, infers intent from the
code, makes decisions consistent with what's there rather than what
was meant. Drift compounds across sessions until the project is no
longer the project the operator started.

The align flow exists to make that foundation explicit, durable,
and actively consulted.

## Grounded in validated practice

This flow is not hypothesis. It formalizes a habit the operator
has already proven valuable across projects: running an exhaustive
interrogation (using the existing `grill-me` skill, sometimes 80+
questions, sometimes consuming a full work day) at the start of any
project worth real investment, and answering every single question.

Reported payoff:

- Deepens the operator's own thinking by surfacing implicit beliefs.
- Aligns the model's understanding over the entire lifetime of the
  project, not just the current session.
- Has never been regretted in practice, despite the cost.

The align flow exists to (a) make this practice repeatable and
structured, (b) preserve its outputs as durable docs the codebase
can carry forward, and (c) wire those docs into future runs so
the day's investment keeps paying off rather than fading after the
session that produced it.

## The shape

The trap is making this a one-shot vision-doc generator. Vision docs
that nobody reads are worse than nothing — they create false
alignment. Better shape: structured interrogation, stress-testing of
the result, then explicit wiring so the docs get consulted in
future runs.

Stages:

- **Frame** — what triggered this run? Greenfield, in-flight drift,
  pivot, post-incident realignment? Each starts from different ground.
- **Surface** — pull what already exists. AGENTS.md, README,
  auto-memory, prior decisions, the codebase itself. Identify implicit
  principles that are operating but unstated, and contradictions
  between stated and actual practice. The diagnostic step.
- **Interrogate** — the heart. Agent grills operator on: success,
  failure, audience, refusal, default tradeoffs, where to be slow vs
  fast. Iterative and tree-shaped, not a flat checklist: initial
  broad probes, then deeper passes on the load-bearing answers, with
  explicit "I notice tension between your answer to X and your answer
  to Y, which is more load-bearing?" prompts. Modeled on the existing
  `grill-me` skill, scaled up to project scope. Plan for 60–80+
  questions on a serious project — depth is the value, not a cost to
  minimize.
- **Draft** — draft docs and preserve the raw interrogation
  transcript as a first-class doc alongside them. The distilled
  principles lose nuance the answers themselves carry; future agents
  reading the docs need to be able to fall back to the source when
  the distilled version is ambiguous. Drafting is real thinking
  about implications and contradictions, not transcription.
- **Stress-test** — run docs against hypothetical decisions.
  "Given these principles, what would you decide about X?" If operator
  and document disagree, the document is wrong or a principle is
  unstated. Repeat until stable.
- **Wire** — decide how the docs get consulted in future runs.
  The often-skipped step. Without this, the docs become
  decoration.
- **Close** — docs land, pointers added, optional recurring
  audit-self cadence scheduled.

## The docs — fewer is better

Each doc that exists is a doc that has to stay current. Resist
producing a comprehensive set. Strong candidates, ordered by leverage:

1. **Intent / vision** — what we're building, for whom, what success
   looks like in concrete terms. Plain language. Read-out-loud test.
2. **Non-goals** — what we're explicitly not doing and why. Often more
   decision-shaping than the goals doc. Prevents mid-run scope creep.
3. **Principles** — philosophical commitments that resolve tradeoffs.
   ("Default cut, not patch" is exactly this kind of principle and is
   in auto-memory already — would be more durable as a project-level
   principle.)
4. **Decision boundaries** — what kinds of choices belong to the
   operator vs the agent. The governance split. Already present in
   auto-memory; belongs at the project level too.
5. **Anti-patterns** — known wrong directions. "If you find yourself
   doing X, stop and check in." Cheap and high-value.

Glossary / ubiquitous-language is a possible sixth, but probably
composes from the existing skill rather than being native to this
flow.

The operator picks which docs matter for the project at hand.
Empty placeholders are forbidden — if a doc isn't worth filling in,
don't produce it.

## Interrogation UX — improve on grill-me

`grill-me` proved the value of deep interrogation. The align flow
should learn from it and improve on the UX, hooking into adapter-
specific UI controls where available. In Claude Code that means
`AskUserQuestion` — structured Q/A with predicted answers, not free-
text barrage.

**The core upgrade: predicted answers.** Free-text "what does success
look like?" is expensive for the operator and low-signal for the
agent. Predicted-answer Q/A — "based on the codebase and conversation
so far, success looks like one of these three; which is closest?" —
is cheaper for the operator (recognition vs recall) and higher-signal
for the agent because the *predictions themselves* are alignment
proof. Off predictions = agent doesn't yet understand the project,
caught before docs are drafted. Close predictions = alignment
already high. Either way, more signal than free-text alone.

**Specific UX upgrades to design for:**

- **Predicted-answer Q/A as the default question shape.** For each
  question the agent commits to 2–4 specific predicted answers (with
  one marked recommended if appropriate) plus the operator's free-
  text escape hatch. The 2–4 ceiling is a feature — forces the agent
  to commit to a real model rather than hedge with vague options.
- **Preview affordance on load-bearing options.** Render a snippet of
  what the *doc* would say under each option ("if you pick A,
  the principles doc would commit to X"). Operator picks between
  concrete consequences, not abstractions. Catches drift before
  drafting, not after.
- **Themed batches with incremental drafting.** Chunk into clusters
  (audience, success/failure, tradeoffs, refusals, anti-patterns),
  4–8 questions per batch. Draft between batches so later
  batches are informed by earlier answers, not pre-planned.
- **Tension surfacing as a first-class question.** When a later
  answer contradicts an earlier one, the agent doesn't smooth over —
  it explicitly asks "these are in tension, which is more load-
  bearing?" Modeled on the best of grill-me; surfaced via the same
  Q/A control.
- **Save / park / skip.** Each question has an explicit "park, want
  to think more" option. Parked questions land in a follow-up list at
  session end. Stamina-friendly without lowering depth.
- **Live doc preview between batches.** Operator sees the
  docs taking shape and can catch "wait, that's not what I
  meant" before final drafting.
- **Right question shape per question.** Not every question wants to be
  multiple-choice. Some questions genuinely need free-text depth
  (e.g., "describe the user you're building for") and forcing
  multiple-choice would flatten the value. The flow picks the
  right question shape per question: predicted-answer Q/A when the agent
  has enough context to commit to options, free-text grill-me-style
  for genuinely open questions, hybrid where appropriate.

**Adapter portability.** `AskUserQuestion` is a Claude Code
control. Other adapters (Codex, future host integrations) will need
graceful degradation to terminal prompting or other mechanisms.
Design the flow with the rich UI as the preferred path, not the
only path.

## The drift-prevention mechanism — the part that matters most

Most vision-doc efforts fail because the docs exist and nothing
consumes them. The docs only prevent drift if a mechanism uses
them. Options:

- **Auto-pulled at Frame** — every flow's Frame stage reads them
  in. Simple but noisy on small tasks.
- **Decision-checkpoint** — when a flow hits a load-bearing
  decision, it explicitly checks against the align docs. Composes
  well with the `assumption-check` step idea.
- **Drift detector (`compass-check`)** — a step that compares the
  current direction against documented intent mid-run and flags
  divergence. Preventive and active, not just available.
- **Embedded in depth** — Deep mode pulls align docs; Lite
  skips. Avoids noise on small tasks.

The drift detector is the mechanism that would justify the upfront
investment. Without it, the flow is theater.

## When it runs vs when it doesn't

Earns its weight only on:

- Greenfield projects worth real time
- In-flight projects already drifting, where the operator can name
  the drift
- Initiatives where many agent sessions will work over weeks or months
- Projects where the operator has strong implicit principles that
  haven't been surfaced

Should never auto-route from `circuit:run` for routine tasks. Operator
invokes explicitly. Router should refuse to assume a task is
align-worthy without an explicit signal.

## Honest tradeoffs

**Depth is the feature, not a cost.** The investment of a day and
60–80+ answered questions is the value-prop. A "lighter" version that
trims interrogation depth produces lighter docs that don't carry
the alignment weight the project needs. The flow's failure mode
isn't "too long" — it's a short-circuited operator who answers
questions superficially. The flow should be willing to refuse to
produce docs if engagement is shallow.

**Risk of premature commitment.** Pinning principles too early can
ossify a project before the operator knows what they actually
believe. Docs should be living, with explicit "revisit on X
trigger" markers — not frozen.

**Pedagogical bonus, not just doc production.** Structured
interrogation about implicit beliefs has value beyond the docs — it
surfaces what the operator actually thinks. Worth naming as a goal of
the flow, not just a side effect.

## Naming note

This flow has the strongest claim on the name `align` (aligning
operator and model intent — close to the dictionary meaning). The
earlier idea of an `align` flow for converging divergent code
patterns should be renamed to `converge` if both ship. The drift
detector step is `compass-check` regardless.

## Relationship to other ideas

- **Relates to `learn` step** (see `self-improving-circuit.md`) —
  `learn` could be the mechanism that keeps align docs current
  over time. End-of-run evaluation: "did anything we learned today
  invalidate or strengthen something in the align docs?"
- **Relates to `recall` step** — `recall` at Frame would naturally
  pull align docs into context. The wiring question above is
  partly answered by an existing `recall` design.
- **Relates to `audit-self`** — periodic check that the align
  docs haven't drifted from current practice.

## What to prototype

Before building the flow, prove the concept by running it manually
once on circuit-next itself. The repo already has fragments scattered
across AGENTS.md and auto-memory; consolidating them into draft
align docs would test whether the drafted docs add real value or
just rearranges what's there.

Steps for the manual prototype:

1. Operator and agent run the Surface stage by hand — list every
   implicit principle currently operating, with source.
2. Run a compressed Interrogate session against gaps and contradictions,
   using `AskUserQuestion` with predicted answers as the primary
   question shape.
3. Draft the five doc candidates (or fewer, if some don't earn
   their place).
4. Stress-test against three real recent decisions from circuit-next
   history. Did the docs predict the decision the operator actually
   made?
5. If yes, the flow has signal. Build it.
6. If no, the bar for what counts as a useful doc needs rework
   before tooling investment.

## Open questions

- How does the flow handle disagreement between operator answers
  given on different days? (Versioning? Re-interrogation? Last-answer-
  wins?)
- Should align docs be checked into the repo, or kept in a
  separate operator-private location? Some docs feel
  team-shareable, others feel like private operator notes.
- What's the right cadence for `audit-self` against align docs?
  Triggered by N runs? Calendar interval? Detected drift?
- For multi-operator projects (future), how does this flow handle
  divergent intent between operators?
- For non-Claude-Code adapters, what's the degraded interrogation UX?
  Plain terminal Q/A is one option; a structured TUI another. Worth
  designing the flow's question-spec format to be control-
  agnostic so each adapter can render it natively.
