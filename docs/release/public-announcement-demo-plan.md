# Public Announcement Demo Plan

Status: decision draft, source-backed.

## Decision

Build a new, narrow public routable demo flow for the announcement rather than
stretching the current Build or Explore flows.

The reason is simple: Build already proves the final production path, with
implementation, verification, review, and close evidence. But Build does not
support tournament mode today. Explore already proves tournament comparison and
operator choice. But Explore intentionally stops at a decision and does not run
Act, Verify, or Review. A single announcement command needs both shapes in one
run.

Recommended flow name for implementation planning: `demo-build`.

Do not add a dedicated `/circuit:demo-build` host command in the core slice.
Use the existing `run` command surface plus the explicit CLI flow name. This
keeps the public surface smaller while still making the demo one Circuit
command.

Recommended public command shape:

```bash
./bin/circuit run demo-build \
  --goal "Build a small launch-card app, compare three app variants, let me choose one, run tests, and capture deployment proof." \
  --tournament \
  --tournament-n 3 \
  --run-folder docs/release/proofs/runs/demo-build/run \
  --progress jsonl
```

Use host commands for the recorded demo only after the deterministic CLI proof
passes. The host form should be `/circuit:run ...`, not a new dedicated slash
command. The alpha is plugin-only, and the root package is private
(`README.md:94-122`, `docs/release/0.1.0-alpha.6-notes.md:5-18`).

## Demo Requirements

The demo should make one Circuit command visibly compelling:

1. The operator starts one command, not a hand-run sequence of Explore then
   Build.
2. Circuit creates two or three app variants through model-specific relays.
3. Circuit writes a checkpoint HTML report that compares those variants.
4. The operator chooses a variant at the checkpoint.
5. Circuit produces the final app in the target project after that choice.
6. Circuit runs tests or build checks and records command evidence.
7. Circuit captures deployment proof without inventing a deployment claim.
8. Circuit closes with a report that links the chosen variant, test evidence,
   deployment evidence, and final app path.

The demo must not claim:

- Native Codex App Server or Claude Agent SDK support. The current public docs
  say those do not ship in this alpha (`README.md:111-122`,
  `docs/release/0.1.0-alpha.6-notes.md:59-75`).
- A global `circuit` launcher. The release notes record that no global launcher
  was found in the relevant shell (`docs/release/0.1.0-alpha.6-notes.md:43-57`).
- Model quality, provider availability, or deployment success unless a run
  report contains that exact evidence.

## Current Capability Audit

### Product Surface

- Current public flows are Build, Explore, Fix, Pursue, and Review
  (`README.md:100-109`, `generated/release/current-capabilities.json:564-603`).
- Claude Code and Codex public surfaces exist, but the host support is still
  partial and model-mediated
  (`generated/release/current-capabilities.json:275-335`).
- Generated host files are outputs. Flow authors edit `src/flows/<id>/data.ts`,
  command sources, and related source files, then regenerate
  (`docs/generated-surfaces.md:7-18`, `docs/generated-surfaces.md:25-38`).

Decision: the demo flow should be source-authored under `src/flows/demo-build/`
and then emitted into generated flow mirrors. Do not hand-edit generated host
files. Add a dedicated command source only if the product decision changes
after the core proof passes.

### Build Flow

What exists:

- Build is public and frames a requested change, plans it, relays
  implementation, runs verification, relays review, and closes with evidence
  (`src/flows/build/data.ts:41-63`).
- Build supports lite, standard, deep, and autonomous mode, but not tournament
  (`src/flows/build/data.ts:100-110`).
- Build's stage path is Frame, Plan, Act, Verify, Review, Close
  (`src/flows/build/data.ts:111-148`, `src/flows/build/data.ts:319-327`).
- Build has a checkpoint before implementation
  (`src/flows/build/data.ts:149-191`), an implementation relay
  (`src/flows/build/data.ts:218-243`), verification
  (`src/flows/build/data.ts:244-263`), review
  (`src/flows/build/data.ts:264-292`), and a close report
  (`src/flows/build/data.ts:293-316`).
- A runtime test runs Build through checkpoint, implementation relay,
  verification, review relay, and close
  (`tests/runner/build-runtime-wiring.test.ts:133-175`).

Gap for this demo:

- Build cannot compare multiple model-generated app variants in a tournament.

### Explore Flow

What exists:

- Explore supports tournament and autonomous mode
  (`src/flows/explore/data.ts:112-123`).
