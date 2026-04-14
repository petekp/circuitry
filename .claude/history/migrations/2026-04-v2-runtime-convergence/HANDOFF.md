# Handoff: 2026-03-31 / 2026-04-01 Overnight Session

## Changed

### Spec Amendment (from prior session's harden-spec circuit)
- Applied 13 accepted caveats (C1-C13) to v2 architecture spec via Codex
- Spec grew from 2,850 to 3,269 lines

### Three-Way Adversarial Review
- Cross-reference audit (subagent): found C3 regression + minor C9 ambiguity
- Internal consistency audit (subagent): found same C3 regression, verified schemas, protocols, terminal targets
- Codex adversarial review: found 8 issues (3 critical, 4 high, 1 medium)
- All three independent reviewers converged on C3 dispatch gate regression

### Spec Revisions (8 fixes total)
- PA-01: Fixed C3 dispatch gates (options + decision-packet steps now use result_verdict)
- PA-02: Added seam-proof.md as optional read for execution-contract (needs_adjustment loop fix)
- PA-03: Redefined step completion for terminal fail routes in resume algorithm
- PA-04: Added confirm checkpoint response as optional read for scope step (amend loop fix)
- PA-05: Added attempt field to state.checkpoints, defined current-attempt calculation
- PA-06: Added any_of priority rule ("last listed wins") for execution-contract
- PA-07: Quoted all terminal targets in YAML examples
- PA-08: Extended completion constraint to all pass verdicts (not just complete_and_hardened)

### Dry Run
- Symbolically executed develop manifest (default mode) with "add rate limiting to the API gateway"
- Traced happy path + needs_adjustment loop + design_invalidated recovery
- Verdict: MECHANICALLY SOUND (3 specification notes, 0 failures)

### Migration Audit (Phase 1 complete)
- Created all control plane artifacts:
  - CHARTER.md: mission, invariants, ship gate
  - DECISIONS.md: 4 foundational decisions
  - SLICES.yaml: 14 slices mapped to spec's 15 migration steps
  - SHIP_CHECKLIST.md: automated checks, manual verification, docs, cleanup
  - RATCHETS.yaml: 5 anti-pattern ratchets with concrete budgets
  - INVENTORY.md: per-skill inventory, anti-pattern counts, leverage assessment
  - HANDOFF.md: this file

## Now True

- v2 architecture spec is amended, adversarially reviewed, and mechanically validated
- Spec at `.circuitry/specs/v2-architecture-spec.md` (3,324 lines) is ready for implementation
- Migration control plane is complete at `.claude/migration/`
- 14 implementation slices defined with dependencies, exit criteria, and verification commands
- 5 anti-pattern ratchets baselined (resume: 11, compose-prompt: 54, dispatch.sh: 45, relay_root: 33, batch.json: 42)
- Codebase inventory complete: 13 skills, 6,877 SKILL.md lines, 10,070 total lines, ~80-85% runtime prose

## Remains

- MAP.csv not yet created (file-level inventory mapping)
- No implementation slices started
- Three dry-run specification notes could be addressed (max_attempts reset semantics, compound loop bounding, single-option checkpoint escape) but are not blocking
- Guard script not yet written (the shell script that enforces ratchet budgets)

## Shipping Blockers

- Migration implementation has not started (Phase 2)
- All 14 slices are in "proposed" status

## Next Steps

1. Optionally create MAP.csv with file-level mapping and guard script for CI enforcement
2. Begin implementation. Two parallel tracks available:
   - **Track A (topology):** slice-001 (split run/fix), slice-002 (add fix), slice-003 (fold harden-spec)
   - **Track B (infrastructure):** slice-004 (protocol cards), slice-005 (relay holes)
3. After both tracks complete, converge at slice-006 (structured artifacts) then slice-007 (Runtime Foundation)
4. The Runtime Foundation (slice-007) is the biggest single slice and the keystone of the migration

## Review Artifacts

All review artifacts are at `.relay/circuit-runs/v2-architecture-spec/artifacts/`:
- `caveat-resolution.md` (13 accepted, 4 rejected, 15 deferred)
- `post-amendment-review.md` (8 findings, all fixed)
- `caveat-cross-reference-audit.md` (10/13 fully applied, 2 issues found and fixed)
- `consistency-audit.md` (2 critical + 1 high + 3 medium + 3 low, all fixed)
- `dry-run-trace.md` (mechanically sound, 3 specification notes)

