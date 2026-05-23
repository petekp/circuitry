<div align="center">
  <img src="assets/circuit.png" alt="Circuit" width="100%" />
</div>
<h3 align="center"><strong>Structured developer flows for Claude Code and Codex</strong></h3>
<br />
Circuit runs coding tasks through structured flows with trace, reports, and
evidence. It helps produce more consistent and reliable results, with less
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

- Records the chosen built-in, custom, or dynamically determined flow
- Moves through each step in sequence and/or parallelizes non-dependent steps
- Applies your preferred skills at the appropriate steps
- Uses your preferred model(s) and thinking power for particular steps
- Checks step outputs before continuing, including deterministic relay
  acceptance criteria where a flow declares them, with traces, reports, and
  evidence that show what passed

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

Codex can recommend the right Circuit flow from your natural-language request.

### Local CLI

From this checkout:

```bash
npm install
npm run build
./bin/circuit run --goal '<your task>'
```

Circuit requires Node.js `22.18.0` or newer.
For a more careful manual check, use [`docs/first-run.md`](docs/first-run.md).
For the repo map, use [`docs/repository-map.md`](docs/repository-map.md).

## Start From An Intent

Use one front door unless you already know the flow you want:

| Host | You type | What happens |
| --- | --- | --- |
| Claude Code | `/circuit:run the checkout total is wrong when discounts and tax both apply` | The host may recommend a flow; Circuit records the selected flow when the run starts. |
| Codex | `@Circuit the checkout total is wrong when discounts and tax both apply` | Codex may recommend a flow; Circuit records the selected flow when the run starts. |
| CLI | `./bin/circuit run --goal "the checkout total is wrong when discounts and tax both apply"` | Circuit's deterministic CLI router selects and records the flow. |

If the flow choice is obvious, use direct commands such as `/circuit:fix`,
`/circuit:review`, `/circuit:build`, `/circuit:explore`,
`/circuit:prototype`, or `/circuit:goal` as expert controls. They start
Circuit from that flow; they are not a bypass. The CLI form is
`./bin/circuit run <flow> --goal "<task>"`. Use `/circuit:run` for Pursue from
Claude Code; the CLI can run `pursue` directly.

Create drafts reusable custom flows after explicit confirmation. Handoff saves,
resumes, clears, briefs, or installs continuity support. See
[`docs/operator-guide.md`](docs/operator-guide.md) for direct commands, flags,
checkpoints, verification, and troubleshooting.

## Safety Notes

Build, Fix, Prototype, and Pursue may invoke a write-capable worker. Circuit
discloses that before write-capable work starts:

> A worker can edit this checkout.

Review collects untracked file paths and sizes by default, but not untracked
file contents. Add `--include-untracked-content` only after you confirm those
files are safe to relay.

Built-in worker connectors are **`claude-code`**, **`codex`**, and
**`cursor-agent`**. Use `claude-code` for trusted Claude Code writes, `codex`
for first-class Codex worker writes, and `cursor-agent` for Cursor CLI
implementer work.

Custom connectors use the prompt-file/output-file protocol. stdin is ignored,
the process inherits the Circuit process environment and current working
directory, and `capabilities.filesystem: read-only` is a routing signal, not an
OS sandbox.

## Host And Worker Terms

Codex has two separate roles:

- **host/orchestrator behavior:** in Codex, ask `@Circuit` to handle a task.
  Codex can recommend the right Circuit flow and invoke the local Circuit
  engine.
- **worker connector behavior:** Circuit can relay worker steps through the
  Codex CLI from any host, including write-capable implementer steps.

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
- [`docs/repository-map.md`](docs/repository-map.md): before/after repo map,
  layer ownership, and migration rationale.

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
- [`docs/architecture/codebase-walkthrough.md`](docs/architecture/codebase-walkthrough.md):
  codebase walkthrough for contributors.
- [`docs/release/proofs/index.yaml`](docs/release/proofs/index.yaml):
  checked-in proof set covering doing work, deciding, continuity,
  customization, failure, first run, and plan execution for this alpha.

## License

No reuse license has been selected yet.
