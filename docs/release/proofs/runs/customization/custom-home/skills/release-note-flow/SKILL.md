---
name: release-note-flow
description: Draft release notes from a change summary.
---

# release-note-flow

Draft release notes from a change summary.

## Run

Direct invocation already routes this custom flow; skip `/circuit:run`.

```bash
circuit run release-note-flow --flow-root '<repo>/docs/release/proofs/runs/customization/custom-home/flows' --goal '<task>' --progress jsonl
```
