# Documentation Claim Inventory - 2026-05-19

This inventory backs the May 19, 2026 documentation sweep. It covers the
highest-traffic docs and the claims most likely to mislead operators or future
agents if they drift.

## Scope

Audited:

- `README.md`
- `AGENTS.md` and `CLAUDE.md`
- `docs/literate-guide.md`
- `docs/architecture/*.md`
- `docs/flows/*.md`
- `docs/contracts/*.md`
- `docs/generated-surfaces.md`
- `docs/first-run.md`
- `docs/host-trial-checklist.md`
- `docs/positioning-and-strategy.md`
- `docs/specs/3-axis-rigor-tournament-autonomous-v1.md`
- `plugins/claude/README.md`
- `src/commands/*.md` and flow-owned command docs
- `docs/release/claims/public-claims.yaml`

Ignored as current truth, but searched for stale echoes:

- generated proof-run transcripts under `docs/release/proofs/runs/**`
- historical `docs/ideas/**`, `docs/learnings/**`, and older audit/plan ledgers

## Evidence Commands

| Evidence | Result |
| --- | --- |
| `git status --short` | Only pre-existing untracked `.codex/` before this sweep. |
| `git log --since='7 days ago' --oneline -- README.md AGENTS.md docs/literate-guide.md docs/generated-surfaces.md docs/flows docs/contracts docs/specs/3-axis-rigor-tournament-autonomous-v1.md docs/positioning-and-strategy.md src/commands/run.md src/flows plugins/claude/README.md docs/release/claims/public-claims.yaml` | Recent changes explain the drift: canonical rename (`7bcdf814`), axis CLI/schema work (`cb247a10`, `1de6a236`, `21815747`), Pursue (`c5164d0f`, `40e6a434`), and Migrate/Sweep removal (`4c4bfaeb`). |
| `node scripts/emit-flows.ts --check` | Passed before edits; generated surfaces were initially in sync. |
| `node scripts/release/check-public-claims.mjs` | Passed before edits, which means backing was valid but claim wording could still be incomplete. |
| `npm run check-release-infra` | Passed before edits with the tracked Fix Lite parity warning. |

## Claim Inventory

