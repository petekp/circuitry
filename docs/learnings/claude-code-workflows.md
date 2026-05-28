# Claude Code dynamic workflows - what we'd borrow, what we'd skip

Notes from a read of Claude Code's dynamic workflow docs on 2026-05-28:
https://code.claude.com/docs/en/workflows.

Also informed by one local generated workflow in this repo:
`.claude/workflows/circuit-pr-review.js`, plus its output report at
`.circuit/reviews/pkp-run-centered-v1-readiness.md`.

This note captures product learnings. It does not define current Circuit
behavior.

## What the source is

Claude Code dynamic workflows are a host-native way to run a JavaScript
orchestration script that coordinates many subagents.

The important mechanics:

- Claude can write a workflow script from a task description.
- A saved workflow script can be reused as a slash command.
- Project workflows live in `.claude/workflows/`.
- Personal workflows live in `~/.claude/workflows/`.
- The workflow runtime executes the script in the background while the main
  Claude Code session stays responsive.
- The script owns the loop, branching, fanout, and intermediate state.
- Intermediate results stay in script variables rather than filling the main
  chat context.
- `/workflows` exposes a progress view with phases, agent counts, token totals,
  elapsed time, agent prompts, recent tool calls, and results.
- Runs can pause/resume inside the same Claude Code session.
- Saved workflow scripts are Claude Code-specific. They are not portable Node
  scripts by default.

The docs position workflows for tasks that need more agents than one
conversation can coordinate, or tasks where the orchestration itself should be
readable and rerunnable: large audits, large migrations, cross-checked research,
and plans worth drafting from several angles.

## What changed in our understanding

The feature is stronger than "prompt templates." A workflow can be a small
program for process:

- define phases;
- spawn subagents;
- run stages in parallel;
- enforce structured output schemas;
- route findings into verifier agents;
- run focused proof commands;
- return a final report.

The local `circuit-pr-review` workflow proved this concretely. It scoped the
diff, classified touched Circuit surfaces, ran gated review dimensions, sent
medium-or-higher findings through adversarial verification, selected focused
proof commands, and wrote a severity-ranked report.

That is not just a nicer prompt. It is executable process code.

## The core distinction

Claude workflows are an **execution substrate**.

Circuit is a **process, evidence, skill-prep, and continuity layer**.

That distinction matters. Claude workflows answer:

> How do I run this scripted swarm of agents in Claude Code?

Circuit answers:

> What kind of coding work is this, what process should it follow, what evidence
> is enough, what skills and history should be close at hand, and can this Run
> honestly close?

Those are different layers. Circuit should not compete with Claude workflows on
Claude-only agent fanout. Circuit should use host-native fanout where it helps
and keep owning the higher-level work discipline.

## Why a Claude Code user might still reach for Circuit

Claude workflows are powerful when the operator already knows the right process
or wants Claude to generate one for a large parallel job.

Circuit is still useful when the operator wants:

- one front door for coding work;
- a governed flow library rather than ad hoc generated process code;
- durable run folders, traces, reports, checkpoints, and Handoff;
- cross-session continuity;
- cross-host behavior across Claude Code, Codex, and the local CLI;
- predictable skill staging through moments and project policy;
- evidence and completion gates that are not left to a one-off script;
- short human output with rich agent-facing artifacts behind it.

Put bluntly: Claude workflows help Claude do more work at once. Circuit helps
agents do the right work, in the right shape, with the right proof.

## How they fit together

The clean integration shape:

```text
Circuit Run decides what kind of work this is.
Circuit flow defines the expected practice and proof.
Claude workflow executes a bounded high-scale part when Claude Code is the host.
Circuit consumes the result as evidence.
Circuit records what happened and decides whether the Run can close.
```

Example:

```text
/circuit:run review this PR

Circuit:
- routes to Review;
- sees the PR is large or cross-cutting;
- stages project rules, skill moments, and proof expectations;
- invokes a saved Claude workflow for parallel review;
- receives the report;
- checks whether findings and proofs satisfy the Review standard;
- writes Run evidence;
- gives the operator a short answer;
- preserves Handoff state if work remains.
```

That keeps Claude workflows in the role where they are excellent: host-native
parallel execution. It keeps Circuit in the role where it is strongest:
selection, standards, evidence, continuity, and closure.

## What we'd borrow soon

### Reusable Run captures

Claude Code can save a successful workflow script as a future slash command.
Circuit needs an analogous move, but not as arbitrary JavaScript by default.

The Circuit version should be a safe reusable Run capture:

- goal pattern;
- selected flow;
- proof mapping;
- skill moments;
- project or personal policy choices;
- output expectations;
- review gate before reuse.

This is probably the highest-value borrowing. It turns "that Run worked well"
into repeatable practice without asking users to hand-author a full flow.

### Project and personal reuse scopes

Claude's `.claude/workflows/` and `~/.claude/workflows/` split is simple and
right.

Circuit already has project and personal config layers. Reusable Run captures,
skill-moment policy, proof mappings, and saved review profiles should use the
same shape:

- project-scoped when the team should share it;
- personal-scoped when it reflects one operator's preferences.

### Pre-run approval for expensive or high-impact work

Claude workflows show the planned phases and allow the operator to approve,
deny, view the raw script, or remember approval. Desktop also shows a token
caution.

Circuit should borrow this as a compact decision packet before high-impact,
write-capable, high-fanout, or expensive Runs:

