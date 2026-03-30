#!/usr/bin/env bash
# setup.sh — Initialize relay scripts in the current project
#
# Usage:
#   ./scripts/setup.sh [--target-dir <dir>]
#
# Copies relay scripts (compose-prompt.sh, dispatch.sh, update-batch.sh) and
# manage-codex reference templates into the target project's scripts/relay/
# directory. This is needed because circuits dispatch work via these scripts
# from the project root.
#
# If --target-dir is not provided, copies to the current working directory.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${PWD}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--target-dir <dir>]"
      echo ""
      echo "Copies relay scripts and manage-codex references into <dir>/scripts/relay/"
      echo "Default <dir> is the current working directory."
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

RELAY_DIR="${TARGET_DIR}/scripts/relay"
REFERENCES_DIR="${RELAY_DIR}/references"
REFERENCE_TEMPLATES=(
  agents-md-template.md
  converge-template.md
  implement-template.md
  relay-protocol.md
  review-preamble.md
  review-template.md
  ship-review-template.md
)

echo "Setting up Circuit relay scripts..."
echo "  Source:  ${PLUGIN_ROOT}/scripts/relay/"
echo "  Target:  ${RELAY_DIR}/"

mkdir -p "${RELAY_DIR}"
mkdir -p "${REFERENCES_DIR}"

cp "${PLUGIN_ROOT}/scripts/relay/compose-prompt.sh" "${RELAY_DIR}/compose-prompt.sh"
cp "${PLUGIN_ROOT}/scripts/relay/dispatch.sh" "${RELAY_DIR}/dispatch.sh"
cp "${PLUGIN_ROOT}/scripts/relay/update-batch.sh" "${RELAY_DIR}/update-batch.sh"

for template in "${REFERENCE_TEMPLATES[@]}"; do
  cp "${PLUGIN_ROOT}/skills/manage-codex/references/${template}" "${REFERENCES_DIR}/${template}"
done

chmod +x "${RELAY_DIR}/compose-prompt.sh"
chmod +x "${RELAY_DIR}/dispatch.sh"
chmod +x "${RELAY_DIR}/update-batch.sh"

echo ""
echo "Done. Relay scripts installed at ${RELAY_DIR}/"
echo "Manage-codex references installed at ${REFERENCES_DIR}/"
echo ""
echo "Next steps:"
echo "  1. Create AGENTS.md in your project root"
echo "     Template: ${PLUGIN_ROOT}/skills/manage-codex/references/agents-md-template.md"
echo "  2. Invoke a circuit: /circuit:router <describe your task>"
echo ""
echo "Optional: install Codex CLI for better parallelism: npm install -g @openai/codex"
