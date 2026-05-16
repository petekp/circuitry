---
name: flow-research-intake
description: Rubric for turning prior-art research into circuit-next flow design decisions.
type: product-architecture
date: 2026-04-28
status: active
authority: guidance
---

# Flow Research Intake

This document is the landing pad for the deep prior-art research now in flight.
Its job is to keep the research useful. We are not looking for a bigger list of
tools; we are looking for lessons that help Circuit become a better flow
system.

## What We Are Trying To Learn

Circuit should not aim for an exhaustive list of named flows. The better
question is:

> What small set of reusable blocks lets people assemble trustworthy AI coding
> flows without turning the product into a generic box-and-arrow builder?

The research should help us decide:

- which flow blocks are missing or named poorly;
- which block interfaces need to be typed more carefully;
- how schematics should compose blocks;
- how much branching should be allowed;
- how human decisions should work across Claude, Codex, and non-interactive
  hosts;
- how evidence should be stored so humans can understand outcomes without
  reading raw step logs;
- how connectors can preserve each host's strengths without collapsing into the
  weakest shared feature set.

## What Counts As A Useful Finding

A useful finding should change a design choice, sharpen a risk, or give us a
testable pattern.

Good findings look like this:

- "Temporal shows why durable execution and replay are separate from business
  logic. Circuit should keep durable run state below flow schematics."
- "BPMN human tasks are useful, but freeform process diagrams become hard to
  govern. Circuit should expose named decision points, not arbitrary graph
  editing first."
- "LangGraph's typed state idea maps well to Circuit blocks, but Circuit
  should keep final evidence reports stable and inspectable instead of hiding
  everything inside agent memory."
- "SWE-agent and OpenHands prove that coding agents need tight loops around
  tests, patches, and environment state. Circuit's Verify and Review blocks
  should treat command evidence as first-class data."

Less useful findings look like this:

- "Tool X has agents."
- "Tool Y supports flows."
- "Tool Z has a nice UI."

Those can still be sources, but we need the concrete lesson underneath.

## Research Intake Template

Use this shape when importing the research result into our own notes.

| Field | What To Capture |
|---|---|
| Source | Official docs, repo, paper, or design writeup. |
| Category | Durable flow, business process, AI agent framework, coding agent, CI, or other. |
| Core idea | The shortest plain-English description of the system. |
| Circuit relevance | Why this matters to Circuit specifically. |
| Block lesson | Which reusable block it informs: Frame, Diagnose, Act, Verify, Review, Human Decision, Queue, Batch, Close, Handoff, or a missing block. |
| Composition lesson | What it teaches about schematics, typed state, allowed routes, or branch control. |
| Evidence lesson | What it teaches about reports, logs, replay, proof, review, or final summaries. |
| Human loop lesson | What it teaches about questions, approvals, defaults, pauses, escalation, or unattended mode. |
| Connector lesson | What it teaches about supporting multiple hosts without flattening their differences. |
| Borrow | What Circuit should copy directly. |
| Adapt | What Circuit should use with changes. |
| Reject | What Circuit should avoid. |
| Decision pressure | Which open Circuit decision this source should influence. |

## Design Questions To Answer After Research

These are the questions we should answer before adding many more built-in
flows.

1. What is the smallest durable interface for a block?
2. Should schematic files name block types directly, or use higher-level
   aliases like "bug-fix diagnosis" that expand into blocks?
3. Should branches be exposed to users, or mostly appear as named outcomes from
   checks?
4. How should a Human Decision block behave in four cases: interactive
   Claude, interactive Codex, unattended mode, and non-interactive CI-like mode?
5. Which output should every block produce: a detailed step report, a
   short human summary, or both?
6. Which parts of a flow are declarative config, and which require code?
7. How do model and effort settings attach to blocks without making schematics
   noisy?
8. How do we let custom flows reuse blocks without letting invalid
   combinations parse?
9. What should the first user-authored flow format look like?
10. Which named flows justify their own schematic, and which should become
    special cases of broader blocks?

