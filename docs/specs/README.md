# Specs

Specs in this directory are design targets, draft plans, or implemented V1
records. They are not automatically current behavior.

Use this directory with care:

| Spec | Class | Current use |
| --- | --- | --- |
| [clarify-block-v1.md](clarify-block-v1.md) | Implementation spec | Plan for adding the reusable Clarify block and wiring it into Goal first, then Pursue after direct-run and Goal-child proof. Not current behavior. |
| `headless-engine-host-api-v1.md` | Research note | Used by local plan-execution proof paths. Not a shipped host API unless code and contracts agree. |
| [circuit-history-v1.md](circuit-history-v1.md) | Implementation spec | Source-backed plan for explicit local history indexing/querying plus a non-injected `MemoryInputV0` preview. Not current behavior. |
| [circuit-history-run-start-recall-v1.md](circuit-history-run-start-recall-v1.md) | Implemented V1 record | Source-backed plan and implementation record for automatic, explicit run-start history recall from the local history index. Current behavior is defined by code, tests, and generated runtime surfaces. |
| [narration-display-profiles.md](narration-display-profiles.md) | Canonical | Companion to [docs/contracts/host-rendering.md](../contracts/host-rendering.md); covered by host experience tests. |
| `prototype-flow-v1.md` | Planning spec | Source-backed product and implementation spec for a durable Prototype flow. Not current behavior. |
| `prototype-model-comparison-v1.md` | Implementation spec | Source-backed plan for adding multi-variant model-comparison to Prototype. Not current behavior. |
