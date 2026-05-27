# Shared Helpers

`src/shared/` is for helpers used across source layers. Keep it small enough
that a reader can tell why code does not belong in `src/runtime/`,
`src/flows/`, `src/cli/`, or `src/schemas/`.

Common groups:

- selection, config, and local skill loading,
- relay prompt and result helpers,
- operator summaries, HTML projectors, progress, and status rendering,
- deterministic proof, verification, verdict, and checkpoint helpers,
- fanout aggregation and scoring helpers,
- JSON extraction and schema conversion helpers,
- run-folder and runtime-source helpers.

Put flow-specific report writing in a flow package. Put engine-only graph state
in `src/runtime/`. Put persisted shapes in `src/schemas/` first.

Keep a helper here only when at least two source layers use it.