- Explore intentionally omits Act, Verify, and Review because it is a decision
  flow, not an executable production flow (`src/flows/explore/data.ts:124-129`).
- Explore tournament mode fans out option cases, bounds concurrency, aggregates
  survivors, reviews proposals, asks for a tradeoff checkpoint, and closes a
  decision (`src/flows/explore/data.ts:293-465`).
- Runtime tests prove option fanout, bounded checkpoint choices, resume to final
  decision, and tournament branch evidence
  (`tests/runner/explore-tournament-runtime.test.ts:208-304`).
- Runtime tests also prove `tournament_n` drives option count, fanout branch
  count, aggregate count, and checkpoint choices
  (`tests/runner/explore-tournament-runtime.test.ts:306-358`).

Gap for this demo:

- Explore closes with a decision. It does not produce the final app, run app
  tests, or capture deployment proof.

### HTML Renderer And Operator Feedback

What exists:

- The HTML registry currently includes Build and Explore projectors only
  (`src/shared/html/index.ts:1-16`).
- Build's HTML projector renders a waiting checkpoint when a typed Build brief
  includes a checkpoint packet, filters allowed choices, shows recommendation,
  risk, proof, evidence, and a resume command
  (`src/shared/html/build-checkpoint.ts:160-234`).
- Explore's HTML projector renders only after a tournament decision is finalized
  and required evidence reports parse successfully
  (`src/shared/html/explore-tournament.ts:183-258`).
- The operator summary writer writes HTML first, links it from JSON and
  Markdown only if it exists, and removes stale HTML if the projector returns
  nothing (`src/shared/operator-summary-writer.ts:287-353`).
- Tests prove Explore tournament HTML escapes operator-controlled content and
  marks selected and recommended options
  (`tests/unit/shared/html/explore-tournament.test.ts:115-175`,
  `tests/runner/operator-summary-writer.test.ts:959-1090`).
- Tests prove Build checkpoint HTML is written and linked from JSON and
  Markdown (`tests/runner/operator-summary-writer.test.ts:1092-1144`).

Gap for this demo:

- There is no projector for a demo-build variant-selection checkpoint. Reusing
  Explore HTML would be misleading because Explore HTML is final-decision HTML,
  not waiting-checkpoint HTML.

### Fanout, Branches, And Model-Specific Variants

What exists:

- Fanout can expand relay or sub-run branches and aggregate outcomes
  (`src/runtime/executors/fanout.ts:110-180`).
- Relay fanout branches can carry a branch-specific selection record into the
  synthetic relay step (`src/runtime/fanout/branch-execution.ts:83-147`).
- Relay traces can record connector and resolved selection evidence
  (`src/runtime/domain/trace.ts:71-74`,
  `src/shared/relay-runtime-types.ts:15-17`).
- Accepted relay branches are schema-checked, provenance-checked, and
  cross-report-checked (`src/runtime/fanout/branch-execution.ts:149-185`).
- Sub-run fanout can run child flows in per-branch worktrees
  (`src/runtime/fanout/branch-execution.ts:424-465`).
- Worktrees are cleaned up after fanout, and the aggregate report is written
  from branch outcomes (`src/runtime/executors/fanout.ts:188-235`).
- Join policies include `pick-winner`, `disjoint-merge`, `aggregate-survivors`,
  and `aggregate-only` (`src/shared/fanout-join-policy.ts:39-126`).

Gap for this demo:

- The current runtime does not preserve full branch worktrees as user-visible
  app previews after fanout. The smallest defensible slice should compare typed
  variant reports first, then build the chosen app once in the parent project.
  A later, larger slice can preserve branch preview apps and apply the selected
  branch.

### Connectors And Provider-Scoped Models

What exists:

- Selection supports provider-scoped models with provider values `openai`,
  `anthropic`, `gemini`, and `custom`; built-in connectors currently honor
  Anthropic models for `claude-code` and OpenAI models for `codex`
  (`docs/contracts/selection.md:126-143`).
- `claude-code` is a trusted-write subprocess connector. It can receive
  `--model` and `--effort` after provider validation
  (`docs/contracts/connector.md:72-90`, `src/connectors/claude-code.ts:110-141`).
- `codex` is a read-only subprocess connector. It can receive `-m` and the
  allowed reasoning-effort config after provider validation, while preserving
  the read-only sandbox boundary (`docs/contracts/connector.md:90-141`,
  `src/connectors/codex.ts:251-335`).
