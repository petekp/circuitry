# Documentation Map

Start here when you need repo truth without reading every historical note.

## Read First

1. [README.md](../README.md) - product shape, install paths, host roles, and
   first links.
2. [docs/first-run.md](first-run.md) - doctor, safest Review, expected output,
   and run folder shape.
3. [docs/operator-guide.md](operator-guide.md) - commands, run flow,
   checkpoints, verification, and troubleshooting.
4. [docs/configuration.md](configuration.md) - starter config, local skills,
   Codex host/worker distinction, and connector routing.

## Agent And Contributor Setup

- [docs/agent-setup.md](agent-setup.md) - copy-paste setup instructions for
  coding agents.
- [AGENTS.md](../AGENTS.md) - repo operating rules for agents working in this
  checkout.
- [CLAUDE.md](../CLAUDE.md) - compatibility pointer to
  [AGENTS.md](../AGENTS.md).
- [UBIQUITOUS_LANGUAGE.md](../UBIQUITOUS_LANGUAGE.md) - product vocabulary and
  terms to avoid.
- [docs/literate-guide.md](literate-guide.md) - codebase walkthrough for
  contributors opening the repo for the first time.

## Change Flows Or Runtime

- [docs/architecture/runtime.md](architecture/runtime.md) and
  [docs/architecture/declarative-flow-architecture.md](architecture/declarative-flow-architecture.md)
  - current runtime and flow authoring architecture.
- [docs/flows/authoring-model.md](flows/authoring-model.md),
  [docs/flows/blocks.md](flows/blocks.md), and the specific flow guide you are
  changing.
- [docs/contracts/](contracts/) - contract details when code, tests, or
  generated surfaces depend on an invariant.
- [docs/script-inventory.md](script-inventory.md) - current script ownership
  and historical migration map.

## Generated, Release, And Evidence

- [docs/generated-surfaces.md](generated-surfaces.md) - generated-file
  ownership and drift checks.
- [docs/flows/block-catalog.json](flows/block-catalog.json) - generated block
  catalog.
- [generated/](../generated/), [plugins/](../plugins/), and
  [docs/release/](release/) - generated truth, release truth, host package
  output, and checked-in proof evidence.
- [docs/host-trial-checklist.md](host-trial-checklist.md) - release QA
  checklist for saying the host experience is ready for broader use.

When docs disagree, prefer code, tests, generated surfaces, and release checks
over dated plans or audits.

## Document Classes

| Audience / role | Paths | Use as |
| --- | --- | --- |
| Operator entry | [README.md](../README.md), [docs/first-run.md](first-run.md), [docs/operator-guide.md](operator-guide.md), [docs/configuration.md](configuration.md) | Current user-facing setup and operation. |
| Agent setup | [docs/agent-setup.md](agent-setup.md), [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md) | Instructions for coding agents in this checkout. [CLAUDE.md](../CLAUDE.md) is only a compatibility pointer. |
| Vocabulary | [UBIQUITOUS_LANGUAGE.md](../UBIQUITOUS_LANGUAGE.md) | Current product terms for product prose, docs, contracts, and flow authoring notes. |
| Contributor reference | [docs/literate-guide.md](literate-guide.md), [docs/architecture/](architecture/), [docs/contracts/](contracts/), [docs/flows/](flows/), [docs/script-inventory.md](script-inventory.md) | Current codebase, flow, block, contract, and script ownership reference. |
| Generated/evidence | [docs/generated-surfaces.md](generated-surfaces.md), [docs/flows/block-catalog.json](flows/block-catalog.json), [generated/](../generated/), [docs/release/](release/), [plugins/](../plugins/) generated mirrors | Generated truth, release truth, or proof evidence. Do not hand-edit generated mirrors. |
| Release QA | [docs/host-trial-checklist.md](host-trial-checklist.md) | Checklist for validating host readiness before broader use. |
| Working strategy | [docs/positioning-and-strategy.md](positioning-and-strategy.md) | Internal strategy context. Not polished external copy; validate claims against code and release evidence before reuse. |
| Research note | [docs/ideas/](ideas/), [docs/learnings/](learnings/), [docs/flows/research-intake.md](flows/research-intake.md), [docs/flows/cloudflare-glasswing-block-review.md](flows/cloudflare-glasswing-block-review.md) | Prior-art, product-shape, or design intake material. Useful context, not current behavior. |
| Archived | Completed or historical files in [docs/specs/](specs/) and [docs/internal/archive/](internal/archive/) | Dated target specs, design records, and local-only historical notes. Do not treat as active instructions unless a current doc links to a live section. |

## Low-Noise Rules

- Keep current how-to guidance in the canonical docs above.
- Keep generated ownership in [docs/generated-surfaces.md](generated-surfaces.md);
  do not repeat it in every guide.
- Move completed execution records that are not public release evidence into
  local-only [docs/internal/archive/](internal/archive/) after repo-wide
  reference probes.
- Keep speculative product ideas in [docs/ideas/](ideas/) and prior-art notes in
  [docs/learnings/](learnings/).
- Leave release proof runs in place unless a release check proves they are safe
  to move.
