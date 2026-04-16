---
description: "Save, explicitly resume, or clear session continuity across session boundaries."
---

Direct utility invocation for `/circuit:handoff`.

## Purpose

Save, explicitly resume, or clear session continuity across session boundaries.

## Examples

Fast modes are positional subcommands:

```
/circuit:handoff                            # Draft continuity from conversation and save
/circuit:handoff resume                     # Present saved continuity and pick up
/circuit:handoff done                       # Clear continuity and detach the current run
```

## Bootstrap Contract

Launch the `circuit:handoff` skill immediately.
Execute argument-selected fast modes before context gathering.
Use hook-authored helper wrappers from `.circuit/bin/` when the utility needs Circuit helpers.
Do not do broad repo exploration unless the utility contract explicitly requires it.
