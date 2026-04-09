#!/usr/bin/env bash
# verify-install.sh -- Validate Circuit's shipped install surface and runtime.
#
# Usage:
#   ./scripts/verify-install.sh [--mode repo|installed]

set -uo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-node}"
SURFACE_MANIFEST_REL="scripts/runtime/generated/surface-manifest.json"

READ_CONFIG="$PLUGIN_ROOT/scripts/runtime/bin/read-config.js"
APPEND_EVENT="$PLUGIN_ROOT/scripts/runtime/bin/append-event.js"
DERIVE_STATE="$PLUGIN_ROOT/scripts/runtime/bin/derive-state.js"
RESUME="$PLUGIN_ROOT/scripts/runtime/bin/resume.js"
DISPATCH_CLI="$PLUGIN_ROOT/scripts/runtime/bin/dispatch.js"

PASS=0
FAIL=0
TMP_PATHS=()

pass() {
  printf '  \033[32m✓\033[0m %s\n' "$1"
  (( PASS++ ))
}

fail() {
  printf '  \033[31m✗\033[0m %s\n' "$1"
  (( FAIL++ ))
}

section() {
  printf '\n\033[1m%s\033[0m\n' "$1"
}

new_temp_dir() {
  local dir
  dir="$(mktemp -d "${TMPDIR:-/tmp}/circuit-verify.XXXXXX")"
  TMP_PATHS+=("$dir")
  printf '%s\n' "$dir"
}

cleanup() {
  local path
  for path in "${TMP_PATHS[@]+"${TMP_PATHS[@]}"}"; do
    rm -rf "$path"
  done
}
trap cleanup EXIT

MODE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      shift
      MODE="${1:-}"
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      exit 1
      ;;
  esac
  shift || true
done

if [[ -z "$MODE" ]]; then
  if [[ -f "$PLUGIN_ROOT/CIRCUITS.md" ]]; then
    MODE="repo"
  else
    MODE="installed"
  fi
fi

if [[ "$MODE" != "repo" && "$MODE" != "installed" ]]; then
  printf 'circuit: --mode must be repo or installed\n' >&2
  exit 1
fi

printf 'Selected mode: %s\n' "$MODE"