- selected flow;
- planned steps;
- write capability;
- likely proof commands;
- expected cost level;
- run once / trust this project policy / cancel.

This fits Circuit's checkpoint direction without making proof inspection a
routine burden.

### Richer progress views

Claude's workflow progress view is a good operator surface:

- phases;
- agent counts;
- token totals;
- elapsed time;
- prompts;
- recent tool calls;
- results;
- pause, stop, restart, save.

Circuit should keep final human output short, but it could use a richer optional
Run progress view or generated local report for long tasks.

### Focused proof mapping

The local `circuit-pr-review` workflow mapped changed surfaces to proof
commands. That was very useful.

Circuit should make this first-class metadata: if a flow or Run knows what
changed, it should be able to choose focused checks before falling back to
`npm run verify`.

### Adversarial verification as a reusable Review pattern

The workflow's best review move was sending medium-or-higher findings to agents
whose job was to refute them.

Circuit Review should treat this as a first-class pattern:

- findings are claims;
- important claims should survive adversarial verification;
- low-confidence claims should stay labeled as such;
- final reports should separate confirmed, refuted, and unverified claims.

### Cost telemetry

Claude workflows expose token totals and elapsed time in progress views.

Circuit should record whatever cost telemetry hosts and connectors expose:

- model;
- effort;
- token totals;
- elapsed time;
- child run or agent counts.

This should live in Run artifacts and surface briefly to the operator.

## What we'd explore later

### Claude workflow adapter

Circuit could optionally invoke a saved Claude workflow when running inside
Claude Code.

This should be an adapter, not the core Circuit model. The boundary should be:

- Circuit decides the Run and expected evidence.
- Claude workflow executes a bounded part.
- Circuit consumes the report as evidence.

### Workflow-to-flow importer

If a Claude workflow becomes valuable, Circuit could inspect it and propose a
portable flow or Run capture.

This should start as read-only advice. Generated JavaScript should not silently
become Circuit source of truth.

### Durable child-result caching

Claude workflows resume within a session by reusing completed agent results.

Circuit could explore durable child-result caching later, but only if it can
avoid treating stale cached work as fresh proof.

### Declarative high-scale fanout

Claude workflows are a strong reminder that big audits and migrations often
need many independent passes.

Circuit can explore bounded fanout, but it should stay declarative and
evidence-backed rather than becoming a general JavaScript runner.

## What we'd skip

### Do not make Circuit a JavaScript workflow engine

That would pull Circuit away from source-owned flows, schemas, generated
surfaces, and durable evidence. It would also invite the Run envelope to become
a second runtime.

### Do not make Claude Code the product center

Claude workflows are Claude Code-native. Circuit's advantage is cross-host:
Claude Code, Codex, and local CLI.

Claude interop should be optional. Circuit should still make sense without it.

### Do not adopt `workflow` as Circuit product language

Claude now owns "workflow" in this nearby context. Circuit should keep `Run` and
`flow`.

Use "workflow" only when talking about Claude Code's feature or compatibility
with it.

### Do not treat a generated script as proof

A workflow script can encode a good process. The proof is still in the files,
tests, reports, traces, and evidence it produces.

### Do not drop human decision points

Claude workflows do not support mid-run user input except permission prompts.
That is a constraint, not a product philosophy Circuit should inherit.

Circuit should keep checkpoints and decision packets for work that needs real
human choice between stages.

### Do not auto-approve write-heavy agents by default

Claude workflow subagents run under Claude's permission model, and file edits
can be auto-approved. Circuit should keep write capability explicit and visible,
especially when it is routing through multiple hosts or connectors.

## Codex portability lesson

A saved Claude workflow script will not run in Codex as-is.

It expects Claude Code workflow runtime globals and helpers such as:

- `agent`;
- `parallel`;
- `pipeline`;
- `phase`;
- `log`;
- `args`;
- the workflow return wrapper.

Node would fail on those missing runtime assumptions. Codex could read the file
as a process spec and imitate it manually, but that is interpretation, not
execution.

To make this portable, Circuit would need either:

- a compatibility runtime that implements those primitives over Codex-native
  agents; or
- a translator that turns a Claude workflow into a Circuit flow or Run capture.

The safer first move is translation or adaptation, not direct execution.

## Product framing to remember

The strongest framing is not "Circuit versus Claude workflows."

It is:

> Claude workflows make the lower execution layer stronger. Circuit should move
> up a level.

Circuit should focus on:

- choosing and preparing the right process;
- preserving cross-host portability;
- making evidence and completion contracts durable;
- capturing successful practice into reusable governed artifacts;
- staging skills and history predictably;
- handing off unfinished work across sessions.

Claude workflows reduce the need for Circuit to invent its own high-scale
subagent runtime. That is good. It lets Circuit be more clearly about the
operator's working environment and the agent's prepared workspace.

## Open questions

1. What is the minimum safe shape of a reusable Run capture?
2. Should a saved Claude workflow be consumed as a connector, a custom flow
   source, or a one-off evidence producer?
3. How much of the Claude workflow progress model can Circuit expose without
   building a full live task UI?
4. What proof metadata belongs in a flow versus in project config?
5. When a Claude workflow writes code, what additional Circuit safety disclosure
   or checkpoint is needed?
6. Can a workflow-generated report be normalized into process evidence without
   weakening Circuit's closure gate?
