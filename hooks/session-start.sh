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

Circuits produce **artifact chains** — each phase writes a durable file that feeds the next. Heavy implementation is dispatched to **Codex workers** via the `manage-codex` orchestrator.

The relay scripts (`compose-prompt.sh`, `update-batch.sh`) handle prompt assembly and batch state.

## Quick Start

1. Copy relay scripts to your project: `cp -r "$(claude plugin path circuit)/scripts/relay" ./scripts/relay`
2. Ensure `codex` CLI is installed: `npm install -g @openai/codex`
3. Invoke a circuit: `/circuit:router <describe your task>`

Use `/manage-codex` to orchestrate Codex workers directly without a circuit wrapper.
BANNER
