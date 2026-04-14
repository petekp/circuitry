# Decisions: Release Contract Convergence

## D1 — 2026-04-07

Keep `workers` as an adapter utility rather than redesigning it into a normal
domain skill. The manifests and architecture doc already encode the adapter
model, so the lowest-risk convergence is to align docs, verifier, and tests to
that existing runtime contract.

## D2 — 2026-04-07

Keep `review` and `handoff` as utilities with no `circuit.yaml`. The taxonomy
fix happens in docs, catalog ratchets, and verifier expectations rather than by
promoting those utilities into first-class circuits.

## D3 — 2026-04-07

Use Vitest integrity and subprocess integration tests as the ratchet runner for
this migration. Do not introduce a separate guard framework unless the current
test harness proves unable to express one of the required budgets or ship-gate
checks.

## D4 — 2026-04-08

`scripts/verify-install.sh` must derive the expected public command surface from
authoritative metadata via the bundled `catalog-compiler.js` in a temp root.
The verifier may compare shipped generated files against that regenerated output,
but it may not trust `.claude-plugin/public-commands.txt` and `commands/*.md`
just because they agree with each other.

## D5 — 2026-04-08

The shipped workflow invocation contract is `expert_command` plus optional
`entry.usage`. `entry.command` is removed rather than tolerated as legacy
residue. In v1, `entry.usage` is an explicit single placeholder token like
`<task>`; free-form usage strings are invalid.

## D6 — 2026-04-10

Fresh `/circuit:*` commands win over stale continuity. SessionStart may only
announce saved continuity as passive context; it may not inject imperative
resume instructions or commandeer a brand-new slash command. Explicit
continuation goes through `/circuit:handoff resume`, and the required
host-behavior acceptance gate lives in the manual harness
`./scripts/qa/manual-host-surface-smoke.sh` rather than CI.
