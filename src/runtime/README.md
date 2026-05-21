# Runtime Map

`src/runtime/` is the engine layer. It executes compiled flows; it does not own
flow-specific product behavior.

## Read Order

1. `run/compiled-flow-runner.ts` and `run/graph-runner.ts` for the main graph
   walk.
2. `executors/` for step-kind behavior.
3. `manifest/` for turning compiled flow files into executable runtime
   packages.
4. `run-files/` and `trace/` for persisted run-folder state.
5. `connectors/`, `fanout/`, and `projections/` for specialized mechanics.

## Owner Groups

| Path | Owns |
| --- | --- |
| `domain/` | Small runtime domain helpers for flows, routes, runs, selections, steps, traces, and run files. |
| `executors/` | Step execution for compose, relay, verification, checkpoint, sub-run, fanout, and result handling. |
| `fanout/` | Branch expansion, branch execution, worktree handling, and fanout types. |
| `manifest/` | Executable flow loading, validation, and package indexing. |
| `projections/` | Runtime projections for progress, status, and tournament checkpoint context. |
| `run/` | Run orchestration, graph advancement, child runs, checkpoints, result writing, and runtime capabilities. |
| `run-files/` | Run-folder paths, report validation, and run file storage. |
| `trace/` | Append-only trace storage. |
| `connectors/` | Runtime connector resolution. Connector implementations live in `src/connectors/`. |

## Boundary Checks

- Add or change a flow in `src/flows/`, not here.
- Add a schema in `src/schemas/` when a persisted or public shape changes.
- Keep flow-specific report writing in flow package writers or registries.
- Use runtime tests for engine mechanics and flow tests for flow package
  behavior.
