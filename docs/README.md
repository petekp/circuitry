# Documentation Map

Start here when you need repo truth without reading every historical note.

## Read Order

1. `README.md` - user-facing product, install, commands, and common operation.
2. `docs/first-run.md` - first doctor run and safest first Review.
3. `docs/operator-guide.md` - command, run, verification, and troubleshooting
   detail.
4. `docs/configuration.md` - config layers, local skills, Codex worker setup,
   and connector routing.
5. `docs/agent-setup.md` - copy-paste setup instructions for coding agents.
6. `AGENTS.md` - repo operating rules for agents working in this checkout.
7. `UBIQUITOUS_LANGUAGE.md` - canonical vocabulary for product-facing prose.
8. `docs/generated-surfaces.md` - generated-file ownership and drift checks.
9. `docs/script-inventory.md` - script ownership, inventory, and migration map.
10. `docs/architecture/runtime.md` and
   `docs/architecture/declarative-flow-architecture.md` - current runtime and
   flow authoring architecture.
11. `docs/flows/authoring-model.md`, `docs/flows/blocks.md`, and the specific
   flow guide you are changing.
12. `docs/contracts/` - contract details when code, tests, or generated surfaces
   depend on an invariant.

When docs disagree, prefer code, tests, generated surfaces, and release checks
over dated plans or audits.

## Document Classes

| Class | Paths | Use as |
| --- | --- | --- |
| Canonical | `README.md`, `docs/first-run.md`, `docs/operator-guide.md`, `docs/configuration.md`, `docs/agent-setup.md`, `AGENTS.md`, `CLAUDE.md`, `UBIQUITOUS_LANGUAGE.md`, this file | Entry points, setup guidance, and vocabulary. `CLAUDE.md` is only a compatibility pointer. |
| Canonical | `docs/architecture/runtime.md`, `docs/architecture/declarative-flow-architecture.md`, `docs/contracts/**`, `docs/flows/authoring-model.md`, `docs/flows/blocks.md`, `docs/flows/pursue.md`, `docs/flows/explore-tournament.md`, `docs/script-inventory.md` | Current architecture, flow authoring, block, flow, contract, and script ownership guidance. |
| Canonical | `docs/host-trial-checklist.md`, `docs/positioning-and-strategy.md` | Host testing and strategy notes. Check code and release evidence before turning strategy copy into product claims. |
| Generated/evidence | `docs/generated-surfaces.md`, `docs/flows/block-catalog.json`, `generated/**`, `docs/release/**`, `plugins/**` generated mirrors | Generated truth, release truth, or proof evidence. Do not hand-edit generated mirrors. |
| Research note | `docs/ideas/**`, `docs/learnings/**`, `docs/flows/research-intake.md`, `docs/flows/cloudflare-glasswing-block-review.md` | Prior-art, product-shape, or design intake material. Useful context, not current behavior. |
| Archived | Completed or historical files in `docs/specs/**` | Dated target specs and design records. Do not treat as active instructions unless a canonical doc links to a live section. |

## Low-Noise Rules

- Keep current how-to guidance in the canonical docs above.
- Keep generated ownership in `docs/generated-surfaces.md`; do not repeat it in
  every guide.
- Move completed execution records that are not public release evidence into
  local-only `docs/internal/archive/` after repo-wide reference probes.
- Keep speculative product ideas in `docs/ideas/` and prior-art notes in
  `docs/learnings/`.
- Leave release proof runs in place unless a release check proves they are safe
  to move.
