# Source Tree Map

Start here when a change touches TypeScript source. Pick the narrowest owner
first, then follow that layer's local README.

| Path | Owns | First check |
| --- | --- | --- |
| `src/cli/` | CLI commands and output shaping. | Public command behavior, flags, and run-folder output. |
| `src/commands/` | Hand-authored direct command source for generated host mirrors. | Direct command ownership and generated-surface drift. |
| `src/connectors/` | Built-in worker connector implementations. | Connector protocol, process execution, and transcript capture. |
| `src/flows/` | Built-in flow packages, flow catalog, compiler support, and flow-owned writers. | Flow package README and generated surfaces. |
| `src/runtime/` | Engine mechanics for executing compiled flows. | Runtime README and runtime tests. |
| `src/schemas/` | Zod schemas for contracts, config, traces, reports, and generated manifests. | Schema README and contract tests. |
| `src/shared/` | Cross-layer helpers used by CLI, flows, runtime, and summaries. | Import direction and caller ownership. |
| `src/run-status/` | Run status projections and run-folder lookup helpers. | Status projection tests. |
| `src/release/` | Release metadata helpers. | Release infrastructure checks. |
| `src/types/` | Hand-written TypeScript-only helpers that cannot be inferred cleanly from schemas. | Types README and contract parity tests. |
| `src/index.ts` | Public package export surface. | Export and barrel tests. |

## Boundary Rules

- Flow-specific behavior belongs in `src/flows/<id>/` or flow registries, not in
  `src/runtime/`.
- Generated host mirrors belong under `plugins/` and `generated/`; edit the
  source file and regenerate.
- Schemas describe contracts. Runtime code should parse and act on those
  contracts, not invent hidden shapes.
- Public command behavior must stay aligned with generated host command and
  skill surfaces.

## Suggested Read Order

1. Operator or host behavior: [docs/README.md](../docs/README.md) first.
2. Source ownership: this file.
3. Runtime changes: [src/runtime/README.md](runtime/README.md).
4. Schema changes: [src/schemas/README.md](schemas/README.md).
5. Type-only changes: [src/types/README.md](types/README.md).
6. Flow changes: [src/flows/README.md](flows/README.md) and
   [docs/flows/authoring-model.md](../docs/flows/authoring-model.md).
