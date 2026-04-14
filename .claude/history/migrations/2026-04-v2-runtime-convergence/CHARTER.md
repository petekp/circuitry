# Migration Charter: Simplified Runtime Closeout

## Mission

Close out Circuit's runtime-convergence migration by removing the last residual
legacy vocabulary and safeguards, proving the installed plugin works end to end,
and archiving the completed migration so future agents only see the simplified
architecture as active.

## Baseline

- Branch baseline: `pkp/pristine-runtime-convergence`
- Baseline commit: `31244a3e05cdf284426698881a9db0c48ba91f21`
- Existing PR reference: `#15` if still open; otherwise treat `main` plus
  `31244a3` as the convergence reference point.

## Current Target State

The simplified runtime architecture is already the live design. The remaining
closeout must preserve and prove these facts:

1. Canonical runtime inputs are `circuit.manifest.yaml` plus `events.ndjson`.
2. `state.json` is derived output only; tooling may derive or persist it, but it
   is not an authority input.
3. Built-in Codex dispatch is isolated-only (`codex` aliases the isolated
   boundary).
4. Continuity selection is control-plane-only.
5. No live `.circuit/current-run` mirror is part of the active architecture.
6. No live `step_reopened` runtime surface exists.
7. Reroute verdicts use `reroute`, `reroute_plan`, and `reroute_execute`.
8. Custom-circuit draft validation, publish/materialization, direct invocation,
   and `/circuit:run` routing continue to work on the installed plugin.

## Critical Workflows

These installed-plugin workflows must pass before the migration is archived:

1. `/circuit:build` completes a real scratch-repo task end to end.
2. `/circuit:handoff` capture, resume, and done operate against that run through
   the control plane.
3. Build dispatch exercises the built-in `codex` path and the built-in `agent`
   path on a real run.
4. `/circuit:create` drafts and publishes a custom circuit, `/reload-plugins`
   refreshes the menu surface, direct `/circuit:<slug>` invocation works, and
   `/circuit:run` can route into that custom circuit.

## External Surfaces

- Installed Claude Code plugin cache and command surface
- Slash commands under `/circuit:*`
- Runtime command shims under `.circuit/bin/`
- Custom-circuit overlay under `~/.claude/circuit/overlay/`
- User-global custom circuits under `~/.claude/circuit/skills/`
- Runtime schemas, generated bins, and generated public surfaces

## Invariants

1. No backward-compatibility aliases survive for renamed reroute verdicts.
2. No live non-archive, non-generated source reintroduces `step_reopened`,
   `reopen-step`, `codex-ambient`, or `.circuit/current-run`.
3. Generated outputs are refreshed from source; bundled `scripts/runtime/bin/*`
   files are never hand-edited.
4. Historical migration material remains intact as archive history, not active
   guidance.

## Non-Goals

- Another architecture refactor
- Rewriting archived historical migration notes to current terminology
- Adding new compatibility shims for removed runtime concepts
- Expanding product scope beyond closeout proof and archival

## Ship Gate

The closeout is complete only when all of the following are true:

1. The live repo accepts only `reroute`, `reroute_plan`, and
   `reroute_execute`; the legacy `reopen*` verdict names are rejected in the
   shared schemas and regression tests.
2. A permanent architecture ratchet rejects `step_reopened`, `reopen-step`,
   `codex-ambient`, `.circuit/current-run`, and direct `state.json`
   read-as-authority paths outside the named archive/generated/test-fixture
   exceptions.
3. `.claude/migration/CHARTER.md` and `.claude/migration/SHIP_CHECKLIST.md`
   reflect this finish line rather than the original midpoint migration plan.
4. The automated suite below passes in order:
   - `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && npm run prepare`
   - `node /Users/petepetrash/Code/circuit/scripts/runtime/bin/catalog-compiler.js generate`
   - `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && npm run check`
   - `python3 -m py_compile /Users/petepetrash/Code/circuit/scripts/debug/scrape-circuit-invocations.py`
   - `bash -n /Users/petepetrash/Code/circuit/scripts/qa/manual-host-surface-smoke.sh`
   - `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`
5. Real installed-plugin acceptance is recorded with actual outcomes for:
   - one `/circuit:build` run to completion in a scratch repo
   - `/circuit:handoff` capture, resume, and done on that run
   - built-in worker dispatch through `codex`
   - built-in worker dispatch through `agent`
   - `/circuit:create`, publish, `/reload-plugins`, direct
     `/circuit:<slug>` invocation, and `/circuit:run` routing into it
6. After the checklist is green, the full `.claude/migration/` corpus is moved
   to `.claude/history/migrations/2026-04-v2-runtime-convergence/`, and the new
   active `.claude/migration/README.md` states that no migration is currently
   active.
