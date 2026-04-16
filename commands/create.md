---
description: "Generate, validate, and publish a user-global custom circuit workflow."
---

Direct utility invocation for `/circuit:create`.

## Purpose

Generate, validate, and publish a user-global custom circuit workflow.

## Examples

```
/circuit:create                             # Guided flow: draft, validate, publish
```

## Bootstrap Contract

Launch the `circuit:create` skill immediately.
First resolve the installed plugin root from `.circuit/plugin-root`.
Do not search the whole repo, plugin cache, or `$HOME` to rediscover Circuit docs or skills.
Use exact paths plus the bundled `custom-circuits` helper CLI for catalog checks, draft validation, and publish.
Keep shell steps short and single-purpose; avoid long chained one-liners unless they are unavoidable.