- Custom connectors are represented in release capability truth as implemented
  JSON prompt-file wrappers
  (`generated/release/current-capabilities.json:281-309`,
  `generated/release/current-capabilities.json:483-502`).

Demo implication:

- Multi-model variants are feasible at the relay-selection layer, but public
  copy should say "provider-scoped model relays" or "model-specific variants"
  only when the run report records the provider and model used. Do not claim a
  provider produced a variant unless the trace and relay reports prove it.

### Release And Packaging

What exists:

- The alpha release checks are `npm run check-flow-drift`,
  `npm run check-release-ready`, and `npm run publish:plugins:check`
  (`docs/release/0.1.0-alpha.6-notes.md:25-41`).
- The release checklist says final publication must rerun
  `check-release-ready`, rerun `publish:plugins:check`, inspect generated
  source owners, review public copy against deferred items, and inspect the
  fresh plugin publish report (`docs/release/initial-public-release-list.md:90-101`).
- Package scripts include the required verification, drift, release, host smoke,
  cache sync, and plugin publish commands (`package.json:13-48`).
- Existing golden proof records already include Explore tournament HTML and
  branch evidence (`docs/release/proofs/index.yaml:145-188`).

Gap for this demo:

- A demo-build proof run does not exist yet. The announcement should not ship
  until the proof run is captured, indexed, and checked.

## Local Checks From This Planning Pass

These checks were run from `/Users/petepetrash/Code/circuit`.

| Check | Result | Use in the decision |
| --- | --- | --- |
| `npm run verify` | Passed. Full check, lint, build, 1,800 tests, eval checks, flow drift, plugin runtime, and release infra passed. | Current repo is healthy enough to plan on top of. |
| Focused HTML/runtime tests for Build and Explore tournament | Passed. 5 files, 70 tests. | Existing Build/Explore/HTML evidence is real. |
| `npm run check-release-ready` | Passed. Fix Lite exception remains tracked. | Release truth is internally coherent. |
| `npm run check-flow-drift` | Passed. Generated surfaces and plugin runtimes are in sync. | New flow work must preserve this. |
| `./bin/circuit --help` | Passed. CLI exposes `run`, `resume`, `--tournament`, `--tournament-n`, `--autonomous`, `--run-folder`, and `--progress jsonl`. | The deterministic demo should start with the local CLI. |
| `node -v` / `npm -v` | `v24.15.0` / `11.12.1`. | Satisfies the repo's Node requirement. |
| `claude --version` | `2.1.145 (Claude Code)`. | CLI exists; no live model generation was run. |
| `codex --version` | `codex-cli 0.130.0`. | CLI exists; no live model generation was run. |
| `vercel --version` / `vercel whoami` | CLI `48.12.1`; authentication check exited 0. | Deployment proof is plausible, but still must be captured by the demo run. |
| `command -v circuit` | Not found. | Demo command should use `./bin/circuit` or host plugin commands, not a global launcher. |
| `claude plugin list` | `circuit@circuit` version `0.1.0-alpha.6` is enabled at user scope. | Claude plugin is installed locally; still not a live demo proof. |
| `npm run check:codex-plugin-cache` | Passed. 26 owned source files and 26 owned target files, with no missing, stale, or extra owned files. | Local Codex plugin cache is currently aligned. |

## Gap List

Must fix for the announcement demo:

1. **No single current flow covers the whole story.** Build can produce and
   verify work; Explore can compare options. Neither alone gives variant
   comparison, operator choice, final app production, tests, and deployment
   proof in one run.
2. **No demo-build report schemas exist.** The demo needs typed reports for
   variant options, variant branch output, variant review, operator selection,
   final implementation, verification, deployment proof, review, and result.
3. **No demo-build HTML projector exists.** The checkpoint comparison needs a
   waiting-checkpoint renderer that shows variant cards and the resume command.
4. **No deployment proof report exists.** The demo needs a bounded report that
   records provider, command, exit code, URL if present, and claim status such
   as `deployed`, `preflight-only`, or `failed`.
5. **Branch-built app previews are not a small slice.** The runtime cleans up
   sub-run worktrees after fanout, so real branch preview preservation and
   selected-branch apply would require additional runtime design.
6. **Host/provider claims need run evidence.** CLI presence is not the same as
   successful model or deployment execution. The final demo run must record the
   providers, models, commands, versions, and deployment result.

Can defer:

