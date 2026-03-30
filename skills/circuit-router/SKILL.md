---
name: circuit:router
description: >
  Routes `/circuit:router` requests to the best-fit circuit skill among the 9
  circuits. Not a circuit itself. Use for `/circuit:router` or
  `/circuit:router <args>` when choosing which circuit to start.
---

# Circuit Router

Routing only. This skill is not a circuit.

## Workflow

1. Treat `/circuit:router <text>` as the strongest signal.
2. If args are empty, read the current thread and any referenced handoff, spec, PRD, bug report, or circuit directory.
3. If still ambiguous, ask exactly one disambiguating question.

Route only when positive signals match and exclusions do not.

- `circuit:develop`
  Match: multi-file or cross-domain feature delivery, unclear approach, or research needed before build.
  Supports `--light` flag for tasks where the approach is clear but still benefits from structured intent/contract/implement/review flow.
  Exclude: bug fixes, config changes, or single-file wiring tasks. For clear-approach tasks, recommend `circuit:develop --light` instead of excluding them.
- `circuit:decide`
  Match: architecture or protocol choices with real downside, serious options, or reopen conditions needed before build.
  Exclude: code delivery, bug fixes, or settled decisions.
- `circuit:harden-spec`
  Match: an existing RFC, spec, PRD, or circuit schema that is promising but not yet safe to build from.
  Exclude: unformed ideas, bug fixes, or specs already implementation-ready.
- `circuit:repair-flow`
  Match: a broken, flaky, or unsafe existing flow, especially across boundaries, where repair must start from forensics and end in a verified fix.
  Exclude: feature ideation, greenfield implementation, or cases with no real broken flow to reproduce.
- `circuit:cleanup`
  Match: systematic dead code removal, stale docs cleanup, orphaned artifact sweeps, vestigial comment removal, or codebase hygiene passes.
  Exclude: refactoring with behavior changes, architecture decisions, feature work, one-off deletions, dependency upgrades, or formatting-only cleanup.
- `circuit:create`
  Match: authoring a new circuit from a natural-language workflow and fitting it to the live circuit corpus.
  Exclude: editing an existing circuit, building a runtime engine, or wrapping a tiny one-off prompt in circuit structure.
- `circuit:ratchet-quality`
  Match: overnight autonomous quality improvement, polish, ratcheting, or unattended codebase refinement with an evidence-backed closeout.
  Exclude: interactive work, greenfield features, architecture decisions, cleanup-only scope, or repos without build/test commands.
- `circuit:dry-run`
  Match: dry-running, validating, tracing, or mechanically checking a circuit skill, especially after authoring or editing it.
  Exclude: architecture critique, feature design, or product judgment.
- `circuit:setup`
  Match: configuring which skills circuits use, setting up Circuit for a new project, generating circuit.config.yaml, or discovering installed skills.
  Exclude: running circuits, building features, or making decisions.

## Route Order

Use a sequence only when an earlier phase must happen before a later one.

- Broken existing flow: `circuit:repair-flow` before any rebuild or expansion work.
- Unsettled architecture or protocol choice: `circuit:decide` before `circuit:harden-spec` or `circuit:develop`.
- Draft exists but is not build-ready: `circuit:harden-spec` before `circuit:develop`.
- Cleanup-only scope: `circuit:cleanup` instead of `circuit:ratchet-quality` (ratchet is for quality improvement, cleanup is for removal).
- New circuit authoring: `circuit:create` before `circuit:dry-run`.
- If both `circuit:decide` and `circuit:harden-spec` match, start with `circuit:decide`.
- If none match, say so and do not force a route. This includes single-file changes, config edits, quick wiring, or trivial bug fixes.

## Overlap Disambiguation

These circuits share surface-level similarity. Use these rules to disambiguate:

- **ratchet vs cleanup:** Ratchet *improves* code quality (refactors, test coverage, error handling). Cleanup *removes* dead code, stale docs, and orphaned artifacts. If the user says "clean up" meaning "make better," route to ratchet. If they mean "remove unused stuff," route to cleanup.
- **harden-spec vs develop:** Harden-spec turns a *draft document* into something safe to build from — it never writes code. Develop takes a *feature idea* and builds it end to end. If a spec/RFC/PRD exists and needs review, route to harden-spec first. If the user is starting from an idea with no document, route to develop.
- **decide vs develop:** Decide resolves *which approach* to take when there are meaningful architectural alternatives. Develop *builds the chosen approach*. If the user says "should we use X or Y," route to decide. If they say "build X," route to develop.
- **decide vs harden-spec:** Decide chooses *between* options. Harden-spec stress-tests *one* spec that already exists. If the decision is unsettled, route to decide first, then harden-spec.
- **ratchet vs develop:** Ratchet improves *existing* code without adding features. Develop adds *new* capabilities. If the user wants "make this codebase better" without new features, route to ratchet.
- **develop full vs develop --light:** Full develop is for unclear approaches that need research and decision phases. Light develop (`--light`) is for clear-approach tasks that still span multiple files and benefit from structured intent/contract/implement/review. If the user says "add X following the existing pattern" or "the approach is obvious but non-trivial," recommend `circuit:develop --light`.

## Recommend

Recommend the best circuit or sequence in order.
For each recommended step, give 1-2 sentences tied to the matched signals and exclusion checks.
Briefly say why the closest alternatives do not fit.
If nothing fits, say that directly and stop.

## Invoke On Confirmation

If the user confirms, invoke only the first recommended circuit.
Recompute once if new information changes the route.
