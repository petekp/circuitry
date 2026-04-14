## Handoff — 2026-04-12

### Changed
- Completed Slice 6 closeout of the continuity-control-plane migration
- Deleted the remaining legacy selector surface by removing `scripts/runtime/engine/src/continuity.ts`
- Added `scripts/runtime/engine/src/project-root.ts` as the narrow shared helper for resolving the git/project root
- Updated:
  - `scripts/runtime/engine/src/cli/session-start.ts`
  - `scripts/runtime/engine/src/cli/user-prompt-submit.ts`
  - `scripts/runtime/engine/src/codex-runtime.ts`
  - `scripts/runtime/engine/src/continuity-commands.ts`
  so continuity-facing code no longer imports the deleted markdown-era helper module
- Reworked `scripts/runtime/engine/src/session-start.integration.test.ts` to construct a legacy home `handoff.md` fixture inline and prove session-start ignores it even when `CIRCUIT_HANDOFF_HOME` is set
- Strengthened `./.claude/migration/continuity-control-plane/guard.sh` with a zero-budget selector residue check for deleted helpers such as `resolveHandoffPath()` and `inspectContinuity()`
- Rebuilt bundled runtime CLIs, refreshed generated prompt surfaces, and synced the cache copy

### Now True
- All continuity authority is control-plane only: index + records for selection, `.circuit/current-run` as mirror only, and no legacy markdown selector code remains in runtime sources
- Session-start stays passive and ignores both:
  - legacy home handoff fixtures
  - mirror-only `.circuit/current-run` pointers that are not backed by indexed `current_run`
- The closeout verification chain passed:
  - `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && node esbuild.config.mjs`
  - `cd /Users/petepetrash/Code/circuit && node scripts/runtime/bin/catalog-compiler.js generate`
  - `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && npm test -- src/session-start.integration.test.ts src/user-prompt-submit.integration.test.ts src/runtime-cli-integration.test.ts src/render-active-run.test.ts src/resume.test.ts src/catalog/prompt-surface-contracts.test.ts src/continuity-control-plane.test.ts`
  - `cd /Users/petepetrash/Code/circuit && ./scripts/verify-install.sh --mode repo`
  - `cd /Users/petepetrash/Code/circuit && ./.claude/migration/continuity-control-plane/guard.sh`
  - `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`
- The migration guard now enforces zero scan residue, zero compatibility residue, and zero legacy selector residue

### Remains
- Continuity-control-plane migration slices are complete
- No continuity-specific blockers remain in this migration lane

### Shipping Blockers
- None for the continuity-control-plane migration

### Next Steps
1. Treat the continuity-control-plane migration as closed and start the next unrelated task from a fresh handoff.
2. If continuity surfaces change again, rerun the Slice 6 verification chain before finishing:
   - `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && node esbuild.config.mjs`
   - `cd /Users/petepetrash/Code/circuit && node scripts/runtime/bin/catalog-compiler.js generate`
   - `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && npm test -- src/session-start.integration.test.ts src/user-prompt-submit.integration.test.ts src/runtime-cli-integration.test.ts src/render-active-run.test.ts src/resume.test.ts src/catalog/prompt-surface-contracts.test.ts src/continuity-control-plane.test.ts`
   - `cd /Users/petepetrash/Code/circuit && ./scripts/verify-install.sh --mode repo`
   - `cd /Users/petepetrash/Code/circuit && ./.claude/migration/continuity-control-plane/guard.sh`
   - `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`
