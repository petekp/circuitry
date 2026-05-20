# Initial Public Release List

Date: 2026-05-19

This is the hand-authored release list for the first public Circuit release.
It complements the generated release truth surfaces:

- [docs/release/readiness-report.generated.md](readiness-report.generated.md)
- [docs/release/parity-matrix.generated.md](parity-matrix.generated.md)
- `generated/release/current-capabilities.json`
- [docs/release/proofs/index.yaml](proofs/index.yaml)
- [docs/release/claims/public-claims.yaml](claims/public-claims.yaml)

Local release infrastructure is currently green:

- `npm run check-release-ready` passed with no automated release blockers.
- `npm run publish:plugins:check` passed and wrote
  `.circuit/release/plugin-publish-report.json`.

Those checks do not catch every public-facing wording mismatch. The list below
is the final human release list to clear before announcement or marketplace
publication.

## Blockers

| ID | Item | Evidence | Required action | Verification |
| --- | --- | --- | --- | --- |
| REL-PUB-001 | Fix the Claude plugin manifest description. It names retired `/circuit:migrate` and `/circuit:sweep` commands and omits Pursue. | `plugins/claude/.claude-plugin/plugin.json` names `/circuit:migrate` and `/circuit:sweep`; `plugins/claude/commands/` contains only `build`, `create`, `explore`, `fix`, `handoff`, `review`, and `run`; `generated/release/current-capabilities.json` lists public flows as Build, Explore, Fix, Pursue, and Review. | Rewrite the description to name the current public commands and clarify that Pursue is routable through `/circuit:run` and CLI explicit flow invocation, not a dedicated slash command. | `rg -n "migrate|sweep|pursue|/circuit:" plugins/claude/.claude-plugin/plugin.json plugins/claude/commands README.md`; `npm run publish:plugins:check`. |
| REL-PUB-002 | Fix stale Explore command prose before publishing host commands as user-facing docs. | `src/flows/explore/command.md` says Explore walks `Frame -> Analyze -> Compose -> Review -> Close`; `src/flows/explore/data.ts` and `generated/flows/explore/circuit.json` say the canonical stage path is `Frame, Analyze, Plan or Decision, Close`, with critique embedded in the Plan/Decision stage rather than a separate canonical Review stage. | Update `src/flows/explore/command.md` to match the current Explore stage model, then regenerate host command mirrors. | `npm run emit-flows`; `npm run check-flow-drift`; focused `rg` for the old stage sentence in `src/flows/explore/command.md` and generated command mirrors. |

## Should Fix Before Announcement

| ID | Item | Evidence | Next action | Verification |
| --- | --- | --- | --- | --- |
| REL-PUB-003 | Add public release-note wording for the approved Fix Lite intent exception. | [docs/release/readiness-report.generated.md](readiness-report.generated.md) lists this as a next action; [docs/release/parity/exceptions.yaml](parity/exceptions.yaml) tracks `EX-REL-004-FIX-INTENT-MODE`; [docs/release/parity-matrix.generated.md](parity-matrix.generated.md) marks `router:intent:fix` as `approved_exception`. | In release notes or launch copy, say that bare `fix:` selects the Fix flow at normal depth; Lite requires an explicit quick/small/tiny/simple hint or `--rigor lite`. | `npm run check-release-ready`; review release notes for the exact exception wording. |
| REL-PUB-004 | Run and record a real host trial for Claude Code and Codex before saying the host experience is ready for broader use. | [docs/host-trial-checklist.md](../host-trial-checklist.md) defines the manual scenarios; [docs/contracts/host-adapter-acceptance.md](../contracts/host-adapter-acceptance.md) marks real installed-host injection as experimental for both hosts. | Execute the checklist in a clean temp repo for Claude Code and Codex, then record pass/fail notes or keep the release copy scoped to deterministic package checks. | `npm run smoke:host:claude`; `npm run smoke:host:codex`; manual checklist notes with skipped prerequisites called out. |
| REL-PUB-005 | Keep public host-support wording scoped to current capability levels. | `generated/release/current-capabilities.json` marks `claude-code-command`, `codex-plugin`, and `generic-shell` as partial; [docs/release/readiness-report.generated.md](readiness-report.generated.md) calls out partial host surfaces as a next action. | In README, release notes, and marketplace copy, avoid claiming native host adapters, planned native Codex App Server or Claude Agent SDK adapters, or polished generic shell text progress. Describe current Claude/Codex support as plugin command surfaces with model-mediated host affordances. | `rg -n "native|supported|generic shell|model-mediated|planned" README.md docs plugins/claude/.claude-plugin/plugin.json plugins/circuit/.codex-plugin/plugin.json`; `npm run check-release-ready`. |
| REL-PUB-006 | Keep golden proof runs refreshed if any blocker fix changes command, summary, or report contracts. | [docs/release/proofs/README.md](proofs/README.md) says to regenerate proofs when command, summary, report, checkpoint, or scenario contracts change; all current scenarios in [docs/release/proofs/index.yaml](proofs/index.yaml) are `verified_current`. | Treat manifest and command prose fixes as source-owned generated-surface changes first. Run flow drift checks after REL-PUB-002. If a fix changes command semantics, flow behavior, progress, summary, report, checkpoint, or scenario contracts, recapture proofs and review the diff. | `npm run capture-proofs:golden-runs` when required; `npm run check-release-ready`; review touched proof files manually. |
| REL-PUB-007 | Decide whether to ship the package as alpha with the root package still private. | `package.json` is private `0.0.1`; both host plugin manifests are `0.1.0-alpha.6`; `npm run publish:plugins:check` reports source, Claude, Codex, and Claude marketplace versions as `0.1.0-alpha.6`. | If this release is plugin-only, leave root package private and state that publicly. If an npm package is part of release scope, define the package release path separately. | `npm run publish:plugins:check`; inspect `package.json`, `plugins/claude/.claude-plugin/plugin.json`, and `plugins/circuit/.codex-plugin/plugin.json`. |

