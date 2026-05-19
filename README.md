<p align="center">
  <img src="assets/circuit.png" alt="Circuit" width="100%" />
</p>
<br />

**Powerful, configurable workflow orchestration for coding agents.**

Circuit gives your coding agent tools for completing complex, multi-step workflows.

Go from this:
- Prompt the agent with a skill
- Ask the agent to make a plan
- Ask the agent to review the plan and update it
- Ask the agent to execute the plan
- Ask the agent to review its work using a skill
- Ask the agent to use another skill for a different part of the code
- and so on, all the while feeling a sense of unease if the agent drifted or missed any crucial details

To this:
- `/circuit:run build the thing`

Circuit automates all the tedium and produces sounder results:
- Chooses the right built-in or custom multi-step flow
- Moves through each step in sequence and/or parallelizes non-dependent steps
- Applies your preferred skills at the appropriate steps
- Uses your preferred model(s) and thinking power for particular steps
- Checks the outputs of each step before continuing, providing traces, reports, and evidence that the work was complete

## Current Alpha

Circuit `0.1.0-alpha.6` is a plugin-only alpha for Claude Code and Codex. The
root `circuit` npm package in this checkout remains private, so Claude Code
users install a host plugin instead of installing a global npm package.

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

## When To Use It

| Flow | Use it for | Write behavior |
| --- | --- | --- |
| Explore | Investigating, explaining, comparing options, or making a decision before editing code. | Does not implement the change for you. |
| Review | Auditing code, a diff, a PR, a plan, a report, or a risk surface. | Audit-only. |
| Fix | Bugs, regressions, failing tests, crashes, flaky behavior, or production issues. | May invoke a write-capable worker. |
| Build | Features, refactors, docs, tests, or focused code changes that are not mainly bug fixes. | May invoke a write-capable worker. |
| Pursue | Broad goals with several coordinated pieces of work that need ordering. | May invoke a write-capable worker. |

Circuit also ships two utilities:

| Utility | Use it for |
| --- | --- |
| Create | Drafting, validating, and publishing a reusable custom flow after explicit confirmation. |
| Handoff | Saving, resuming, clearing, briefing, or installing continuity handoff support. |

## Install And Run

For Claude Code, install the plugin from the marketplace:

```bash
/plugin marketplace add petekp/circuit
/plugin install circuit@circuit
/reload-plugins
```

Run the doctor before your first task run:

```bash
node '<plugin root>/scripts/circuit.ts' doctor
```

The doctor output should include `"runtime_source": "bundled"`. That means the
plugin uses the runtime it shipped with, not a `circuit` binary from `PATH`.

Then ask Circuit to choose a flow:

```text
/circuit:run the checkout total is wrong when discounts and tax both apply
```

The installed Claude Code plugin is self-contained. You do not need to clone
this repo, run `npm install`, install a `circuit` binary, or create a symlink.
The plugin wrapper launches the bundled runtime that ships with the plugin.

For Codex from this checkout, refresh the local Codex plugin package and check
that the cache matches the repo:

```bash
npm run sync:codex-plugin-cache
npm run check:codex-plugin-cache
```

Then ask Codex to use Circuit:

```text
@Circuit the checkout total is wrong when discounts and tax both apply
```

Codex can choose the best bundled Circuit flow skill from your natural-language
request.

For local development from this checkout:

```bash
git clone https://github.com/petekp/circuit.git
cd circuit
npm install
npm run build
./bin/circuit run --goal '<your task>'
```

Circuit requires Node.js `22.18.0` or newer.

## Commands

Use one front door unless you already know the flow you want:

| Host | You type | Who chooses the flow |
| --- | --- | --- |
| Claude Code | `/circuit:run the checkout total is wrong when discounts and tax both apply` | The host model selects an explicit Circuit flow. |
| Codex | `@Circuit the checkout total is wrong when discounts and tax both apply` | Codex chooses the best bundled Circuit flow skill. |
| CLI | `./bin/circuit run --goal "the checkout total is wrong when discounts and tax both apply"` | Circuit's deterministic CLI router chooses. |

Use a direct command when the flow choice is clear:

| Host | You type | What runs |
| --- | --- | --- |
| Claude Code | `/circuit:fix checkout total is wrong` | Fix. |
| Claude Code | `/circuit:review current diff` | Review. |
| Claude Code | `/circuit:build add billing settings` | Build. |
| Claude Code | `/circuit:explore compare auth providers` | Explore. |
| Codex | Invoke `fix`, `review`, `build`, or `explore` as a specific Circuit skill. | Runs that flow through the Codex plugin wrapper. |
| CLI | `./bin/circuit run fix --goal "checkout total is wrong"` | Fix. |
| CLI | `./bin/circuit run pursue --goal "coordinate these cleanup goals"` | Pursue. |