- Persisting live preview apps for every branch.
- Applying a selected worktree branch automatically.
- Native host support.
- A global npm package release.
- Cross-run project-memory claims.

## Smallest Shippable Core Slice

Ship `demo-build` as a thin flow built from existing runtime capabilities:

1. Frame the app goal and constraints.
2. Create `demo.variant-options@v1` with two or three variant slots.
3. Fan out model-specific relay branches that produce typed
   `demo.variant@v1` reports. Each branch records its provider-scoped model,
   summary, proposed app shape, expected files, test plan, deployment plan, and
   evidence limits.
4. Review the variants into `demo.variant-review@v1`.
5. Pause at a `demo.variant-selection@v1` checkpoint.
6. Render `reports/operator-summary.html` with comparable variant cards,
   recommendation, risks, proof plan, and resume command.
7. Resume from operator choice.
8. Run one implementation relay in the parent project to produce the selected
   app.
9. Run verification commands.
10. Run a deployment proof step that records what happened, without upgrading a
    preflight into a deployment claim.
11. Run a reviewer relay.
12. Close with `demo.result@v1`.

This slice is honest: variants are model-specific implementation proposals
until the selected app is produced in the parent project. If the public demo
requires live preview apps for every variant, that is a larger release item and
should be planned separately.

## Implementation Plan

### Slice 1: Flow Skeleton And Schemas

Files:

- `src/flows/demo-build/data.ts`
- `src/flows/demo-build/flow.ts`
- `src/flows/demo-build/reports.ts`
- `src/flows/demo-build/contract.md`
- `src/flows/demo-build/index.ts` only if current imports need a package surface
- `src/flows/catalog.ts`

Acceptance:

- `demo-build` is public and routable.
- The first slice uses the existing `run` command surface, not a dedicated
  `/circuit:demo-build` command.
- The Schematic uses canonical stages: Frame, Plan, Act, Verify, Review, Close.
- The flow supports tournament mode and `tournament_n` 2 to 3 for the demo.
- Report schemas parse for all new report types.

Proof:

```bash
npm run build
npm run test -- tests/contracts/catalog-completeness.test.ts tests/runner/flow-definition-compiler.test.ts
```

### Slice 2: Variant Fanout And Checkpoint

Files:

- `src/flows/demo-build/data.ts`
- `tests/runner/demo-build-runtime.test.ts`

Acceptance:

- The variant fanout emits two or three branch reports.
- Branch reports link to runtime trace evidence for provider-scoped model
  selection. Do not trust the relayed model to self-report this fact without
  trace backing.
- The review step recommends a variant or asks for operator judgment.
- The checkpoint exposes only choices the runtime can honor.
- Resume with a selected variant continues to final implementation.

Proof:

```bash
npm run test -- tests/runner/demo-build-runtime.test.ts
```

### Slice 3: HTML Comparison Renderer

Files:

- `src/shared/html/demo-build-checkpoint.ts`
- `src/shared/html/index.ts`
- `tests/unit/shared/html/demo-build-checkpoint.test.ts`
- `tests/runner/operator-summary-writer.test.ts`

Acceptance:

- HTML emits only for `demo-build` while the variant-selection checkpoint is
  waiting.
- The page shows all valid variant cards, the recommended choice, provider and
  model evidence if present, risk notes, proof plan, and resume command.
- HTML escapes operator-controlled fields and strips deceptive bidi controls.
- Markdown and JSON link to HTML only when it exists.

Proof:

```bash
npm run test -- tests/unit/shared/html/demo-build-checkpoint.test.ts tests/runner/operator-summary-writer.test.ts
```

### Slice 4: Final App, Verification, Deployment Proof, Review

Files:

- `src/flows/demo-build/data.ts`
- `src/flows/demo-build/reports.ts`
- `src/flows/demo-build/relay-hints.ts`
- `tests/runner/demo-build-runtime.test.ts`

Acceptance:

- The selected variant report is the input to the final implementation relay.
- Verification records command evidence before close.
- Deployment proof records command, provider, exit code, detected URL if any,
  and claim status.
- The deployment proof step is implemented as an explicit demo-build writer or
  verification step with a typed report; it is not inferred from terminal text
  in the final summary.
- Review can accept, retry Act, or stop before close.
- Close report links the chosen variant, final app evidence, verification,
  deployment proof, review, and run folder paths.

Proof:

```bash
npm run test -- tests/runner/demo-build-runtime.test.ts tests/contracts/flow-schematic.test.ts
```

