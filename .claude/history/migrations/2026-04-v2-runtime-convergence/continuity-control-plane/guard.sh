#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

scan_budget=0
compat_budget=0
selector_budget=0

count_scan_residue() {
  {
    rg -n 'findLatestActiveRun\(' scripts/runtime/engine/src || true
  } | wc -l | tr -d ' '
}

count_compat_residue() {
  {
    rg -n 'import-legacy|legacy_import|projection_revision|run_local_markdown|canonical_markdown' \
      scripts/runtime/engine/src schemas || true
  } | wc -l | tr -d ' '
}

count_selector_residue() {
  {
    rg -n 'resolveHandoffPath\(|hasValidHandoff\(|inspectContinuity\(|resolveCurrentRun\(|projectSlug\(' \
      scripts/runtime/engine/src || true
  } | wc -l | tr -d ' '
}

print_status() {
  local scan_count
  local compat_count
  local selector_count
  scan_count="$(count_scan_residue)"
  compat_count="$(count_compat_residue)"
  selector_count="$(count_selector_residue)"
  printf 'scan_residue=%s budget=%s\n' "$scan_count" "$scan_budget"
  printf 'compat_residue=%s budget=%s\n' "$compat_count" "$compat_budget"
  printf 'selector_residue=%s budget=%s\n' "$selector_count" "$selector_budget"
}

check_budget() {
  local label="$1"
  local count="$2"
  local budget="$3"
  if (( count > budget )); then
    printf 'FAIL: %s count %s exceeds budget %s\n' "$label" "$count" "$budget" >&2
    return 1
  fi
  printf 'PASS: %s count %s within budget %s\n' "$label" "$count" "$budget"
}

main() {
  if [[ "${1:-}" == "--status" ]]; then
    print_status
    return 0
  fi

  local scan_count
  local compat_count
  local selector_count
  scan_count="$(count_scan_residue)"
  compat_count="$(count_compat_residue)"
  selector_count="$(count_selector_residue)"

  check_budget "scan_residue" "$scan_count" "$scan_budget"
  check_budget "compat_residue" "$compat_count" "$compat_budget"
  check_budget "selector_residue" "$selector_count" "$selector_budget"
}

main "$@"
