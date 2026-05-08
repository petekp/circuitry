# Plugin Publish Automation

Status: Implemented V1

## Purpose

Circuit needs one dependable release path for its Claude Code and Codex host
plugins.

The V1 promise is:

> From a clean checkout, one command can prepare, verify, and publish the host
> plugin packages to the requested target, with dry-run output before any
> externally visible action.

This spec covers the host plugin packages only. It does not change Circuit run
behavior, flow selection, connector routing, or generated flow semantics.

## Current State

The repo already automates most preparation work:

- `npm run emit-flows` rebuilds generated host surfaces.
- `npm run verify` checks TypeScript, lint, build, tests, generated flow drift,
  and release infra.
- `npm run check-release-ready` checks release readiness metadata.
- `npm run sync:codex-plugin-cache` refreshes the local Codex plugin cache.
- `npm run check:codex-plugin-cache` checks local Codex cache drift.

The repo now has a single publish command:

```bash
npm run publish:plugins:check
```

Known gaps:

- Claude Code marketplace publishing is wired from repo root through
  `.claude-plugin/marketplace.json`.
- Claude and Codex plugin manifests share `plugins/version.json` as the checked
  version source.
- Codex local cache refresh is automated, but broader Codex marketplace release
  is not.
- the checked-in Codex marketplace is named `circuit-next`, while the local
  cache sync still defaults to `circuit-next-local`.
- `scripts/publish-plugins.mjs` validates, tags, pushes, and reports both host
  package outcomes together.

## Goals

V1 should:

- make local plugin refresh boring and repeatable
- make public release harder to do by accident
- keep Claude Code and Codex package versions aligned
- fail before publishing if generated surfaces drift
- fail before public release if the working tree is dirty
- print the exact commands it would run in dry-run mode
- write a small machine-readable publish report
- keep host-specific publishing details outside generated files

## Non-Goals

V1 does not include:

- npm package publishing
- automatic changelog writing
- automatic version selection from commit history
- GitHub release creation
- signing release outputs
- submitting to third-party curated plugin catalogs
- changing Codex bundled hook behavior
- making Codex user-level handoff hooks install automatically

## Command Surface

Add one script:

```bash
node scripts/publish-plugins.mjs <target> [options]
```

Expose it through package scripts:

```json
{
  "publish:plugins": "node scripts/publish-plugins.mjs check",
  "publish:plugins:bump": "node scripts/publish-plugins.mjs bump",
  "publish:plugins:check": "node scripts/publish-plugins.mjs check",
  "publish:plugins:local": "node scripts/publish-plugins.mjs local",
  "publish:plugins:release": "node scripts/publish-plugins.mjs release --codex-source petekp/circuit-next --codex-marketplace circuit-next"
}
```

Targets:

| Target | External effect | Purpose |
|---|---:|---|
| `bump` | yes, repo files only | Explicitly update plugin version files before release. |
| `check` | no | Validate release readiness without changing installs or git state. |
| `local` | yes, local only | Refresh local Codex cache and validate local Claude package. |
| `release` | yes | Tag and push Claude, refresh remote Codex, and write a report. |

Options:

```bash
--dry-run              # default for release; print commands without running effects
--yes                  # required for release effects
--skip-verify          # allowed only with --allow-unsafe
--allow-dirty          # allowed only for check/local; never for release
--allow-unsafe         # unlocks skip-verify and other escape hatches
--write-generated      # refresh generated surfaces; never allowed for release
--version <version>    # expected plugin version; hard fail for release mismatch
--codex-source <source> # remote Codex marketplace source for release
--codex-marketplace <name> # Codex marketplace name to refresh after add
--json                 # print final report JSON only
```

Rules:

- `release` defaults to dry-run.
- `release --yes` is required before any tag, push, or marketplace update.
- `check` and `local` may run without `--yes`.
- `--skip-verify` must fail unless `--allow-unsafe` is also present.
- `release` must fail if `--allow-dirty` is present.
- `release` must fail if `--write-generated` is present.
- `release` must fail unless `--codex-source` is a remote source.
- `--version` mismatch is a hard failure for `release` and a reported warning
  for `check` and `local` until the manifest migration lands.
- `bump` requires `--version` and writes only version-bearing plugin metadata.

## Publish Pipeline

### Stage 0: Inspect

Purpose: establish what will be published.

Read:

