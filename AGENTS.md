# Agent Guide — circuit

## What this project is

`circuit` is a Claude Code plugin that runs configurable developer
flows. The product surface is `src/` (TypeScript), `tests/`, the
generated host plugin packages under `plugins/`, the flow packages
under `src/flows/`, the engine contracts under `docs/contracts/`,
and the flow design notes under `docs/flows/`.

This file is the agent-facing operating doc. Keep it short. If something
isn't here, it isn't a rule.

See [`UBIQUITOUS_LANGUAGE.md`](UBIQUITOUS_LANGUAGE.md) for the canonical product
vocabulary (flow, schematic, block, route, relay, check, trace, report,
evidence). Use that vocabulary in product-facing prose.

## Rules that earned their place

1. **Read before Write.** Always read existing files before overwriting
   them.
2. **Tests for behavior we care about.** When fixing a bug, write a
   failing test first. When changing behavior, the test changes with it.
3. **Plain English with the operator.** Short sentences, one idea each.
   No project-internal jargon — no codename ids, no review-result-class
   language. If a name matters, describe what it is.
4. **Task list for multi-step work.** Three or more steps → use the
   task tools.
5. **Root-cause discipline.** Enumerate two or three hypotheses before
   acting on one.
6. **Codex for impactful, hard-to-revert decisions.** Default off. Pull
   Codex in when a choice is hard to re-work later (architecture,
   contracts, migration paths), I'm stuck after a couple of real
   attempts, or you ask. Use `/codex` explicitly so the handoff is
   visible. Don't use Codex for cleanup, mechanical refactors, or
   anything `npm run verify` proves. No challenger passes on plans.
7. **Host hooks use hook input for identity.** Hook scripts must read the
   host's stdin JSON for workspace identity and pass explicit project roots.
   Do not treat `process.cwd()` as the project authority inside hooks.
8. **File-set audits need probes.** Before a rename, conversion, or migration
   batch, state the partition criterion and run the grep or script that proves
   it. If the plan depends on a runtime contract, run a small probe before
   locking the plan.

## Verification

```bash
npm run check        # tsc --noEmit
npm run lint         # biome check
npm run test         # vitest (full suite)
npm run test:fast    # vitest excluding tests/runner/cli-router.test.ts (only true outlier; ~10s of subprocess-driven CLI integration)
npm run test:coverage # vitest run --coverage (info, no thresholds)
npm run build        # tsc -p tsconfig.build.json
npm run verify       # full canonical check; CI runs this
npm run verify:fast  # check + lint + build + test:fast + drift (~40% faster)
```

`verify` is the canonical check and what CI enforces. Use `verify:fast`
during iterative loops; run full `verify` before claiming a change is
done. Both must pass before commit on changes to `src/`, `tests/`, or
generated host packages.

Choose focused proof before the final check: flow authoring changes need the
`tests/runner/flow-facts.test.ts` and catalog completeness tests plus
`check-flow-drift`; runtime path changes need runtime-context and runtime
tests; generated host package changes need `check-flow-drift`; release-surface
changes need `check-release-infra`.

## Where things live

| File or output | Path |
|---|---|
| Claude Code plugin package | `plugins/claude/` |
| Claude Code plugin manifest | `plugins/claude/.claude-plugin/plugin.json` |
| Claude Code slash commands (generated) | `plugins/claude/commands/<id>.md` |
| Claude Code compiled flow output (generated) | `plugins/claude/skills/<id>/circuit.json` for public flows |
| Codex plugin package | `plugins/circuit/` |
| Direct command sources | `src/commands/<id>.md` |
| Flow-owned command sources | `src/flows/<id>/command.md` |
| Generated surface source map | `docs/generated-surfaces.md` |
| CLI entrypoint | `bin/circuit` |
| Engine source | `src/runtime/`, `src/cli/`, `src/schemas/` |
| Flow packages | `src/flows/<id>/` (FlowData, schematic, output schemas, command, contract, writers, relay hints) |
| Flow catalog | `src/flows/catalog.ts` (single source of truth the engine derives from) |
| Tests | `tests/` |
| Documentation map | `docs/README.md` |
| Engine contracts | `docs/contracts/` |
| Flow design notes | `docs/flows/` |
| Release proof runs | `docs/release/proofs/runs/` |
| Ubiquitous language | `UBIQUITOUS_LANGUAGE.md` |
| Block catalog | `docs/flows/block-catalog.json` |

Internal file names such as `relay-hints.ts` are intentional runtime names.
Do not rename them while adding a flow unless there is an explicit
terminology migration in progress.

## Adding a flow

1. Create `src/flows/<id>/` with `data.ts` (the canonical `FlowData` value),
   `flow.ts` (the thin `defineFlowData` adapter), `reports.ts` (the flow's Zod
   report schemas), optional `command.md` and `contract.md`, optional
   `relay-hints.ts` if any relay steps have shape hints, and `writers/` for
   custom semantic writers.
2. Export a tiny `index.ts` compatibility projection if callers need the
   `<id>CompiledFlowPackage` name.
3. Add the definition to `flowDefinitions` in `src/flows/catalog.ts`.
3. `npm run build && node scripts/emit-flows.ts` to regenerate
   `schematic.json`, command mirrors, and public host flow output.
4. `npm run verify`.

The engine (`src/runtime/`) does not need any edits — registries derive
from the catalog. If you find yourself editing engine files to add a
flow, the boundary is being violated.

`CompiledFlowPackage.engineFlags` carries opt-in switches the engine
branches on (currently only `bindsExecutionDepthToRelaySelection`,
which Build sets). Add a flag entry there if your flow needs special
engine behavior — never put flow-specific code into the engine itself.
