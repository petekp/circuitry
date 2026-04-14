#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
NODE_BIN="${NODE_BIN:-node}"
RSYNC_BIN="${RSYNC_BIN:-rsync}"
RG_BIN="${RG_BIN:-rg}"
CLAUDE_TIMEOUT_SEC="${CLAUDE_TIMEOUT_SEC:-90}"
CONTINUITY_CLI="$REPO_ROOT/scripts/runtime/bin/continuity.js"
CIRCUIT_ENGINE_CLI="$REPO_ROOT/scripts/runtime/bin/circuit-engine.js"
CACHED_PLUGIN_ROOT="${CACHED_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/circuit}"

SYNC_CACHE=1
REQUESTED_CASES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-sync)
      SYNC_CACHE=0
      ;;
    --case)
      shift
      REQUESTED_CASES+=("${1:-}")
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      exit 1
      ;;
  esac
  shift || true
done

for command_name in "$CLAUDE_BIN" "$NODE_BIN" "$RSYNC_BIN" "$RG_BIN" git; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

if (( SYNC_CACHE == 1 )); then
  "$REPO_ROOT/scripts/sync-to-cache.sh"
fi

STAMP="$(date '+%Y%m%d-%H%M%S')"
HARNESS_ROOT="$REPO_ROOT/.circuit/manual-host-surface-smoke/$STAMP"
LOG_ROOT="$HARNESS_ROOT/logs"
mkdir -p "$LOG_ROOT"

ALL_CASES=(
  run-develop
  run-develop-pending-handoff
  run-develop-active-run
  build
  build-continue-saved-continuity
  explore
  repair
  migrate
  sweep
  review-current-changes
  handoff-capture
  handoff-done
  handoff-resume
)

