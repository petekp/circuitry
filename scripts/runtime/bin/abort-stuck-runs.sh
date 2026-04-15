#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: abort-stuck-runs.sh [--dry-run|--execute]
EOF
}

mode="dry-run"
seen_dry_run=0
seen_execute=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      seen_dry_run=1
      if [[ "$seen_execute" -eq 1 ]]; then
        echo "circuit: --execute and --dry-run cannot be used together" >&2
        exit 1
      fi
      mode="dry-run"
      ;;
    --execute)
      seen_execute=1
      if [[ "$seen_dry_run" -eq 1 ]]; then
        echo "circuit: --execute and --dry-run cannot be used together" >&2
        exit 1
      fi
      mode="execute"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "circuit: unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_BIN="$SCRIPT_DIR/circuit-engine.js"
RUNS_DIR=".circuit/circuit-runs"
TERMINAL_STATUSES="aborted blocked complete completed failed handed_off stopped"

if [[ ! -d "$RUNS_DIR" ]]; then
  echo "No run directory found at $RUNS_DIR"
  exit 0
fi

stuck_count=0
failed=0

while IFS= read -r -d '' state_file; do
  status="$(node -e 'const fs=require("fs"); const state=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(state.status ?? ""));' "$state_file")"
  if [[ " $TERMINAL_STATUSES " == *" $status "* ]]; then
    continue
  fi

  run_root="$(dirname "$state_file")"
  run_slug="$(basename "$run_root")"
  stuck_count=$((stuck_count + 1))
  echo "$run_slug status=$status"

  if [[ "$mode" == "execute" ]]; then
    reason="stuck-run migration: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    output_file="$(mktemp "${TMPDIR:-/tmp}/circuit-abort-run.XXXXXX")"
    if ! node "$ENGINE_BIN" abort-run --run-root "$run_root" --reason "$reason" >"$output_file" 2>&1; then
      failed=1
      echo "Failed to abort $run_slug" >&2
      cat "$output_file" >&2
    fi
    rm -f "$output_file"
  fi
done < <(find "$RUNS_DIR" -mindepth 2 -maxdepth 2 -name state.json -type f -print0)

if [[ "$mode" == "dry-run" ]]; then
  if [[ "$stuck_count" -eq 0 ]]; then
    echo "No stuck runs found."
  fi
  echo "Re-run with --execute to abort them."
  exit 0
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

if [[ "$stuck_count" -eq 0 ]]; then
  echo "No stuck runs found."
fi
