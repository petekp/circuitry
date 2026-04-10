#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CIRCUIT_ENGINE_CLI="$PLUGIN_ROOT/scripts/runtime/bin/circuit-engine.js"
NODE_BIN="${NODE_BIN:-node}"

if [[ ! -f "$CIRCUIT_ENGINE_CLI" ]]; then
  echo "circuit: circuit-engine CLI not found at $CIRCUIT_ENGINE_CLI" >&2
  exit 1
fi

exec "$NODE_BIN" "$CIRCUIT_ENGINE_CLI" "$@"
