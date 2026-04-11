#!/usr/bin/env bash
set -euo pipefail

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  project_dir="$(git rev-parse --show-toplevel)"
else
  project_dir="$PWD"
fi
# Sanitize project path to a slug: normalize separators and strip unsafe chars
# Converts backslashes and slashes to dashes, strips colons and other
# characters unsafe in file paths (e.g. Windows drive letter "C:").
project_slug=$(printf '%s' "$project_dir" | tr '\\' '/' | tr '/' '-' | sed 's/[:<>"|?*]//g; s/^-//')
handoff_home="${CIRCUIT_HANDOFF_HOME:-}"
handoff_root=".claude/projects"
if [[ -z "$handoff_home" && -d "$project_dir/../home" ]]; then
  handoff_home="$project_dir/../home"
  handoff_root=".circuit-projects"
fi
if [[ -z "$handoff_home" ]]; then
  handoff_home="$HOME"
fi
if [[ -n "${CIRCUIT_HANDOFF_HOME:-}" ]]; then
  handoff_root=".circuit-projects"
fi
handoff_file="$handoff_home/$handoff_root/${project_slug}/handoff.md"

print_continuity_banner() {
  local available="$1"
  cat <<EOF
> **Circuit continuity available.** This is context only.
> Fresh \`/circuit:*\` commands should be honored as the active task.
> Resume saved continuity only through \`/circuit:handoff resume\`.
> Available: ${available}

EOF
}

# Check for active run via explicit pointer, fall back to most-recent heuristic
active_run=""
circuit_runs_dir="${project_dir}/.circuit/circuit-runs"
current_run_pointer="${project_dir}/.circuit/current-run"

if [[ -L "$current_run_pointer" ]] || [[ -f "$current_run_pointer" ]]; then
  # Explicit pointer exists -- resolve it
  if [[ -L "$current_run_pointer" ]]; then
    pointed_dir=$(readlink "$current_run_pointer")
    # Resolve relative symlinks
    if [[ ! "$pointed_dir" = /* ]]; then
      pointed_dir="${project_dir}/.circuit/${pointed_dir}"
    fi
  else
    # Plain file containing the run slug
    pointed_dir="${circuit_runs_dir}/$(cat "$current_run_pointer")"
  fi
  if [[ -f "${pointed_dir}/artifacts/active-run.md" ]]; then
    active_run="${pointed_dir}/artifacts/active-run.md"
  fi
fi

# Fallback: most recently modified active-run.md (single-run heuristic)
# Fully null-safe: use find -print0 and compare mtimes in a while-read loop.
# No ls parsing, no newline assumptions, works on macOS and Linux.
if [[ -z "$active_run" ]] && [[ -d "$circuit_runs_dir" ]]; then
  newest_mtime=0
  newest_file=""
  while IFS= read -r -d '' candidate; do
    # stat -f %m (macOS) or stat -c %Y (Linux) for mtime as epoch seconds
    if mtime=$(stat -f %m "$candidate" 2>/dev/null) || mtime=$(stat -c %Y "$candidate" 2>/dev/null); then
      if (( mtime > newest_mtime )); then
        newest_mtime=$mtime
        newest_file="$candidate"
      fi
    fi
  done < <(find "$circuit_runs_dir" -name "active-run.md" -maxdepth 3 -type f -print0 2>/dev/null)
  [[ -n "$newest_file" ]] && active_run="$newest_file"
fi

has_handoff=0
if [[ -f "$handoff_file" ]] && head -1 "$handoff_file" | grep -q '^# Handoff'; then
  has_handoff=1
fi

has_active_run=0
if [[ -n "$active_run" ]] && [[ -f "$active_run" ]]; then
  has_active_run=1
  run_root="$(cd "$(dirname "$active_run")/.." && pwd)"
  if [[ -f "${run_root}/circuit.manifest.yaml" ]]; then
    if ! "${CLAUDE_PLUGIN_ROOT}/scripts/relay/circuit-engine.sh" render --run-root "$run_root" >/dev/null 2>&1; then
      printf 'warning: circuit-engine render failed for %s; using last saved dashboard\n' "$run_root" >&2
    fi
  fi
fi

if (( has_handoff == 1 || has_active_run == 1 )); then
  available_labels=""
  if (( has_handoff == 1 )); then
    available_labels="pending handoff"
  fi
  if (( has_active_run == 1 )); then
    if [[ -n "$available_labels" ]]; then
      available_labels="${available_labels}, active run"
    else
      available_labels="active run"
    fi
  fi
  print_continuity_banner "$available_labels"
else
  cat <<'WELCOME'
Circuit is active. Try one of these to get started:

  /circuit:run fix: login form rejects valid emails       Bug fix with test-first discipline
  /circuit:run add dark mode support to the settings page  Router picks the right workflow
  /circuit:run decide: REST vs GraphQL for the new API     Adversarial evaluation of options

Circuit classifies your task into the right workflow (Explore, Build, Repair,
Migrate, Sweep), selects a rigor level, and runs it. You step in at checkpoints.
If a session crashes, the next one picks up where it stopped.
WELCOME
fi
