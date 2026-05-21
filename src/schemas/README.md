# Schema Map

`src/schemas/` owns runtime and generated-surface contracts. The files are Zod
schemas first and TypeScript types second.

## Main Groups

| Files | Own |
| --- | --- |
| `compiled-flow.ts`, `flow-schematic.ts`, `flow-schematic-policy.ts`, `flow-blocks.ts`, `flow-block-definitions.ts` | Flow authoring, compiler, block catalog, and compiled graph contracts. |
| `step.ts`, `stage.ts`, `route-policy.ts`, `check.ts`, `acceptance-criteria.ts` | Step, stage, route, check, and acceptance criteria contracts. |
| `run.ts`, `run-status.ts`, `snapshot.ts`, `trace-entry.ts`, `operator-summary.ts`, `result.ts` | Run-folder state, trace entries, snapshots, summaries, and final result shapes. |
| `config.ts`, `selection-policy.ts`, `connector.ts`, `skill.ts`, `axes.ts`, `depth.ts`, `rigor.ts`, `role.ts` | Config, selection, connector, skill, depth, and role contracts. |
| `host.ts`, `progress-event.ts`, `runtime-source.ts`, `manifest.ts` | Host progress, runtime source, and plugin manifest-facing shapes. |
| `ids.ts`, `scalars.ts`, `json.ts`, `change-kind.ts`, `rubric.ts`, `verification.ts`, `continuity.ts` | Shared scalar, JSON, verification, continuity, and older serialized compatibility shapes. |

## Rules Of Thumb

- Persisted shapes should be strict unless a contract intentionally permits
  extension.
- Product vocabulary belongs in [UBIQUITOUS_LANGUAGE.md](../../UBIQUITOUS_LANGUAGE.md).
- Generated surfaces and release checks often read these schemas indirectly, so
  schema changes usually need contract tests plus generated-surface checks.
- Keep deprecated serialized names where existing data needs them, but avoid
  teaching those names in product prose.
