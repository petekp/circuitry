---
description: "The primary Circuit router."
---

Direct slash-command invocation for `/circuit:run <task>`.

## Purpose

The primary Circuit router.

## Examples

Prefix a task with a built-in intent to skip classification and dispatch directly:

| Prefix | Workflow | Rigor |
|--------|----------|-------|
| `fix:` | Repair | Lite |
| `repair:` | Repair | Deep |
| `develop:` | Build | Standard |
| `decide:` | Explore | Tournament |
| `migrate:` | Migrate | Deep |
| `cleanup:` | Sweep | Standard |
| `overnight:` | Sweep | Autonomous |
| (none) | (classify) | (auto) |

```
/circuit:run <task>                         # Router classifies
/circuit:run fix: login drops the session   # Dispatch to Repair Lite
/circuit:run develop: add SSO flow          # Dispatch to Build Standard
/circuit:run cleanup: unused exports        # Dispatch to Sweep Standard
```

## Bootstrap Contract

Launch the `circuit:run` skill immediately.
Use hook-authored helper wrappers from `.circuit/bin/` instead of rediscovering plugin paths or cache layout.
If the request is an explicit smoke/bootstrap verification of the workflow, bootstrap and validate run state, then stop without unrelated repo exploration.
Valid smoke evidence is the real `.circuit` run state and workflow scaffold on disk; repo hygiene or branch status alone does not count.
For smoke/bootstrap requests, manual `Write`/`Edit` creation of `circuit.manifest.yaml`, `events.ndjson`, the derived `state.json` snapshot, or `artifacts/active-run.md` is a failure; use `.circuit/bin/circuit-engine bootstrap` instead.
Inside that skill, execute its compiled contract block before unrelated repo exploration.
Do not reinterpret this command as a generic repo-understanding request.
