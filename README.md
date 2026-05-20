<p align="center">
  <img src="assets/circuit.png" alt="Circuit" width="100%" />
</p>
<br />

# Circuit

**Configurable flow orchestration for coding agents.**

Circuit gives a coding agent a structured path through real work. Give it a
task, and Circuit chooses or runs the right flow, moves through the steps in
order, checks outputs before continuing, and leaves a trace, reports, and
evidence in a run folder.

Use it when you want a repeatable path for bug fixes, implementation, review,
architecture choices, or a broad goal that needs ordered work.

New here? Start with [`docs/first-run.md`](docs/first-run.md). For the full
docs map, see [`docs/README.md`](docs/README.md).

## Start Here

Pick the path that matches your host.

### Claude Code

Install the host plugin:

```text
/plugin marketplace add petekp/circuit
/plugin install circuit@circuit
/reload-plugins
```

Run doctor before the first useful run. For the current alpha version, the
marketplace install path is:

```bash
node "$HOME/.claude/plugins/cache/circuit/circuit/0.1.0-alpha.6/scripts/circuit.ts" doctor
```

The doctor output should include `"runtime_source": "bundled"`. That means
the plugin is using the runtime it shipped with, not a `circuit` binary from
`PATH`.

Then use the natural-language front door:

```text
/circuit:run the checkout total is wrong when discounts and tax both apply
```

The installed Claude Code plugin is self-contained. You do not need to clone
this repo, run `npm install`, install a `circuit` binary, or create a symlink.

### Codex

Codex has two separate Circuit roles:

- As the **host/orchestrator**, Codex starts Circuit through `@Circuit`.
- As a **worker connector**, Circuit can relay read-only worker steps through
  the Codex CLI.

For Codex host use from this checkout, refresh the local plugin package and
check the cache:

```bash
npm run sync:codex-plugin-cache
npm run check:codex-plugin-cache
```

Then run doctor from the synced package:

```bash
node "$HOME/.codex/plugins/cache/circuit-local/circuit/0.1.0-alpha.6/scripts/circuit.ts" doctor
```

Or from this checkout:

```bash
node plugins/circuit/scripts/circuit.ts doctor
```

Then ask Codex to use Circuit:

```text
@Circuit the checkout total is wrong when discounts and tax both apply
```

Codex can choose the best bundled Circuit flow skill from your
natural-language request.

Install the Codex CLI only when you also want the optional read-only worker
connector:

```bash
npm install -g @openai/codex
```

### Local Development From Source

For repo development:

```bash
git clone https://github.com/petekp/circuit.git
cd circuit
npm install
npm run build
./bin/circuit run --goal '<your task>'
```

Circuit requires Node.js `22.18.0` or newer.

## Choose A Flow

Use one front door unless you already know the flow you want.

Claude Code:

```text
/circuit:run the checkout total is wrong when discounts and tax both apply
```

Codex:

```text
@Circuit the checkout total is wrong when discounts and tax both apply
```

CLI:

```bash
./bin/circuit run --goal "the checkout total is wrong when discounts and tax both apply"
```

If the flow choice is obvious, use the direct commands in
[`docs/operator-guide.md`](docs/operator-guide.md). That guide also covers
flags, checkpoints, verification, troubleshooting, and older compatibility
prefixes.

## What Ships In This Alpha

Circuit `0.1.0-alpha.6` is a plugin-only alpha for Claude Code and Codex. The
root `circuit` npm package in this checkout remains private, so Claude Code
users install a host plugin instead of a global npm package.

Ships now:

- Core flows: Build, Explore, Fix, Pursue, and Review.
- Claude Code commands: `/circuit:run`, `/circuit:explore`,
  `/circuit:review`, `/circuit:fix`, `/circuit:build`, `/circuit:create`, and
  `/circuit:handoff`.
- Codex plugin skills: `run`, `build`, `create`, `explore`, `fix`, `handoff`,
  and `review`.
- A repo-local CLI for development and tests.

Not shipped in this alpha:

- Native Codex App Server or Claude Agent SDK adapters.
- `codex-isolated` writable worker support. `codex-isolated` is not a valid
  config value.
- Cross-run project-memory query and recall.
- An automatic update channel.
- A public `/circuit:pursue` slash command. Pursue can still run through
  `/circuit:run`, `@Circuit`, or `./bin/circuit run pursue --goal "<task>"`.
- A polished generic-shell progress UI.
- An external same-task comparison demo. Use the checked-in proof set as the
  release proof for this alpha.

## Safety Notes

Build, Fix, and Pursue may invoke a write-capable worker. Circuit discloses
that before it invokes an implementer:

> This flow may invoke a write-capable Claude Code worker. Circuit will verify
> and review the result, but the worker can edit files in this checkout.

Review collects untracked file paths and sizes by default, but not untracked
file contents. Add `--include-untracked-content` only after you confirm those
files are safe to relay.

Built-in worker connectors are **`claude-code`** and **`codex`**. Use
`claude-code` for trusted same-workspace writes. Use `codex` for read-only
Codex relays.

Custom connectors use the prompt-file/output-file protocol. stdin is ignored,
the process inherits the Circuit process environment and current working
directory, and `capabilities.filesystem: read-only` is a routing signal, not an
OS sandbox.

## Host And Worker Terms

Codex has two separate roles:

- **host/orchestrator behavior:** in Codex, ask `@Circuit` to handle a task.
  Codex chooses the best bundled Circuit flow skill and invokes the local
  Circuit engine.
- **worker connector behavior:** Circuit can relay read-only worker steps
  through the Codex CLI from any host.

See [`docs/configuration.md`](docs/configuration.md) for connector routing and
worker setup.

## Configuration

Circuit reads config at run time from:

1. `~/.config/circuit/config.yaml` for your personal defaults across projects.
2. `./.circuit/config.yaml` at the repo root for project-specific overrides.

Config can set models, effort, local skills, connector routing, and per-flow
overrides. See [`docs/configuration.md`](docs/configuration.md).

## Give This To A Coding Agent

Use the canonical copy-paste prompt in
[`docs/agent-setup.md`](docs/agent-setup.md). It includes the safe setup
checks, generated-file boundary, Codex cache checks, and first-run guidance.

## Where To Go Next

Start:

- [`docs/first-run.md`](docs/first-run.md): first doctor run, safest Review,
  and the run folder shape.
- [`docs/README.md`](docs/README.md): map of the current docs.

Operate:

- [`docs/operator-guide.md`](docs/operator-guide.md): commands, run flow,
  checkpoints, verification, and troubleshooting.
- [`docs/configuration.md`](docs/configuration.md): config layers, local
  skills, Codex worker setup, and connector routing.
- [`docs/agent-setup.md`](docs/agent-setup.md): copy-paste setup instructions
  for a coding agent.

Contribute or verify:

- [`docs/generated-surfaces.md`](docs/generated-surfaces.md): source map for
  generated command, skill, schematic, and plugin output.
- [`docs/literate-guide.md`](docs/literate-guide.md): codebase walkthrough for
  contributors.
- [`docs/release/proofs/index.yaml`](docs/release/proofs/index.yaml):
  checked-in proof set covering doing work, deciding, continuity,
  customization, failure, first run, and plan execution for this alpha.

## License

TBD
