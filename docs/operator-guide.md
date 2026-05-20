# Operator Guide

Commands, run details, verification, and troubleshooting for Circuit.

## Front Doors

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

## Flow Guide

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

## How A Run Works

For vocabulary, read `flow` as the kind of work, `stage` as a grouped part of
that work, `trace` as the ordered record, `report` as typed output, and
`evidence` as supporting facts or files. The full vocabulary lives in
[`UBIQUITOUS_LANGUAGE.md`](../UBIQUITOUS_LANGUAGE.md).

1. Circuit selects a flow. In host plugins, the host model may select the flow
   before calling Circuit. In CLI router mode, Circuit's deterministic router
   selects it.
2. Circuit loads the compiled flow from the catalog and checks the requested
   depth, tournament, and autonomous controls against that flow's allow-list.
3. Circuit runs stages in order. Examples include Frame, Analyze, Plan, Act,
   Verify, Review, and Close. Each flow chooses the stages it needs.
4. Relay steps may declare deterministic acceptance criteria. Circuit checks
   those criteria after the worker returns and after the relay result has
   passed its normal schema and verdict check. Failed criteria either stop the
   run or retry the same relay step with feedback, depending on the flow.
5. Circuit writes a trace, typed reports, evidence, and checkpoint state into a
   run folder under `.circuit/runs/`.
6. If a checkpoint needs your choice, Circuit pauses. Resume it with:

   ```bash
   ./bin/circuit resume \
     --run-folder '<run_folder>' \
     --checkpoint-choice '<choice>'
   ```

Build, Fix, and Pursue disclose the write-capable worker path before they
invoke an implementer:

> This flow may invoke a write-capable Claude Code worker. Circuit will verify
> and review the result, but the worker can edit files in this checkout.

## Review Untracked Files

Review collects untracked file paths and sizes by default, but not untracked
file contents. If you explicitly want Review to send untracked file contents to
the configured worker, add `--include-untracked-content` after you confirm
those files are safe to relay.

## Generated Files

Do not hand-edit generated host output.

Use [`docs/generated-surfaces.md`](generated-surfaces.md) as the source map for
what to edit, what is generated, and which drift check applies. For flow,
command, schematic, skill, or plugin output changes, run `npm run emit-flows`
or `npm run check-flow-drift` as that map directs.

## Verification

`npm run verify` is the full canonical check that CI enforces. Use focused
checks while you work, `verify:fast` for a faster broad pass, and release
checks before public claims:

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

**A relay acceptance criterion failed.** The trace records
`check.evaluated` entries with `check_kind: "acceptance_criteria"` for each
criterion Circuit evaluated. If the step declares `retry-with-feedback`, the
next attempt receives the failed criterion and reason in its relay prompt.
Retry count still comes from the step's normal `budgets.max_attempts`.

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