## Handoff — 2026-04-08

### Changed
- Added step-scoped backend routing to `scripts/relay/dispatch.sh` with `--step` parsing and precedence:
  explicit backend -> per-step role -> per-step default -> role -> per-circuit -> global -> auto-detect
- Added the `converger -> reviewer` role fallback when `roles.converger` is unset
- Expanded relay tests to cover step precedence, converger fallback, custom Gemini-style wrapper routing, nested config discovery, CRLF parsing, and malformed step-config failure
- Added release-integrity ratchets so shipped workflow docs/examples must thread `--circuit` and `--step`
- Updated README, ARCHITECTURE, `circuit.config.example.yaml`, workflow SKILLs, and `workers` docs to keep routing config-only and backend-agnostic
- Added `docs/examples/gemini-dispatch.sh` as a documentation-only custom backend wrapper example

### Now True
- Backend routing can target a whole circuit, a manifest step, or a step-local worker subrole without changing `circuit.yaml`
- Built-in backends remain `codex` and `agent`; every other CLI still resolves as `custom`
- Custom backend receipts remain schema-compatible: `backend: "custom"` plus the exact configured `command`
- The shipped docs and executable examples now carry real routing context instead of relying on role-only dispatch
- The cache copy under `~/.claude/plugins/cache/.../circuit` has been synced with these changes

### Remains
- No first-class Gemini runtime adapter exists; Gemini remains a documented wrapper-script example only
- `verify-install.sh` still validates general config precedence and malformed-config behavior, but the new step-scoped guarantees are enforced primarily through Vitest relay/integrity coverage

### Shipping Blockers
- None for this slice

### Next Steps
1. Start a fresh Codex/Claude session with `/clear` so the synced cache is reloaded
2. If you want to exercise the new routing surface manually, add a `dispatch.per_step` entry to your local `circuit.config.yaml` and run a workflow step that dispatches workers

## Handoff — 2026-04-08 (Adversarial Review Follow-up)

### Changed
- Performed an adversarial review of the step-scoped routing slice
- Added a relay regression that requires `dispatch.sh --step` to fail with a real CLI diagnostic instead of an unbound-variable shell crash
- Hardened `dispatch.sh` flag parsing so all supported flags now report `ERROR: missing value for <flag>` when invoked without an argument
- Added release-integrity coverage for stale role-only review-dispatch wording
- Updated `skills/build/SKILL.md`, `skills/run/references/phase-spine.md`, and `skills/run/references/rigor-profiles.md` to describe review dispatch with circuit + step context instead of role alone

### Now True
- The new `--step` surface fails loudly and helpfully on malformed invocation
- Review-related docs no longer lag the routing contract established by the executable examples and relay tests
- Full Vitest, verify-install, and cache sync have all been rerun after the fixes

### Remains
- No additional adversarial findings were confirmed beyond the parser edge case and doc-surface drift

### Shipping Blockers
- None

### Next Steps
1. `/clear` before the next fresh session so the synced cache picks up the latest relay/docs fixes
2. Optional manual smoke: invoke `dispatch.sh` once with an intentionally incomplete flag to confirm the friendly diagnostic in your own shell

## Handoff — 2026-04-08 (Named Command Registry)

### Changed
- Added `dispatch.commands.<name>` support to `scripts/relay/dispatch.sh`
- `codex` now keeps a built-in fallback command, but users can override the exact invocation with `dispatch.commands.codex`
- Non-built-in names like `gemini` can now resolve through `dispatch.commands.gemini` and still be routed symbolically from `roles`, `dispatch.engine`, `dispatch.per_circuit`, or `dispatch.per_step`
- Expanded relay tests to prove configured named commands for both `codex` and `gemini`
- Updated README, ARCHITECTURE, and `circuit.config.example.yaml` to document the user-space setup flow:
  global `~/.claude/circuit.config.yaml`, optional repo-root `circuit.config.yaml`, and command registry + routing keys

### Now True
- Backend selection and exact CLI invocation are separated cleanly:
  routing chooses a backend name, `dispatch.commands` can define what that name actually runs
- Users can configure Codex/Gemini command lines directly in config without editing plugin files
- Raw custom command strings still work for the older positional wrapper contract

