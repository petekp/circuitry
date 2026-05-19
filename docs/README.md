# Documentation Map

Start here when you need repo truth without reading every historical note.

## Read Order

1. `README.md` - user-facing product, install, commands, and common operation.
2. `AGENTS.md` - repo operating rules for agents working in this checkout.
3. `UBIQUITOUS_LANGUAGE.md` - canonical vocabulary for product-facing prose.
4. `docs/generated-surfaces.md` - generated-file ownership and drift checks.
5. `docs/architecture/runtime.md` and
   `docs/architecture/declarative-flow-architecture.md` - current runtime and
   flow authoring architecture.
6. `docs/flows/authoring-model.md`, `docs/flows/blocks.md`, and the specific
   flow guide you are changing.
7. `docs/contracts/` - contract details when code, tests, or generated surfaces
   depend on an invariant.

When docs disagree, prefer code, tests, generated surfaces, and release checks
over dated plans or audits.

## Document Classes

| Class | Paths | Use as |
| --- | --- | --- |
| Canonical | `README.md`, `AGENTS.md`, `CLAUDE.md`, `UBIQUITOUS_LANGUAGE.md`, this file | Entry points and vocabulary. `CLAUDE.md` is only a compatibility pointer. |
| Canonical | `docs/architecture/runtime.md`, `docs/architecture/declarative-flow-architecture.md`, `docs/contracts/**`, `docs/flows/authoring-model.md`, `docs/flows/blocks.md`, `docs/flows/pursue.md`, `docs/flows/explore-tournament.md` | Current architecture, flow authoring, block, flow, and contract guidance. |
| Canonical | `docs/first-run.md`, `docs/host-trial-checklist.md`, `docs/positioning-and-strategy.md` | Operator onboarding, host testing, and strategy notes. Check code and release evidence before turning strategy copy into product claims. |
| Generated/evidence | `docs/generated-surfaces.md`, `docs/flows/block-catalog.json`, `generated/**`, `docs/release/**`, `plugins/**` generated mirrors | Generated truth, release truth, or proof evidence. Do not hand-edit generated mirrors. |
| Research note | `docs/ideas/**`, `docs/learnings/**`, `docs/flows/research-intake.md`, `docs/flows/cloudflare-glasswing-block-review.md` | Prior-art, product-shape, or design intake material. Useful context, not current behavior. |
| Archived | `docs/audit/**`, `docs/plans/**`, completed or historical files in `docs/specs/**` | Dated evidence, migration ledgers, closure records, and target specs. Do not treat as active instructions unless a canonical doc links to a live section. |
| Removal candidate | Unreferenced specs listed in `docs/audit/2026-05-19-docs-claim-inventory.md` | Keep until their decisions are absorbed or explicitly discarded. |

## Low-Noise Rules

- Keep current how-to guidance in the canonical docs above.
- Keep generated ownership in `docs/generated-surfaces.md`; do not repeat it in
  every guide.
- Put completed execution records in `docs/plans/` or `docs/audit/` with a
  dated status, then stop linking them as live guidance.
- Keep speculative product ideas in `docs/ideas/` and prior-art notes in
  `docs/learnings/`.
- Leave release proof runs in place unless a release check proves they are safe
  to move.
