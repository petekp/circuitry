#!/usr/bin/env bash
# dispatch.sh — Backend-agnostic dispatch for Circuit workers
#
# Detects whether Codex CLI is available and dispatches accordingly.
# When Codex is installed, uses `codex exec --full-auto`.
# When Codex is not installed, emits an Agent tool invocation that the
# orchestrator (Claude) should execute directly.
#
# Usage:
#   ./scripts/relay/dispatch.sh --prompt <file> --output <file> [--backend codex|agent]
#
# Options:
#   --prompt FILE    — Assembled prompt file to send to the worker (required)
#   --output FILE    — Path where worker should write its last-message trace (required)
#   --backend MODE   — Force backend: "codex" or "agent" (optional; auto-detects if omitted)
#
# Exit codes:
#   0  — Dispatch succeeded (codex backend) or instructions emitted (agent backend)
#   1  — Error (missing args, codex forced but not found, etc.)
#
# When backend=agent, this script does NOT execute the Agent tool itself (it cannot —
# that's a Claude Code tool). Instead it prints a structured instruction block that
# the orchestrator should copy into an Agent tool call.

set -euo pipefail

PROMPT=""
OUTPUT=""
BACKEND=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt)  PROMPT="$2"; shift 2 ;;
    --output)  OUTPUT="$2"; shift 2 ;;
    --backend) BACKEND="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROMPT" || -z "$OUTPUT" ]]; then
  echo "ERROR: --prompt and --output are required" >&2
  exit 1
fi

if [[ ! -f "$PROMPT" ]]; then
  echo "ERROR: prompt file not found: $PROMPT" >&2
  exit 1
fi

# Auto-detect backend if not specified
if [[ -z "$BACKEND" ]]; then
  if command -v codex >/dev/null 2>&1; then
    BACKEND="codex"
  else
    BACKEND="agent"
  fi
fi

case "$BACKEND" in
  codex)
    if ! command -v codex >/dev/null 2>&1; then
      echo "ERROR: --backend codex specified but codex CLI not found" >&2
      echo "Install with: npm install -g @openai/codex" >&2
      exit 1
    fi
    cat "$PROMPT" | codex exec --full-auto -o "$OUTPUT" -
    ;;

  agent)
    # Emit structured instructions for the orchestrator to use the Agent tool.
    # The orchestrator (Claude) reads this output and creates an Agent tool call.
    PROMPT_CONTENT="$(cat "$PROMPT")"
    cat <<AGENT_INSTRUCTIONS
DISPATCH_BACKEND=agent

Use the Agent tool to execute this worker. Pass the prompt content below as the
Agent tool's task parameter. Use isolation: "worktree" for safe execution.

Agent tool parameters:
  task: |
    ${PROMPT_CONTENT}

    ---
    Write your last-message trace to: ${OUTPUT}
  isolation: worktree

After the Agent completes, verify its output artifacts exist at the expected paths.
AGENT_INSTRUCTIONS
    ;;

  *)
    echo "ERROR: unknown backend: $BACKEND (expected 'codex' or 'agent')" >&2
    exit 1
    ;;
esac
