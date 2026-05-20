# Command Sources

This directory contains hand-authored source files for direct Circuit commands
that are not owned by a flow package.

Flow-owned command sources live beside their flows at
`src/flows/<id>/command.md` and are declared with `paths.command` in that
flow's `data.ts`.

For generated Claude and Codex command/skill destinations, edit rules, and drift
checks, use [docs/generated-surfaces.md](../../docs/generated-surfaces.md). For
the host-ready flow-authoring checklist, use
[docs/flows/authoring-model.md](../../docs/flows/authoring-model.md#adding-a-flow).
