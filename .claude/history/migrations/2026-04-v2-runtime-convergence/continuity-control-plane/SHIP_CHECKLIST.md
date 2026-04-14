# Ship Checklist: Continuity Control Plane

## Automated Checks

1. `cd scripts/runtime/engine && npm run typecheck`
2. `cd scripts/runtime/engine && node esbuild.config.mjs`
3. `cd /Users/petepetrash/Code/circuit && node scripts/runtime/bin/catalog-compiler.js generate`
4. `cd scripts/runtime/engine && npm test -- src/session-start.integration.test.ts src/user-prompt-submit.integration.test.ts src/runtime-cli-integration.test.ts src/render-active-run.test.ts src/resume.test.ts src/catalog/prompt-surface-contracts.test.ts src/continuity-control-plane.test.ts`
5. `cd /Users/petepetrash/Code/circuit && ./scripts/verify-install.sh --mode repo`
6. `cd /Users/petepetrash/Code/circuit && ./.claude/migration/continuity-control-plane/guard.sh`
7. `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`

## Cleanliness Checks

1. No `findLatestActiveRun()` remains.
2. No continuity docs or code mention `import-legacy`.
3. No continuity docs or code mention `legacy_import`.
4. No continuity docs or code mention `projection_revision`.
5. No prompt contract tells the model to read a handoff file as the source of truth once engine continuity commands exist.
