# Agent Flywheel — what we'd borrow, what we'd skip

Notes from a read of https://agent-flywheel.com/complete-guide on
2026-05-07. The post pitches an "Agentic Coding Flywheel": a
methodology for orchestrating a swarm of fungible coding agents to ship
software fast, by spending ~85% of the work in upstream planning and
~15% in mostly-mechanical execution.

Relevant takeaways for Circuit:

## What the source is

A long-form guide written by an operator who runs many coding agents
in parallel, all committing to `main`, coordinated through a small
stack of homegrown tools (Beads for tasks, Agent Mail for file
reservations, bv for graph triage). The methodology is
swarm-coordination-heavy. The premise is that planning tokens are far
cheaper than implementation tokens, so it's worth spending many model
rounds polishing a plan before any code gets written.

## What's worth borrowing

### The 1x / 5x / 25x rework-cost framing

The post names three reasoning spaces and asserts a rough cost ratio:
**Plan space (1x), Bead space (5x), Code space (25x)**. A change made
in the plan is roughly 25x cheaper than the same change made in code.

Circuit already encodes this intuition in its stage ordering
(Frame → Plan → Act, then Verify → Review → Close), but we've never
*named* the cost ratio. Naming it would sharpen depth choice:
"this is a Deep task because the cost of being wrong in code is
high, so we pay more upstream." It's a framing tool, not new
machinery — exactly the kind of thing that fits our cut-not-patch
default.

### Convergence metrics for ending a polish loop

Their guidance for when to stop polishing a plan: stop when content
similarity is rising, output size is shrinking, and change velocity is
slowing. These are concrete signals, not gut-feel.

Circuit's iteration loops — Explore polish, relay
implement/review/converge — currently terminate on gut-feel or fixed
caps. A "diminishing returns" check would be a small heuristic, not a
new file, and it would prevent two failure modes we already see:
stopping too early because the loop felt slow, and grinding past the
point where the model is just rephrasing itself.

### Fresh-eyes review on the *plan*, before implementation

Their "Check Your Beads N Times, Implement Once" practice says: before
launching anyone to write code, run a fresh-context agent over the
plan looking for duplicates, missing dependencies, and incomplete
context.

We already do hostile fresh-context review post-commit (the
adversarial subagent batch). Adding the same review on the plan side,
before code gets written, is a stage-ordering tweak inside Build and
Fix. No new infra. The cost ratio above justifies it: catching a
plan defect at 1x is much cheaper than catching the same defect at
25x in code review.

## What we'd skip, and why

### Beads — a persistent JSONL task graph with PageRank triage

Beads are durable task records committed to the repo, with dependency
edges, queryable via a CLI that ranks tasks by graph centrality. It's
genuinely clever — but it's swarm coordination machinery. Its
purpose is letting many fungible agents pick the next-best-unblocked
task without colliding.

Circuit is a solo-operator plugin. There's no swarm to
coordinate, no contention to resolve. Adopting Beads here would mean
authoring a JSONL task graph for tasks that one operator + one Claude
session can already hold in working memory. That's exactly the
ceremony we deliberately stripped (ADRs, plan-lint, ratchets) and
should not re-introduce without a concrete cost-of-absence story on
real product work.

### Agent Mail and single-branch file reservations

Their model is: every agent commits directly to `main`, and conflicts
are prevented by an out-of-band reservation system (Agent Mail) plus
pre-commit guards. Solves a real problem if you have ten agents
editing the same repo at once. We don't.

### The Idea-Wizard pipeline (30 ideas → winnow to 5 → expand to 10 → human review)

A six-stage wizard for adding a feature to an existing project.
Generates 30 candidate ideas, narrows to 5, expands those, asks the
operator to pick. It's a structured brainstorm.

For Circuit, this is over-engineered — our Explore flow
already covers "shape an execution plan" and our operator has a sharp
sense of what to build. Generating 25 throwaway ideas to discard is
the kind of churn the methodology strip was meant to prevent.

### 4–6 dedicated polish cycles as a default

Their recommendation to polish plans through 4–6+ fresh-context
review sessions before implementing. Reasonable for a 3,000–6,000
line plan that will drive 200–500 beads of swarm work. Severe
overkill for the size of work Circuit typically handles. The
convergence-metrics idea above is the steerable version of this; the
fixed cycle count is not.

## The real disagreement: agent fungibility vs adapter specialization

The flywheel's strongest architectural claim is **agent fungibility**:
all agents are generalists, all read the same [AGENTS.md](../../AGENTS.md), all are
interchangeable. No specialist roles, no boss agents, no coordinating
roles that become bottlenecks. Crash recovery is automatic because
any agent can pick up any bead.

Circuit's design is the opposite: we have specialized adapters
(agent vs codex), specialized flows (Build vs Fix vs Review),
specialized depth profiles, and relay routing that picks the right
runtime for the shape of the work.

A flywheel partisan would call this coordination tax — every
specialization is a place where work has to be routed correctly or
gets stuck. We'd call their fungibility a waste of differentiated
runtime strengths (Codex's read-only sandbox, Claude's tool surface,
the depth gradient).

These can both be right under different conditions. Their bet pays
off when you have many cheap fungible workers and the bottleneck is
coordination overhead. Ours pays off when the operator is the scarce
resource and routing-by-shape lets one human direct work without
having to think about adapter mechanics.

Worth holding this tension in mind next time we touch the relay
layer. If we ever find ourselves adding a fifth or sixth adapter
distinction, the flywheel argument is the one to stress-test against.

## Status

Captured for reference. Nothing to action immediately. The two small
borrowable items (cost-ratio framing, convergence metrics) can ride
along whenever we next touch the relevant docs or circuits — they
don't need a dedicated batch.
