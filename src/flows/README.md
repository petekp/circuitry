# Flow Packages

`src/flows/` owns Circuit's built-in flows: Build, Explore, Fix, Prototype,
Pursue, and Review, plus the internal Goal and Runtime proof flows.

Most public flows have:

| File | Purpose |
| --- | --- |
| `data.ts` | Source of the flow shape. Start here for behavior. |
| `reports.ts` | Flow-specific report schemas. |
| `command.md` | Optional source for a direct command surface. No built-in flow ships one today. |
| `relay-hints.ts` | Worker-facing guidance. |
| `writers/` | Flow-specific report and summary writers. |
| `schematic.json` | Generated output. Do not edit directly. |
| `contract.md` | Contract notes when the flow needs them. |

Use [docs/flows/authoring-model.md](../../docs/flows/authoring-model.md) for
the flow-authoring playbook and [docs/generated-surfaces.md](../../docs/generated-surfaces.md)
for generated output ownership.

Public flow packages emit host mirrors under `plugins/` and compiled files under
`generated/flows/`. Internal packages emit generated flow files only.
