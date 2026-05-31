# Doc Deletion Candidate Audit - 2026-05-31

Purpose: identify docs under `./docs` that are worth deleting outright,
archiving, or replacing with tombstone redirects after the current docs status
sweep.

Scope checked:

- All tracked Markdown docs under `docs/`, excluding checked-in release proof
  run payloads from candidate scoring.
- The current status indexes in `docs/ideas/README.md`,
  `docs/learnings/README.md`, and `docs/specs/README.md`.
- Inbound references from `README.md`, `AGENTS.md`, `UBIQUITOUS_LANGUAGE.md`,
  `docs`, `src`, `tests`, `scripts`, `plugins`, and `package.json`.
- Current source, generated surfaces, and release checks as the authority when
  a dated note disagrees with the repo.

Before this report was added, `find docs -type f -name '*.md' -not -path
'docs/release/proofs/runs/*'` found 118 Markdown docs in scope.

## Recommendation Summary

There are docs worth removing from the active tree, but only two are clean hard
delete candidates. The rest should be archived or tombstoned first because other
historical docs cite them as evidence.

| Candidate | Recommendation | Why |
| --- | --- | --- |
| `docs/ideas/architecture-hardening-plan.md` | deleted | It was explicitly superseded by `architecture-hardening-plan-v2.md`, which contains the authoritative re-analysis and 2026-05-30 closeout. No current code, test, release, or generated surface depended on v1. |
| `docs/ideas/self-auditing-memory-review-codex.md` | deleted | It was a superseded independent review. The useful conclusions are either captured in the parent memory docs, the slice specs, or current code. It had no live source/code dependency. |
| `docs/ideas/self-auditing-memory-review.md` | archived in place | The parent `self-auditing-memory.md` and Slice 3 still cite it. It is stale as guidance, but useful as the dated soundness review that caused corrections. |
| `docs/ideas/longitudinal-evidence-memory.md` | archived in place | Its direction has been absorbed, but several memory docs still cite it as idea lineage and evidence. |
| `docs/ideas/pull-query-memory.md` | archived in place | It is superseded by `pull-query-memory-engineering-proposal.md` and `history pull`, but the proposal still cites its line-level evidence repeatedly. |
| `docs/internal/audits/2026-05-20-first-time-experience.md` | not changed in tracked docs | It is an ignored local audit record, not a tracked repo doc. No tracked cleanup was needed. |

## Not Recommended For Deletion

| Area | Recommendation | Reason |
| --- | --- | --- |
| `docs/internal/archive/**` | keep, or prune only as a separate history-retention decision | These files have no live inbound references, but they are already outside the active docs path and have archive disclaimers. Deleting them would reduce history, not current reader confusion. |
| `docs/release/proofs/**` | keep | Release proof evidence is part of the public-release verification surface. Do not delete unless a release check or release proof refresh says it is safe. |
| `docs/specs/goal-block-v1.md` | keep; now indexed in `docs/specs/README.md` | Current flow/source comments cite it as authority for Goal flow shape. |
| `docs/specs/run-envelope-goal-loop-migration-v1.md` | keep; now indexed in `docs/specs/README.md` | Current run-envelope source comments and migration docs cite it. |
| `docs/ideas/ratchet-data-requirements.md` | keep for now | Several memory review/proposal docs cite its corpus counts and prototype evidence. It is stale as current behavior, but still useful as evidence lineage. |
| `docs/ideas/effective-memory-program-review-codex.md` | keep for now | The active effective-memory program cites it as the independent review that corrected the plan. |
| `docs/learnings/**` | keep | These are research context, now clearly labeled. None currently justify deletion. |

## Candidate Inventory

### Deleted

- `docs/ideas/architecture-hardening-plan.md`
- `docs/ideas/self-auditing-memory-review-codex.md`

### Archived In Place

- `docs/ideas/self-auditing-memory-review.md`
- `docs/ideas/longitudinal-evidence-memory.md`
- `docs/ideas/pull-query-memory.md`

### Keep After Review

- `docs/ideas/architecture-hardening-plan-v2.md`
- `docs/ideas/effective-memory-program-review-codex.md`
- `docs/ideas/ratchet-data-requirements.md`
- `docs/specs/goal-block-v1.md`
- `docs/specs/run-envelope-goal-loop-migration-v1.md`
- `docs/internal/archive/**`
- `docs/release/proofs/**`
- `docs/learnings/**`

## Cleanup Applied

1. Updated `docs/ideas/README.md` and the `architecture-hardening-plan-v2.md`
   preface while hard-deleting `architecture-hardening-plan.md` and
   `self-auditing-memory-review-codex.md`.
2. Archived the three citation-heavy memory docs in place, keeping inbound
   evidence links valid while removing them from active-guidance status.
3. Added `goal-block-v1.md` and `run-envelope-goal-loop-migration-v1.md` to
   `docs/specs/README.md` so the specs index is complete.
4. Left the ignored local `docs/internal/audits/2026-05-20-first-time-experience.md`
   unchanged because it is not tracked repo documentation.

## Verification Notes

- `rg` found only status/index and superseding-doc references for the removed
  architecture v1 note.
- `rg` found no live source/code dependency for the removed Codex memory review.
- `rg` found active historical citations for `pull-query-memory.md`,
  `longitudinal-evidence-memory.md`, and `self-auditing-memory-review.md`, so
  those should not be hard-deleted without citation rewrites.
- `rg` found current code/source comments referencing `goal-block-v1.md` and
  `run-envelope-goal-loop-migration-v1.md`, so those are indexing gaps, not
  deletion candidates.
