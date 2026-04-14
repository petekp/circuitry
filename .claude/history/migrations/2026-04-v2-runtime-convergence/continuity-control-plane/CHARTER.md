# Migration Charter: Continuity Control Plane

## Mission

Cut Circuit continuity over to a single engine-owned control plane and delete compatibility logic instead of preserving it.

## Scope

- `scripts/runtime/engine/src/continuity.ts`
- `scripts/runtime/engine/src/continuity-control-plane.ts`
- `scripts/runtime/engine/src/cli/continuity.ts`
- `scripts/runtime/engine/src/cli/session-start.ts`
- `scripts/runtime/engine/src/cli/user-prompt-submit.ts`
- `scripts/runtime/engine/src/bootstrap.ts`
- `scripts/runtime/engine/src/command-support.ts`
- `scripts/runtime/engine/src/catalog/prompt-surface-contracts.ts`
- `schemas/continuity-index.schema.json`
- `schemas/continuity-record.schema.json`
- `skills/handoff/SKILL.md`
- `docs/continuity-control-plane-*.md`

## Critical Workflows

1. Save continuity during an active run.
2. Explicit `/circuit:handoff resume`.
3. Explicit `/circuit:handoff done`.
4. Passive session-start continuity banner.

## External Surfaces

- `.circuit/control-plane/continuity-index.json`
- `.circuit/control-plane/continuity-records/<record-id>.json`
- `.circuit/current-run`
- `/circuit:handoff`
- `hooks/session-start.sh`
- bundled runtime CLIs

## Invariants

- Ordinary save is non-terminal.
- Continuity reads only the control plane.
- Session-start remains passive.
- No scan fallback survives.
- No legacy or compatibility surface survives in the design.

## Non-Goals

- Importing historical handoff markdown
- Writing compatibility handoff markdown
- Downgrade support

## Guardrails

- Delete compatibility-only code in the same slice that makes it obsolete.
- Do not add projection, import, or downgrade branches back into the design.
- Refresh bundled and generated surfaces whenever source contracts change.

## Ship Gate

### Automated Checks

- `cd scripts/runtime/engine && npm run typecheck`
- `cd scripts/runtime/engine && npm test -- src/session-start.integration.test.ts src/user-prompt-submit.integration.test.ts src/runtime-cli-integration.test.ts src/render-active-run.test.ts src/resume.test.ts src/catalog/prompt-surface-contracts.test.ts src/continuity-control-plane.test.ts`
- `cd /Users/petepetrash/Code/circuit && ./scripts/verify-install.sh --mode repo`
- `cd /Users/petepetrash/Code/circuit && ./.claude/migration/continuity-control-plane/guard.sh`

### Cleanliness Checks

- No `findLatestActiveRun()` remains.
- No `import-legacy` remains.
- No continuity docs or prompt surfaces describe handoff markdown as authority.
