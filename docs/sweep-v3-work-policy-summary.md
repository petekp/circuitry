# Sweep V3 Work Policy Summary

Status: generated-view target, hand-authored for the proof slice  
Source fixture: `docs/sweep-v3-definition-fixture.yaml`

## Purpose

This is the human review view the v3 compiler should eventually generate from a
Sweep definition. If this view is not easier to review than the current
`circuit.yaml` plus hidden `SKILL.md` policy, the work-pattern direction should
pause.

## Outer Runtime Graph

The first proof keeps the current v2 outer graph:

```text
frame -> survey -> triage -> execute -> verify -> deferred -> close
```

Dynamic child work remains receipt-visible first. The runtime core should not
need to understand survey categories, PROVE rows, or queue batches in the first
v3 slice.

## Dynamic Work

| Pattern | Parent Phase | Instances | Mutation | Profile Floor | Cap / Completion | Enforcement |
|---------|--------------|-----------|----------|---------------|------------------|-------------|
| `survey-category` | survey | selected categories from sweep type | read_only | `scan-fast` | max 5, all complete | resolver + receipt |
| `prove-item` | triage | `queue.md` rows marked PROVE | read_only | `research-standard` | max 20, all complete | receipt audited first |
| `execute-batches` | execute | queue batch assignments | safe_edit | `code-fast` | sequential workers loop, max 3 attempts | adapter + runtime gate |
| `sweep-independent-audit` | verify | one fresh-context audit | diagnose_only | `review-high` | all complete, max 2 attempts later | resolver + runtime gate |

## Mode Differences

| Mode | Difference |
|------|------------|
| Lite | Survey is inline/high-confidence only; triage should only pass high-confidence low-risk work. |
| Standard | Category fanout survey, PROVE as needed, sequential batches, independent audit during Verify. |
| Deep | Stronger PROVE expectation; confirm every batch; prefer deferral over risky removal. |
| Autonomous | Auto-approve by confidence x risk table, max 3 execute batches, include injection check, log decisions to deferred output. |

## Safety Review

| Phase | Mutates Source? | Guardrail |
|-------|-----------------|-----------|
| survey | No | Category workers are read-only scans. |
| triage | No | PROVE workers audit evidence only. |
| execute | Yes | Uses `workers` adapter; checkpoint/pause guidance on public APIs, FFI, published packages, destructive cleanup. |
| verify | No | Diagnose-only audit in a fresh context; Autonomous adds injection check. |

## Policy Boundaries

Provider model IDs do not appear in the fixture. The definition uses logical
profiles:

- `scan-fast`
- `research-standard`
- `research-high`
- `code-fast`
- `code-standard`
- `code-high`
- `review-high`
- `review-critical`

Local config/adapters bind those profile names to concrete providers, models,
effort flags, and commands.

## Prose-Owned Judgment

These remain owned by `skills/sweep/SKILL.md`:

- how to classify confidence and risk
- how to decide whether a PROVE item is confirmed or KEEP
- how to batch items by blast radius
- how to interpret ambiguous injection findings
- how to prioritize deferred follow-up items

The fixture structures the machine-significant controls around that judgment:
fanout shape, mutation policy, prompt/template intent, skill budget, logical
compute floors, batch caps, and receipt expectations.

## Projection Check

The proof succeeds only if a compiler can project the fixture to the current v2
manifest shape without runtime-core changes:

| V3 Phase | Current v2 Step | Projection |
|----------|-----------------|------------|
| frame | frame | checkpoint step |
| survey | survey | dispatch step |
| triage | triage | synthesis step |
| execute | execute | dispatch step |
| verify | verify | dispatch step |
| deferred | deferred | synthesis step |
| close | close | synthesis step |

The `work-policy.index.json` projection should carry work patterns and policy
templates. It should not change canonical runtime events.