The host commands wrap the same CLI. Each run accepts `--goal`. Direct CLI runs
can also pass these controls when the selected flow supports them:

| Control | CLI flag | Supported by |
| --- | --- | --- |
| Lite, standard, or deep depth | `--rigor <lite|standard|deep>` | Build, Explore, and Fix. Review and Pursue only support standard depth. |
| Tournament | `--tournament --tournament-n <2|3|4>` | Explore. |
| Autonomous checkpoint handling | `--autonomous` | Build, Explore, Fix, and Pursue. |

Unsupported combinations fail before the run starts.

**Advanced compatibility:**

The deterministic CLI router still understands old intent prefixes such as
`fix:`, `review:`, `develop:`, and `decide:`. Keep them for scripts and older
habits, not for the normal user path.

Review collects untracked file paths and sizes by default, but not untracked
file contents. If you explicitly want Review to send untracked file contents to
the configured worker, add `--include-untracked-content` after you confirm
those files are safe to relay.

## How A Run Works

1. Circuit selects a flow. In host plugins, the host model may select the flow
   before calling Circuit. In CLI router mode, Circuit's deterministic router
   selects it.
2. Circuit loads the compiled flow from the catalog and checks the requested
   depth, tournament, and autonomous controls against that flow's allow-list.
3. Circuit runs stages in order. Examples include Frame, Analyze, Plan, Act,
   Verify, Review, and Close. Each flow chooses the stages it needs.
4. Circuit writes a trace, typed reports, evidence, and checkpoint state into a
   run folder under `.circuit/runs/`.
5. If a checkpoint needs your choice, Circuit pauses. Resume it with:

   ```bash
   ./bin/circuit resume \
     --run-folder '<run_folder>' \
     --checkpoint-choice '<choice>'
   ```

Build, Fix, and Pursue disclose the write-capable worker path before they
invoke an implementer:

> This flow may invoke a write-capable Claude Code worker. Circuit will verify
> and review the result, but the worker can edit files in this checkout.

## Configuration

Circuit reads two config files:

1. `~/.config/circuit/config.yaml` for your personal defaults across projects.
2. `./.circuit/config.yaml` at the repo root for project-specific overrides.

Both files use the same schema. For selection fields such as model, effort, and
skills, Circuit composes layers in this order:

```text
defaults < user-global < project < invocation
```

Config can set models, reasoning effort, local skills, connector routing, and
per-flow overrides under `circuits.<flow_id>`. Connector routing has its own
precedence, described below.

Circuit reads config at run time, so editing config does not require a plugin
rebuild.

## Local Skills

Circuit can load your own `SKILL.md` files into relay prompts. It scans these
host-native roots in order:

1. `~/.agents/skills/<skill-id>/SKILL.md`
2. `~/.claude/skills/<skill-id>/SKILL.md`

`~/.agents/skills` wins when both roots contain the same skill id. Built-in
flows do not require local skills. A built-in flow may expose an optional skill
slot, and you can bind that slot to one of your skills in config.

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
optional flow slots to concrete local skills. Circuit ignores missing unbound
slots. When Circuit loads a skill, the trace records the skill id, optional
slot, path, SHA-256, and byte count.

## Codex Host And Codex Worker

Codex can use Circuit in two separate ways:

- **host/orchestrator behavior:** in Codex, ask `@Circuit` to handle a task.
  Codex chooses the best bundled Circuit flow skill and invokes the local
  Circuit engine.
- **worker connector behavior:** Circuit can relay read-only worker steps
  through the Codex CLI from any host.

The Codex worker connector is optional:

```bash
npm install -g @openai/codex
```

When a step uses Codex as its connector, Circuit launches `codex exec` with
read-only sandbox flags. The Codex subprocess inherits the Circuit process
environment and current working directory, so configure it only where those
process settings are appropriate for the worker.

## Connector Routing

Flow schematics do not hard-code a connector. Config chooses the connector for
each relay step in this order:

1. `relay.roles.<role>` mapping for the step role.
2. `relay.circuits.<flow_id>` mapping for the active flow.
3. `relay.default`.
4. Auto-detect, which currently selects `claude-code`.

Built-in connectors:

- **`claude-code`**: Claude Code CLI subprocess. Use it for trusted
  same-workspace writes.
- **`codex`**: Codex CLI subprocess with read-only sandbox flags. Circuit will
  not route implementer steps to this connector.