### Slice 5: Generated Surfaces And Release Proof

Files:

- `generated/flows/demo-build/circuit.json`
- `generated/flows/demo-build/tournament.json`
- `plugins/claude/skills/demo-build/circuit.json`
- `plugins/claude/skills/demo-build/tournament.json`
- `plugins/codex/flows/demo-build/circuit.json`
- `plugins/codex/flows/demo-build/tournament.json`
- `docs/generated-surfaces.md`
- `docs/release/proofs/index.yaml`
- `docs/release/proofs/runs/demo-build/**`
- `generated/release/current-capabilities.json`

Acceptance:

- Generated surfaces are emitted from source.
- The proof index names the demo-build proof and required reports.
- Public claim files do not make provider or deployment claims beyond captured
  evidence.

Proof:

```bash
npm run build && npm run emit-flows
npm run check-flow-drift
npm run verify
npm run check-release-ready
npm run publish:plugins:check
```

## Rough Demo Script

### Setup

Use a clean demo app repo or temp repo. Avoid the Circuit repo's current dirty
working tree for the recorded app demo.

Preflight:

```bash
node -v
npm -v
claude --version
codex --version
vercel --version
vercel whoami
./bin/circuit --help
```

Do not run live model generation or deployment in prep copy unless that output
will be captured as demo evidence.

### Run

1. Start the command:

   ```bash
   ./bin/circuit run demo-build \
     --goal "Build a small launch-card app for Circuit's announcement. Compare three variants, let me choose one, run tests, and capture deployment proof." \
     --tournament \
     --tournament-n 3 \
     --run-folder docs/release/proofs/runs/demo-build/run \
     --progress jsonl
   ```

2. Show the progress stream enough to prove Circuit is running one flow and
   writing a run folder.
3. When Circuit pauses, open:

   ```bash
   docs/release/proofs/runs/demo-build/run/reports/operator-summary.html
   ```

4. Narrate what the operator sees:

   - Three app variants.
   - Provider/model evidence for each variant if captured.
   - Recommendation and risks.
   - Test and deployment plan.
   - Resume command.

5. Resume with the selected choice:

   ```bash
   ./bin/circuit resume \
     --run-folder docs/release/proofs/runs/demo-build/run \
     --checkpoint-choice option-2 \
     --progress jsonl
   ```

6. Show final app files or local preview.
7. Show verification report.
8. Show deployment proof report. Say "deployed" only if the report has a
   successful deployment URL and the recorded command output supports it.
9. Show final result report and evidence links.

### Closing Line

"Circuit did not just give a suggestion. It ran a flow: compared variants,
asked for the operator's choice, built the selected app, checked it, captured
deployment evidence, and left the run folder behind."

## Release Packaging Path

1. Implement the `demo-build` source flow and tests.
2. Regenerate generated surfaces with `npm run build && npm run emit-flows`.
3. Run focused tests for the new flow and HTML projector.
4. Run `npm run verify`.
5. Capture a deterministic proof run under
   `docs/release/proofs/runs/demo-build/`.
6. Add the proof to `docs/release/proofs/index.yaml`.
7. Update release truth if the new flow changes public capability files.
8. Run `npm run check-flow-drift`.
9. Run `npm run check-release-ready`.
10. Run `npm run publish:plugins:check`.
11. Inspect `.circuit/release/plugin-publish-report.json` for status,
    version alignment, warnings, and errors.
12. If using local Codex dogfooding, run `npm run sync:codex-plugin-cache` and
    `npm run check:codex-plugin-cache`.
13. Record host trial notes only after the actual host command has been run.

## Open Checks Before Public Copy

- Which exact provider/model rows will the recorded demo use?
- Will the demo use real Vercel deployment or a preflight-only deployment proof?
- What clean target app repo will be used?
- Will the announcement show CLI first and host plugin second, or host plugin
  only after CLI proof?
- Confirm the product choice: public routable `demo-build`, no dedicated
  `/circuit:demo-build` command in the core slice.

Recommended answer today:

- Use CLI for the deterministic proof.
- Use Claude Code host footage only after `publish:plugins:check` and host
  trial both pass.
- Use real Vercel deployment only if `vercel whoami`, project linking, and the
  deployment command succeed during the captured run.
- Ship `demo-build` as a public routable flow with no dedicated host command in
  the core slice. If the product team wants a visible command later, add it as a
  follow-up after the proof run exists.
