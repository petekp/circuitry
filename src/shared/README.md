# Shared Helper Map

`src/shared/` is for helpers that are used across source layers. It should stay
small enough that a reader can tell why code does not belong in `src/runtime/`,
`src/flows/`, `src/cli/`, or `src/schemas/`.

## Main Groups

| Files | Own |
| --- | --- |
| `selection-resolver.ts`, `relay-selection.ts`, `skill-loading.ts`, `user-skill-registry.ts`, `config-loader.ts` | Selection, local skill, and config helpers used by CLI and runtime paths. |
| `relay-support.ts`, `relay-runtime-types.ts`, `connector-relay.ts`, `write-capable-worker-disclosure.ts` | Relay prompt, relay result, and worker-disclosure helpers shared by flows, runtime tests, and connectors. |
| `operator-summary-writer.ts`, `operator-summary/`, `html/`, `progress-output.ts`, `status-block-renderer.ts` | Human-facing run summaries, HTML projectors, and progress/status rendering helpers. |
| `proof-plan.ts`, `verification-resolver.ts`, `terminal-verdict.ts`, `recovery-route.ts`, `checkpoint-auto-resolution.ts` | Deterministic check, verification, verdict, recovery, and checkpoint policy helpers. |
| `fanout-*.ts`, `rubric.ts` | Fanout aggregation, branch templating, join policy, and scoring helpers. |
| `json-*.ts`, `zod-to-response-schema.ts` | JSON extraction, JSON report writing, and schema-to-response-schema utilities. |
| `manifest-snapshot.ts`, `result-path.ts`, `run-relative-path.ts`, `runtime-source.ts` | Run-folder, manifest, runtime-source, and path helpers shared outside the runtime package. |
| `flow-kind-policy*.ts` | Flow-kind canonical-policy helpers shared by contracts, runtime surfaces, and tests. |

## Rules Of Thumb

- Put flow-specific report writing in `src/flows/<id>/writers/` or a flow
  registry before adding it here.
- Put engine-only state, trace, or graph mechanics in `src/runtime/`.
- Put persisted or public shapes in `src/schemas/` first, then import the
  inferred type where a helper needs it.
- Keep a helper here only when at least two source layers would otherwise
  duplicate the same logic.
- If a helper starts serving only one layer, move it back to that layer during
  the next focused cleanup.
