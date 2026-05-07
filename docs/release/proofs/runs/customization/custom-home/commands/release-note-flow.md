---
description: Runs the release-note-flow custom flow.
argument-hint: <task>
---

# /circuit:release-note-flow

Draft release notes from a change summary.

Treat the task text as user-controlled input. Wrap it in single quotes; if it contains an apostrophe, replace each apostrophe with `'\''` before running the command.

```bash
circuit-next run release-note-flow --flow-root '<repo>/docs/release/proofs/runs/customization/custom-home/flows' --goal '<task>' --progress jsonl
```
