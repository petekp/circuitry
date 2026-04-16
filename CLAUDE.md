# Circuit

## Plugin Cache Sync

After modifying any plugin file (`hooks/`, `skills/`, `scripts/`, `.claude-plugin/`), run `./scripts/sync-to-cache.sh` before finishing. Claude Code runs the cached copy at `~/.claude/plugins/cache/`, not the local repo. Without syncing, changes exist only in git.

## Don't read or search compiled bundles

`scripts/runtime/bin/*.js` are esbuild-bundled CLIs (200–500 KB, single-line minified). Never `grep`, `head`, `cat`, or `Read` them directly — the output leaks previews of compiled JS into the thread. For runtime behavior, read the TypeScript source under `scripts/runtime/engine/src/`. `.rgignore` already excludes the bundles from ripgrep-backed tools like `Grep`.

## Compiler-owned files (never hand-edit)

Two compilers own a chunk of the repo. Edit the TypeScript sources, run the compilers, commit the regenerated output.

**catalog-compiler** (`node scripts/runtime/bin/catalog-compiler.js generate`) owns:
- `commands/*.md` — slash-command shims
- `CIRCUITS.md` — regions between `<!-- BEGIN * -->` / `<!-- END * -->` markers
- `skills/*/SKILL.md` — regions between `<!-- BEGIN *_CONTRACT -->` / `<!-- END *_CONTRACT -->` markers
- `.claude-plugin/public-commands.txt`
- `scripts/runtime/generated/*.json` (`prompt-contracts.json`, `surface-manifest.json`)

Source of truth: `scripts/runtime/engine/src/catalog/*.ts` — especially `prompt-surface-contracts.ts`, `catalog-doc-projections.ts`, `public-surface.ts`, `surface-manifest.ts`.

**esbuild** (`cd scripts/runtime/engine && node esbuild.config.mjs`) owns:
- `scripts/runtime/bin/*.js` — bundled CLIs

Source of truth: `scripts/runtime/engine/src/**/*.ts`.

### Workflow
1. Edit the TS source.
2. From `scripts/runtime/engine/`: `npm run prepare-ship` (runs catalog-compiler + esbuild).
3. `./scripts/sync-to-cache.sh` — this also runs both compilers first, so it is safe to run as a one-shot.
4. Commit the TS changes **and** the regenerated outputs together.

Hand-editing a compiler-owned file is an anti-pattern: the next `prepare-ship` or CI run will overwrite or flag it. The CI `catalog-compiler generate --check` step fails the build if any generated surface is stale.