### Remains
- `agent` is still a structured built-in path rather than a shell-configured command, which is intentional because it emits an Agent-tool receipt instead of spawning a CLI

### Shipping Blockers
- None

### Next Steps
1. `/clear` before the next fresh session so the synced cache picks up the named-command registry changes
2. Optional manual smoke: add a temporary `dispatch.commands.gemini` entry in `~/.claude/circuit.config.yaml` and route one step to `gemini` to confirm your local CLI flags work as expected

## Handoff — 2026-04-11 (First-Class Global Custom Circuits)

### Changed
- Added user-global custom-circuit catalog loading with origin-aware metadata (`origin`, `skillMdPath`, `manifestPath`, `signals`) and reserved-slug enforcement
- Added overlay materialization for published custom circuits, including `~/.claude/circuit/overlay/manifest.json`, overlay-managed `commands/<slug>.md`, and merged `.claude-plugin/public-commands.txt`
- Made installed-surface verification overlay-aware while keeping the shipped manifest closed-world in repo mode
- Added bundled `custom-circuits` CLI and taught `sync-to-cache.sh` to re-materialize overlay-managed commands after sync
- Added `/circuit:create` as a shipped utility skill, updated README/session-start examples/docs, and injected custom-circuit routing context into `/circuit:run`

### Now True
- Published user-global circuits under `~/.claude/circuit/skills/<slug>/` can materialize as real `/circuit:<slug>` commands without touching built-in docs or shipped manifests
- `/circuit:run` can see custom-circuit signals through hook-authored routing context while keeping built-in explicit intent prefixes authoritative and built-ins as tie-breakers
- The cache and marketplace copies are now re-materialized after sync, so overlay-managed custom commands are not lost on plugin sync
- Full runtime engine test suite, generated-surface freshness, and `verify-install.sh` all pass after the change

### Remains
- Manual acceptance on a real Claude Code slash-menu session: create a custom circuit, run `/reload-plugins`, confirm menu visibility, invoke it directly, and route into it through `/circuit:run`
- v1 still has no first-class edit/delete/list UX for custom circuits; publish/create is the supported path

### Shipping Blockers
- None for the shipped v1 create/publish/runtime overlay slice

### Next Steps
1. Run `/reload-plugins` in Claude Code to pick up the synced cache
2. Run `/clear` before the next fresh session so the new `/circuit:create` surface and hook behavior start from a clean prompt state
3. Manual smoke: `/circuit:create <workflow idea>`, confirm publish, `/reload-plugins`, then verify direct `/circuit:<slug>` invocation and `/circuit:run` routing

## Handoff — 2026-04-14 (Canonical Reopen Cleanup)

### Changed
- Removed `step_reopened` from the canonical runtime projection in `scripts/runtime/engine/src/derive-state.ts`
- Removed `step_reopened` from `schemas/event.schema.json`
- Replaced derive-state reopen invalidation coverage with a projector regression that proves legacy reopen events are ignored, and added a schema regression that rejects legacy reopen events
- Dropped reopen analytics from `scripts/debug/scrape-circuit-invocations.py`
- Updated `ARCHITECTURE.md` to describe upstream reroutes without a first-class reopen event
- Ran `npm run prepare`, regenerated the surface catalog, reran `npm run check`, and synced the plugin cache

### Now True
- Canonical runtime state is derived from `circuit.manifest.yaml` plus supported `events.ndjson` event types only
- The runtime no longer models a dedicated reopen event; upstream reroutes are expressed through normal routing + subsequent step execution events
- Legacy `step_reopened` entries are rejected by the event schema and ignored by the pure projector if encountered in older logs
- Generated runtime bins and shipped surface metadata have been refreshed, and the synced cache now matches the repo
- Engine verification is green after the cleanup (`34` files, `326` tests)

### Remains
- The broader architectural refactor is still uncommitted in the worktree
- Resume tests still cover stale-state scenarios, and reopen-named verdicts remain in job-result / manifest schemas where they still participate in reroute semantics
- Optional follow-up: tighten maintainer/debug tooling so analytics derive more metadata directly from manifest + events instead of reading `state.json` snapshots

### Shipping Blockers
- None for this cleanup slice
- Checkpoint commit still needs to be created

