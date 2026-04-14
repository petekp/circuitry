## Handoff — 2026-04-10

### Changed
- Made `hooks/session-start.sh` a passive continuity announcer that refreshes event-backed runs but only prints a compact context-only banner; it no longer injects handoff or active-run instructions into fresh sessions
- Hardened public command generation in `scripts/runtime/engine/src/catalog/public-surface.ts` so workflow shims are direct/bootstrap-first, forbid plugin-cache rediscovery in favor of `CLAUDE_PLUGIN_ROOT`, and utility shims are fast-mode-first; then regenerated `commands/*.md` and `scripts/runtime/generated/surface-manifest.json`
- Added explicit direct-invocation contracts to all public workflows, explicit fast modes to `handoff` and `review`, and documented `/circuit:handoff resume` as the only explicit continuity entrypoint
- Added deterministic ratchets for these contracts plus a manual host harness script at `scripts/qa/manual-host-surface-smoke.sh`
- Rebuilt bundled runtime CLIs, ran the full runtime Vitest suite, re-ran `./scripts/verify-install.sh`, and synced the plugin cache

### Now True
- Fresh `/circuit:*` commands are documented as authoritative over stale continuity, and SessionStart only announces saved continuity as passive context
- `/circuit:handoff resume` is the explicit continuity path; `/circuit:handoff done` remains immediate cleanup
- Generated public command shims now encode action-first workflow behavior, fast-mode utility behavior, and direct `CLAUDE_PLUGIN_ROOT` helper usage from catalog kind
- The runtime suite and verify-install ship gate both pass against the hardened surface
- The Claude Code cache copy has been resynced for this pass

### Remains
- Run the manual host acceptance gate `./scripts/qa/manual-host-surface-smoke.sh` to exercise real Claude host behavior before merge
- Start a fresh Claude Code session or run `/clear` after the cache sync so the updated cached plugin is loaded

### Shipping Blockers
- Manual host acceptance harness not yet executed to completion for this pass

### Next Steps
1. Run `./scripts/qa/manual-host-surface-smoke.sh`
2. If any case times out or drifts, inspect the preserved log under `.circuit/manual-host-surface-smoke/<timestamp>/`
3. If the harness passes, run `/clear` so the synced cache copy is loaded, then review and commit the final diff

## Handoff — 2026-04-08 (Pass 2)

### Changed
- Split `scripts/runtime/engine/src/catalog/surfaces.ts` into focused ownership modules: `public-surface.ts`, `catalog-doc-projections.ts`, `surface-inventory.ts`, `surface-manifest.ts`, and `generate-targets.ts`
- Deleted the catch-all `surfaces.ts` file and rewired catalog compiler/tests to import from the new owners
- Narrowed `scripts/runtime/engine/src/release-integrity.test.ts` to explicit public-surface boundary checks instead of prose-policing assertions
- Added `docs/control-plane-ownership.md` plus small links from `ARCHITECTURE.md` and `docs/compile-oriented-architecture-rfc.md`
- Rebuilt `scripts/runtime/bin/catalog-compiler.js`, regenerated `scripts/runtime/generated/surface-manifest.json`, reran the targeted engine suites, and verified the repo install surface

### Now True
- Public command ownership, doc-block ownership, shipped-file inventory ownership, manifest ownership, and generate-target ownership each have one obvious module owner
- Import direction is one-way: `types.ts`/`surface-roots.ts` sit below public-surface/inventory/manifest/doc projections/target composition
- Public command shims, public command inventory, and generated `CIRCUITS.md` blocks stayed byte-stable; the only generated drift was the expected `surface-manifest.json` hash update for the rebuilt `catalog-compiler.js`
- Release-integrity ratchets now guard machine-owned public boundaries without enforcing narrative wording

### Remains
- Review the final diff shape and commit when ready
- Start a fresh Claude Code session or run `/clear` after the cache sync so the updated cached plugin is loaded

### Shipping Blockers
- None from the pass-2 legibility slice

### Next Steps
1. Run `git diff -- scripts/runtime/engine/src/catalog scripts/runtime/generated/surface-manifest.json docs/control-plane-ownership.md`
2. Confirm the broader pre-existing dirty worktree changes still match intent
3. Run `/clear` after the sync so the cached copy picks up the new module layout

## Handoff — 2026-04-08

### Changed
- Hardened `scripts/verify-install.sh` so it regenerates the expected public command surface from the bundled `catalog-compiler.js` in a temp root before comparing shipped `public-commands.txt` and `commands/*.md`
- Removed manifest-schema acceptance of `entry.command` and tightened `entry.usage` to a single placeholder token contract
- Added regressions for stale installed `workers` shims, legacy/free-form manifest entry fields, and hyphenated `/circuit:<slug>` parsing in doc-surface integrity tests
- Converged `skills/handoff/SKILL.md`, generated command shims, `CIRCUITS.md`, `ARCHITECTURE.md`, and `CUSTOM-CIRCUITS.md` on the real public/internal model
- Rebuilt `scripts/runtime/bin/catalog-compiler.js`, regenerated generated surfaces, reran the required targeted suites, and synced the plugin cache

### Now True
- Installed verification proves shipped public command freshness from authoritative metadata rather than trusting stale generated files
- `workers` stays internal-only as an adapter and cannot silently reappear on the public command surface
- `entry.command` is unsupported, and `entry.usage` must be a single placeholder token like `<task>`
- Release-integrity parsing is safe for hyphenated public command ids
- Public handoff descriptions are aligned across README, generated catalog surfaces, and command shims

### Remains
- Review the final diff shape and commit when ready
- Start a fresh Claude Code session or run `/clear` so the synced cache copy is loaded

### Shipping Blockers
- None

### Next Steps
1. Run `/clear` in Claude Code so the cached plugin refreshes
2. Review `git diff` for the supplemental convergence slice, especially the verifier/schema/catalog files
3. Commit the updated source, generated surfaces, bundled runtime output, and control-plane docs together

## Handoff — 2026-04-07

### Changed
- Created the release-contract convergence control plane under `.claude/migration/release-contract-convergence/`
- Converged `build`, `repair`, `migrate`, and `sweep` onto the parent-to-workers adapter contract
- Updated README, ARCHITECTURE, and CUSTOM-CIRCUITS so workflows, utilities, and the installed verifier are described consistently
- Rewrote `scripts/verify-install.sh` into an installed-surface ship gate
- Added release-integrity, relay-scripts, and subprocess CLI ratchets, including CRLF and install-root coverage
- Ran `./scripts/sync-to-cache.sh` so the cache copy matches the verified repo state

### Now True
- Worker-doc drift budgets are at zero
- README no longer markets `review` and `handoff` as direct circuits
- `verify-install.sh` proves template composition, config precedence, malformed-config failure, and bundled CLI round trips
- `cd scripts/runtime/engine && npx vitest run` passes
- `./scripts/verify-install.sh` passes from the repo root
- The Claude Code cache copy has been updated; `/clear` is the remaining reload step

### Remains
- Start a fresh Claude Code session so the updated cached plugin is loaded
- Stage and commit the branch when ready; the runtime bin diff still reflects in-flight source changes relative to `HEAD`

### Shipping Blockers
- None from the automated release-contract gate

### Next Steps
1. Start a fresh Claude Code session and run `/clear`
2. Stage and review the branch diff, including the pre-existing runtime source/bin changes now covered by tests
3. Commit once you're happy with the final diff shape