| Claim | Primary docs | Current backing | Status | Action |
| --- | --- | --- | --- | --- |
| Circuit is the canonical project name; `circuit-next` remains the CLI/config/runtime namespace. | `README.md`, `AGENTS.md`, `docs/plans/2026-05-19-canonical-project-rename.md` | `package.json`, `plugins/*/.*-plugin/plugin.json`, `bin/circuit-next`, recent commits `7bcdf814`, `10034911`, `42bdae02` | Current | Keep `circuit-next` only for binary, config, cache, and historical references. |
| Public flow set is Review, Fix, Pursue, Build, and Explore; Runtime proof is internal. | `README.md`, `docs/generated-surfaces.md`, `docs/architecture/declarative-flow-architecture.md` | `src/flows/catalog.ts`, `src/flows/*/data.ts`, `generated/flows/**`, `plugins/claude/skills/**`, `plugins/circuit/flows/**` | README was stale | Updated README and command selection docs to include Pursue. |
| Pursue is public but has no dedicated slash command yet. | `docs/generated-surfaces.md`, `src/commands/run.md`, `plugins/claude/README.md` | `src/flows/pursue/data.ts` has no `paths.command`; generated surfaces show host flow mirrors and no command surfaces. | Current after patch | Document as routable through `/circuit:run` and explicit CLI flow name. |
| CLI run controls are `--rigor`, `--tournament`, `--tournament-n`, and `--autonomous`; old `--entry-mode`, `--mode`, and `--depth` are not current user-facing flags. | `README.md`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md` | `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts`, generated flow `axes` blocks | README and 3-axis spec were stale | Updated README; marked the 3-axis spec as historical/stale where it contradicts current code. |
| Flow authoring source of truth is `src/flows/<id>/data.ts` plus `flow.ts`; schematic JSON and host outputs are generated. | `AGENTS.md`, `docs/generated-surfaces.md`, `docs/literate-guide.md`, `plugins/claude/README.md` | `src/flows/catalog.ts`, `src/flows/flow-definition.ts`, `scripts/emit-flows.ts`, `tests/runner/flow-facts.test.ts`, `tests/contracts/catalog-completeness.test.ts` | Literate guide and plugin README were stale | Updated both to direct edits to FlowData, not schematic JSON. |
| Host plugins must preserve host/orchestrator vs worker connector distinction. | `README.md`, `docs/contracts/host-adapter.md`, `docs/contracts/host-capabilities.md` | `src/connectors/*`, `src/runtime/connectors/resolver.ts`, `tests/contracts/host-experience-docs.test.ts` | Current | Kept; host-adapter flow list now includes Pursue. |
| Generated host surfaces are not hand-edited. | `docs/generated-surfaces.md`, `plugins/claude/README.md`, `AGENTS.md` | `scripts/emit-flows.ts`, `node scripts/emit-flows.ts --check` | Current | Keep; regenerate after source command edits. |
| Public release claims must include current public flows. | `docs/release/claims/public-claims.yaml` | `generated/release/current-capabilities.json` includes `flow:pursue`; release checks validate backing only. | Claim wording stale | Update claim text and capability list to include Pursue. |
| Positioning copy about every flow supporting every mode is too broad. | `docs/positioning-and-strategy.md` | `generated/release/current-capabilities.json`, `src/flows/*/data.ts` axes blocks | Stale | Updated working notes to say support varies by flow. |
| CompiledFlow contract invariants are enforced by current flow graph and schematic tests. | `docs/contracts/compiled-flow.md` | `src/schemas/compiled-flow.ts`, `tests/contracts/flow-graph-schema.test.ts`, `tests/contracts/flow-schematic.test.ts` | Test pointer stale | Updated contract test references and manifest wording. |
| First-run doctor and Review as safest first run remain valid. | `docs/first-run.md`, `README.md` | `scripts/release/check-proof-coverage.mjs`, `tests/contracts/host-experience-docs.test.ts`, `docs/release/proofs/index.yaml` | Current | No content change. |
| Older idea, learning, audit, and plan docs may mention stale flow counts, `entry_modes`, old paths, or `circuit-next` as the project noun. | `docs/ideas/**`, `docs/learnings/**`, `docs/audit/**`, `docs/plans/**` | Local grep plus recent git history | Historical, not current truth | Leave historical wording unless linked as current guidance. Prefer adding an explicit historical banner before using them as operator docs. |

## Removal Or Retirement Recommendations

- `docs/specs/3-axis-rigor-tournament-autonomous-v1.md`: keep as a decision
  ledger for now, but do not treat it as current implementation docs. If it is
  still useful after the next axis slice, split it into a short current
  operator/authoring doc plus a historical decision appendix.
- `docs/ideas/**` and `docs/learnings/**`: keep as research notes. Do not link
  them from primary onboarding as current product truth unless each linked file
  gets a freshness header.
- Older audit and plan ledgers should remain evidence records, not operating
  docs. Their stale claims are acceptable only when the file is clearly a dated
  snapshot.

## Post-Patch Proof Results

| Proof | Result |
| --- | --- |
| `npm run emit-flows` | Passed; regenerated host command and Codex skill mirrors from source docs. |
| `node scripts/emit-flows.ts --check` | Passed; generated flow, host package, command, skill, and generated-surface files are in sync. |
| Changed-doc local link check | Passed; checked 29 changed Markdown files. |
| `node scripts/release/check-public-claims.mjs` | Passed; public claims are backed or tracked. |
| `npm run check-release-infra` | Passed with the tracked Fix Lite parity warning. |
| Focused contract and host test slice | Passed: 16 files, 506 tests. |
| `npm run verify:fast` | Passed. |
| `npm run verify` | Passed: full canonical check, including 166 Vitest files and 1,798 passing tests. |