### Next Steps
1. Review the full uncommitted diff and create a checkpoint commit for the architectural refactor plus this cleanup
2. Run `/reload-plugins` in Claude Code if you want the current session to pick up the synced cache immediately
3. Optional follow-up slice: retire remaining reopen terminology from stale-state test comments and any protocol/verdict naming you no longer want to preserve

## Handoff — 2026-04-14 (Pristine Convergence Sweep)

### Changed
- Removed the built-in `codex-ambient` adapter from dispatch resolution, runtime execution, tests, README, and example config
- Added `derive-state --json --no-persist` so tooling can ask the engine for canonical state without mutating runs
- Updated `scripts/debug/scrape-circuit-invocations.py` to derive canonical state from the engine instead of reading `state.json` as an input source
- Updated prompt-contract generation so smoke/bootstrap surfaces describe `state.json` as a derived snapshot rather than a source-of-truth input
- Regenerated command shims, workflow skill contract blocks, `CIRCUITS.md`, bundled runtime bins, and generated prompt/surface manifests
- Cleaned explanatory docs and QA helpers so they no longer describe legacy manual bootstrap or `.circuit/current-run` as live architecture
- Synced the refreshed plugin into the local cache/marketplace copy again after the convergence sweep

### Now True
- Built-in worker dispatch is isolated-only: `codex` and `codex-isolated` are the same deterministic runtime boundary
- Maintainer tooling no longer reads `state.json` as canonical input; manifest + events own runtime truth, and `state.json` is treated as derived output
- Smoke/bootstrap guidance across commands, skills, and generated contracts consistently describes the canonical manifest/event pair plus derived outputs
- The repo no longer advertises stale compatibility escape hatches or mixed architecture stories in its live docs
- Verification is green after the full sweep (`34` files, `325` tests), plus Python and Bash syntax checks for the touched maintainer helpers

### Remains
- The architectural refactor is still one large uncommitted worktree change until the checkpoint commit lands
- Historical migration notes under `.claude/migration/` still mention removed paths, but they are now marked as historical where relevant

### Shipping Blockers
- None
- Branch, commit, push, and PR creation remain to be done

### Next Steps
1. Create the checkpoint branch and commit this full convergence sweep
2. Push the branch and open a PR that calls out the canonical-state cleanup plus isolated-only dispatch cutover
3. Run `/reload-plugins` in Claude Code if you want the current session to pick up the synced cache immediately

## Handoff — 2026-04-14 (Simplified Runtime Closeout Gate)

### Changed
- Renamed the remaining shared verdict family from `reopen*` to
  `reroute*` in `schemas/job-result.schema.json`,
  `schemas/circuit-manifest.schema.json`, and
  `schemas/event.schema.json`
- Updated schema regression coverage so reroute verdicts validate and the
  legacy verdict names are rejected everywhere they previously validated
- Added `scripts/runtime/engine/src/architecture-ratchets.test.ts` to
  reject `step_reopened`, `reopen-step`, `codex-ambient`,
  `.circuit/current-run`, and non-test `state.json` authority reads outside
  the named archive/generated/control-plane exceptions
- Cleaned the remaining live prose/comments that still taught reopen
  semantics (`docs/workflow-matrix.md`, `skills/migrate/SKILL.md`,
  `scripts/runtime/engine/src/resume.test.ts`) and removed the remaining
  raw legacy tokens from active tests and QA helpers
- Rewrote `.claude/migration/CHARTER.md` and
  `.claude/migration/SHIP_CHECKLIST.md` to describe the actual closeout
  finish line instead of the original midpoint migration plan
- Ran the requested automated suite:
  - `npm run prepare`
  - `node scripts/runtime/bin/catalog-compiler.js generate`
  - `npm run check`
  - `python3 -m py_compile scripts/debug/scrape-circuit-invocations.py`
  - `bash -n scripts/qa/manual-host-surface-smoke.sh`
  - `./scripts/sync-to-cache.sh`
- Ran real installed-plugin acceptance in Claude Code CLI against the synced
  cache:
  - scratch repo `/tmp/circuit-closeout-build.FDltZx`
  - `/circuit:build` paused after Plan on run
    `.circuit/circuit-runs/add-a-contributing-md-with-three-concise-contribut/`
  - `/circuit:handoff` saved run-backed continuity record
    `continuity-6a43be56-9cde-4daf-b7b2-f8b950f99cc6`
  - `/circuit:handoff resume` surfaced the pending record cleanly
  - `/circuit:build continue with the handoff and finish the task` completed
    the same run with review verdict `ship_ready`
  - `/circuit:handoff done` cleared continuity successfully