`codex-isolated` is not a current config value. Use `codex` for read-only Codex
relays or `claude-code` for trusted same-workspace writes.

Custom connectors are wrapper executables. Define them under
`relay.connectors.<name>.command` as a YAML argv array. Circuit appends
`PROMPT_FILE OUTPUT_FILE` as the final two arguments. The wrapper reads the
prompt file and writes one JSON response object to the output file.

Treat custom connectors as trusted local processes, not an OS sandbox. For
custom connectors, stdin is ignored, stdout is debug output, and stderr appears
in failure messages. Each custom connector inherits the Circuit process environment
and current working directory. `capabilities.filesystem: read-only` tells
Circuit to route the connector only to read-only worker roles; it does not stop
the wrapper process from writing files on its own. See
[`docs/contracts/connector.md`](docs/contracts/connector.md) for the full
contract.

## Generated Files

Do not hand-edit generated host output.

| Surface | Source of truth | Regenerate or check |
| --- | --- | --- |
| Flow definitions | `src/flows/<id>/data.ts` and `src/flows/<id>/flow.ts` | `npm run emit-flows` |
| Flow-owned commands | `src/flows/<id>/command.md` | `npm run emit-flows` |
| Direct commands | `src/commands/<id>.md` | `npm run emit-flows` |
| Generated schematics, compiled flow files, plugin command mirrors, Codex skill surfaces, and Claude plugin flow mirrors | Generated from the sources above | `npm run check-flow-drift` |
| Plugin runtime bundle | TypeScript build output | `npm run build-plugin-runtime` or `npm run check-plugin-runtime` |

`docs/generated-surfaces.md` is the full source map.

## Verification

Use focused checks while you work and the release checks before public claims:

| Command | What it checks |
| --- | --- |
| `npm run check` | TypeScript with `tsc --noEmit`. |
| `npm run lint` | Biome. |
| `npm run test` | Full Vitest suite. |
| `npm run test:fast` | Vitest without the slow CLI router outlier. |
| `npm run build` | Production TypeScript build. |
| `npm run verify:fast` | Check, lint, build, fast tests, eval checks, flow drift, and plugin runtime drift. |
| `npm run verify` | The full canonical check that CI enforces. |
| `npm run check-release-ready` | Strict release readiness check. |
| `npm run publish:plugins:check` | Plugin packaging and version alignment check. |

The checked-in release proof set lives at
[`docs/release/proofs/index.yaml`](docs/release/proofs/index.yaml). It covers
doing work, deciding, continuity, customization, failure, first run, and plan
execution for this alpha.

Run `npm run capture-proofs:golden-runs` only when a release diff changes
runtime control flow, flow behavior, command semantics, progress, summaries,
reports, checkpoints, or proof scenarios.

## Troubleshooting

**The plugin doctor fails.** Fix doctor output first. A healthy plugin install
reports `"runtime_source": "bundled"`.

**Flow source changes do not appear in commands or plugin files.** Regenerate
generated surfaces:

```bash
npm run emit-flows
npm run check-flow-drift
```

**A plugin run uses the wrong local CLI.** The plugin ignores ambient `PATH`
binaries by default. Use `CIRCUIT_CLI=/absolute/path/to/bin/circuit` for an
explicit development override, or set `CIRCUIT_DEV=1` to allow repo-local and
`PATH` fallbacks during development only.

**Node is too old.** Upgrade to Node.js `22.18.0` or newer.

**Codex is missing.** The Codex worker connector is optional. The `claude-code`
connector works without Codex. Install Codex only if you want a separate
read-only Codex worker process per relay.

**A run is waiting at a checkpoint.** Resume it with the run folder and one of
the allowed checkpoint choices:

```bash
./bin/circuit resume \
  --run-folder '<run_folder>' \
  --checkpoint-choice '<choice>'
```

If a run cannot recover, delete its run folder under `.circuit/runs/` and start
the task again.

## Further Reading

- **[`AGENTS.md`](AGENTS.md):** Agent instructions for this repo.
- **[`UBIQUITOUS_LANGUAGE.md`](UBIQUITOUS_LANGUAGE.md):** Canonical Circuit
  vocabulary.
- **[`docs/README.md`](docs/README.md):** Map of current docs, generated
  evidence, research notes, and archived records.
- **[`docs/architecture/runtime.md`](docs/architecture/runtime.md):** Runtime
  architecture and run-folder ownership.
- **[`docs/contracts/`](docs/contracts/):** Contracts for config, connector,
  run, step, flow, selection, continuity, skill, and stage behavior.
- **[`docs/flows/`](docs/flows/):** Flow design notes and the block catalog.

## License

TBD
