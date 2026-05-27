# Flow Packages

`src/flows/` owns Circuit's built-in flows: Build, Explore, Fix, Goal,
Prototype, Pursue, Review, and the internal Runtime proof flow.

Most public flows have:

| File | Purpose |
| --- | --- |
| `data.ts` | Source of the flow shape. Start here for behavior. |
| `reports.ts` | Flow-specific report schemas. |
| `command.md` | Source text for a direct command surface, when the flow has one. |
| `relay-hints.ts` | Worker-facing guidance. |
| `writers/` | Flow-specific report and summary writers. |
| `schematic.json` | Generated output. Do not edit directly. |
| `contract.md` | Contract notes when the flow needs them. |

Use [docs/flows/authoring-model.md](../../docs/flows/authoring-model.md) for
the flow-authoring playbook and [docs/generated-surfaces.md](../../docs/generated-surfaces.md)
for generated output ownership.

Public flow packages emit host mirrors under `plugins/` and compiled files under
`generated/flows/`. Internal packages emit generated flow files only.
