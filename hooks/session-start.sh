#!/usr/bin/env bash
# session-start.sh — Outputs the Circuit plugin session banner as markdown
#
# Called by hooks.json on SessionStart. Checks prerequisites and lists
# available circuits.

set -uo pipefail

# ── Prerequisite check: Codex CLI ─────────────────────────────────────
if ! command -v codex >/dev/null 2>&1; then
  cat <<'WARNING'
> **Warning: Codex CLI not found**
>
> The Circuit plugin dispatches heavy implementation to Codex workers.
> Without `codex`, circuits that use `manage-codex` will fail.
>
> Install it:
> ```
> npm install -g @openai/codex
> ```
>
> Then verify: `codex --version`

---

WARNING
fi

# ── Banner ────────────────────────────────────────────────────────────
cat <<'BANNER'
# Circuit

```
/circuit:router <describe your task>
```

Circuits are structured, multi-phase workflows that break complex engineering tasks into artifact chains — each phase writes a durable file that feeds the next. Heavy implementation is dispatched to **Codex workers** automatically.

The router picks the right circuit for your task. Start there.

---

### Reference: All Circuits

| Circuit | Invoke | Use When |
|---------|--------|----------|
| **Router** | `/circuit:router` | Unsure which circuit fits — start here |
| **Develop** | `/circuit:develop` | Feature delivery with unclear approach |
| **Decide** | `/circuit:decide` | Architecture choices with real tradeoffs |
| **Harden Spec** | `/circuit:harden-spec` | Turn a rough spec into a build-ready plan |
| **Repair Flow** | `/circuit:repair-flow` | Fix a broken or flaky end-to-end flow |
| **Ratchet Quality** | `/circuit:ratchet-quality` | Autonomous overnight quality improvement |
| **Cleanup** | `/circuit:cleanup` | Dead code and stale docs sweep |
| **Circuit Create** | `/circuit:create` | Author a new circuit from a workflow description |
| **Dry Run** | `/circuit:dry-run` | Validate a circuit skill's mechanical soundness |
| **Setup** | `/circuit:setup` | Discover skills and generate circuit.config.yaml |

Use `/manage-codex` to orchestrate Codex workers directly without a circuit wrapper.
BANNER
