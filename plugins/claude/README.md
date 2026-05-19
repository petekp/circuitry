# Claude Code Plugin Package

This directory is the self-contained Claude Code plugin package for Circuit.
Load it from this checkout with:

```bash
claude --plugin-dir ./plugins/claude
```

## What lives here

- `.claude-plugin/plugin.json` — hand-authored plugin manifest (name, version,
  description, keywords).
- `commands/<id>.md` — **generated** Claude Code command files copied from
  source command files.
- `skills/<flow>/` — **generated** compiled flow JSON files for public flows.
  Some public flows, such as Pursue, can be selected by `/circuit:run` without
  owning a dedicated slash command. Each folder contains `circuit.json` and any
  per-mode variants (e.g. `lite.json`).
- `hooks/` — Claude Code auto-loaded SessionStart hook registration and hook
  script.
- `runtime/circuit.js` — **generated** bundled Circuit runtime. Normal
  installs use this file; no separate `circuit` binary is required.
- `scripts/circuit.mjs` — plugin-local wrapper that injects this
  package's generated flow root before launching the bundled runtime. For
  development only, `CIRCUIT_CLI=/absolute/path/to/bin/circuit`
  overrides the bundle and `CIRCUIT_DEV=1` allows repo-local or `PATH`
  fallback.

## Editing rules

- `.claude-plugin/plugin.json`, `hooks/`, and `scripts/` — edit by hand.
- `commands/<id>.md` — **do not edit by hand**. Edit
  `src/commands/<id>.md` for direct commands or
  `src/flows/<id>/command.md` for flow-owned commands.
- `skills/<flow>/*.json` — **do not edit by hand**. Edit the flow's
  `src/flows/<id>/data.ts` source and thin `src/flows/<id>/flow.ts` adapter,
  then regenerate.
- `runtime/circuit.js` — **do not edit by hand**. Run
  `npm run build-plugin-runtime`.
- After editing an authored source, run `npm run emit-flows`. The drift check
  (`npm run check-flow-drift`) fails CI if generated files diverge.

## Why generated

The runtime composes a compiled flow from each schematic via the catalog
and emit pipeline. This is the canonical source. Hand-edited host output would
silently diverge from the source and break the runtime contract.
