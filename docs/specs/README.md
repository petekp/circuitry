# Specs

Specs in this directory are design targets, draft plans, or implemented V1
records. They are not automatically current behavior.

Use this directory with care:

| Spec | Class | Current use |
| --- | --- | --- |
| `3-axis-rigor-tournament-autonomous-v1.md` | Archived | Historical target spec. Current CLI and flow-axis behavior lives in code and generated surfaces. |
| `checkpoint-experience-v1.md` | Research note | Checkpoint UX target. Verify current behavior against code before acting. |
| `codex-first-class-writable-worker-v1.md` | Implemented V1 record | Source-backed spec for migrating the public `codex` worker connector to a first-class write-capable worker and removing the separate `codex-isolated` built-in. Current behavior is defined by code, tests, generated surfaces, config, and contracts. |
| [clarify-block-v1.md](clarify-block-v1.md) | Implementation spec | Plan for adding the reusable Clarify block and wiring it into Goal first, then Pursue after direct-run and Goal-child proof. Not current behavior. |
| `explore-intent-v1.md` | Research note | Upstream product intent for Explore. Not reconciled as current implementation. |
| `headless-engine-host-api-v1.md` | Research note | Used by local plan-execution proof paths. Not a shipped host API unless code and contracts agree. |
| [circuit-history-v1.md](circuit-history-v1.md) | Implementation spec | Source-backed plan for explicit local history indexing/querying plus a non-injected `MemoryInputV0` preview. Not current behavior. |
| [narration-display-profiles.md](narration-display-profiles.md) | Canonical | Companion to [docs/contracts/host-rendering.md](../contracts/host-rendering.md); covered by host experience tests. |
| `per-step-acceptance-criteria-v1.md` | Implemented V1 record | Source-backed plan and implementation record for relay-step `acceptance_criteria`. Current behavior is defined by code, tests, generated surfaces, and contracts; use this file for rationale and rollout slices. |
| `prototype-flow-v1.md` | Planning spec | Source-backed product and implementation spec for a durable Prototype flow. Not current behavior. |
| `prototype-model-comparison-v1.md` | Implementation spec | Source-backed plan for adding multi-variant model-comparison to Prototype. Not current behavior. |
| `write-capable-implementer-connectors-v1.md` | Superseded implementation record | Earlier source-backed plan for multiple write-capable implementer connectors. Superseded for Codex by `codex-first-class-writable-worker-v1.md`; current behavior uses the public `codex` connector. |
