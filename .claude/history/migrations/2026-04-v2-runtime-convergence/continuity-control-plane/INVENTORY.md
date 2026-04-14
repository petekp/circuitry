# Continuity Control Plane Inventory

## High Leverage

- `scripts/runtime/engine/src/continuity-control-plane.ts`
- `scripts/runtime/engine/src/schema.ts`
- `scripts/runtime/engine/src/bootstrap.ts`
- `scripts/runtime/engine/src/command-support.ts`
- continuity integration tests

## Medium Leverage

- `scripts/runtime/engine/src/continuity.ts`
- `scripts/runtime/engine/src/cli/session-start.ts`
- `scripts/runtime/engine/src/cli/user-prompt-submit.ts`
- `scripts/runtime/engine/src/catalog/prompt-surface-contracts.ts`
- `skills/handoff/SKILL.md`

## Low Leverage / Delete

- continuity scan fallback
- continuity legacy import ideas
- continuity projection metadata
- run-local handoff selection logic

## Anti-Patterns

| Pattern | Scope | Count | Why it matters |
|---|---|---:|---|
| `findLatestActiveRun\(` | `scripts/runtime/engine/src` | 0 | Scan-based continuity fallback is gone. |
| `import-legacy\|legacy_import\|projection_revision` | `scripts/runtime/engine/src schemas` | 0 after this cutover | Compatibility residue should stay deleted from runtime code and schemas. |
