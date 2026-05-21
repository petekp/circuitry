# Host Package Map

Circuit ships host packages for Claude Code and Codex. These packages are the
host-facing layer around the same local engine.

| Path | Owns | Edit posture |
| --- | --- | --- |
| [`plugins/claude/`](claude/) | Claude Code plugin manifest, slash commands, hooks, compiled public flow mirrors, and bundled runtime. | Manifest, hooks, and scripts are hand-authored. Commands, skills, and runtime bundle are generated. |
| [`plugins/codex/`](codex/) | Codex plugin manifest, command mirrors, skill invocation surfaces, compiled public flow mirrors, hooks, and bundled runtime. | Manifest, hooks, and scripts are hand-authored. Commands, skills, flow mirrors, and runtime bundle are generated. |

Use [docs/generated-surfaces.md](../docs/generated-surfaces.md) for the exact
source-to-output table and drift checks.

The short rule:

```text
edit source under src/ -> regenerate -> verify generated surfaces
```

Host package files exist so installed plugins are self-contained. They are not
the source of truth for flow behavior.
