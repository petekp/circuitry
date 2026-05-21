# Repository Map

This map is the top-down path through the repo. It is intentionally shorter
than the codebase walkthrough. Use it to decide which layer to open next, then
switch to the layer-owned docs.

## Disclosure Principle

Keep the first screen small:

1. Root files answer "what is Circuit and how do I start?"
2. `docs/` answers "where is the truth for this kind of change?"
3. `plugins/` answers "what does each host receive?"
4. `src/` answers "which source layer owns this behavior?"
5. Runtime, schemas, and flow packages explain their own boundaries locally.

Historical plans, release proof runs, ideas, and learnings stay discoverable but
do not compete with current entry docs.

## Evidence Used

These probes established the pre-change tree and the references that had to be
kept current:

```bash
find . -maxdepth 2 -type f | sed 's#^./##' | sort
find docs -maxdepth 3 -type f | sort
find plugins/claude plugins/codex -maxdepth 3 -type f | sort
find src/runtime src/schemas src/flows -maxdepth 2 -type f | sort
rg -n "docs/literate-guide\\.md|docs/script-inventory\\.md|generated-surfaces\\.md|docs/README\\.md" README.md AGENTS.md docs src tests scripts plugins generated package.json
```

## Before Map

The verified pre-change shape had useful content, but too much of it sat at the
same level:

```text
.
+-- README.md                    product entry, install paths, host roles
+-- AGENTS.md                    agent operating rules
+-- UBIQUITOUS_LANGUAGE.md       canonical vocabulary
+-- docs/
|   +-- README.md                docs map
|   +-- first-run.md             first manual proof
|   +-- operator-guide.md        operator commands and troubleshooting
|   +-- configuration.md         config and connector routing
|   +-- generated-surfaces.md    generated ownership, emitted by the flow emitter
|   +-- literate-guide.md        deep codebase walkthrough
|   +-- script-inventory.md      script ownership and historical migration map
|   +-- architecture/            runtime and architecture reference
|   +-- contracts/               runtime and host contracts
|   +-- flows/                   flow and block authoring reference
|   +-- release/                 release truth and checked-in proof evidence
|   +-- ideas/                   product ideas
|   +-- learnings/               prior-art notes
+-- plugins/
|   +-- claude/                  Claude Code package, with its own README
|   +-- codex/                   Codex package, no parent host-surface map
+-- src/
    +-- cli/                     command entrypoints
    +-- commands/                direct command sources
    +-- connectors/              worker connector implementations
    +-- flows/                   flow packages plus compiler/catalog support
    +-- runtime/                 engine mechanics
    +-- schemas/                 Zod contracts
    +-- shared/                  cross-layer helpers
```

Main pain points:

- The codebase walkthrough and script ownership record looked like read-first
  docs because they were peers of operator docs.
- There was no parent map for host packages, even though most files under
  `plugins/` are generated.
- `src/`, `src/runtime/`, `src/schemas/`, and `src/flows/` required inference
  from filenames before a contributor could choose the right layer.

## After Map

The current shape keeps stable public paths where release checks already depend
on them, then adds maps at the boundaries where readers had to infer ownership:

```text
.
+-- README.md
+-- docs/
|   +-- README.md
|   +-- repository-map.md
|   +-- first-run.md
|   +-- operator-guide.md
|   +-- configuration.md
|   +-- generated-surfaces.md
|   +-- architecture/
|   |   +-- codebase-walkthrough.md
|   |   +-- runtime.md
|   +-- reference/
|   |   +-- script-inventory.md
|   +-- contracts/
|   +-- flows/
|   +-- release/
+-- plugins/
|   +-- README.md
|   +-- claude/
|   +-- codex/
+-- src/
    +-- README.md
    +-- runtime/README.md
    +-- schemas/README.md
    +-- flows/README.md
    +-- types/README.md
```

The operator path is still short:

```text
README.md -> docs/README.md -> one task-specific doc
```

The contributor path is now layered:

```text
docs/repository-map.md -> src/README.md -> src/<layer>/README.md -> code
```

Layer maps live at `src/runtime/README.md`, `src/schemas/README.md`,
`src/flows/README.md`, and `src/types/README.md`.

## Migration Rationale

| Change | Rationale | Behavior impact |
| --- | --- | --- |
| `docs/literate-guide.md` -> `docs/architecture/codebase-walkthrough.md` | The file is a deep architecture walkthrough, not an operator entry doc. Putting it under architecture reduces first-level docs noise and matches its audience. | Docs-only path move. |
| `docs/script-inventory.md` -> `docs/reference/script-inventory.md` | Script ownership is maintenance reference material. It should sit behind the docs map, not beside first-run and operator docs. | Docs-only path move. |
| Added `plugins/README.md` | Generated host packages need a parent map before readers enter Claude Code or Codex-specific output. | Docs-only addition. |
| Added `src/README.md` and layer READMEs | Runtime, schema, flow, and type ownership can be learned locally without reading the long walkthrough first. | Docs-only addition. |
| Kept `docs/generated-surfaces.md` in place | The flow emitter owns this generated file path, and tests plus release docs already use it as the generated ownership anchor. Moving it would add churn without improving the first navigation step. | No generated ownership change. |
| Kept runtime, schema, and flow code paths in place | The source tree already separates engine mechanics, schemas, and flow packages. A code move would churn imports and generated references before there is evidence of a deeper ownership bug. | No runtime behavior change. |

## Targeted Probes

Run these after navigation or file-tree changes:

```bash
rg -n "\\]\\((?:docs/)?(?:literate-guide|script-inventory)\\.md|readRepoFile\\('docs/(?:literate-guide|script-inventory)\\.md'\\)" README.md AGENTS.md docs src tests scripts plugins generated package.json -g '!docs/internal/archive/**' -g '!docs/release/proofs/runs/**' -g '!docs/reference/**'
npm run check-flow-drift
npm run check-release-infra
npm run verify
```

Expected result: no active links or test reads for the moved docs,
generated-surface drift checks pass, release checks pass, and the full
verification command passes.
