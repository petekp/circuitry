# Codex Plugin Package

This directory is the self-contained Codex plugin package for Circuit. This
README is for plugin development and from-checkout testing. End users should
start from the root [`README.md`](../../README.md) and ask Codex through
`/circuit:run` or a direct Circuit slash command.

## What Lives Here

- `.codex-plugin/plugin.json` - hand-authored plugin manifest, interface text,
  skill root, and marketplace metadata.
- `skills/<id>/SKILL.md` - generated Codex skill invocation surfaces. These are
  the files Codex reads for bundled Circuit skills.
- `commands/<id>.md` - generated command mirrors. They remain reference
  surfaces and byte-for-byte mirrors for command content.
- `flows/<id>/*.json` - generated compiled public flow mirrors.
- `hooks/` - Codex session-start hook script.
- `runtime/circuit.js` - generated bundled Circuit runtime. Normal installs use
  this file; no separate `circuit` binary is required.
- `scripts/circuit.ts` - plugin-local wrapper that launches the bundled runtime
  with this package's generated flow root.

## Editing Rules

- `.codex-plugin/plugin.json`, `hooks/`, and `scripts/` - edit by hand.
- `skills/<id>/SKILL.md` and `commands/<id>.md` - do not edit by hand. Edit
  `src/commands/<id>.md` for direct commands or
  `src/flows/<id>/command.md` for flow-owned commands.
- `flows/<id>/*.json` - do not edit by hand. Edit the flow package source under
  `src/flows/<id>/`, then regenerate.
- `runtime/circuit.js` - do not edit by hand. Run
  `npm run build-plugin-runtime`.
- After editing an authored source, run `npm run emit-flows`. The drift check
  (`npm run check-flow-drift`) fails CI if generated files diverge.

## Read First

Use [docs/generated-surfaces.md](../../docs/generated-surfaces.md) for the full
source-to-output map. The short rule is:

```text
edit source under src/ -> regenerate -> verify generated surfaces
```

Codex skills are generated host instructions, not local operator skill sources.
Local operator skills live outside this package, such as under
`~/.agents/skills` or `~/.claude/skills`.
