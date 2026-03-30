#!/usr/bin/env bash
# session-start.sh — Outputs the Circuit plugin session banner as markdown
#
# Called by hooks.json on SessionStart. Checks prerequisites and lists
# available circuits.

set -uo pipefail

# ── Prerequisite check: Codex CLI ─────────────────────────────────────
if command -v codex >/dev/null 2>&1; then
  DISPATCH_BACKEND="codex"
else
  DISPATCH_BACKEND="agent"
  cat <<'NOTE'
> **Dispatch backend: Agent (Codex CLI not found)**
>
> Dispatch steps will use Claude Code's **Agent tool** (`isolation: "worktree"`)
> instead of `codex exec`. Circuits work fully in this mode -- the artifact chain,
> gates, and resume logic are identical regardless of backend.
>
> For better parallelism, you can optionally install Codex CLI:
> ```
> npm install -g @openai/codex
> ```

---

NOTE
fi

# ── Banner ────────────────────────────────────────────────────────────
cat <<'BANNER'
# Circuit System Available

You have access to the **Circuit** plugin — structured multi-phase workflows for complex engineering tasks.

## Available Circuits

| Circuit | Invoke | Use When |
|---------|--------|----------|
| **Router** | `/circuit:router` | Unsure which circuit fits |
| **Develop** | `/circuit:develop` | Feature delivery with unclear approach |
| **Decide** | `/circuit:decide` | Architecture choices with real tradeoffs |
| **Harden Spec** | `/circuit:harden-spec` | Turn a rough spec into a build-ready plan |
| **Repair Flow** | `/circuit:repair-flow` | Fix a broken or flaky end-to-end flow |
| **Ratchet Quality** | `/circuit:ratchet-quality` | Autonomous overnight quality improvement |
| **Cleanup** | `/circuit:cleanup` | Dead code and stale docs sweep |
| **Circuit Create** | `/circuit:create` | Author a new circuit from a workflow description |
| **Dry Run** | `/circuit:dry-run` | Validate a circuit skill's mechanical soundness |
| **Setup** | `/circuit:setup` | Discover skills and generate circuit.config.yaml |

## How It Works

Circuits produce **artifact chains** — each phase writes a durable file that feeds the next. Heavy implementation is dispatched to workers via the `manage-codex` orchestrator. Workers run via **Codex CLI** when installed, or via Claude Code's **Agent tool** as a fallback.

The relay scripts (`compose-prompt.sh`, `dispatch.sh`, `update-batch.sh`) handle prompt assembly, backend dispatch, and batch state.

## Quick Start

1. Copy relay scripts to your project: `cp -r "$(claude plugin path circuit)/scripts/relay" ./scripts/relay`
2. Invoke a circuit: `/circuit:router <describe your task>`

Optionally install Codex CLI for better parallelism: `npm install -g @openai/codex`

Use `/manage-codex` to orchestrate workers directly without a circuit wrapper.
BANNER