- Verified explicit installed dispatch receipts from the cached plugin:
  - `dispatch.sh --adapter codex` returned `runtime_boundary:
    codex-isolated`, `transport: process`, and a diagnostics path under
    `~/.circuit/runtime/codex/...`
  - `dispatch.sh --adapter agent` returned `runtime_boundary: agent`,
    `transport: agent`, and structured `agent_params`
- Verified existing published custom-circuit overlay behavior:
  - cached `custom-circuits.js materialize` rewrote the overlay manifest and
    `commands/rearchitect.md` for both cache and marketplace installs
  - direct `/circuit:rearchitect` smoke bootstrap succeeded on the installed
    plugin
  - `/circuit:run first-principles rearchitecture ...` routed into the
    published custom circuit `circuit:rearchitect` and bootstrapped the
    custom manifest successfully

### Now True
- The live repo accepts only `reroute`, `reroute_plan`, and
  `reroute_execute`; the legacy `reopen*` verdict names are rejected by the
  shared schemas and regression tests
- The permanent architecture ratchet is in place and the full engine suite is
  green (`35` test files, `328` tests)
- The synced cache/marketplace copy reflects the closeout changes
- Real installed-plugin Build + Handoff acceptance is green end to end
- Explicit built-in adapter receipts are green for both `codex` and `agent`
- Published custom-circuit direct invocation and `/circuit:run` routing are
  green for the existing installed `rearchitect` custom circuit

### Remains
- Archive the now-complete `.claude/migration/` corpus into
  `.claude/history/migrations/2026-04-v2-runtime-convergence/`
- Leave the active path with only the small `README.md` pointer

### Shipping Blockers
- None

### Next Steps
1. Move the full `.claude/migration/` corpus to
   `.claude/history/migrations/2026-04-v2-runtime-convergence/`
2. Leave behind `.claude/migration/README.md` stating that there is no active
   migration and pointing at the archive
3. Optionally rerun a focused post-archive smoke (`npm run check` is expected to
   remain green because the archive move is control-plane/documentation only)

## Handoff — 2026-04-14 (Interactive Terminal Completion)

### Changed
- Used Terminal.app plus macOS automation to drive a real interactive
  `/circuit:create` flow for a brand-new custom circuit named `docs-polish`
- Approved the in-terminal sensitive-path prompt for
  `~/.claude/circuit/drafts/docs-polish`
- Drafted and validated:
  - `~/.claude/circuit/drafts/docs-polish/SKILL.md`
  - `~/.claude/circuit/drafts/docs-polish/circuit.yaml`
- Published the new custom circuit into:
  - `~/.claude/circuit/skills/docs-polish/`
  - cache overlay command
    `/Users/petepetrash/.claude/plugins/cache/petekp/circuit/0.3.0/commands/docs-polish.md`
  - marketplace overlay command
    `/Users/petepetrash/.claude/plugins/marketplaces/petekp/commands/docs-polish.md`
- Verified direct invocation:
  - `/circuit:docs-polish smoke bootstrap this published custom circuit...`
    bootstrapped cleanly in a fresh session
- Verified `/circuit:run` routing:
  - `/circuit:run docs polish README.md and CONTRIBUTING.md ...`
    routed into `docs-polish`
  - run root: `.circuit/circuit-runs/docs-polish/`
  - workflow reported as `docs-polish (custom circuit from
    ~/.claude/circuit/skills/)`

### Now True
- The previously blocked create/publish acceptance path is now green end to end
- The installed overlay manifest contains both `docs-polish` and `rearchitect`
- Direct custom slash invocation and `/circuit:run` routing are proven on a
  newly created custom circuit, not just the pre-existing one
- The full simplified-runtime closeout checklist is green

### Remains
- Archive the migration control plane

### Shipping Blockers
- None

### Next Steps
1. Archive `.claude/migration/` into
   `.claude/history/migrations/2026-04-v2-runtime-convergence/`
2. Leave the small active-path pointer README behind