## Working Product Bets

Treat these as hypotheses to test against the research, not settled doctrine.

| Bet | Why It Seems Right | What Could Disprove It |
|---|---|---|
| Schematics over freeform graphs | Users need understandable flow shapes, and the runtime needs bounded routes. | Prior art shows users can safely author expressive graphs without making review, debugging, or safety much harder. |
| Typed evidence over prose blobs | Later steps should consume facts, not scrape text. | Prior art shows strict reports make useful flow authoring too slow or brittle. |
| Branches as named outcomes | "pass", "retry", "ask", "stop", and "handoff" are easier to reason about than arbitrary edges. | Prior art shows important coding flows need open-ended branching early. |
| Human decisions as blocks | Pauses, approvals, and defaults need durable records and host-specific UI. | Prior art shows host-native prompts are too different to share one structured request shape. |
| Connector capability matrix | Claude, Codex, and other hosts should expose their strengths cleanly. | Prior art shows the matrix becomes harder than a smaller shared abstraction. |
| Custom flows after block stability | Users should author against stable building blocks. | Prior art shows early custom-flow use is the best way to discover blocks. |

## Prior-Art Buckets To Compare

### Durable Flow Engines

Look for lessons about replay, retries, idempotence, state history, failure
recovery, and long-running work. Temporal, Cadence, Durable Task, and AWS Step
Functions belong here.

Circuit likely borrows durable state and visible execution history, but should
avoid asking users to think like distributed-systems engineers.

### Data And CI Pipelines

Look for lessons about reports, dependency edges, fan-out, caching, retries,
and observability. Dagster, Prefect, Airflow, GitHub Actions, and Buildkite
belong here.

Circuit likely borrows report-first thinking and command evidence, but should
avoid turning human coding work into a rigid job graph.

### Business Process Systems

Look for lessons about approvals, human tasks, explicit state, decision tables,
and process visibility. BPMN, Camunda, and DMN belong here.

Circuit likely borrows human-task clarity and decision tables, but should avoid
diagram sprawl.

### AI Agent Frameworks

Look for lessons about typed state, tool calls, guardrails, handoffs,
checkpoints, and multi-agent control. LangGraph, AutoGen, CrewAI, OpenAI Agents,
Semantic Kernel, Haystack, and LlamaIndex belong here.

Circuit likely borrows typed state and handoff concepts, but should avoid
burying durable product evidence inside transient agent memory.

### AI Coding Systems

Look for lessons about planning, patching, test loops, review loops, environment
control, repo state, and operator approval. Claude Code, Codex, Aider,
OpenHands, SWE-agent, Cursor, Cline/Roo Code, Continue, Devin-like systems,
CodeRabbit, Factory, Sourcegraph Cody, and similar coding systems belong here.

Circuit should pay special attention to which systems expose repeatable coding
flows versus one-off chat sessions.

## Coding-System Questions

When looking at AI coding tools, ask:

- Does the tool have repeatable named flows, or only conversational tasks?
- Can users configure model, effort, tools, or skills per step?
- Does it keep structured evidence of what happened?
- Does it separate planning, action, verification, review, and closeout?
- Can a run pause for a human choice and later continue honestly?
- Can it run unattended without pretending uncertain choices were approved?
- Can it hand work across models or hosts?
- Can users author new flows without writing code?
- Does it have a clean story for failed tests, flaky reproduction, partial
  completion, and abandoned work?

## Expected Follow-Up

When the research comes back, do this in order:

1. Extract the ten strongest lessons into the intake template above.
2. Compare those lessons against `docs/flows/blocks.md`.
3. Mark each current block as keep, rename, split, merge, or remove.
4. Name any missing block.
5. Decide the first schematic shape worth implementing.
6. Decide whether Repair should continue immediately, or whether a small
   schematic abstraction should come first.

The goal is a smaller, clearer Circuit. If the research only makes us clone
more old flows, we learned the wrong lesson.
