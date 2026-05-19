<p align="center">
  <img src="assets/circuit.png" alt="Circuit" width="100%" />
</p>
<br />

# circuit

**Structured flows for coding agents.**

Circuit is an orchestration layer for structured, resumable, multi-stage
developer flows. Ask Circuit to handle a task in natural language. In
Claude Code, `/circuit:run` selects the right flow before it starts. In
Codex, `@Circuit` lets Codex choose the best bundled Circuit skill. In the
local CLI, `circuit-next run --goal` keeps the deterministic router path.

Once a flow is selected, Circuit runs the same headless engine in every
host and checks each step's output against a contract before moving on.

- **Configurable relay steps.** Pick the model, reasoning effort, connector,
  and optional local skills through flow and config selection layers.
- **Resumable.** If a session dies mid-run, you can pick up where it left off.
- **Adjustable autonomy.** Steer at checkpoints or run unattended.
- **Mode-driven depth.** Use the default mode, or pick Lite for a faster pass
  and Deep for a more thorough one.

## Get Started

Circuit is currently a pre-release alpha. For Claude Code, install the plugin
from the marketplace:

```bash
/plugin marketplace add petekp/circuit
/plugin install circuit@circuit
/reload-plugins
```

Then ask Circuit to choose a flow:

```text
/circuit:run <your task>
```

The installed plugin is self-contained. Normal users do not need to clone this
repo, run `npm install`, install a `circuit-next` binary, or create a symlink.
The plugin wrapper launches the bundled runtime that ships with the plugin.

For local development from this checkout:

```bash
git clone https://github.com/petekp/circuit.git
cd circuit
npm install
npm run build
./bin/circuit-next run --goal '<your task>'
```

To use Circuit from Codex, install or refresh the Codex plugin package and ask
Codex to use `@Circuit`. Codex can choose the best bundled Circuit flow
skill from your natural-language request.

