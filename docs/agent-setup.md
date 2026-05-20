# Agent Setup

Safe setup steps for coding agents working in a Circuit checkout.

## Copy-Paste Prompt

Replace `<repo-path>` with the checkout path and paste this into the coding
agent:

```text
You are setting up Circuit in this repo: <repo-path>.

Stay inside that checkout unless I explicitly approve a user-global config
change. First read README.md, docs/README.md, AGENTS.md,
UBIQUITOUS_LANGUAGE.md, docs/first-run.md, docs/operator-guide.md,
docs/configuration.md, docs/agent-setup.md, and docs/generated-surfaces.md.

Check the environment with git status --short, node --version, and
npm --version. If Node is older than 22.18.0, stop and report that blocker. If
dependencies are missing, run npm install from the repo root, then run
npm run build.

Do not hand-edit generated host output. For Codex host setup, run
npm run sync:codex-plugin-cache and npm run check:codex-plugin-cache. For
config changes, preview the exact YAML before writing either
~/.config/circuit/config.yaml or ./.circuit/config.yaml.

Use Review as the first real run unless I ask for a write-capable flow. Report
commands run, files changed, verification results, and any blocker.
```

## Checks To Run

Gather the blockers before changing anything:

```bash
git status --short
node --version
npm --version
```

If Node is older than `22.18.0`, stop and report that blocker. Do not try to
work around it inside the repo.

If the checkout needs dependencies, install them from the repo root:

```bash
npm install
```

Then prove the repo builds:

```bash
npm run build
```

If the task is local Codex host setup, sync and check the local plugin cache:

```bash
npm run sync:codex-plugin-cache
npm run check:codex-plugin-cache
```

For plugin or public-claim changes, use the verification section in
[`docs/operator-guide.md`](operator-guide.md#verification).

## Config Boundaries

Config files are:

- `~/.config/circuit/config.yaml` for personal defaults across projects.
- `./.circuit/config.yaml` for project-specific overrides.

The agent should preview config before writing it. A minimal config starts with:

```yaml
schema_version: 1
```

Use `codex` only for read-only Codex relays. Use `claude-code` for trusted
same-workspace writes. Do not use `codex-isolated`; it is planned, not current.

## Safest First Run

Use Review first because it is audit-only:

```bash
./bin/circuit run review --goal 'review this checkout for obvious release blockers'
```

Build, Fix, and Pursue may invoke a write-capable Claude Code worker. The agent
should not start one unless the operator asked for code-changing work.
