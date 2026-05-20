<p align="center">
  <img src="assets/circuit.png" alt="Circuit" width="100%" />
</p>
<br />

**A Workflow Orchestration Plugin for Claude Code and Codex**

Circuit gives your coding agent tools for orchestrating complex, multi-step
workflows to produce more consistent and reliable results, with less
babysitting.

Go from this:

- Prompt the agent with a skill
- Ask the agent to make a plan
- Ask the agent to review the plan and update it
- Ask the agent to execute the plan
- Ask the agent to review its work using a skill
- Ask the agent to use another skill for a different part of the code
- ...and so on, all the while feeling a sense of unease if the agent drifted or
  missed any crucial details

To this:

- `/circuit:run build the thing`

Circuit automates all the tedium and produces sounder results:

- Chooses the right built-in, custom, or dynamically determined multi-step flow
- Moves through each step in sequence and/or parallelizes non-dependent steps
- Applies your preferred skills at the appropriate steps
- Uses your preferred model(s) and thinking power for particular steps
- Checks the outputs of each step before continuing, providing traces, reports,
  and evidence that the work was complete

Ready to try it? Pick a host below, or point your coding agent at the setup
prompt. For the full docs map, see [`docs/README.md`](docs/README.md).

## Start Here

Pick the path that matches where you want to use Circuit. If you want a coding
agent to set this up for you, skip to
[`Give This To A Coding Agent`](#give-this-to-a-coding-agent).

### Claude Code

Install the host plugin:

```text
/plugin marketplace add petekp/circuit
/plugin install circuit@circuit
/reload-plugins
```

Then ask Circuit to handle a task:

```text
/circuit:run the checkout total is wrong when discounts and tax both apply
```

The installed plugin is self-contained. You do not need to clone this repo,
run `npm install`, install a `circuit` binary, or create a symlink.

### Codex

For Codex host use from this checkout, refresh the local plugin package:

```bash
npm run sync:codex-plugin-cache
```

Then ask Codex to use Circuit:

```text
@Circuit the checkout total is wrong when discounts and tax both apply
```

Codex can choose the best bundled Circuit flow skill from your
natural-language request.

### Local CLI

From this checkout:

```bash
npm install
npm run build
./bin/circuit run --goal '<your task>'
```

Circuit requires Node.js `22.18.0` or newer.
For a more careful manual check, use [`docs/first-run.md`](docs/first-run.md).

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

Start:

- [`docs/first-run.md`](docs/first-run.md): manual setup check, safest Review,
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
