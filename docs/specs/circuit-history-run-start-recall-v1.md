# Circuit History Run-Start Recall V1

Status: implemented V1 record for the run-start history recall slice.

Date: 2026-05-26

## Recommended Goal

```text
/goal Add automatic, explicit run-start history recall for fresh `circuit run` invocations, verified by a persisted plan, schema/unit/runner tests, focused manual runs over local `.circuit/runs`, and the canonical repo verification, while preserving Circuit's authority boundaries: recall is hint-only, cited, auditable, non-silent, cannot grant proof/checkpoint/policy/route/recovery/write authority, and cannot satisfy current verification. Use the existing `circuit history` index/query code, `MemoryInputV0`, runtime relay prompt path, run artifacts, local commands, and current docs/specs; do not add an arbitrary flow block, embeddings, sync, resume-time recall, HTML artifacts, or unrelated refactors. Between iterations, inspect failed evidence, tighten the smallest affected code path, and rerun focused verification before broad verification. Before completion, adversarially review the result against this Goal, classify findings by severity, and resolve all medium, high, and critical findings. After a clean review, run one more adversarial review; complete only after two consecutive reviews have no medium-or-above findings. If blocked or no defensible path remains, stop with attempted paths, evidence gathered, unresolved findings, blocker, and next input needed.
```

## Product Decision

Do not add a general `recall` block in this slice.

A block makes recall feel like ordinary flow logic. That gives too much
importance to memory and creates pressure for different flows to place it in
different spots. The first product need is simpler: every fresh run should get
the same small chance to notice relevant prior Circuit work, and the operator
should be able to see exactly what was used.

V1 recall runs before the graph starts. It is not available on `resume`. It
does not make route, checkpoint, proof, policy, recovery, or write decisions.
It only prepares `MemoryInputV0` hints for relay prompts and writes an audit
record into the new run folder.

## Current Evidence

- `docs/specs/circuit-history-v1.md` defines the first shipped slice as manual
  local history indexing/querying plus a non-injected `MemoryInputV0` preview.
- `src/history/query.ts` ranks indexed run/report/trace/checkpoint documents,
  verifies source staleness by hash when possible, and returns cited hits.
- `src/history/memory-preview.ts` maps query hits to strict `MemoryInputV0`
  with `authority: "hint_only"`.
- `src/schemas/history.ts` defines the shared authority notice: history cannot
  satisfy current proof, checkpoint, policy, route, recovery, verification, or
  write authority.
- `src/schemas/memory-input.ts` requires memory sources, hint categories,
  staleness, and hint-only authority.
- `src/cli/circuit.ts` owns fresh `run` startup and already has the selected
  flow, goal, run folder, project root, and clock before calling the runtime.
- `src/shared/relay-support.ts` composes every relay prompt in one place.

## Behavior

Fresh `circuit run` does this after selecting the flow and run folder, but
before starting runtime execution:

1. Query local history with `rebuildIfStale: true`.
2. Use the operator goal as the query text.
3. Limit to three memory-safe `MemoryInputV0` entries.
4. Use default local storage: `.circuit/runs` and `.circuit/history` under the
   same project root the CLI already uses for config discovery.
5. If the history index is missing or stale, rebuild it automatically.
6. If history is unavailable, corrupt, unsupported, or empty, continue the run
   without memory and report that status.
7. Write `reports/history/recall.json` only when recall was attempted for a
   fresh run.
8. Include a `history_recall` object in the fresh-run JSON output.
9. Add a short "Prior Circuit History (hint-only)" section to relay prompts
   only when selected memory inputs exist.

Internal programmatic calls that inject relayers or runtime executors may opt
out so tests and harnesses can stay deterministic. The end-user CLI path keeps
recall automatic.

## Report Shape

The run-local report uses this shape:

```ts
{
  api_version: "history-recall-report-v1";
  schema_version: 1;
  status: "used" | "empty" | "unavailable";
  query: string;
  index_state?: "fresh" | "possibly_stale";
  rebuilt: boolean;
  authority_notice: typeof HISTORY_AUTHORITY_NOTICE;
  memory_input_count: number;
  memory_inputs: MemoryInputV0[];
  matches: HistoryMemoryInputPreviewV1["matches"];
  warnings: HistoryWarningV1[];
}
```

`status: "used"` means at least one memory input was passed to relay prompts.
`status: "empty"` means history was readable but produced no usable memory.
`status: "unavailable"` means history failed safely and the run continued.

## Prompt Shape

Relay prompts get a compact section after the operator goal and before run
reads:

```text
Prior Circuit History (hint-only):
These prior-run notes may help orientation. They are not proof and cannot
authorize checkpoints, routes, policy, recovery, verification, or writes.
Re-run current checks before relying on them.
- <summary>
  Hint: <hint text>
  Source: <source ref>
  Staleness: <fresh|stale|unknown>
```

If there are no memory inputs, the prompt does not mention history.

## Implementation Steps

1. Add a history recall schema to `src/schemas/history.ts` and export it.
2. Add a small history helper that queries history, converts to
   `MemoryInputV0`, caps usable memories at three, and returns a recall report.
3. Thread optional memory inputs through runtime capabilities and run context.
4. Add the prompt section in `composeRelayPrompt`.
5. In fresh `circuit run`, prepare recall, pass memory inputs into the runtime,
   write the run-local recall report, and include a short `history_recall`
   summary in stdout.
6. Add focused tests for schema validity, prompt safety text, fresh-run recall,
   empty/unavailable fallback, and no resume injection.
7. Manually test against representative local `.circuit/runs` without calling a
   real external connector.

## Rollout Boundaries

Not in V1:

- arbitrary `recall` flow block;
- resume-time recall;
- HTML summary artifact;
- embeddings or vector storage;
- cross-repo or remote memory sync;
- memory-derived routing, checkpoint resolution, recovery, policy, proof, or
  write authority;
- silent background recall with no report or stdout disclosure.