verify_surface_manifest() {
  local mode="$1"
  local output

  output="$("$NODE_BIN" - "$PLUGIN_ROOT" "$mode" "$SURFACE_MANIFEST_REL" 2>&1 <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const [pluginRoot, mode, manifestRel] = process.argv.slice(2);
const installedRoots = [
  ".claude-plugin",
  "commands",
  "hooks",
  "schemas",
  "scripts",
  "skills",
  "circuit.config.example.yaml",
];

function walk(absPath, relPath, out) {
  const stat = fs.lstatSync(absPath);
  if (stat.isDirectory()) {
    if (relPath.split("/").includes(".vite")) {
      return;
    }
    for (const child of fs.readdirSync(absPath).sort()) {
      walk(path.join(absPath, child), path.posix.join(relPath, child), out);
    }
    return;
  }
  if (stat.isFile()) {
    out.push(relPath);
  }
}

function sha256(absPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function executable(absPath) {
  return (fs.statSync(absPath).mode & 0o111) !== 0;
}

const errors = [];
const manifestPath = path.join(pluginRoot, manifestRel);
if (!fs.existsSync(manifestPath)) {
  errors.push(`missing shipped manifest ${manifestRel}`);
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (manifest?.schema_version !== "1") {
    errors.push(`unexpected manifest schema_version: ${JSON.stringify(manifest?.schema_version)}`);
  }
  if (typeof manifest?.plugin?.name !== "string" || typeof manifest?.plugin?.version !== "string") {
    errors.push("manifest plugin metadata is incomplete");
  }
  if (!Array.isArray(manifest?.entries) || !Array.isArray(manifest?.public_commands) || !Array.isArray(manifest?.files)) {
    errors.push("manifest arrays are missing");
  }

  if (mode === "installed") {
    const actualTopLevel = fs.readdirSync(pluginRoot).sort();
    const expectedTopLevel = [...installedRoots].sort();
    if (JSON.stringify(actualTopLevel) !== JSON.stringify(expectedTopLevel)) {
      errors.push(
        `installed top-level surface drift:\nexpected ${expectedTopLevel.join(", ")}\nactual   ${actualTopLevel.join(", ")}`,
      );
    }
  }

  const actualFiles = [];
  for (const root of installedRoots) {
    const absPath = path.join(pluginRoot, root);
    if (!fs.existsSync(absPath)) {
      errors.push(`missing shipped root ${root}`);
      continue;
    }
    walk(absPath, root, actualFiles);
  }
  actualFiles.sort();

  const expectedFileMap = new Map();
  for (const file of manifest.files ?? []) {
    expectedFileMap.set(file.path, file);
  }
  const expectedFiles = [...expectedFileMap.keys(), manifestRel].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    errors.push(
      `installed file inventory drift:\nexpected ${expectedFiles.join(", ")}\nactual   ${actualFiles.join(", ")}`,
    );
  }

  for (const [relPath, file] of expectedFileMap.entries()) {
    const absPath = path.join(pluginRoot, relPath);
    if (!fs.existsSync(absPath)) {
      errors.push(`missing shipped file ${relPath}`);
      continue;
    }
    if (file.sha256 !== sha256(absPath)) {
      errors.push(`sha256 mismatch for ${relPath}`);
    }
    if (Boolean(file.executable) !== executable(absPath)) {
      errors.push(`executable-bit mismatch for ${relPath}`);
    }
  }

  const publicEntries = (manifest.entries ?? [])
    .filter((entry) => entry.public === true)
    .map((entry) => entry.slug)
    .sort();
  const publicCommands = [...(manifest.public_commands ?? [])].sort();
  if (JSON.stringify(publicEntries) !== JSON.stringify(publicCommands)) {
    errors.push("manifest public_commands do not match public entry inventory");
  }

  for (const entry of manifest.entries ?? []) {
    if (entry.kind === "adapter") {
      if (entry.public !== false) {
        errors.push(`adapter ${entry.slug} must be non-public`);
      }
      if ("publicCommand" in entry) {
        errors.push(`adapter ${entry.slug} must not define publicCommand`);
      }
    } else {
      const expectedSlash = `/circuit:${entry.slug}`;
      const publicCommand = entry.publicCommand;
      if (!publicCommand) {
        errors.push(`${entry.kind} ${entry.slug} is missing publicCommand`);
        continue;
      }
      if (publicCommand.slash !== expectedSlash) {
        errors.push(`${entry.kind} ${entry.slug} has non-derived slash ${publicCommand.slash}`);
      }
      if (!publicCommand.shimPath.endsWith(`/${entry.slug}.md`) && publicCommand.shimPath !== `commands/${entry.slug}.md`) {
        errors.push(`${entry.kind} ${entry.slug} has unexpected shim path ${publicCommand.shimPath}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
NODE
)"

  if [[ $? -eq 0 ]]; then
    pass "shipped surface manifest and installed filesystem agree"
  else
    printf '%s\n' "$output"
    fail "shipped surface manifest or installed filesystem drifted"
  fi
}

write_test_manifest() {
  local run_root="$1"
  cat > "$run_root/circuit.manifest.yaml" <<'EOF'
schema_version: "2"
circuit:
  id: integration-test
  version: "2026-04-08"
  purpose: >
    Minimal manifest for verify-install round trips.
  entry:
    signals:
      include: [feature]
      exclude: []
  entry_modes:
    default:
      start_at: frame
      description: Default test mode
  steps:
    - id: frame
      title: Frame
      executor: orchestrator
      kind: synthesis
      reads: [user.task]
      writes:
        artifact:
          path: artifacts/brief.md
          schema: brief@v1
      gate:
        kind: schema_sections
        source: artifacts/brief.md
        required: [Objective]
      routes:
        pass: "@complete"
EOF
}

verify_config_behavior() {
  section "Config discovery"

  local config_root config_home config_repo config_nested explicit_config
  config_root="$(new_temp_dir)"
  config_home="$config_root/home"
  config_repo="$config_root/repo"
  config_nested="$config_repo/nested/deeper"
  explicit_config="$config_root/explicit.yaml"
  mkdir -p "$config_home/.claude" "$config_nested"

  cat > "$config_home/.claude/circuit.config.yaml" <<'EOF'
dispatch:
  roles:
    implementer: home-role
EOF

  cat > "$config_repo/circuit.config.yaml" <<'EOF'
dispatch:
  roles:
    implementer: project-role
EOF

  cat > "$explicit_config" <<'EOF'
dispatch:
  roles:
    implementer: explicit-role
EOF

  git init -q "$config_repo" >/dev/null 2>&1 || true

  local explicit_output project_output current_home_config current_home_output current_home_status

  explicit_output="$(
    HOME="$config_home" \
    "$NODE_BIN" "$READ_CONFIG" \
      --config "$explicit_config" \
      --key dispatch.roles.implementer \
      --fallback auto 2>&1
  )"
  if [[ "$explicit_output" == "explicit-role" ]]; then
    pass "explicit config wins over project and home"
  else
    fail "explicit config did not win over project and home"
  fi

  project_output="$(
    cd "$config_nested" && \
    HOME="$config_home" \
    "$NODE_BIN" "$READ_CONFIG" \
      --key dispatch.roles.implementer \
      --fallback auto 2>&1
  )"
  if [[ "$project_output" == "project-role" ]]; then
    pass "nearest project config wins over home"
  else
    fail "nearest project config did not win over home"
  fi

  current_home_config="${HOME:-}/.claude/circuit.config.yaml"
  if [[ -f "$current_home_config" ]]; then
    current_home_output="$(
      cd "$config_root" && \
      HOME="${HOME:-}" \
      "$NODE_BIN" "$READ_CONFIG" \
        --key dispatch.roles.implementer \
        --fallback auto 2>&1
    )"
    current_home_status=$?
    if [[ $current_home_status -eq 0 ]]; then
      pass "current HOME config parses cleanly"
    else
      printf '%s\n' "$current_home_output"
      fail "current HOME config failed to parse"
    fi
  else
    pass "no current HOME config present"
  fi
}

verify_dispatch_contract() {
  section "Dispatch contract"

  local dispatch_root prompt output invalid_role_output invalid_role_status step_output step_status
  dispatch_root="$(new_temp_dir)"
  prompt="$dispatch_root/prompt.md"
  output="$dispatch_root/last-message.txt"
  printf '# Dispatch contract\n' > "$prompt"
  git init -q "$dispatch_root" >/dev/null 2>&1 || true

  invalid_role_output="$(
    "$NODE_BIN" "$DISPATCH_CLI" \
      --prompt "$prompt" \
      --output "$output" \
      --role converger 2>&1
  )"
  invalid_role_status=$?
  if [[ $invalid_role_status -ne 0 ]] && printf '%s' "$invalid_role_output" | grep -q 'unsupported dispatch role'; then
    pass "unsupported explicit roles fail before routing"
  else
    printf '%s\n' "$invalid_role_output"
    fail "unsupported explicit roles did not fail loudly"
  fi

  step_output="$(
    "$NODE_BIN" "$DISPATCH_CLI" \
      --prompt "$prompt" \
      --output "$output" \
      --step review 2>&1
  )"
  step_status=$?
  if [[ $step_status -ne 0 ]] && printf '%s' "$step_output" | grep -q -- '--step is no longer supported'; then
    pass "--step is rejected end-to-end"
  else
    printf '%s\n' "$step_output"
    fail "--step was not rejected"
  fi
}

verify_runtime_round_trip() {
  section "Bundled runtime CLIs"

  local run_root append_started append_step derive resume
  run_root="$(new_temp_dir)"
  write_test_manifest "$run_root"

  append_started="$("$NODE_BIN" "$APPEND_EVENT" "$run_root" run_started --payload '{"manifest_path":"circuit.manifest.yaml","entry_mode":"default","head_at_start":"abc1234"}' 2>&1)"
  if [[ $? -ne 0 ]]; then
    printf '%s\n' "$append_started"
    fail "append-event run_started failed"
    return
  fi

  append_step="$("$NODE_BIN" "$APPEND_EVENT" "$run_root" step_started --payload '{"step_id":"frame"}' --step-id frame --attempt 1 2>&1)"
  if [[ $? -ne 0 ]]; then
    printf '%s\n' "$append_step"
    fail "append-event step_started failed"
    return
  fi

  derive="$("$NODE_BIN" "$DERIVE_STATE" "$run_root" 2>&1)"
  if [[ $? -ne 0 ]]; then
    printf '%s\n' "$derive"
    fail "derive-state failed"
    return
  fi

  resume="$("$NODE_BIN" "$RESUME" "$run_root" 2>&1)"
  if [[ $? -ne 0 ]]; then
    printf '%s\n' "$resume"
    fail "resume round trip failed"
    return
  fi

  if printf '%s' "$resume" | grep -q '"resume_step": "frame"'; then
    pass "append-event -> derive-state -> resume round trip"
  else
    printf '%s\n' "$resume"
    fail "resume output did not point at frame"
  fi
}

section "Node.js"
if command -v "$NODE_BIN" >/dev/null 2>&1; then
  node_version="$("$NODE_BIN" --version 2>&1)"
  node_major="$("$NODE_BIN" -e "console.log(process.versions.node.split('.')[0])")"
  if [[ "$node_major" -ge 20 ]]; then
    pass "node $node_version"
  else
    fail "node $node_version found, but 20+ required"
  fi
else
  fail "node not found"
fi

if [[ "$MODE" == "repo" ]]; then
  section "Generated freshness"
  freshness_output="$("$NODE_BIN" "$PLUGIN_ROOT/scripts/runtime/bin/catalog-compiler.js" generate --check 2>&1)"
  if [[ $? -eq 0 ]]; then
    pass "catalog-compiler generate --check"
  else
    printf '%s\n' "$freshness_output"
    fail "catalog-compiler generate --check failed"
  fi
fi

section "Shipped surface"
verify_surface_manifest "$MODE"
verify_config_behavior
verify_dispatch_contract
verify_runtime_round_trip

printf '\n'
if [[ "$FAIL" -eq 0 ]]; then
  printf 'All checks passed (%d passed)\n' "$PASS"
  exit 0
fi

printf '%d check(s) failed (%d passed)\n' "$FAIL" "$PASS" >&2
exit 1