- `package.json`
- `plugins/claude/.claude-plugin/plugin.json`
- `plugins/circuit/.codex-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- optional `.claude-plugin/marketplace.json`

Checks:

- repo root resolves from script location, not `process.cwd()`
- expected plugin package directories exist
- Claude manifest name is `circuit`
- Codex manifest name is `circuit`
- Codex marketplace points at `./plugins/circuit`
- checked-in Codex marketplace name is `circuit-next`
- local Codex cache defaults may still use `circuit-next-local`
- versions match for `release`
- version mismatch is reported but does not block `check` or `local`
- release Codex source is remote; `./`, absolute paths, and local file URLs are
  rejected for `release`
- release Codex marketplace name must not end in `-local`
- release Codex marketplace name must match the marketplace name exposed by the
  remote Codex source

Output:

- target
- dry-run state
- resolved repo root
- Claude plugin version
- Codex plugin version
- planned commands

### Stage 1: Prepare Generated Surfaces

Purpose: ensure host packages match authored sources.

For `check` and `release`, run only the read-only drift check:

```bash
npm run check-flow-drift
```

For `local --write-generated`, refresh generated output first:

```bash
npm run emit-flows
npm run check-flow-drift
```

Rules:

- generated host files are outputs, not inputs
- `check` and `release` must not write generated files
- `local` may refresh generated files only with `--write-generated`
- if generated output is stale during `check` or `release`, fail and tell the
  operator to run `npm run emit-flows`, inspect, and commit the generated
  changes
- when `local --write-generated` changes files, the report must list the paths

### Stage 2: Verify

Purpose: prove the repo is internally releasable.

Run by default:

```bash
npm run verify
npm run check-release-ready
claude plugin validate .
claude plugin validate plugins/claude
node plugins/claude/scripts/circuit-next.mjs doctor
node plugins/circuit/scripts/circuit-next.mjs doctor
```

For `local`, also run:

```bash
npm run check:codex-plugin-cache
```

The `local` target runs:

```bash
npm run sync:codex-plugin-cache
npm run check:codex-plugin-cache
```

Release does not require the local Codex cache to be current. Public Codex
release is validated through the remote marketplace source instead.

### Stage 3: Local Publish

Purpose: make the current checkout available to local hosts.

Claude Code local validation:

```bash
claude plugin validate plugins/claude
```

Claude Code local usage remains:

```bash
claude --plugin-dir ./plugins/claude
```

Codex local cache refresh:

```bash
npm run sync:codex-plugin-cache
npm run check:codex-plugin-cache
```

Rules:

- stale Codex cache after sync is a hard failure
- local publish does not mutate the user's Codex marketplace config
- local publish does not create git tags
- local publish does not push

### Stage 4: Claude Marketplace Wiring

Purpose: make Claude release automation possible from this repo.

Add root marketplace metadata:

```text
.claude-plugin/marketplace.json
```

Minimum shape:

```json
{
  "name": "circuit-next",
  "description": "Public marketplace entry for Circuit's Claude Code plugin.",
  "owner": {
    "name": "Pete Petrash"
  },
  "plugins": [
    {
      "name": "circuit",
      "version": "0.1.0-alpha.3",
      "source": "./plugins/claude",
      "description": "Structured, resumable developer flows for Claude Code."
    }
  ]
}
```

Validation:

```bash
claude plugin validate .
claude plugin validate plugins/claude
```

Version rule:

- marketplace entry version must equal
  `plugins/claude/.claude-plugin/plugin.json`.
- release automation must fail if either side drifts.

### Stage 4B: Codex Marketplace Wiring

Purpose: separate local Codex cache refresh from public Codex distribution.

The current `.agents/plugins/marketplace.json` is the public repo marketplace:

```json
{
  "name": "circuit-next"
}
```

The local cache script still defaults to `circuit-next-local` so local
development refreshes do not collide with the public marketplace name.

Rules:

- `release` must fail if the resolved Codex marketplace name ends in `-local`.
- `--codex-marketplace` must match the resolved marketplace name.
- `local` may continue to use `circuit-next-local` for the local cache.
- public Codex release must be proven against a remote source, not the local
  checkout.

### Stage 5: Release Publish

Purpose: perform externally visible release actions only after all checks pass.

Dry-run command:

```bash
npm run publish:plugins:release -- \
  --version 0.1.0-alpha.3 \
  --codex-source petekp/circuit-next \
  --codex-marketplace circuit-next
```

Effectful command:

```bash
npm run publish:plugins:release -- \
  --yes \
  --version 0.1.0-alpha.3 \
  --codex-source petekp/circuit-next \
  --codex-marketplace circuit-next
