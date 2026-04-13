# Continuity Control Plane Implementation Plan

Status: execution plan

This plan assumes no backward compatibility. The target is a straight cutover to structured continuity.

## Mission

Replace prompt-led handoff files with engine-owned continuity records and remove the old compatibility branches instead of preserving them.

## Guardrails

1. Do not add new compatibility surfaces.
2. Delete replaced heuristic logic in the same slice that makes it obsolete.
3. Keep session-start passive throughout.
4. Regenerate bundled and generated surfaces whenever source contracts change.
5. Run `./scripts/sync-to-cache.sh` before ending any session that touches `hooks/`, `skills/`, or `scripts/`.

## Slice Plan

### Slice 0: Characterize current behavior

Done. Tests pin passive session-start and current prompt-surface continuity behavior.

### Slice 1: Add schemas and atomic storage

Done. Added:

- `schemas/continuity-index.schema.json`
- `schemas/continuity-record.schema.json`
- `scripts/runtime/engine/src/continuity-control-plane.ts`
- `scripts/runtime/engine/src/continuity-control-plane.test.ts`

### Slice 2: Move current run attachment into the index

Touch:

- `scripts/runtime/engine/src/bootstrap.ts`
- `scripts/runtime/engine/src/command-support.ts`
- `scripts/runtime/engine/src/bootstrap.test.ts`
- `scripts/runtime/engine/src/runtime-cli-integration.test.ts`

Goal:

- bootstrap updates `index.current_run`
- runtime completion detaches `index.current_run`
- `.circuit/current-run` becomes a byproduct of indexed attachment state

Verification:

```bash
cd scripts/runtime/engine
npm test -- src/bootstrap.test.ts src/runtime-cli-integration.test.ts src/continuity-control-plane.test.ts
```

### Slice 3: Add engine-owned continuity commands

Touch:

- `scripts/runtime/engine/src/cli/circuit-engine.ts`
- `scripts/runtime/engine/src/cli/continuity.ts`
- `scripts/runtime/bin/circuit-engine.js`
- `scripts/runtime/bin/continuity.js`

Goal:

- add `status`, `save`, `resume`, and `clear`
- do not add `render`
- do not add `import-legacy`

Verification:

```bash
cd scripts/runtime/engine
npm test -- src/runtime-cli-integration.test.ts src/continuity-control-plane.test.ts
node ../bin/circuit-engine.js
```

### Slice 4: Cut `/circuit:handoff` and session-start over to the control plane

Touch:

- `scripts/runtime/engine/src/cli/session-start.ts`
- `scripts/runtime/engine/src/cli/user-prompt-submit.ts`
- `scripts/runtime/engine/src/catalog/prompt-surface-contracts.ts`
- `skills/handoff/SKILL.md`
- continuity integration tests

Goal:

- `/circuit:handoff` flows instruct the model to call engine continuity commands
- session-start reads only continuity status and indexed current run
- prompt surfaces stop talking about handoff file paths as the source of truth

Verification:

```bash
cd scripts/runtime/engine
npm test -- src/session-start.integration.test.ts src/user-prompt-submit.integration.test.ts src/catalog/prompt-surface-contracts.test.ts
```

### Slice 5: Delete heuristic continuity code

Touch:

- `scripts/runtime/engine/src/continuity.ts`
- docs and prompt contracts

Delete:

- markdown continuity selection
- `findLatestActiveRun()`
- any continuity references to handoff files beyond transitional prompt text that survives only until Slice 4 lands

Verification:

```bash
cd scripts/runtime/engine
npm run typecheck
npm test -- src/session-start.integration.test.ts src/user-prompt-submit.integration.test.ts src/runtime-cli-integration.test.ts src/continuity-control-plane.test.ts
```

### Slice 6: Closeout

Goal:

- docs match the no-compat architecture
- bundled and generated surfaces are fresh
- cache sync completed

Verification:

```bash
cd /Users/petepetrash/Code/circuit
node scripts/runtime/bin/catalog-compiler.js generate
cd scripts/runtime/engine
node esbuild.config.mjs
npm test -- src/session-start.integration.test.ts src/user-prompt-submit.integration.test.ts src/runtime-cli-integration.test.ts src/render-active-run.test.ts src/resume.test.ts src/catalog/prompt-surface-contracts.test.ts src/continuity-control-plane.test.ts
cd /Users/petepetrash/Code/circuit
./scripts/verify-install.sh --mode repo
./scripts/sync-to-cache.sh
```