## Nice To Have

| ID | Item | Evidence | Next action |
| --- | --- | --- | --- |
| REL-PUB-008 | Produce a short external proof demo for the reliability claim. | [docs/positioning-and-strategy.md](../positioning-and-strategy.md) says the strongest claim is externally unproven and recommends a same-task comparison demo. | Capture one focused Build/Fix/Review example showing the evidence trail and a concrete verification or review moment. |
| REL-PUB-009 | Add a tiny release-notes page that links the exact proof and check commands used for this alpha. | The release truth exists across generated reports, claims, proofs, and plugin publish output, but there is no single reader-facing release note yet. | Draft release notes after blockers are fixed, with links to proof scenarios and the final command transcript. |
| REL-PUB-010 | Refresh installed Codex cache after the final release diff, if using a local dogfood install. | [docs/contracts/host-adapter.md](../contracts/host-adapter.md) documents `npm run sync:codex-plugin-cache` and `npm run check:codex-plugin-cache`; local caches can drift. | Run the sync/check pair only for local dogfooding. Do not treat it as marketplace publication. |

## Gap-Audit Acceptance Additions

These are the extra proof points from the execution-plan gap review:

- `REL-PUB-001`: split verification into a negative check for retired names
  (`migrate`, `sweep`) and a positive check for the current commands plus Pursue
  wording.
- `REL-PUB-004`: host-trial evidence must include setup evidence from
  [docs/host-trial-checklist.md](../host-trial-checklist.md): regenerated host output, Codex cache refresh
  when Codex local dogfooding is used, Codex doctor from a normal temp repo, and
  confirmation that `circuit` on `PATH` points at the intended checkout. Smoke
  scripts may return `pass`, `fail`, or `skip`; skipped prerequisites must be
  named.
- `REL-PUB-006`: record the proof-refresh decision. If the release diff only
  changes manifest or command prose without changing command semantics, flow
  behavior, progress, summaries, reports, checkpoints, or scenarios, note that
  proof recapture is not required.
- `REL-PUB-009`: release notes must use
  [docs/release/claims/public-claims.yaml](claims/public-claims.yaml) as the public-claim checklist. Any
  claim they make needs either the listed source/proof backing or explicit
  non-shipping wording.
- `REL-PUB-010`: if a local Codex host trial is part of `REL-PUB-004`, run the
  Codex cache sync/check pair after the final generated diff and before that
  trial.
- Final `publish:plugins:check`: inspect the fresh
  `.circuit/release/plugin-publish-report.json` for `status`, version alignment,
  and warnings/errors instead of treating command success alone as sufficient.
  Inspect cache-target evidence from `sync:codex-plugin-cache` or
  `check:codex-plugin-cache` when local Codex dogfooding is part of the release
  pass.

## Not In Scope Or Deferred

| ID | Item | Why it is not in the initial release |
| --- | --- | --- |
| REL-PUB-011 | Native Codex App Server and Claude Agent SDK adapters. | These are not current roadmap items. Release truth should not list them as planned capabilities, and public copy should not imply they are pending support. |
| REL-PUB-012 | `codex-isolated` writable worker support. | [README.md](../../README.md), [docs/contracts/connector.md](../contracts/connector.md), and [docs/release/claims/public-claims.yaml](claims/public-claims.yaml) all say `codex-isolated` is planned, not current. |
| REL-PUB-013 | Cross-run project-memory query and recall surfaces. | [docs/positioning-and-strategy.md](../positioning-and-strategy.md) treats structured project-memory records as real, but cross-run query and recall surfaces as gaps. Do not claim them as shipping. |
| REL-PUB-014 | Keep-up-for-you update channel. | [docs/positioning-and-strategy.md](../positioning-and-strategy.md) says the update-channel claim is not yet supported. Do not use launch copy that implies automatic methodology updates. |
| REL-PUB-015 | Public `/circuit:pursue` slash command. | Pursue is a public routable flow and has generated flow mirrors, but [docs/generated-surfaces.md](../generated-surfaces.md) and `src/commands/run.md` say it has no dedicated command surface yet. |

## Final Gate

Before public announcement or marketplace publication:

1. Clear both blocker items.
2. Re-run `npm run check-release-ready`.
3. Re-run `npm run publish:plugins:check`.
4. If any source command, generated host surface, proof, or release truth file changed, run the focused drift check named by that source owner.
5. Review final public copy against the not-in-scope/deferred list above.
6. Review the fresh plugin publish report for status, versions, and
   warnings/errors; review cache-target evidence when local Codex dogfooding is
   part of the release pass.
