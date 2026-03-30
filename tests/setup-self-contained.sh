#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/circuit-setup-test.XXXXXX")"
PROJECT_DIR="${TMP_DIR}/project"
FAKE_HOME="${TMP_DIR}/home"
HEADER_FILE="${TMP_DIR}/header.md"
OUTPUT_FILE="${TMP_DIR}/prompt.md"
REFERENCE_TEMPLATES=(
  agents-md-template.md
  converge-template.md
  implement-template.md
  relay-protocol.md
  review-preamble.md
  review-template.md
  ship-review-template.md
)

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

mkdir -p "$PROJECT_DIR" "$FAKE_HOME"

"$REPO_ROOT/scripts/setup.sh" --target-dir "$PROJECT_DIR" >/dev/null

test -d "$PROJECT_DIR/scripts/relay/references"
for template in "${REFERENCE_TEMPLATES[@]}"; do
  test -f "$PROJECT_DIR/scripts/relay/references/$template"
done

printf '# Regression Header\n' > "$HEADER_FILE"

HOME="$FAKE_HOME" \
  "$PROJECT_DIR/scripts/relay/compose-prompt.sh" \
  --header "$HEADER_FILE" \
  --template implement \
  --root "${TMP_DIR}/relay-root" \
  --out "$OUTPUT_FILE" >/dev/null

grep -q '^### Files Changed$' "$OUTPUT_FILE"
