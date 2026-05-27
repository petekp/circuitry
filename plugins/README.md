# Host Packages

Circuit ships host packages for Claude Code and Codex. They give each host a
self-contained way to run the same local Circuit engine.

| Path | What it is | Edit posture |
| --- | --- | --- |
| [`plugins/claude/`](claude/) | Claude Code plugin package. | Manifests, hooks, and scripts are hand-authored. Commands, flow mirrors, and runtime bundle are generated. |
| [`plugins/codex/`](codex/) | Codex plugin package. | Manifests, hooks, and scripts are hand-authored. Commands, skills, flow mirrors, and runtime bundle are generated. |

Short rule:

```text
edit source under src/ -> regenerate -> verify generated surfaces
```

Use [docs/generated-surfaces.md](../docs/generated-surfaces.md) for the exact
source-to-output map.
