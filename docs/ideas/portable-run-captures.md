# Portable Run captures

Idea for making successful Runs shareable as reusable team or personal process
patterns. Captured 2026-05-28 from a discussion about Claude Code dynamic
workflows and whether Circuit Runs could become portable.

This is not current behavior. It is a possible future addition.

## The trigger

Claude Code workflows can be saved after a one-off run works well. That is the
most valuable part of the feature to borrow: a good agent process can become a
reusable command instead of staying trapped in one session.

For Circuit, the useful version is not "save arbitrary JavaScript." It is:

> This Run worked well. Save the reusable parts as a project or personal process
> pattern.

The important distinction:

- **Flow**: the reusable process definition.
- **Run**: one live attempt to satisfy an operator goal.
- **Run capture**: a reusable pattern extracted from a successful Run.

The capture is not the old Run replayed. The old Run is evidence that the
pattern worked once.

## Product thesis

Share the practice, not the historical execution.

Exact run folders are not good portable objects. They are evidence records tied
to a repo, a manifest hash, local paths, traces, reports, possible untracked
files, connector behavior, and timestamped facts. Treating them as replayable
team templates would create safety and staleness problems.

A Run capture should extract the durable parts:

- goal shape;
- selected flow;
- depth and effort choices;
- skill moments;
- proof commands;
- evidence expectations;
- output shape;
- project rules;
- optional source Run reference.

The result is a shareable practice pattern. It can guide future Runs, but it
does not prove future work.

## Difficulty read

| Shareable object | Difficulty | Read |
| --- | ---: | --- |
| Run capture / reusable pattern | Medium | Mostly a schema, export/import path, and Run intake integration. |
| Flow profile from a Run | Medium | Similar, but explicitly scoped to one existing flow. |
| Full replayable run folder | Hard | Tied to repo state, paths, trace, manifest hash, artifacts, and sensitive content. |
| Team marketplace of captures | Medium-hard | Needs trust, provenance, review UX, compatibility checks, and versioning. |

The sensible V1 is Run capture. Portable exact Runs are a trap for now.

## Proposed storage

Use project and personal scopes, matching Circuit's existing config posture:

```text
.circuit/captures/<name>.yaml
~/.config/circuit/captures/<name>.yaml
```

Project captures are shared with the repo. Personal captures stay local.

## Sketch shape

```yaml
schema_version: 1
kind: run_capture
name: circuit-pr-review
description: Review Circuit PRs with surface-aware checks and adversarial verification.

scope:
  visibility: project
  applies_to:
    repos:
      - petekp/circuit

source:
  run_id: run_abc123
  captured_at: 2026-05-28T19:00:00Z
  captured_by: operator
  source_ref: .circuit/runs/run_abc123

match:
  goal_patterns:
    - review this PR
    - review current branch
  file_signals:
    - src/**
    - tests/**
    - docs/release/**

run:
  flow: review
  depth: deep
  effort: high

moments:
  - before:plan-implementation
  - after:schema-change
  - before:close-run

proofs:
  focused:
    - when: generated surfaces changed
      run: npm run check-flow-drift
    - when: schemas or contracts changed
      run: npx vitest run tests/contracts
  final:
    - npm run verify

evidence_expectations:
  - findings cite file and line
  - medium-or-higher findings are independently checked
  - skipped checks are explicitly listed

output:
  human_summary: concise
  artifact_paths:
    - reports/operator-summary.md
    - reports/review.json
```

The exact schema should be much smaller than this in V1. This sketch shows the
kind of information worth preserving.

## Operator lifecycle

1. A Run closes successfully.
2. Circuit detects that the Run had reusable shape: repeated goal pattern,
   explicit proof choices, useful skill moments, or operator endorsement.
3. Circuit asks: "Save this as a reusable capture?"
4. Circuit drafts a redacted capture.
5. The operator reviews and edits it before saving.
6. Future Runs can match the capture and offer to apply it.
7. Applying a capture is visible in the Run record.

No capture should become an automatic hidden rule on first save.

## Import and team sharing

Imported captures should be treated like project policy, not proof.

Before a capture affects a Run, Circuit should show:

- capture name;
- source scope: project or personal;
- flow it applies to;
- proof commands it may run;
- skill moments it may stage;
- whether any commands are missing locally;
- whether the capture schema is compatible with this Circuit version.

The operator should be able to accept once, trust for this project, or ignore.

## Safety boundaries

### Redaction

Run artifacts can contain sensitive data:

- local paths;
- untracked files;
- diffs;
- proprietary code;
- prompts;
- model outputs;
- connector names and behavior;
- tokens or secret-looking strings in command output.

The capture exporter must default to redacted, structural data. It should not
copy raw reports wholesale.

### Staleness

A capture from one repo may not fit another repo's package manager, test
commands, architecture, or host setup.

Captures need compatibility checks before use:

- required flow exists;
- named moments are valid;
- proof commands are available or explicitly accepted;
- path patterns make sense in the current repo;
- capture schema version is supported.

### Authority

Imported captures can guide a Run. They cannot prove completion, decide
checkpoints, bypass proof, silently write memory, or grant write permission.

The current Run still has to produce current evidence.

### Trust and provenance

Team-shared captures should show who created them, from what Run, and why they
are trusted.

Personal captures can be lighter, but still need source and timestamp metadata.

## Relationship to flows

A capture is not a new flow.

It is closer to a profile or preset over a flow:

```text
flow + project practice + proof choices + skill moments + output expectations
```

Some captures may eventually graduate into authored flows. That should be an
explicit promotion step, not the default save path.

## Relationship to Claude Code workflows

The borrowed move is "save the useful orchestration after it works."

The part not borrowed is "the saved artifact is executable JavaScript."

Claude Code workflow scripts are host-specific. They depend on Claude Code's
runtime helpers and will not run in Codex or plain Node without an adapter. A
Run capture should be declarative enough for Circuit to apply across hosts.

## What not to do

- Do not replay old run folders as if they were portable.
- Do not make captures silently authoritative.
- Do not store raw model transcripts or command output by default.
- Do not let a capture bypass current verification.
- Do not turn this into a team marketplace before local project captures are
  useful.
- Do not make captures a replacement for authored flows.

## Why this is attractive

This feature would make Circuit feel more compounding.

Today, a strong Run produces evidence and maybe a Handoff. A Run capture would
let strong Runs produce reusable practice. That directly supports the product
goal of reducing repeated steering and handholding over time.

It also gives teams a lightweight way to share "how we use Circuit here" without
requiring every useful pattern to become a full custom flow.

## Open questions

1. Should the first artifact be called a Run capture, flow profile, or practice
   capture?
2. What is the smallest useful schema?
3. Should captures be matched automatically from the goal, manually selected by
   the operator, or both?
4. What redaction checks are mandatory before saving a project capture?
5. Can captures include shell commands, or only references to named proof
   policies?
6. Should applying a capture require a checkpoint the first time in each repo?
7. What is the promotion path from capture to authored flow?
