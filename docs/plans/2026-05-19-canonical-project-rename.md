# Canonical Project Rename Notes

Date: 2026-05-19

## Goal

Promote the current `~/Code/circuit-next` checkout to the canonical local
project path `~/Code/circuit`, preserve the older `~/Code/circuit` checkout as
`~/Code/circuit-v1`, and make the promoted checkout the source of truth for
`petekp/circuit`.

## Initial inventory

Older checkout before preservation:

- Path: `/Users/petepetrash/Code/circuit`
- Branch: `main`
- HEAD: `5ec00339fa3f83e559ff0a39fade639c5b4a593c`
- Remote: `https://github.com/petekp/circuit.git`
- Upstream: `origin/main`
- Remote `main`: `5ec00339fa3f83e559ff0a39fade639c5b4a593c`
- Initial status: dirty. The dirty tree included tracked edits, untracked
  docs, untracked runtime-core files, and untracked `.circuit-next/runs/*`
  evidence.

Current checkout before promotion:

- Path: `/Users/petepetrash/Code/circuit-next`
- Branch: `main`
- HEAD: `f5482b8292c849c6997fd01b5cc5a6512d1e3b74`
- Remote: `git@github.com:petekp/circuit-next.git`
- Upstream: `origin/main`
- Remote `main`: `f5482b8292c849c6997fd01b5cc5a6512d1e3b74`
- Initial status: clean.

## Backups

Remote backups created before any remote takeover:

- `petekp/circuit` branch `archive/circuit-v1-main-20260519` points at
  `5ec00339fa3f83e559ff0a39fade639c5b4a593c`.
- `petekp/circuit` branch `archive/circuit-v1-working-tree-20260519` points at
  `bbf8456b32969f260b1ceb27183f94daec0c4aba`, preserving the dirty old
  working tree.

Expected local preserved checkout:

- `/Users/petepetrash/Code/circuit-v1`
- Branch after move: `main`
- Status after move: clean.

## Move path

1. Confirm both checkouts are clean.
2. Move `/Users/petepetrash/Code/circuit` to
   `/Users/petepetrash/Code/circuit-v1`.
3. Move `/Users/petepetrash/Code/circuit-next` to
   `/Users/petepetrash/Code/circuit`.
4. Retarget the promoted checkout remote to
   `git@github.com:petekp/circuit.git`.
5. Push the promoted `main` to `petekp/circuit` only after the archive branches
   above exist.

## Rollback

Local rollback before the promoted `main` is pushed:

1. Move `/Users/petepetrash/Code/circuit` back to
   `/Users/petepetrash/Code/circuit-next`.
2. Move `/Users/petepetrash/Code/circuit-v1` back to
   `/Users/petepetrash/Code/circuit`.
3. Restore the promoted checkout remote to
   `git@github.com:petekp/circuit-next.git`.

Remote rollback after promoted `main` is pushed:

1. Push `archive/circuit-v1-main-20260519` back to `main` with
   `--force-with-lease`.
2. Use `archive/circuit-v1-working-tree-20260519` to recover the old dirty tree
   if needed.

## Progress evidence

Completed local moves:

- `/Users/petepetrash/Code/circuit-v1` is the preserved older checkout on `main`, status clean.
- `/Users/petepetrash/Code/circuit` is the promoted checkout on `main`.
- Promoted checkout remote is now `git@github.com:petekp/circuit.git`.
- After fetching the new remote, promoted `main` and `origin/main` have no merge base; takeover therefore requires an explicit `--force-with-lease` push after verification.

Focused checks after identity edits:

- `npm run test -- tests/contracts/codex-host-plugin.test.ts tests/release/plugin-publish-automation.test.ts` passed.
- `npm run check-flow-drift` passed.
- `npm run check-release-infra` passed.
- Allowlisted stale-reference audit for old repo/marketplace identities passed with no matches outside this migration note.
- `npm run verify` passed after the Claude marketplace contract test was updated.

## Reference audit policy

Allowed remaining `circuit-next` references:

- Runtime CLI binary and command examples: `bin/circuit-next`,
  `./bin/circuit-next`, `scripts/circuit-next.mjs`, and the user-facing
  `circuit-next` command namespace.
- Runtime state and config paths: `.circuit-next/` and
  `~/.config/circuit-next/`.
- Historical release proofs, old parity docs, and generated proof fixtures that
  describe past runs.
- Local development cache names such as `circuit-next-local`.
- Compatibility prose that explicitly describes the old name or the migration.

References that should not remain after promotion:

- Repository URLs pointing to `petekp/circuit-next`, except this note's initial inventory and rollback entries.
- Marketplace or package identity fields that name the project as
  `circuit-next` when they describe the canonical project rather than the CLI
  command namespace.
