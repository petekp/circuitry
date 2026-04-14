# Migration Charter: Isolated Codex Dispatch Default

Historical note: this charter captures the 2026-04-11 cutover plan. The
current repo no longer supports `codex-ambient`; isolated Codex dispatch is the
only built-in Codex mode.

## Mission

Flip Circuit's built-in Codex dispatch from ambient user-state execution to an isolated Circuit-owned runtime boundary, while preserving an explicit `codex-ambient` compatibility escape hatch.

## Source

Current built-in `codex` dispatch shells directly into the ambient Codex CLI state, inherits user MCP/plugin/skill configuration, and leaves temp/process hygiene outside Circuit ownership.

## Target

Circuit-owned isolated Codex runtime roots under `~/.circuit/runtime/codex/`, per-launch `TMPDIR`, auth bootstrap, path-owned janitor cleanup, launch diagnostics, and adapter semantics where `codex` means isolated-by-default and `codex-ambient` is explicit.

## Critical Workflows

1. Worker dispatch with `--adapter codex`
2. Auto-routing when Codex is installed
3. Auto-routing fallback to `agent` when Codex is absent
4. Repo-mode `verify-install` validation of the shipped dispatch surface

## External Surfaces

- `scripts/runtime/bin/dispatch.js`
- `scripts/runtime/bin/verify-install.js`
- `scripts/verify-install.sh`
- `README.md`
- `circuit.config.example.yaml`

## Invariants

1. Custom adapters keep the existing `PROMPT_FILE OUTPUT_FILE` wrapper contract.
2. `agent` dispatch remains unchanged.
3. `codex-ambient` stays opt-in and clearly documented as less deterministic.
4. Isolated Codex launches never inherit ambient Codex MCP configuration.

## Non-Goals

- Dedicated verification-runner orchestration in this wave
- New user-facing YAML keys for Codex isolation behavior
- Changes to custom adapter execution semantics

## Ship Gate

This migration slice is ready when:

1. `dispatch.ts` routes built-in Codex launches through the isolated runtime helper.
2. Receipts include `runtime_boundary`, optional `diagnostics_path`, and optional `warnings`.
3. `verify-install --mode repo` validates the isolated launch contract with a fake `codex` shim.
4. Targeted engine tests for adapter resolution, auth bootstrap, config generation, janitor cleanup, and launch contracts pass.