```

Claude release actions:

```bash
claude plugin tag plugins/claude --dry-run
claude plugin tag plugins/claude --push
```

Codex local cache actions are not public release actions. `release` must never
use `./` as the Codex source.

Codex release actions require a remote marketplace source:

```bash
codex plugin marketplace add petekp/circuit-next --ref circuit--v0.1.0-alpha.3
codex plugin marketplace upgrade circuit-next
```

Rules:

- `claude plugin tag ... --push` only runs under `release --yes`.
- Codex marketplace add/upgrade only runs under `release --yes`.
- Codex release source must be remote.
- Codex release marketplace name must not end in `-local`.
- local Codex marketplace sources are allowed only for `local`.
- if `git status --short` is dirty, release fails.
- release must print the pushed tag name
- release must print the Codex marketplace name refreshed

## Version Policy

Use one source of truth before public release.

Recommended V1 source:

```text
plugins/version.json
```

Shape:

```json
{
  "version": "0.1.0-alpha.3"
}
```

Consumers:

- `plugins/claude/.claude-plugin/plugin.json`
- `plugins/circuit/.codex-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.agents/plugins/marketplace.json` if it later grows a version field
- tests that assert manifest alignment

V1 may start with a check-only source of truth instead of rewriting manifests.
The release command must still fail on version mismatch.

Explicit bump command:

```bash
npm run publish:plugins:bump -- --version 0.1.0-alpha.3
```

The bump command updates:

- `plugins/version.json`
- `plugins/claude/.claude-plugin/plugin.json`
- `plugins/circuit/.codex-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

It does not publish, tag, push, or choose a version automatically.

## Report

Write a local report to:

```text
.circuit-next/release/plugin-publish-report.json
```

`generated/release/plugin-publish-report.json` is reserved for a future
checked-in release-truth file. V1 must not write there because the release
command requires a clean tree.

Shape:

```ts
type PluginPublishReport = {
  schema_version: 1;
  target: "check" | "local" | "release";
  dry_run: boolean;
  status: "passed" | "published" | "failed";
  repo_root: string;
  git: {
    branch: string;
    head: string;
    dirty_files: string[];
  };
  versions: {
    claude: string;
    codex: string;
    expected?: string;
  };
  commands: Array<{
    id: string;
    argv: string[];
    skipped?: boolean;
    exit_code?: number;
  }>;
  outputs: {
    claude_tag?: string;
    codex_marketplace?: string;
    codex_source?: string;
    codex_cache_status?: "ok" | "stale" | "synced" | "missing";
  };
};
```

Dry-run reports must include commands with `skipped: true`.

## Tests

Add focused tests before wiring release effects.

Required tests:

- package scripts expose the publish command
- inspection step reads both plugin manifests
- version mismatch fails for release
- version mismatch is reported but does not fail check/local
- dirty tree blocks release by default
- `release --allow-dirty` fails before running publish effects
- `--skip-verify` fails without `--allow-unsafe`
- check/release do not run write-generation
- dry-run release does not call effectful commands
- `release --yes` plans `claude plugin tag plugins/claude --push`
- `release --yes` rejects local Codex sources such as `./`
- `release --yes` rejects Codex marketplace names ending in `-local`
- `release --yes` plans remote Codex marketplace add/upgrade
- local target plans Codex cache sync/check
- root Claude marketplace version matches plugin manifest
- final report redacts no paths and records every planned command

Use fake command runners for tests. Do not run real `claude`, `codex`,
`git push`, or tag creation in unit tests.

## Rollout Plan

1. Add version-alignment tests and a read-only inspect module.
2. Add `plugins/version.json` or equivalent manifest alignment.
3. Add `scripts/publish-plugins.mjs` with `check` target only.
4. Add local target with Codex cache sync/check and Claude validation.
5. Add root Claude marketplace metadata and validation.
6. Add release dry-run with remote Codex source validation.
7. Add `release --yes` effectful path.
8. Add docs to `README.md` after the command is real.

## Open Questions

- Should Codex public distribution stay as a repo marketplace, or should it move
  to a dedicated marketplace repo?
- Should the Claude marketplace root live in this repo, or should `plugins/claude`
  be split into a release repo later?
- Should `publish:plugins:release --yes` require `main`, or allow release from a
  release branch?
- Should a later release-truth report be committed under `generated/release/`,
  or should publish reports remain local files?