if (( ${#REQUESTED_CASES[@]} == 0 )); then
  CASES=("${ALL_CASES[@]}")
else
  CASES=("${REQUESTED_CASES[@]}")
fi

PASS_COUNT=0
FAIL_COUNT=0
FAILED_CASES=()

continuity_field() {
  local repo_root="$1"
  local field_name="$2"
  local args=(
    "$CONTINUITY_CLI"
    status
    --project-root "$repo_root"
    --field "$field_name"
  )

  "$NODE_BIN" "${args[@]}"
}

legacy_current_run_marker_path() {
  local repo_root="$1"
  printf '%s\n' "$repo_root/.circuit"/current-run
}

assert_exists() {
  local path="$1"
  [[ -e "$path" ]] || {
    printf 'missing expected path: %s\n' "$path" >&2
    return 1
  }
}

assert_not_exists() {
  local path="$1"
  [[ ! -e "$path" ]] || {
    printf 'unexpected path exists: %s\n' "$path" >&2
    return 1
  }
}

assert_log_contains() {
  local log_path="$1"
  local snippet="$2"
  "$RG_BIN" -q --fixed-strings -- "$snippet" "$log_path" || {
    printf 'log missing required snippet: %s\n' "$snippet" >&2
    return 1
  }
}

assert_log_not_contains() {
  local log_path="$1"
  local snippet="$2"
  if "$RG_BIN" -q --fixed-strings -- "$snippet" "$log_path"; then
    printf 'log contained forbidden snippet: %s\n' "$snippet" >&2
    return 1
  fi
}

result_text() {
  local log_path="$1"
  "$NODE_BIN" - "$log_path" <<'NODE'
const fs = require("node:fs");

const logPath = process.argv[2];
const lines = fs.readFileSync(logPath, "utf-8").split("\n");
let result = "";

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const payload = JSON.parse(line);
    if (payload.type === "result" && typeof payload.result === "string") {
      result = payload.result;
    }
  } catch {
    // Ignore non-JSON lines.
  }
}

process.stdout.write(result);
NODE
}

assert_result_contains() {
  local log_path="$1"
  local snippet="$2"
  local result
  result="$(result_text "$log_path")"
  [[ "$result" == *"$snippet"* ]] || {
    printf 'result missing required snippet: %s\n' "$snippet" >&2
    return 1
  }
}

assert_result_not_contains() {
  local log_path="$1"
  local snippet="$2"
  local result
  result="$(result_text "$log_path")"
  [[ "$result" != *"$snippet"* ]] || {
    printf 'result contained forbidden snippet: %s\n' "$snippet" >&2
    return 1
  }
}

assert_value_contains() {
  local value="$1"
  local snippet="$2"
  local label="${3:-value}"
  [[ "$value" == *"$snippet"* ]] || {
    printf '%s missing required snippet: %s\n' "$label" "$snippet" >&2
    return 1
  }
}

assert_value_equals() {
  local value="$1"
  local expected="$2"
  local label="${3:-value}"
  [[ "$value" == "$expected" ]] || {
    printf '%s expected %s but got %s\n' "$label" "$expected" "$value" >&2
    return 1
  }
}

assert_bootstrap_only_log() {
  local log_path="$1"
  assert_log_not_contains "$log_path" "Let me understand the repo first"
  assert_log_not_contains "$log_path" "Frame checkpoint resolved, routing to Plan"
  assert_log_not_contains "$log_path" "plan.md written"
  assert_log_not_contains "$log_path" "ls ~/.claude/plugins/cache"
}

assert_build_semantic_bootstrap_log() {
  local log_path="$1"
  assert_log_contains "$log_path" ".circuit/bin/circuit-engine" || return 1
  assert_log_contains "$log_path" "bootstrap" || return 1
  assert_log_not_contains "$log_path" "\"name\":\"Write\"" || return 1
}

current_run_target() {
  local repo_root="$1"
  local target
  target="$(continuity_field "$repo_root" current_run.run_root)"
  if [[ -z "$target" ]]; then
    printf 'no attached current run found for %s\n' "$repo_root" >&2
    return 1
  fi

  printf '%s\n' "$target"
}

continuity_selection() {
  local repo_root="$1"
  continuity_field "$repo_root" selection
}

continuity_record_count() {
  local repo_root="$1"
  local records_dir="$repo_root/.circuit/control-plane/continuity-records"

  if [[ ! -d "$records_dir" ]]; then
    printf '0\n'
    return 0
  fi

  find "$records_dir" -maxdepth 1 -type f -name '*.json' | wc -l | tr -d '[:space:]'
}

copy_repo_fixture() {
  local target_root="$1"
  mkdir -p "$target_root"
  "$RSYNC_BIN" -a \
    --delete \
    --exclude '.git' \
    --exclude '.claude' \
    --exclude '.circuit' \
    --exclude '.circuit*' \
    --exclude 'scripts/runtime/engine/node_modules' \
    "$REPO_ROOT/" \
    "$target_root/"
}

init_fixture_repo() {
  local repo_root="$1"
  git -C "$repo_root" init -q
  git -C "$repo_root" config user.name "Circuit Smoke Harness"
  git -C "$repo_root" config user.email "smoke-harness@example.com"
  git -C "$repo_root" add -A
  git -C "$repo_root" commit -qm "fixture baseline"
}

bootstrap_build_run() {
  local repo_root="$1"
  local run_slug="${2:-manual-active-run}"
  local goal="${3:-Manual host-surface seeded run}"
  local run_root="$repo_root/.circuit/circuit-runs/$run_slug"

  mkdir -p "$run_root"
  "$NODE_BIN" "$CIRCUIT_ENGINE_CLI" bootstrap \
    --project-root "$repo_root" \
    --manifest "@build" \
    --entry-mode default \
    --run-root "$run_root" \
    --goal "$goal" \
    --json >/dev/null

  printf '%s\n' "$run_root"
}

seed_pending_continuity() {
  local repo_root="$1"
  local sentinel="$2"
  local run_root="${3:-}"
  local args=(
    "$CIRCUIT_ENGINE_CLI"
    continuity
    save
    --project-root "$repo_root"
    --cwd "$repo_root"
    --goal "Resume $sentinel"
    --next "DO: resume-$sentinel"
    --state-markdown "- $sentinel"
    --debt-markdown "- CONSTRAINT: keep continuity explicit"
    --json
  )

  if [[ -n "$run_root" ]]; then
    args+=(--run-root "$run_root")
  fi

  "$NODE_BIN" "${args[@]}" >/dev/null
}

seed_active_run() {
  local repo_root="$1"
  local sentinel="${4:-}"
  local run_root
  run_root="$(bootstrap_build_run "$repo_root" "manual-active-run" "Seeded active run for host-surface smoke")"
  if [[ -n "$sentinel" ]]; then
    printf '%s\n' "$sentinel" >>"$run_root/artifacts/active-run.md"
  fi
  printf '%s\n' "$run_root"
}

seed_review_diff() {
  local repo_root="$1"
  cat >"$repo_root/review-scope-sentinel.ts" <<'EOF'
export const reviewScopeSentinel = "baseline";
EOF
  git -C "$repo_root" add review-scope-sentinel.ts
  git -C "$repo_root" commit -qm "add review scope sentinel"
  cat >"$repo_root/review-scope-sentinel.ts" <<'EOF'
export const reviewScopeSentinel = "REVIEW_SCOPE_SENTINEL";
EOF
}

run_claude_case() {
  local repo_root="$1"
  local prompt="$2"
  local log_path="$3"

  CLAUDE_CASE_BIN="$CLAUDE_BIN" \
  CLAUDE_CASE_LOG="$log_path" \
  CLAUDE_CASE_PROMPT="$prompt" \
  CLAUDE_CASE_REPO_ROOT="$repo_root" \
  CLAUDE_CASE_TIMEOUT_SEC="$CLAUDE_TIMEOUT_SEC" \
  "$NODE_BIN" <<'NODE'
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const logPath = process.env.CLAUDE_CASE_LOG;
const repoRoot = process.env.CLAUDE_CASE_REPO_ROOT;
const prompt = process.env.CLAUDE_CASE_PROMPT;
const claudeBin = process.env.CLAUDE_CASE_BIN;
const timeoutMs = Number(process.env.CLAUDE_CASE_TIMEOUT_SEC || "180") * 1000;

const logFd = fs.openSync(logPath, "w");
const result = spawnSync(
  claudeBin,
  [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-hook-events",
    "--no-session-persistence",
    "--permission-mode",
    "bypassPermissions",
    prompt,
  ],
  {
    cwd: repoRoot,
    stdio: ["ignore", logFd, logFd],
    timeout: timeoutMs,
    env: process.env,
  },
);
fs.closeSync(logFd);

if (result.error && result.error.code === "ETIMEDOUT") {
  process.exit(124);
}
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
NODE
}

run_cached_user_prompt_submit_case() {
  local repo_root="$1"
  local prompt="$2"
  local log_path="$3"

  CLAUDE_CASE_LOG="$log_path" \
  CLAUDE_CASE_PLUGIN_ROOT="$CACHED_PLUGIN_ROOT" \
  CLAUDE_CASE_PROMPT="$prompt" \
  CLAUDE_CASE_REPO_ROOT="$repo_root" \
  "$NODE_BIN" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const logPath = process.env.CLAUDE_CASE_LOG;
const pluginRoot = process.env.CLAUDE_CASE_PLUGIN_ROOT;
const prompt = process.env.CLAUDE_CASE_PROMPT;
const repoRoot = process.env.CLAUDE_CASE_REPO_ROOT;
const hookPath = path.resolve(pluginRoot, "hooks/user-prompt-submit.js");

const logFd = fs.openSync(logPath, "w");
const result = spawnSync(hookPath, {
  cwd: repoRoot,
  env: {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PROJECT_DIR: repoRoot,
  },
  input: JSON.stringify({ prompt }),
  stdio: ["pipe", logFd, logFd],
});
fs.closeSync(logFd);

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
NODE
}

run_claude_handoff_capture_case() {
  local repo_root="$1"
  local log_path="$2"

  CLAUDE_CASE_BIN="$CLAUDE_BIN" \
  CLAUDE_CASE_LOG="$log_path" \
  CLAUDE_CASE_REPO_ROOT="$repo_root" \
  CLAUDE_CASE_TIMEOUT_SEC="$CLAUDE_TIMEOUT_SEC" \
  "$NODE_BIN" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const logPath = process.env.CLAUDE_CASE_LOG;
const repoRoot = process.env.CLAUDE_CASE_REPO_ROOT;
const claudeBin = process.env.CLAUDE_CASE_BIN;
const timeoutMs = Number(process.env.CLAUDE_CASE_TIMEOUT_SEC || "180") * 1000;
const sessionId = crypto.randomUUID();
const prompts = [
  "We are pausing a Circuit build run. Preserve these hard-to-rediscover facts for the next continuity capture: DECIDED: keep session-start passive; CONSTRAINT: continuity authority is control-plane only; NEXT must stay exact: DO: rerun the continuity closeout verification chain after the next continuity edit. Reply only with READY.",
  "/circuit:handoff",
];

const logFd = fs.openSync(logPath, "w");

for (const prompt of prompts) {
  const isFirstPrompt = prompt === prompts[0];
  const result = spawnSync(
    claudeBin,
    [
      "--print",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-hook-events",
      "--permission-mode",
      "bypassPermissions",
      ...(isFirstPrompt ? ["--session-id", sessionId] : ["--resume", sessionId]),
      prompt,
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", logFd, logFd],
      timeout: timeoutMs,
      env: process.env,
    },
  );

  if (result.error && result.error.code === "ETIMEDOUT") {
    fs.closeSync(logFd);
    process.exit(124);
  }
  if (result.error) {
    fs.closeSync(logFd);
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    fs.closeSync(logFd);
    process.exit(result.status ?? 1);
  }
}

fs.closeSync(logFd);
process.exit(0);
NODE
}

assert_continuity_banner() {
  local log_path="$1"
  assert_log_contains "$log_path" "Circuit continuity available"
  assert_log_contains "$log_path" "This is context only."
  assert_log_contains "$log_path" 'Fresh `/circuit:*` commands should be honored as the active task.'
  assert_log_contains "$log_path" "/circuit:handoff resume"
}

assert_build_bootstrap() {
  local repo_root="$1"
  local workflow_label="${2:-Build}"
  local run_root
  run_root="$(current_run_target "$repo_root")"

  [[ -d "$run_root" ]] || {
    printf 'attached run root is not a directory: %s\n' "$run_root" >&2
    return 1
  }
  assert_exists "$run_root/circuit.manifest.yaml"
  assert_exists "$run_root/events.ndjson"
  assert_exists "$run_root/state.json"
  assert_exists "$run_root/artifacts/active-run.md"
  assert_log_contains "$run_root/artifacts/active-run.md" "## Workflow"
  assert_log_contains "$run_root/artifacts/active-run.md" "$workflow_label"
}

run_case() {
  local case_id="$1"
  local case_root="$HARNESS_ROOT/$case_id"
  local repo_root="$case_root/repo"
  local case_home="$case_root/home"
  local log_path="$LOG_ROOT/$case_id.stream.jsonl"
  local prompt=""
  local seeded_run_root=""

  rm -rf "$case_root"
  mkdir -p "$case_root"
  mkdir -p "$case_home"
  copy_repo_fixture "$repo_root"
  init_fixture_repo "$repo_root"

  case "$case_id" in
    run-develop)
      prompt="/circuit:run develop: smoke bootstrap the build path for host-surface verification; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    run-develop-pending-handoff)
      seed_pending_continuity "$repo_root" "PENDING_CONTINUITY_SENTINEL"
      prompt="/circuit:run develop: smoke bootstrap the build path for host-surface verification; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    run-develop-active-run)
      seeded_run_root="$(seed_active_run "$repo_root" "Build" "frame" "ACTIVE_RUN_CONTINUITY_SENTINEL")"
      prompt="/circuit:run develop: smoke bootstrap the build path for host-surface verification; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    build)
      prompt="/circuit:build smoke bootstrap the build path for host-surface verification; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    build-continue-saved-continuity)
      seed_pending_continuity "$repo_root" "BUILD_CONTINUE_SAVED_CONTINUITY_SENTINEL"
      prompt="/circuit:build continue from saved continuity"
      ;;
    explore)
      prompt="/circuit:explore smoke inspect the public-surface bootstrap path; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    repair)
      prompt="/circuit:repair smoke investigate the placeholder host-surface regression; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    migrate)
      prompt="/circuit:migrate smoke migrate the placeholder host-surface contract; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    sweep)
      prompt="/circuit:sweep smoke clean placeholder host-surface residue; create and validate circuit.manifest.yaml, events.ndjson, the derived state.json snapshot, and artifacts/active-run.md for the selected run, then stop"
      ;;
    review-current-changes)
      seed_review_diff "$repo_root"
      prompt="/circuit:review current changes"
      ;;
    handoff-capture)
      seeded_run_root="$(bootstrap_build_run "$repo_root" "handoff-capture-run" "Seeded run for /circuit:handoff capture")"
      ;;
    handoff-done)
      seeded_run_root="$(seed_active_run "$repo_root" "Build" "frame" "ACTIVE_RUN_DONE_SENTINEL")"
      seed_pending_continuity "$repo_root" "HANDOFF_DONE_SENTINEL" "$seeded_run_root"
      prompt="/circuit:handoff done"
      ;;
    handoff-resume)
      seeded_run_root="$(seed_active_run "$repo_root" "Build" "frame" "ACTIVE_RUN_RESUME_SENTINEL")"
      seed_pending_continuity "$repo_root" "HANDOFF_RESUME_SENTINEL" "$seeded_run_root"
      prompt="/circuit:handoff resume"
      ;;
    *)
      printf 'Unknown case id: %s\n' "$case_id" >&2
      return 1
      ;;
  esac

  local status=0
  local assert_status=0

  set +e
  if [[ "$case_id" == "handoff-capture" ]]; then
    run_claude_handoff_capture_case "$repo_root" "$log_path"
    status=$?
  elif [[ "$case_id" == "build-continue-saved-continuity" ]]; then
    run_cached_user_prompt_submit_case "$repo_root" "$prompt" "$log_path"
    status=$?
  else
    run_claude_case "$repo_root" "$prompt" "$log_path"
    status=$?
  fi

  if (( status == 0 )); then
    case "$case_id" in
      run-develop)
        assert_build_bootstrap "$repo_root" || assert_status=1
        assert_bootstrap_only_log "$log_path" || assert_status=1
        assert_build_semantic_bootstrap_log "$log_path" || assert_status=1
        ;;
      run-develop-pending-handoff)
        assert_build_bootstrap "$repo_root" || assert_status=1
        assert_bootstrap_only_log "$log_path" || assert_status=1
        assert_build_semantic_bootstrap_log "$log_path" || assert_status=1
        assert_continuity_banner "$log_path" || assert_status=1
        assert_log_contains "$log_path" "pending continuity" || assert_status=1
        assert_log_not_contains "$log_path" "PENDING_CONTINUITY_SENTINEL" || assert_status=1
        ;;
      run-develop-active-run)
        assert_build_bootstrap "$repo_root" || assert_status=1
        assert_bootstrap_only_log "$log_path" || assert_status=1
        assert_build_semantic_bootstrap_log "$log_path" || assert_status=1
        assert_continuity_banner "$log_path" || assert_status=1
        assert_log_contains "$log_path" "active run" || assert_status=1
        assert_log_not_contains "$log_path" "ACTIVE_RUN_CONTINUITY_SENTINEL" || assert_status=1
        if [[ "$(current_run_target "$repo_root")" == "$seeded_run_root" ]]; then
          printf 'fresh workflow command did not replace the seeded active run\n' >&2
          assert_status=1
        fi
        ;;
      build)
        assert_build_bootstrap "$repo_root" "Build" || assert_status=1
        assert_bootstrap_only_log "$log_path" || assert_status=1
        assert_build_semantic_bootstrap_log "$log_path" || assert_status=1
        ;;
      build-continue-saved-continuity)
        assert_value_equals "$(continuity_selection "$repo_root")" "pending_record" "continuity selection" || assert_status=1
        assert_not_exists "$(legacy_current_run_marker_path "$repo_root")" || assert_status=1
        assert_log_contains "$log_path" "Circuit Continuity Reference" || assert_status=1
        assert_log_contains "$log_path" ".circuit/bin/circuit-engine continuity resume --json" || assert_status=1
        assert_log_contains "$log_path" "- selection: pending_record" || assert_status=1
        assert_log_not_contains "$log_path" ".circuit/bin/circuit-engine bootstrap" || assert_status=1
        assert_log_not_contains "$log_path" "canonical project handoff path" || assert_status=1
        assert_log_not_contains "$log_path" "Read this handoff first:" || assert_status=1
        ;;
      explore)
        assert_build_bootstrap "$repo_root" "Explore" || assert_status=1
        ;;
      repair)
        assert_build_bootstrap "$repo_root" "Repair" || assert_status=1
        ;;
      migrate)
        assert_build_bootstrap "$repo_root" "Migrate" || assert_status=1
        ;;
      sweep)
        assert_build_bootstrap "$repo_root" "Sweep" || assert_status=1
        ;;
      review-current-changes)
        assert_not_exists "$(legacy_current_run_marker_path "$repo_root")" || assert_status=1
        assert_log_contains "$log_path" "Review verdict:" || assert_status=1
        assert_log_contains "$log_path" "review-scope-sentinel.ts" || assert_status=1
        ;;
      handoff-capture)
        local combined_narrative
        combined_narrative="$(continuity_field "$repo_root" record.narrative.state_markdown)"$'\n'"$(continuity_field "$repo_root" record.narrative.debt_markdown)"
        [[ "$(continuity_selection "$repo_root")" == "pending_record" ]] || assert_status=1
        [[ "$(continuity_record_count "$repo_root")" == "1" ]] || assert_status=1
        assert_value_equals "$(continuity_field "$repo_root" record.run_ref.run_slug)" "handoff-capture-run" "saved run slug" || assert_status=1
        assert_value_contains "$(continuity_field "$repo_root" record.narrative.next)" "DO: rerun the continuity closeout verification chain after the next continuity edit" "saved next action" || assert_status=1
        assert_value_contains "$combined_narrative" "DECIDED:" "saved continuity narrative" || assert_status=1
        assert_value_contains "$combined_narrative" "CONSTRAINT:" "saved continuity narrative" || assert_status=1
        assert_value_contains "$combined_narrative" "keep session-start passive" "saved continuity narrative" || assert_status=1
        assert_value_contains "$combined_narrative" "continuity authority is control-plane only" "saved continuity narrative" || assert_status=1
        assert_value_equals "$(continuity_field "$repo_root" current_run.run_root)" "$seeded_run_root" "indexed current run root" || assert_status=1
        assert_log_contains "$log_path" ".circuit/bin/circuit-engine continuity save" || assert_status=1
        assert_result_contains "$log_path" "Handoff saved." || assert_status=1
        assert_result_contains "$log_path" '/circuit:handoff done' || assert_status=1
        assert_result_not_contains "$log_path" "/circuit:handoff save" || assert_status=1
        assert_result_not_contains "$log_path" "/circuit:handoff clear" || assert_status=1
        ;;
      handoff-done)
        [[ "$(continuity_selection "$repo_root")" == "none" ]] || assert_status=1
        [[ "$(continuity_record_count "$repo_root")" == "0" ]] || assert_status=1
        assert_not_exists "$(legacy_current_run_marker_path "$repo_root")" || assert_status=1
        assert_exists "$seeded_run_root/artifacts/active-run.md" || assert_status=1
        assert_log_contains "$log_path" ".circuit/bin/circuit-engine continuity clear --json" || assert_status=1
        assert_log_not_contains "$log_path" "handoff.md" || assert_status=1
        ;;
      handoff-resume)
        assert_log_contains "$log_path" "# Circuit Resume" || assert_status=1
        assert_log_contains "$log_path" "HANDOFF_RESUME_SENTINEL" || assert_status=1
        assert_log_not_contains "$log_path" "ACTIVE_RUN_RESUME_SENTINEL" || assert_status=1
        assert_log_contains "$log_path" ".circuit/bin/circuit-engine continuity resume --json" || assert_status=1
        ;;
    esac
  elif (( status == 124 )); then
    printf '\nTimed out after %ss\n' "$CLAUDE_TIMEOUT_SEC" >>"$log_path"
  fi
  set -e

  if (( status == 0 && assert_status == 0 )); then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf 'PASS %s\n' "$case_id"
    return 0
  fi

  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_CASES+=("$case_id")
  printf 'FAIL %s (log: %s)\n' "$case_id" "$log_path"
  return 0
}

printf 'Manual host-surface smoke harness\n'
printf 'Log root: %s\n' "$LOG_ROOT"
printf 'Cases: %s\n\n' "${CASES[*]}"

for case_id in "${CASES[@]}"; do
  run_case "$case_id"
done

printf '\nSummary: %d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
if (( FAIL_COUNT > 0 )); then
  printf 'Failed cases: %s\n' "${FAILED_CASES[*]}"
  exit 1
fi
