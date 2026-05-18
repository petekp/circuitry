# Cloudflare Project Glasswing - public confirmation of the harness bet

Notes from a read of Lucas Meijer's 2026-05-18 tweet
(https://x.com/lucasmeijer/status/2056471009239117947) and Cloudflare's
"Project Glasswing: what Mythos showed us" post
(https://blog.cloudflare.com/cyber-frontier-models/).

This is one of the clearest public confirmations so far of the approach
Circuit has been moving toward: narrow tasks, reusable blocks, typed evidence,
independent review, and an orchestrating harness around strong coding agents.

## What the source says

Lucas's read of the Cloudflare post is that narrow LLM tasks composed as blocks
produce better results than just asking the model. The important part is not
the metaphor. It is the work shape: break the problem into scoped units, pass
structured state between them, and compose the results.

Cloudflare's post gives the concrete example. Their security team first tried
pointing a generic coding agent at a repository and asking it to find
vulnerabilities. That produced findings, but not enough useful coverage or
signal. The bottleneck was not only model quality. It was the interaction
shape:

- one agent session tends to follow one focused stream of work;
- vulnerability research needs many narrow hypotheses across many components;
- a broad prompt causes wandering and noisy findings;
- useful security triage depends on proof, reachability, validation, dedupe,
  and structured reporting.

Cloudflare's answer was a harness. It runs a recon pass, creates narrow hunt
tasks, validates findings with an independent agent, re-queues uncovered areas,
deduplicates root causes, traces reachability, feeds confirmed traces back into
new tasks, and writes structured reports against a schema.

## Why this matters to Circuit

This is not just a security-scanner story. It confirms a general product bet:
as models get stronger, the surrounding work shape matters more, not less.

The winning unit is not "one smarter chat." The winning unit is a harness that
can:

- scope work before acting;
- send different stages through the right role or worker;
- preserve state outside the model's transient context;
- require evidence before advancing;
- independently challenge results;
- recover or re-queue when coverage is incomplete;
- close with structured reports instead of loose prose.

That is close to Circuit's core architecture. Circuit already treats a flow as
stages and blocks, writes typed reports, keeps run folders, supports
checkpoints, separates implementation from review, and aims to close with
evidence. The public lesson strengthens those bets.

## Mapping to Circuit

| Cloudflare harness lesson | Circuit translation |
|---|---|
| Broad repo prompt wanders. | Frame and Gather Context should narrow the task before Act or Review. |
| Narrow scoped tasks produce better findings. | Blocks should have clear inputs, outputs, checks, and routes. |
| Independent validation reduces noise. | Review should stay a separate role with fresh context. |
| Proof beats speculation. | Verify and close-with-evidence are product primitives, not ceremony. |
| Coverage needs many small passes. | Pursue, Queue, Batch, and Coordinate Pursuits are the right direction for larger work. |
| Dedupe and trace turn raw findings into decisions. | Circuit needs stronger issue identity, reachability, and "same root cause" handling for future review/fleet work. |
| Structured reports beat free-form prose. | Zod reports, run folders, and evidence links should remain central. |

## What to borrow

### Harness-first positioning

Circuit should describe itself less as a better prompt wrapper and more as the
harness around coding agents. The model does the reasoning and tool use. Circuit
owns the shape of the work: scope, sequence, proof, review, recovery, and
operator-facing evidence.

### Coverage as a first-class problem

Cloudflare's most important point is that a single session cannot cover a large
surface in a useful way. Circuit's current Build/Fix/Review flows are strongest
for focused work. For larger goals, Pursue should evolve toward explicit
coverage accounting:

- what areas were inspected;
- what areas were skipped;
- what should be re-queued;
- which findings share a root cause;
- which claims have proof and which remain hypotheses.

### Independent disagreement, not self-review

Cloudflare reports that an independent validator with a different prompt catches
noise the original finder misses. Circuit should keep protecting this boundary:
implementation and review are different roles, and review should not inherit the
implementer's private reasoning.

### Structured ingest, not narrative closeout

Cloudflare's final report stage writes to a predefined schema. Circuit's close
step should keep moving in that direction. The operator-facing summary can be
plain English, but the durable record should stay queryable and typed.

## What not to overclaim

This does not prove that "multi-agent is always better." It proves that
decomposition helps when the task is naturally narrow, parallel, evidence-heavy,
and coverage-bound. For small sequential code changes, extra roles can still add
overhead.

This also does not prove Circuit already has the full Cloudflare shape.
Cloudflare's harness has dynamic fanout, gapfill, dedupe, reachability tracing,
and structured ingest at security-team scale. Circuit has the right substrate,
but only some of that behavior is implemented today.

## Product implication

The public claim Circuit should be able to prove is:

> Circuit helps coding agents produce more trustworthy outcomes by decomposing
> work into scoped blocks, requiring proof, independently reviewing results, and
> handing the operator structured evidence instead of another loose transcript.

That is stronger and more durable than "Circuit makes the model smarter."

## Follow-up pressure

- Add benchmark tasks that stress decomposition, proof, and review against a
  strong vanilla prompt.
- Add coverage accounting to Pursue before claiming larger-work superiority.
- Treat dedupe, traceability, and re-queueing as future fleet-level blocks.
- Keep final claims bounded: Circuit should win where the work benefits from
  harnessed composition, not on every possible coding-agent task.
