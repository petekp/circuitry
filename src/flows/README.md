# Flow Package Map

`src/flows/` owns built-in flows and the compiler/catalog support that turns
authored flow data into generated schematics and compiled runtime files.

## Flow Package Shape

Most public flow packages follow this shape:

| File | Role |
| --- | --- |
| `data.ts` | Hand-authored FlowData source. Start here for behavior. |
| `flow.ts` | Thin adapter that binds FlowData to the compiler. |
| `reports.ts` | Flow-specific report schemas. |
| `command.md` | Flow-owned command source when the flow has a direct command surface. |
| `relay-hints.ts` | Prompt and relay guidance for worker-facing steps. |
| `writers/` | Flow-specific report and summary writers. |
| `schematic.json` | Generated schematic output. Do not edit directly. |
| `contract.md` | Flow-specific contract notes when needed. |

Use [docs/flows/authoring-model.md](../../docs/flows/authoring-model.md) for
the full authoring model and [docs/generated-surfaces.md](../../docs/generated-surfaces.md)
for output ownership.

## Root Support Files

| Path | Owns |
| --- | --- |
| `catalog.ts` | Built-in flow package list. Runtime derives from this catalog. |
| `catalog-derivations.ts` | Pure derivation helpers for registries and runtime package data. |
| `compile-schematic-to-flow.ts` | Schematic-to-compiled-flow projection. |
| `router.ts` | CLI flow selection for natural-language goals. |
| `registries/` | Report schemas, writers, validators, shape hints, and runtime index derived from flow packages. |
| `block-step-expansion.ts` | Expansion from authored block uses to executable schematic steps. |
| `canonical-stage-policy.ts` and `stage-policy.ts` | Stage policy helpers. |

## Public And Internal Packages

Public flow packages emit host mirrors under `plugins/` and compiled files under
`generated/flows/`. Internal flow packages emit only generated flow files and
must not have host mirrors.

Current packages:

- Public: `build`, `explore`, `fix`, `goal`, `prototype`, `pursue`, `review`
- Internal: `runtime-proof`
