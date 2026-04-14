# Ship Checklist: Isolated Codex Dispatch Default

Historical note: this checklist is preserved as migration history. The current
repo no longer supports `codex-ambient`.

## Automated Checks

- [x] `npm run typecheck` in `scripts/runtime/engine`
- [x] `npx vitest run src/dispatch.test.ts src/codex-runtime.test.ts src/dispatch-contract.test.ts`
- [x] `./scripts/verify-install.sh --mode repo`
- [x] `node scripts/runtime/bin/catalog-compiler.js generate`

## Manual Verification

- [ ] Run repeated Circuit worker dispatches in the same repo and confirm no user-configured MCP servers launch.
- [ ] Confirm `codex-ambient` still works in a local config when intentionally selected.

## Cleanup

- [x] No direct built-in `spawnSync("codex", ...)` path remains in runtime engine source.
- [x] Shipped runtime bins and generated surface manifest were regenerated after source changes.
- [x] README and example config document the new default and fallback mode.
