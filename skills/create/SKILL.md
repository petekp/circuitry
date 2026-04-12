---
name: create
description: >
  Generate, validate, and publish a user-global custom circuit workflow.
role: utility
trigger: >
  Use for /circuit:create when the user wants a new reusable workflow.
---

# Circuit: Create

Generate a first-class user-global custom circuit, validate it, then publish it as
`/circuit:<slug>` on confirmation.

## Scope

- Custom circuits live only under `~/.claude/circuit/skills/<slug>/`.
- Drafts live under `~/.claude/circuit/drafts/<slug>/`.
- Installed command/menu overlay state lives under `~/.claude/circuit/overlay/manifest.json`.
- Do not add project-local custom circuits in v1.
- Do not edit built-in workflows to publish a custom circuit.

## Required Inputs

The user should provide:

1. A natural-language workflow description.
2. Optionally, a preferred name.

If the description is missing, ask one concise question for it.

## Plugin Root

Resolve the installed plugin root from the hook-authored state file:

```bash
test -f .circuit/plugin-root
PLUGIN_ROOT="$(tr -d '\n' < .circuit/plugin-root)"
test -n "$PLUGIN_ROOT"
test -d "$PLUGIN_ROOT/skills"
test -f "$PLUGIN_ROOT/scripts/runtime/bin/custom-circuits.js"
test -f "$PLUGIN_ROOT/scripts/runtime/bin/circuit-engine.js"
```

If `.circuit/plugin-root` is missing, stop and tell the user to invoke a `/circuit:*`
command again so the helper state can be re-authored.

When you execute shell during this flow, prefer one short command per step.
Do not chain commands with `&&` or append `2>&1` unless absolutely necessary.
The host approval UI is more reliable with simple single-purpose commands.

Do not search the whole repo, plugin cache, or `$HOME` to rediscover Circuit files.
Use exact paths only:

- `.circuit/plugin-root`
- `$PLUGIN_ROOT/scripts/runtime/bin/custom-circuits.js`
- `$PLUGIN_ROOT/skills/<archetype>/SKILL.md`
- `$PLUGIN_ROOT/skills/<archetype>/circuit.yaml`
- `~/.claude/circuit/drafts/<slug>/`
- `~/.claude/circuit/skills/<slug>/`

Avoid broad searches like `**/SKILL.md`, `**/CUSTOM-CIRCUITS.md`, or sweeping `~/.claude/`.

## Archetype Selection

Pick the closest built-in workflow skeleton:

| Archetype | Use When |
|-----------|----------|
| `explore` | research, investigation, option analysis, decision support |
| `build` | feature work, implementation plans, docs/tests/refactors |
| `repair` | bug fixing, incident/regression handling, triage-to-fix loops |
| `migrate` | coexistence, staged replacement, audit-and-migrate programs |
| `sweep` | cleanup, batch improvement, dead-code or quality passes |

Infer and record all of these before drafting:

- `slug`
- archetype
- concise purpose
- direct invocation usage (`/circuit:<slug>` and optional `<task>` placeholder)
- 3-5 include signals
- optional exclude signals

## Slug Rules

The slug must be:

- lowercase kebab-case
- short and human-readable
- not reserved
- not already used by a built-in or published custom circuit

Check collisions with the merged catalog first:

```bash
node "$PLUGIN_ROOT/scripts/runtime/bin/custom-circuits.js" catalog \
  --scope merged \
  --home "$HOME"
```

If the preferred slug collides, propose one better slug and continue only after the user agrees.
Do not overwrite an existing published custom circuit in v1.

## Drafting

Read the chosen archetype from the installed plugin root:

```bash
ARCHETYPE="build"  # replace with the selected archetype
test -f "$PLUGIN_ROOT/skills/$ARCHETYPE/SKILL.md"
test -f "$PLUGIN_ROOT/skills/$ARCHETYPE/circuit.yaml"
```

Generate a full draft under `~/.claude/circuit/drafts/<slug>/`:

```text
SKILL.md
circuit.yaml
```

Use the archetype as the base, but adapt it fully to the requested workflow.
The draft must be a complete workflow, not a stub.

### Draft Requirements

For `circuit.yaml`:

- `circuit.id` must equal the slug.
- Keep schema-valid v2 structure.
- Use the selected archetype's step topology as the starting point.
- Replace purpose, entry usage, include signals, exclude signals, and step language so it fits the requested workflow.
- Keep routing/gating coherent; do not leave archetype-specific names that no longer match the new workflow.

For `SKILL.md`:

- Frontmatter `name` must equal the slug.
- Frontmatter `description` must match the workflow.
- Do not declare `role`; published custom circuits are workflows.
- State clearly that the published manifest path is `~/.claude/circuit/skills/<slug>/circuit.yaml`.
- Tell the direct workflow to treat `/circuit:<slug>` as already routed and not to bounce through `/circuit:run`.
- For custom-workflow smoke/bootstrap instructions, use `circuit-engine bootstrap --manifest "~/.claude/circuit/skills/<slug>/circuit.yaml"` and do not use `--workflow <slug>`.
- Reuse the archetype's structure and rigor, but rewrite the semantics for the new workflow.

## Validation

After drafting, validate through the dedicated helper CLI.

```bash
SLUG="<slug>"
node "$PLUGIN_ROOT/scripts/runtime/bin/custom-circuits.js" validate-draft \
  --slug "$SLUG" \
  --plugin-root "$PLUGIN_ROOT" \
  --home "$HOME" \
  --project-root "$PWD" \
  --entry-mode default \
  --goal "<validation objective>"
```

If validation fails:

1. Regenerate once using the actual validation error context.
2. Re-run the same validation.
3. If it still fails, stop without publishing and show the errors plainly.

## Publish Summary

If validation passes, present a concise summary and wait for confirmation:

- slug
- archetype
- purpose
- include signals
- exclude signals
- direct invocation
- `/circuit:run` behavior summary

The `/circuit:run` summary should be:

- built-in explicit prefixes still win
- otherwise this custom circuit is eligible when its signals are a stronger match than the best built-in
- built-ins win ties

Do not publish until the user explicitly confirms.

## Publish

On confirmation:

1. Publish the draft through the dedicated helper CLI:

```bash
SLUG="<slug>"
node "$PLUGIN_ROOT/scripts/runtime/bin/custom-circuits.js" publish-draft \
  --slug "$SLUG" \
  --plugin-root "$PLUGIN_ROOT" \
  --home "$HOME" \
  --include-marketplace
```

2. Tell the user to run `/reload-plugins` so the slash menu refreshes.

The publish helper owns:

- promoting the draft into `~/.claude/circuit/skills/<slug>/`
- removing the draft copy after a successful promote
- merging built-in and custom command ids into `.claude-plugin/public-commands.txt`
- writing/removing overlay-managed `commands/<slug>.md`
- updating `~/.claude/circuit/overlay/manifest.json`

## Guardrails

- Keep built-in docs/manifests closed-world in v1; only the installed command surface becomes overlay-aware.
- Do not hand-edit `commands/<slug>.md` in the plugin root; let the materializer generate it.
- Do not publish if slug collisions remain unresolved.
- Do not claim success until draft validation passed and materialization completed cleanly.
