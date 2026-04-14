# Ship Checklist: Simplified Runtime Closeout

> Executed in Claude Code CLI from Terminal.app. The CLI does not expose a
> `/reload-plugins` slash command, so fresh Claude sessions were used as the
> installed-surface reload equivalent after publish.

## Automated Gate

- [x] `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && npm run prepare`
- [x] `node /Users/petepetrash/Code/circuit/scripts/runtime/bin/catalog-compiler.js generate`
- [x] `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && npm run check`
- [x] `python3 -m py_compile /Users/petepetrash/Code/circuit/scripts/debug/scrape-circuit-invocations.py`
- [x] `bash -n /Users/petepetrash/Code/circuit/scripts/qa/manual-host-surface-smoke.sh`
- [x] `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`

## Schema And Ratchet Proof

- [x] Shared verdict enums accept `reroute`, `reroute_plan`, and
      `reroute_execute`.
- [x] Shared verdict enums reject the legacy `reopen`, `reopen_plan`, and
      `reopen_execute` names everywhere they previously validated.
- [x] `job_completed` event payload validation accepts the reroute verdicts and
      rejects the legacy verdict names.
- [x] Live non-archive, non-generated source contains no `step_reopened`.
- [x] Live non-archive, non-generated source contains no `reopen-step`.
- [x] Live non-archive, non-generated source contains no `codex-ambient`.
- [x] Live non-archive, non-generated source contains no `.circuit/current-run`.
- [x] No runtime or maintainer tool reads `state.json` as canonical input
      outside explicit test fixtures and derivation helpers.
- [x] `derive-state --json --no-persist` still emits canonical state without
      mutating the run.

## Architecture Assertions

- [x] Canonical runtime inputs are `circuit.manifest.yaml` plus `events.ndjson`.
- [x] `state.json` is derived output only.
- [x] Built-in Codex dispatch is isolated-only.
- [x] Continuity selection is control-plane-only.
- [x] No live `.circuit/current-run` surface remains.
- [x] No live `step_reopened` runtime surface remains.
- [x] Current custom-circuit publish/materialization behavior still works.

## Installed-Plugin Acceptance

- [x] Run `/reload-plugins` before the acceptance pass.
- [x] Start from a fresh session state equivalent to `/clear`.
- [x] Complete one real `/circuit:build` task in a scratch repo.
- [x] On that run, execute `/circuit:handoff`, `/circuit:handoff resume`, and
      `/circuit:handoff done`.
- [x] Confirm one built-in worker dispatch through `codex`.
- [x] Confirm one built-in worker dispatch through `agent`.
- [x] Run `/circuit:create` for a custom circuit, validate it, and publish it.
- [x] Run `/reload-plugins` after publish so the slash-menu overlay refreshes.
- [x] Invoke the published `/circuit:<slug>` directly.
- [x] Confirm `/circuit:run` routes into that custom circuit when its signals are
      the strongest match.

## Recording

- [x] Record the actual automated results in `.claude/migration/HANDOFF.md`
      before archiving.
- [x] Record the actual installed-plugin manual results in
      `.claude/migration/HANDOFF.md` before archiving.
- [ ] Archive the full `.claude/migration/` corpus to
      `.claude/history/migrations/2026-04-v2-runtime-convergence/`.
- [ ] Leave only `.claude/migration/README.md` in the active path, stating that
      no migration is currently active and pointing at the archive.
