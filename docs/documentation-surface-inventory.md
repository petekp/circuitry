# Documentation Surface Inventory

Date: 2026-05-20

Status: audit record with a 2026-05-21 navigation addendum. Records the
consolidation decision; not an active runbook.

## Scope

Audited active runbooks, playbooks, and agent-facing how-to docs in:

- `AGENTS.md`, `README.md`, and `UBIQUITOUS_LANGUAGE.md`
- `docs/**/*.md` outside checked-in release proof runs
- `src/commands/**/*.md` and `src/flows/*/command.md`
- generated host command and Codex skill mirrors as generated outputs, not
  editable source

Excluded from active-instruction status:

- `docs/internal/archive/**`
- `docs/release/proofs/runs/**`
- `docs/ideas/**`
- `docs/learnings/**`
- historical or planning specs unless `docs/README.md` marks the file as a
  current source of truth

## Partition Criterion

A file is an active how-to source only when it tells an operator or coding agent
how to set up, run, author, verify, release, or maintain current Circuit
behavior. Historical notes, design targets, proof artifacts, and generated host
mirrors can be evidence, but they are not source-of-truth instructions.

## Approved Active How-To Locations

The active list lives in [docs/README.md](README.md#approved-active-how-to-locations).
Do not add another active runbook or playbook without updating that list and the
documentation-surface tests.

## Decisions

| Cluster | Path | Decision | Notes |
| --- | --- | --- | --- |
| Docs map | `docs/README.md` | Keep | Central index. Added the approved active how-to list and this inventory link. |
| Agent operating rules | `AGENTS.md` | Merge duplicate | Kept repo rules; replaced the full adding-a-flow playbook with a pointer to `docs/flows/authoring-model.md`. |
| Retired Claude guide | `CLAUDE.md` | Remove | Full cutover to `AGENTS.md`; no legacy agent-guide shim remains. |
| Agent setup | `docs/agent-setup.md` | Keep thin | Kept the copy-paste setup prompt; delegated setup details to first-run, operator, config, and generated-surface docs. |
| First run | `docs/first-run.md` | Keep | Smallest install proof and safest Review path. |
| Operator guide | `docs/operator-guide.md` | Keep | Current command, checkpoint, verification, and troubleshooting guide. Generated-file guidance stays as a pointer to `docs/generated-surfaces.md`. |
| Configuration | `docs/configuration.md` | Keep | Config files, local skills, and connector routing source of truth. |
| Flow authoring | `docs/flows/authoring-model.md` | Keep and expand | Now owns the host-ready flow-authoring checklist: package files, command ownership, `paths.command`, generated Claude/Codex command and skill surfaces, Codex cache sync, release metadata, and verification. |
| Block authoring | `docs/flows/blocks.md` | Keep | Product-level block catalog narrative. Machine-readable catalog remains generated. |
| Generated ownership | `docs/generated-surfaces.md` | Keep generated | Generated source map. Do not edit by hand. Drift check owns it. |
| Host package maps | `plugins/README.md`, `plugins/claude/README.md`, `plugins/codex/README.md` | Keep thin | Package-level maps separate hand-authored manifests, hooks, and scripts from generated commands, skills, flow mirrors, and runtime bundles. |
| Source layer maps | `src/README.md`, `src/runtime/README.md`, `src/schemas/README.md`, `src/flows/README.md`, `src/shared/README.md`, `src/types/README.md` | Keep thin | Source maps route contributors to the right layer before they open implementation files. |
| Command source note | `src/commands/README.md` | Keep thin | Kept only direct command ownership and pointers to generated-surface and flow-authoring docs. |
| Flow command docs | `src/flows/*/command.md` | Keep | Source for generated host command and Codex skill instructions. |
| Direct command docs | `src/commands/*.md` | Keep | Source for generated host command and Codex skill instructions. |
| Declarative architecture | `docs/architecture/declarative-flow-architecture.md` | Merge duplicate | Kept architecture decision; replaced generated-surface file lists with source-of-truth pointers. |
| Codebase walkthrough | `docs/architecture/codebase-walkthrough.md` | Move and keep | Moved from `docs/literate-guide.md` so the deep contributor walkthrough sits with architecture references, not operator entry docs. |
| Pursue guide | `docs/flows/pursue.md` | Keep and align | Kept product shape; updated executable truth to start from `data.ts`/`flow.ts` and generated-surface map. |
| Script ownership | `docs/reference/script-inventory.md` | Move and keep | Moved from `docs/script-inventory.md` so script ownership is a reference layer, not a read-first doc. |
| Repository map | `docs/repository-map.md` | Add | Added the before/after tree map, disclosure principle, migration rationale, and targeted probes for this navigation redesign. |
| Release proofs | `docs/release/proofs/README.md` | Keep | Release proof lifecycle source of truth. Proof runs remain evidence fixtures. |
| Host release QA | `docs/host-trial-checklist.md` | Keep | Manual release QA checklist. Operators use `docs/first-run.md` instead. |
| Release plans | `docs/release/initial-public-release-list.md` and release generated reports | Keep as release records | Current only where release checks and ledgers agree. |
| Specs | `docs/specs/**` | Mostly archive/research | `docs/specs/README.md` marks current use. `narration-display-profiles.md` remains active with host-rendering contract. |
| Ideas | `docs/ideas/**` | Archive/research | Option-generation notes only. Not current behavior. |
| Learnings | `docs/learnings/**` | Archive/research | Prior-art notes only. Not current behavior. |
| Internal archive | `docs/internal/archive/**` | Archive | Historical audits and completed ledgers only. |
| Release proof runs | `docs/release/proofs/runs/**` | Evidence | Checked-in fixtures. Preserve unless release proof tooling updates them. |
| Generated host mirrors | `plugins/claude/**`, `plugins/codex/**` | Generated | Do not edit by hand. Update sources and run generated-surface checks. |
| Dead connector shim | `src/shared/connector-helpers.ts` | Remove | No imports remain; connector code imports `src/shared/json-extraction.ts` directly. |

## Evidence Probes

Initial active-doc inventory:

```bash
rg --files README.md AGENTS.md UBIQUITOUS_LANGUAGE.md docs plugins src/README.md src/*/README.md src/commands src/flows | sort
```

Keyword probe for duplicate-prone guidance:

```bash
rg -n -i "runbook|playbook|how-to|how to|guide|adding a flow|add a flow|flow author|authoring|generated surface|generated-surfaces|cache sync|release metadata|command ownership|paths\.command|host-ready|slash command|skill surface|source of truth|source-of-truth" AGENTS.md README.md UBIQUITOUS_LANGUAGE.md docs plugins/README.md plugins/claude/README.md plugins/codex/README.md src/README.md src/*/README.md src/commands src/flows plugins/claude/commands plugins/codex/commands plugins/codex/skills
```

Focused orphan-playbook check after consolidation:

```bash
rg -l -i "(^# .*Runbook|^# .*Playbook|## Adding A Flow|## Adding a flow|Safe setup steps for coding agents|Copy-Paste Prompt|Release QA checklist|source map for Circuit command surfaces|Do not hand-edit generated host output)" README.md AGENTS.md docs plugins/README.md plugins/claude/README.md plugins/codex/README.md src/README.md src/*/README.md src/commands src/flows -g "*.md" -g "!docs/internal/archive/**" -g "!docs/release/proofs/runs/**" -g "!docs/ideas/**" -g "!docs/learnings/**" -g "!docs/documentation-surface-inventory.md"
```

Expected result: every hit is either in the approved list in `docs/README.md`
or is a command source under `src/commands/` or `src/flows/*/command.md`.

Cutover check for removed legacy public docs:

```bash
rg -n "CLAUDE\.md|older tooling|compatibility pointer|Advanced Compatibility|old intent prefixes" README.md AGENTS.md docs src/commands -g "!docs/internal/archive/**" -g "!docs/release/proofs/runs/**" -g "!docs/ideas/**" -g "!docs/learnings/**" -g "!docs/documentation-surface-inventory.md"
```

Expected result: no matches.

Cutover check for removed shim surfaces:

```bash
test ! -e src/shared/connector-helpers.ts
rg -n "connector-helpers|Compatibility shim|compatibility projection|legacy root host surface" src tests scripts docs -g "!docs/internal/archive/**" -g "!docs/release/proofs/runs/**" -g "!docs/documentation-surface-inventory.md"
```

Expected result: only ratchet tests may name the retired file path.

Final verification targets:

```bash
npm run check-flow-drift
npm run check-release-infra
npm run verify
```
