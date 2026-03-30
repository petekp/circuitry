# Circuit Plugin for Claude Code

## Stack
- **Shell scripts** (`scripts/`) - Bash 3.2+, Python 3 for YAML parsing
- **Skills** (`skills/`) - Claude Code skill definitions (SKILL.md + circuit.yaml)
- **Hooks** (`hooks/`) - Claude Code plugin hooks (hooks.json + session-start.sh)

## Build and Test

```bash
# Verify installation
./scripts/verify-install.sh

# Smoke test compose-prompt.sh
./scripts/relay/compose-prompt.sh --header /dev/null --out /tmp/test.md 2>&1 || true

# Run setup against a temp dir
./scripts/setup.sh --target-dir /tmp/circuit-test
```

## Key Files

- `scripts/relay/compose-prompt.sh` - Assembles worker prompts from headers + skills + templates
- `scripts/relay/dispatch.sh` - Backend-agnostic dispatcher (codex/agent/custom)
- `scripts/relay/update-batch.sh` - Batch state mutator for relay protocol
- `scripts/setup.sh` - Provisions relay scripts into consuming projects
- `scripts/verify-install.sh` - Pre-flight checks for plugin health
- `skills/manage-codex/` - Batch orchestrator skill with reference templates
- `.claude-plugin/plugin.json` - Plugin manifest

## Operational Boundaries

- Never modify consuming project files outside of `scripts/relay/` during setup
- Relay scripts must work when copied into a consuming project (not just from plugin root)
- `compose-prompt.sh` resolution chain: env var > plugin-relative > project-local > shared fallback
- `update-batch.sh` is the ONLY allowed way to mutate `batch.json`

## Gotchas

- `compose-prompt.sh` uses `python3 -c "import yaml"` for config parsing — PyYAML must be installed
- When scripts are copied into a consuming project, PLUGIN_ROOT resolves to the wrong directory
- `claude plugin path` does not exist in the current CLI — use known install paths instead
- Keep `setup.sh` and the scripts it copies in sync — they must produce a self-contained runtime

## Conventions

- Run `./scripts/verify-install.sh` after every meaningful change
- Relay scripts must be Bash 3.2+ compatible (macOS default)
- All skill names use the `circuit:` namespace prefix
- Templates live in `skills/manage-codex/references/`
