# Migration Charter: Release Contract Convergence

## Mission

Converge Circuit's shipped release contract onto one enforced model: `workers`
is an adapter utility, parent workflows gate on typed worker results, `review`
and `handoff` are utilities everywhere, and the installed-path verifier is a
real ship gate rather than a template smoke check.

## Source

Current release surfaces drift in three ways:

1. Parent workflow docs (`build`, `repair`, `migrate`, `sweep`) describe
   `workers` as if it were a normal domain skill passed through `--skills`.
2. README and contributor docs disagree about what counts as a circuit versus a
   utility.
3. `scripts/verify-install.sh` and CI can pass without exercising the real
   installed-surface paths users are told to trust.

## Target

One release contract across docs, runtime, verifier, and CI:

- `workers` remains an adapter utility that owns prompt-template assembly and
  the implement/review/converge loop.
- `build`, `repair`, `migrate`, and `sweep` remain parent workflows that create
  child roots, hand off to `circuit:workers`, and gate on typed worker result
  files.
- `review` and `handoff` remain lifecycle utilities and are never marketed as
  circuits.
- Installed-path verification proves the same shipped behavior CI relies on.

## Critical Workflows

These user-visible and contributor-visible paths must hold throughout:

1. `/circuit:run <task>` routes correctly and preserves the workflow taxonomy
2. `/circuit:build <task>` documents the parent-to-workers adapter handoff
3. `/circuit:repair <task>` documents the parent-to-workers adapter handoff
4. `/circuit:migrate <task>` documents the parent-to-workers adapter handoff
5. `/circuit:sweep <task>` documents the parent-to-workers adapter handoff
6. `/circuit:review` remains a standalone utility
7. `/circuit:handoff` remains a lifecycle utility
8. `scripts/verify-install.sh` works from the repo checkout and the installed
   plugin cache path
9. Bundled CLIs `read-config`, `append-event`, `derive-state`, and `resume`
   behave correctly from installed roots

## External Surfaces

- User-facing docs: `README.md`, `CIRCUITS.md`
- Contributor docs: `ARCHITECTURE.md`, `CUSTOM-CIRCUITS.md`
- Workflow and utility skills under `skills/`
- Slash command shims under `commands/`
- Relay scripts and verifier under `scripts/`
- Engine CLIs and regression tests under `scripts/runtime/engine/src/`
- CI workflow `.github/workflows/ci.yml`

## Invariants

1. No new slash commands are introduced.
2. No `circuit.yaml` is added for `review` or `handoff`.
3. Existing workflow manifests remain the runtime source of truth.
4. Runtime helper changes happen only when failing installed-surface tests prove
   a real behavior gap.
5. Windows support stays out of scope for this migration; CRLF resilience is the
   only portability hardening included.

## Non-Goals

- Redesigning the worker architecture so `workers` becomes a normal domain skill
- Reworking unrelated workflow behavior or prose outside the release contract
- Adding Windows-specific runtime support
- Refactoring CI beyond what is needed to align it with the stronger verifier

## Guardrails

- Test-first for each slice: add the failing ratchet or integration test before
  patching docs or scripts
- Preserve and build on pre-existing dirty worktree changes; do not revert them
- Delete replaced wording in the same slice that introduces the new contract
- Treat installed-surface truth as authoritative over internal convenience
  checks

## Ship Gate

The convergence program is ready to ship when:

1. Workflow docs no longer pass `workers` through `--skills`
2. `review` and `handoff` are called utilities consistently across README,
   catalog, architecture, and custom-circuit docs
3. `scripts/verify-install.sh` exercises real installed-surface contract checks
   instead of a template-only smoke test
4. Installed-surface config precedence, malformed-config handling, and
   append-event -> derive-state -> resume round trips are covered by automated
   tests
5. `./scripts/verify-install.sh` passes from the repo root and a temp
   reconstructed install root
6. `cd scripts/runtime/engine && npx vitest run` passes with the new
   installed-surface integration suite
7. `scripts/runtime/bin/` remains fresh after rebuilding
8. `./scripts/sync-to-cache.sh` succeeds so the cached plugin copy matches git
