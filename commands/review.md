---
description: "Standalone fresh-context code review."
---

Direct utility invocation for `/circuit:review`.

## Purpose

Standalone fresh-context code review.

## Examples

Scope selection is mechanical. Name a scope or fall back to the repo's current diff:

```
/circuit:review                             # Uncommitted diff, else most recent commit
/circuit:review src/auth/                   # Explicit scope: named paths
/circuit:review HEAD~3..HEAD                # Explicit scope: diff target
```

## Bootstrap Contract

Launch the `circuit:review` skill immediately.
Execute argument-selected fast modes before context gathering.
Use hook-authored helper wrappers from `.circuit/bin/` when the utility needs Circuit helpers.
Do not do broad repo exploration unless the utility contract explicitly requires it.
