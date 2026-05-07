# Self-improving Circuit

Idea seed for a learning loop in Circuit workflows. Captured 2026-05-07
from a conversation prompted by Browserbase's autobrowse article
(https://www.browserbase.com/blog/autobrowse).

## The trigger

Autobrowse runs a browser task end-to-end, studies the trace, iterates
on a `strategy.md` scratchpad until results plateau (3–5 loops), then
graduates the winning approach into a reusable `SKILL.md` plus
deterministic glue. Their pitch: agents stop paying the discovery tax on
every run, and the skill library compounds. Their Craigslist example
shows ~45% cost reduction per run after graduation.

The question this raised: is there a self-improving / compounding
learning shape Circuit should adopt?

## The shape that fits Circuit

Autobrowse's graduation produces new artifacts (one SKILL.md per site).
For an engineering workflow that direction is wrong — sprawling
auto-generated skill files nobody trusts is a real failure mode,
especially as Circuit heads toward marketplace publishing.

Better shape for Circuit: at the end of a workflow, evaluate whether
anything we learned should update an existing doc the operator already
maintains (AGENTS.md, repo guides, auto-memory).
The operator declares which docs are "learning targets"; Circuit
proposes diffs. Existing curation stays intact. Docs get sharper over
time instead of rotting.

This inverts the autobrowse model: instead of "agent emits a new
artifact," it's "agent proposes a diff to an artifact the human already
owns."

## Design constraints to get right

**Fire on signal, not on completion.** If the step runs every Close
phase and the bar is low, you'll get doc thrash and the operator stops
reading the proposals. Strong signals worth firing on:

- Surprises (something AGENTS.md implied was wrong)
- Recurring gotchas (we hit the same friction twice)
- Confirmed patterns (a non-obvious approach got operator endorsement at
  Review)

Routine successful work shouldn't fire it at all. Default to "no
proposal worth making."

**Propose a diff, never auto-apply.** Matches the existing rule about
not editing finalized things without explicit go. Step output is a
small "here's what I'd change in `<file>` and why." Operator says
yes / no / edit.

**Unify with auto-memory, don't parallel it.** Auto-memory already has
the "is this worth saving" judgment. Treat the new step as the same
judgment with a different target chooser: at end-of-run, evaluate "did
we learn something durable, and if so, where does it belong —
auto-memory (cross-project, about the operator or process) or a repo
doc (project-specific, about this code)?"

## Honest tradeoff

This is a fuzzier learning loop than autobrowse's. Autobrowse measures
convergence via cost-per-run; doc updates are a human judgment call.
The value compounds slowly. The win is less "10x speedup on recurring
tasks" and more "AGENTS.md and the repo guides stay accurate as the
codebase evolves" — agent-maintained living documentation instead of
doc-rot.

That might be the right value prop for Circuit. Doc-rot is the
universal failure mode of every project; a workflow runner that
actively keeps its own guidance sharp would be a real differentiator.

## What to prototype

A `learn` step type that runs after Close. Inputs:

- List of target docs (workflow config; defaults could be AGENTS.md +
  auto-memory)
- Run trace / Close summary
- Operator review signal (was the approach endorsed?)

Output: at most one structured proposal per run. If nothing strong to
say, say nothing. Operator reviews and accepts / edits / discards.

Stress-test before committing to build:

1. Run a few real workflow batches with a manual stand-in for the step
   (post-hoc: "what would I have proposed updating?").
2. Check whether the proposals would have been worth reading or noise.
3. If signal-to-noise is good, build the step. If not, the trigger
   threshold is the wrong problem to solve and the idea needs rework.

## Open questions

- What does the proposal artifact look like? Inline diff in the Close
  summary, or a separate review surface?
- Cross-run reinforcement: should a proposal require N runs of
  evidence, or is one strong run enough?
- Does the operator pre-declare learning-target docs in workflow
  config, or does Circuit infer them from repo conventions
  (AGENTS.md, README, files under `docs/`)?
- How does this interact with `circuit:create` (which already publishes
  user-global custom workflows)? Is graduation-into-a-recipe a separate
  follow-on, or out of scope for this idea?
