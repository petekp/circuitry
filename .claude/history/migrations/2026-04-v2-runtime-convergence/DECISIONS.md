# Migration Decisions

## Decision 1: Spec-first, then implement

Date: 2026-03-31

The v2 architecture spec was written and hardened (3 parallel reviews, 13 accepted caveats, adversarial re-review) before any implementation begins. This front-loads design risk into a document where mistakes are cheap to fix, rather than discovering architecture problems mid-implementation.

## Decision 2: Coexistence during migration

Date: 2026-03-31

During migration, both v1 prose and v2 event-sourced runtime can coexist. When both exist for a circuit, the engine prefers the v2 runtime. This allows incremental conversion without a flag day.

## Decision 3: Python for runtime scripts

Date: 2026-03-31

The spec calls for `scripts/runtime/append-event.py`, `derive-state.py`, and `resume.py`. Python was chosen because it has good JSON/NDJSON handling, the verify-install.sh script already checks for python3, and it avoids adding a Node.js dependency to a shell-based plugin.

## Decision 5: Retained dispatch prose in SKILL.md files

Date: 2026-04-01

The compose-prompt and dispatch.sh references in SKILL.md "Dispatch Backend" sections are intentionally retained. Per Decision 2 (coexistence), SKILL.md prose remains the active execution guide until a v2 engine consumes circuit.yaml directly. Removing dispatch instructions now would break circuit execution.

Exit condition: These references are removed when a v2 engine exists that reads circuit.yaml manifests and drives execution without SKILL.md prose. At that point, SKILL.md becomes documentation-only.

## Decision 4: Migration step ordering

Date: 2026-03-31

Steps 1-3 (circuit topology changes) are independent of steps 4-6 (infrastructure improvements). Steps 7-9 (Runtime Foundation) depend on step 6. Steps 10-15 depend on steps 7-9. This creates two parallel tracks for early work, converging at step 7.

## Decision 6: Canonical runtime projection does not model reopen events

Date: 2026-04-14

`step_reopened` and the old `reopen-step` command are not part of the canonical runtime model. The only runtime truth is `circuit.manifest.yaml` plus supported `events.ndjson` event types. Routing back to an earlier step is represented by gate routing and the subsequent `step_started` / worker / checkpoint events, not by a dedicated reopen event.

Legacy `step_reopened` entries are now rejected by `schemas/event.schema.json`, and the pure projector ignores them if they still appear in historical logs.

Exit condition: None. Reintroduce reopen as a first-class runtime event only through a new explicit decision that updates the schema, projection, and docs together.

## Decision 7: Built-in Codex dispatch is isolated-only

Date: 2026-04-14

Circuit no longer ships `codex-ambient`. The only built-in Codex modes are `codex` and `codex-isolated`, and both resolve to Circuit-owned isolated runtime execution.

This removes the last built-in worker path that inherited user Codex state, keeps dispatch semantics deterministic, and prevents config/docs from advertising a compatibility escape hatch that the current architecture no longer wants.

Exit condition: None. Reintroduce an ambient built-in only through a new explicit decision that updates runtime behavior, docs, example config, and verification together.