Optional but recommended: drop a personal config at
`~/.config/circuit-next/config.yaml` to set defaults (model, reasoning effort,
local skills, connector routing) across every project. A repo-local
`./.circuit/config.yaml` overrides those defaults per project. See
[User-Space Configuration](#user-space-configuration) for details.

## How It Works

Circuit replaces ad-hoc skill invocation and copy-pasted instructions. Use one
natural-language front door for normal work, or call a flow directly when
you already know what you want.

**Core Flows:**

These flows ship with the plugin. Build, Fix, Explore, Review, and Pursue can
all be selected by the host model or invoked explicitly through the CLI.

| Flow | Purpose |
|----------|-------------|
| **Explore** | Investigate, understand, choose among options, shape a plan |
| **Build** | Features, refactors, docs, tests, mixed changes |
| **Fix** | Bugs, regressions, flaky behavior |
| **Review** | Audit-only review, no implementation |
| **Pursue** | Broad goals with multiple coordinated pieces of work |

**Run Controls:**

Each flow declares which rigor, tournament, and autonomous settings it
supports. Unsupported combinations fail before the run starts.

| Control | Behavior |
|-------|--------|
| **Default** | Standard rigor, no tournament, operator-present checkpoints unless the flow has safe defaults. |
| **Lite** | Lower rigor where the flow allows it. Use for small, low-risk work. |
| **Deep** | Higher rigor where the flow allows it. Useful for risky or architecture-heavy work. |
| **Tournament** | Competing proposals with adversarial evaluation. Available on Explore. |
| **Autonomous** | Checkpoints auto-resolve to declared safe choices. Useful for unattended runs. |

Use `--rigor <lite|standard|deep>`, `--tournament`, `--tournament-n <2|3|4>`,
and `--autonomous` to set those controls. Availability varies by flow; see
each flow's `src/flows/<id>/data.ts` for the authoritative FlowData value,
`src/flows/<id>/flow.ts` for the adapter, and `src/flows/<id>/schematic.json`
for the generated compatibility schematic.

Every flow is built from a fixed set of stages: **Frame, Analyze, Plan, Act,
Verify, Review, Close**. Not every flow runs every stage, but the order
holds.

1. **The flow is selected.** In host plugins, the host model may choose a
   flow before calling Circuit. In CLI router mode, Circuit's deterministic
   router chooses.

2. **Steps run in the right order.** Research before decisions. Decisions
   before implementation. Implementation gets an independent review from a
   separate worker. Every step writes a typed report and an entry in the run
   trace.

3. **Progress survives session crashes.** Each run gets its own folder with a
   trace, reports, and evidence. If a session dies, resume against that
   folder and Circuit picks up at the last completed step.

4. **Stay in the loop.** Flows pause at checkpoints when they need scope
   confirmation or a tradeoff decision. Everything else runs autonomously.
   Autonomous mode resolves checkpoints to their safe default and keeps
   going.

## Commands

**Default front doors:**

| Host | You type | What chooses |
|----------|-------------|-------------|
| Claude Code | `/circuit:run the checkout total is wrong when discounts and tax both apply` | The host model selects an explicit Circuit flow. |
| Codex | `@Circuit the checkout total is wrong when discounts and tax both apply` | Codex chooses the best bundled Circuit flow skill. |
| CLI | `./bin/circuit-next run --goal "the checkout total is wrong when discounts and tax both apply"` | Circuit's deterministic CLI router chooses. |

**Direct flow control:**

| Host | You type | What happens |
|----------|-------------|-------------|
| Claude Code | `/circuit:fix checkout total is wrong` | Runs Fix directly. |
| Claude Code | `/circuit:review current diff` | Runs Review directly. |
| Claude Code | `/circuit:build add billing settings` | Runs Build directly. |
| Claude Code | `/circuit:explore compare auth providers` | Runs Explore directly. |
| Codex | Invoke the specific Circuit flow skill directly. | Runs that flow through the Codex plugin wrapper. |
| CLI | `./bin/circuit-next run fix --goal "checkout total is wrong"` | Runs Fix directly. |
| CLI | `./bin/circuit-next run pursue --goal "coordinate these cleanup goals"` | Runs Pursue directly. |

The host commands wrap the underlying CLI. Each flow accepts a `--goal`; direct
CLI runs can also pass `--rigor`, `--tournament`, `--tournament-n`, and
`--autonomous` when the selected flow supports that axis combination.

**Advanced compatibility:**

The deterministic CLI router still understands old intent prefixes such as
`fix:`, `review:`, `develop:`, and `decide:`. They are kept for scripts and
older habits, not as the normal user experience.

Review collects untracked file paths and sizes by default, but not untracked
file contents. If you explicitly want Review to send untracked file contents
to the configured worker, add `--include-untracked-content` after confirming
those files are safe to relay.

## Key Features

**Natural flow selection.** Describe your task. In host plugins, the host
model may choose the flow before calling Circuit. In CLI router mode,
Circuit uses a small deterministic classifier.

**Independent review.** For default and deep modes, implementation and review
run in separate workers. The reviewer starts fresh with no knowledge of the
implementation choices. Lite mode skips the review where the flow allows it.

**Typed reports and evidence.** Every step writes a Zod-validated report. A
flow's final report links the reports the run produced — the implementation,
the verification result, the review verdict — so you can audit a run end to
end without re-reading the trace.

**Relay configuration.** Pick the model, reasoning effort, connector, and
optional local skills for relay steps. Configuration layers from defaults to
user-global to project to invocation, and the resolver enforces a single
ordering at run time.

**Definition-driven flows.** Each flow is one folder under `src/flows/<id>/`:
typed definition, report schemas, command, contract, writers, and relay hints.
The engine derives every per-flow registry from the catalog. Adding a flow does
not require editing the engine.

**Run folders.** Each run gets its own directory with the trace, every typed
report, evidence, and a checkpoint inbox. Resuming, debugging, and audits
all read from the same place.

## Local Skills

Circuit can load your own local `SKILL.md` files into relay prompts. It scans
the host-native skill folders, in this order:

1. `~/.agents/skills/<skill-id>/SKILL.md`
2. `~/.claude/skills/<skill-id>/SKILL.md`

`~/.agents/skills` wins when both roots contain the same skill id. Built-in
flows do not require any local skills, and they do not name concrete local
skill ids. A built-in flow may expose an optional skill slot, and you can bind
that slot to one of your own skills in config.

```yaml
schema_version: 1

skills:
  bindings:
    review-assistant: react-change-review

circuits:
  review:
    skill_bindings:
      review-assistant: my-review-skill
    selection:
      skills:
        mode: append
        skills:
          - tdd
```

`selection.skills` names concrete local skill ids and must resolve before the
worker starts. `skills.bindings` and `circuits.<flow>.skill_bindings` bind
optional flow slots to concrete local skills. Missing unbound slots are ignored.
When a skill is loaded, the run trace records its id, optional slot, path,
SHA-256, and byte count.

## User-Space Configuration

Circuit reads configuration from two layered files:

1. `~/.config/circuit-next/config.yaml` for your personal defaults across
   projects.
2. `./.circuit/config.yaml` at a repo root for project-specific overrides.

Both files share the same schema. The project file's keys win when the same
key is set in both. The default selection ordering is: defaults < user-global
< project < invocation flags.

Configuration controls:

- Per-step **model** (which Claude model to use)
- Per-step **reasoning effort**
- Local **skills** selected through `selection.skills` or optional slot bindings
- Per-step **connector** (which backend executes a relayed step)
- Per-flow overrides under `circuits.<flow_id>`

Config is read at run time, so editing either file does not require a
plugin rebuild.

## Codex Host And Codex Worker

Codex can use Circuit in two separate ways:

- **host/orchestrator behavior:** in Codex, ask `@Circuit` to handle a task.
  Codex chooses the best bundled Circuit flow skill and invokes the local
  Circuit engine.
- **worker connector behavior:** Circuit can also relay read-only worker steps
  through the Codex CLI from any host.

The Codex worker connector is optional.

```bash
npm install -g @openai/codex
```

When Codex is the connector for a step, Circuit launches `codex exec` with
read-only sandbox flags. It inherits the Circuit process environment and
current working directory, so configure it only where those process settings are
appropriate for the worker.

## Connector Routing

Circuit keeps flow schematics connector-agnostic. Routing lives in
`config.yaml`, so the same flow can pick the right execution transport
without baking transport choices into the schematic.

Connector resolution at relay time follows a fixed order:

1. `relay.roles.<role>` mapping (matches the role of the step being relayed)
2. `relay.circuits.<flow_id>` mapping (matches the active flow)
3. `relay.default`
4. Auto-detect (currently `claude-code`)

Built-in connectors:

- **`claude-code`** — Claude Code CLI subprocess. This is the trusted
  same-workspace connector and the current auto default.
- **`codex`** — Codex CLI subprocess using Codex's read-only sandbox flags.
  This connector cannot run implementer steps.

`codex-isolated` is planned for a future isolated writable Codex worker. It is
not a current config value; use `codex` for read-only Codex relays or
`claude-code` for trusted same-workspace writes.

Before a Build or Fix run invokes an implementer, Circuit
discloses the write-capable worker path:

> This flow may invoke a write-capable Claude Code worker. Circuit will verify
> and review the result, but the worker can edit files in this checkout.

Custom connectors are wrapper executables. Define them under
`relay.connectors.<name>.command` as a YAML argv array. Circuit appends
`PROMPT_FILE OUTPUT_FILE` as the final two arguments; the wrapper reads the
prompt file and writes a JSON response object to the output file. This keeps
wrapper contracts small and avoids shell interpolation.

Custom connectors are trusted local processes, not an OS sandbox. For custom
connectors, stdin is ignored, stdout is treated as debug output, and stderr is
included in failure messages. They inherit the Circuit process environment and
current working directory. `capabilities.filesystem: read-only` means Circuit
will only route them to read-only worker roles; it does not prevent the wrapper
process from writing files on its own. See
[`docs/contracts/connector.md`](docs/contracts/connector.md) for the full
contract.

## Prerequisites

- **Claude Code**
- **Node.js 22.18.0+**

## Troubleshooting

**Verify your install.** From a checkout, run the full check suite:

```bash
npm run verify
```

This runs `tsc --noEmit`, the linter, the build, the test suite, and the
flow-emit drift check. If any step fails, that is the issue to fix first.

**Changes to flow source not showing up.** Slash commands and compiled flows
are generated from `src/flows/<id>/`. Regenerate them with:

```bash
npm run emit-flows
```

Verify there is no drift with `npm run check-flow-drift`. CI runs the same
check on every push.

**Verify a plugin install.** Run the plugin doctor. The JSON should include
`"runtime_source": "bundled"`:

```bash
node '<plugin root>/scripts/circuit-next.mjs' doctor
```

**Develop against a local CLI.** The plugin ignores ambient `PATH` binaries by
default. Use `CIRCUIT_NEXT_CLI=/absolute/path/to/bin/circuit-next` for an
explicit override, or set `CIRCUIT_NEXT_DEV=1` to allow repo-local and `PATH`
fallbacks during development only.

**Node version failure.** The bundled runtime requires Node.js 22.18.0 or
newer. Upgrade Node if the wrapper reports an older version.

**"codex not found" warning.** Codex CLI is optional. The `claude-code`
connector works without Codex. Install Codex only if you want a separate
read-only Codex worker process per relay.

**A run resumed from the wrong step.** Each run's state lives in its run
folder under `.circuit-next/runs/`. To resume a specific run with an explicit
checkpoint choice:

```bash
./bin/circuit-next resume \
  --run-folder '<run_folder>' \
  --checkpoint-choice '<choice>'
```

If a run is irrecoverably stuck, the simplest recovery is to delete its run
folder and start the task again from scratch.

## Further Reading

- **[`AGENTS.md`](AGENTS.md):** The agent-facing operating doc for this
  repo.
- **[`UBIQUITOUS_LANGUAGE.md`](UBIQUITOUS_LANGUAGE.md):** Canonical vocabulary
  for Circuit.
- **[`docs/README.md`](docs/README.md):** The low-noise map of canonical docs,
  archived records, generated evidence, research notes, and removal candidates.
- **[`docs/architecture/runtime.md`](docs/architecture/runtime.md):** Runtime
  architecture and run-folder ownership.
- **[`docs/contracts/`](docs/contracts/):** Engine contracts (config,
  connector, run, step, flow, selection, continuity, skill, stage).
- **[`docs/flows/`](docs/flows/):** Flow design notes and the block catalog.

## License

TBD
