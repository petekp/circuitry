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

## Start Here

Pick the path that matches your host.

### Claude Code

Install the host plugin:

```text
/plugin marketplace add petekp/circuit
/plugin install circuit@circuit
/reload-plugins
```

Run doctor before the first useful run:

```bash
node '<plugin root>/scripts/circuit.ts' doctor
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

From this checkout, refresh the local Codex plugin package and check the cache:

```bash
npm run sync:codex-plugin-cache
npm run check:codex-plugin-cache
```

Then ask Codex to use Circuit:

```text
@Circuit the checkout total is wrong when discounts and tax both apply
```

Codex can choose the best bundled Circuit flow skill from your
natural-language request.

### Local CLI

For local development:

```bash
git clone https://github.com/petekp/circuit.git
cd circuit
npm install
npm run build
./bin/circuit run --goal '<your task>'
```

Circuit requires Node.js `22.18.0` or newer.

## What Ships In This Alpha

Circuit `0.1.0-alpha.6` is a plugin-only alpha for Claude Code and Codex. The
root `circuit` npm package in this checkout remains private, so Claude Code
users install a host plugin instead of a global npm package.

This alpha ships:

- Core flows: Build, Explore, Fix, Pursue, and Review.
- Claude Code commands: `/circuit:run`, `/circuit:explore`,
  `/circuit:review`, `/circuit:fix`, `/circuit:build`, `/circuit:create`, and
  `/circuit:handoff`.
- Codex plugin skills: `run`, `build`, `create`, `explore`, `fix`, `handoff`,
  and `review`.
- A repo-local CLI: `./bin/circuit run --goal "<task>"` and explicit flow
  names such as `./bin/circuit run fix --goal "<bug>"`.

This alpha does not ship:

- Native Codex App Server or Claude Agent SDK adapters.
- `codex-isolated` writable worker support. `codex-isolated` is not a valid
  config value in this alpha.
- Cross-run project-memory query and recall.
- An automatic update channel.
- A public `/circuit:pursue` slash command. Pursue can still run through
  `/circuit:run`, `@Circuit`, or `./bin/circuit run pursue --goal "<task>"`.
- A polished generic-shell progress UI.
- An external same-task comparison demo. For this alpha, use the checked-in
  proof set as the release proof.

## Choose A Flow

Use one front door unless you already know the flow you want:

| Host | You type | Who chooses the flow |
| --- | --- | --- |
| Claude Code | `/circuit:run the checkout total is wrong when discounts and tax both apply` | The host model selects an explicit Circuit flow. |
| Codex | `@Circuit the checkout total is wrong when discounts and tax both apply` | Codex chooses the best bundled Circuit flow skill. |
| CLI | `./bin/circuit run --goal "the checkout total is wrong when discounts and tax both apply"` | Circuit's deterministic CLI router chooses. |

If the flow choice is obvious, use direct commands such as `/circuit:fix`,
`/circuit:review`, `/circuit:build`, or `/circuit:explore`. The CLI form is
`./bin/circuit run <flow> --goal "<task>"`. Use `/circuit:run` for Pursue from
Claude Code; the CLI can run `pursue` directly.

Create drafts reusable custom flows after explicit confirmation. Handoff saves,
resumes, clears, briefs, or installs continuity support. See
[`docs/operator-guide.md`](docs/operator-guide.md) for direct commands, flags,
checkpoints, verification, and troubleshooting.

**Advanced compatibility:**

The deterministic CLI router still understands old intent prefixes such as
`fix:`, `review:`, `develop:`, and `decide:`. Keep them for scripts and older
habits, not for the normal user path.

## Safety Notes

Build, Fix, and Pursue may invoke a write-capable worker. Circuit discloses
that before it invokes an implementer:

> This flow may invoke a write-capable Claude Code worker. Circuit will verify
> and review the result, but the worker can edit files in this checkout.

Review collects untracked file paths and sizes by default, but not untracked
file contents. Add `--include-untracked-content` only after you confirm those
files are safe to relay.

Codex has two separate roles:

- **host/orchestrator behavior:** in Codex, ask `@Circuit` to handle a task.
  Codex chooses the best bundled Circuit flow skill and invokes the local
  Circuit engine.
- **worker connector behavior:** Circuit can relay read-only worker steps
  through the Codex CLI from any host.

Built-in worker connectors are **`claude-code`** and **`codex`**. Use
`claude-code` for trusted same-workspace writes. Use `codex` for read-only
Codex relays. Custom connectors use the prompt-file/output-file protocol;
stdin is ignored, the process inherits the Circuit process environment and
current working directory, and `capabilities.filesystem: read-only` is a
routing signal, not an OS sandbox.

## Configuration

Circuit reads config at run time from:

1. `~/.config/circuit/config.yaml` for your personal defaults across projects.
2. `./.circuit/config.yaml` at the repo root for project-specific overrides.

Config can set models, effort, local skills, connector routing, and per-flow
overrides. See [`docs/configuration.md`](docs/configuration.md).

## Give This To A Coding Agent

Paste this into a coding agent when you want it to set up Circuit from a
checkout safely:

```text
You are setting up Circuit in this repo: <repo-path>.

Stay inside that checkout. Read README.md and docs/agent-setup.md, then follow
the setup checklist there. Do not hand-edit generated host output. Preview any
config YAML before writing it. Use Review as the first real run unless I ask
for a write-capable flow. Report commands run, files changed, verification
results, and any blocker.
```

See [`docs/agent-setup.md`](docs/agent-setup.md) for the full setup checklist.

## Where To Go Next

- [`docs/first-run.md`](docs/first-run.md): first doctor run and safest first
  Review.
- [`docs/operator-guide.md`](docs/operator-guide.md): commands, run flow,
  checkpoints, verification, and troubleshooting.
- [`docs/configuration.md`](docs/configuration.md): config layers, local
  skills, Codex worker setup, and connector routing.
- [`docs/agent-setup.md`](docs/agent-setup.md): copy-paste setup instructions
  for a coding agent.
- [`docs/generated-surfaces.md`](docs/generated-surfaces.md): source map for
  generated command, skill, schematic, and plugin output.
- [`docs/release/proofs/index.yaml`](docs/release/proofs/index.yaml): checked-in
  proof set covering doing work, deciding, continuity, customization, failure,
  first run, and plan execution for this alpha.
- [`docs/README.md`](docs/README.md): map of the current docs.

## License

TBD
