# Handoff

Historical note: this handoff describes the original isolated-dispatch slice.
`codex-ambient` was removed from the live repo on 2026-04-14.

## Changed

- Added `scripts/runtime/engine/src/codex-runtime.ts` to own isolated `CODEX_HOME`, per-launch `TMPDIR`, auth bootstrap, diagnostics reports, and path-owned janitor behavior.
- Updated dispatch resolution so `codex` aliases isolated mode, `codex-isolated` and `codex-ambient` are reserved built-ins, and `auto` resolves to isolated Codex when available.
- Extended `DispatchReceipt` with `runtime_boundary`, optional `diagnostics_path`, and optional `warnings`.
- Added adapter-resolution, isolated-runtime, janitor, fake-codex contract, and repo-mode verify-install coverage.
- Regenerated bundled CLIs and the installed surface manifest.

## Now True

- Circuit no longer launches built-in Codex work inside ambient user state by default.
- Isolated launches copy auth from `~/.codex/auth.json`, ignore ambient Codex MCP config, and produce per-launch reports under the runtime root.
- Repo-mode `verify-install` proves the isolated launcher contract even when a real `codex` binary is absent.

## Remains

- Dedicated verification-runner orchestration is still deferred to phase 2.
- Manual acceptance for repeated dispatches and ambient fallback still needs a human smoke pass in a real user environment.

## Shipping Blockers

- None for the isolation-plus-diagnostics wave.

## Exact Next Steps

1. Run repeated real Circuit Codex dispatches in one repo and confirm no user-configured MCP helpers remain after the grace window.
2. Start the deferred verification-runner slice only after the isolated default behavior is accepted.
