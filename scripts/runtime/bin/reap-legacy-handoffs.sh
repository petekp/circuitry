#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: reap-legacy-handoffs.sh [--execute] [<project-root> | <project>/.relay/handoffs ...]

Lists legacy handoff files from:
  - $HOME/.claude/handoffs
  - $HOME/.relay/handoffs
  - each passed project's .relay/handoffs directory

Dry-run is the default. Pass --execute to move discovered files into:
  $HOME/.circuit/archive/legacy-handoffs/<timestamp>/
EOF
}

if [[ -z "${HOME:-}" ]]; then
  printf 'circuit: HOME is required\n' >&2
  exit 1
fi

mode="dry-run"
declare -a project_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute)
      mode="execute"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      project_args+=("$1")
      shift
      ;;
  esac
done

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
archive_dir="${HOME}/.circuit/archive/legacy-handoffs/${timestamp}"
now_epoch="$(date +%s)"

declare -a scan_roots=(
  "${HOME}/.claude/handoffs"
  "${HOME}/.relay/handoffs"
)

project_handoff_dir() {
  local input="$1"
  if [[ "$input" == */.relay/handoffs ]]; then
    printf '%s\n' "$input"
    return
  fi

  printf '%s\n' "${input%/}/.relay/handoffs"
}

canonical_dir_or_input() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    (
      cd "$dir"
      pwd -P
    )
    return
  fi

  printf '%s\n' "${dir%/}"
}

archive_relative_path() {
  local source_path="$1"
  local source_dir="$2"

  case "$source_dir" in
    "${HOME}/.claude/handoffs"|"$HOME/.claude/handoffs")
      printf 'home/.claude/handoffs/%s\n' "${source_path#${source_dir}/}"
      ;;
    "${HOME}/.relay/handoffs"|"$HOME/.relay/handoffs")
      printf 'home/.relay/handoffs/%s\n' "${source_path#${source_dir}/}"
      ;;
    *)
      local project_root
      project_root="$(dirname "$(dirname "$source_dir")")"
      project_root="${project_root#/}"
      printf 'projects/%s/.relay/handoffs/%s\n' "$project_root" "${source_path#${source_dir}/}"
      ;;
  esac
}

for arg in "${project_args[@]}"; do
  scan_roots+=("$(canonical_dir_or_input "$(project_handoff_dir "$arg")")")
done

total_files=0
would_archive=0
moved=0
scanned_roots=0
missing_roots=0

printf 'mode=%s\n' "$mode"
printf 'archive_dir=%s\n' "$archive_dir"

for raw_root in "${scan_roots[@]}"; do
  scanned_roots=$((scanned_roots + 1))
  root="${raw_root%/}"

  if [[ ! -d "$root" ]]; then
    missing_roots=$((missing_roots + 1))
    printf 'scan_root=%s status=missing\n' "$root"
    continue
  fi

  while IFS= read -r file_path; do
    [[ -n "$file_path" ]] || continue

    total_files=$((total_files + 1))
    would_archive=$((would_archive + 1))

    mtime_epoch="$(stat -f '%m' "$file_path")"
    age_days=$(( (now_epoch - mtime_epoch) / 86400 ))
    relative_archive_path="$(archive_relative_path "$file_path" "$root")"
    destination_path="${archive_dir}/${relative_archive_path}"

    if [[ "$mode" == "execute" ]]; then
      mkdir -p "$(dirname "$destination_path")"
      mv "$file_path" "$destination_path"
      moved=$((moved + 1))
      action="archived"
    else
      action="would_archive"
    fi

    printf 'file=%s age_days=%s action=%s archive_path=%s\n' \
      "$file_path" \
      "$age_days" \
      "$action" \
      "$destination_path"
  done < <(find "$root" -type f | LC_ALL=C sort)
done

printf 'SUMMARY total_files=%s would_archive=%s moved=%s scanned_roots=%s missing_roots=%s archive_dir=%s\n' \
  "$total_files" \
  "$would_archive" \
  "$moved" \
  "$scanned_roots" \
  "$missing_roots" \
  "$archive_dir"
