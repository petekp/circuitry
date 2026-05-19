# 2026-05-18 Terminology Review Table

Status: reviewed on 2026-05-18. This file is the terminology table and evidence
ledger for the approved or low-risk cleanup batches in this sweep.

Archive note: this is a dated audit record. Use `UBIQUITOUS_LANGUAGE.md` as the
current vocabulary source before making prose or schema decisions.

This file intentionally names confusing and deprecated terms as evidence. Exclude
this file from old-term greps unless the goal is to audit the audit.

## Scope And Method

- Canonical vocabulary sources: `UBIQUITOUS_LANGUAGE.md` and `AGENTS.md`.
- Audited surfaces: `docs/`, `src/`, `tests/`, `plugins/`, `generated/`,
  `scripts/`, `bin/`, `AGENTS.md`, and `UBIQUITOUS_LANGUAGE.md`.
- Excluded from counts: `docs/release/proofs/runs/**`, this audit file, and
  generated plugin runtime bundles under `plugins/*/runtime/**`.
- Counts are current-worktree text matches. They are a triage signal, not proof
  that every match has the same meaning.
- Function verbs were extracted from recurring function, method, and const-arrow
  names in `src/`, `tests/`, `scripts/`, and `bin/`.

## Noun And Concept Terminology

| Term | Current count | Current meaning | Proposed decision | Evidence |
| --- | ---: | --- | --- | --- |
| Flow | 5039 | A named kind of work Circuit can run. | Keep as the main product noun. | `AGENTS.md:6`, `UBIQUITOUS_LANGUAGE.md:10` |
| Schematic | 957 | Authored flow definition. | Keep for source-of-truth flow structure. | `AGENTS.md:83`, `src/flows/flow-definition.ts` |
| Block | 834 | Reusable kind of work in a schematic. | Keep for flow composition. | `AGENTS.md:90`, `docs/flows/block-catalog.json` |
| Stage | 1781 | Grouped part of a flow. | Keep for Frame/Analyze/Plan/Act/Verify/Review/Close. | `UBIQUITOUS_LANGUAGE.md:13`, `src/flows/stage-policy.ts` |
| Step | 5225 | One executable use of a block. | Keep for executable units. | `AGENTS.md:101`, `UBIQUITOUS_LANGUAGE.md:14` |
| Route | 1453 | Named outcome path between steps. | Keep for graph outcomes. | `UBIQUITOUS_LANGUAGE.md:15`, `src/flows/compile-schematic-to-flow.ts` |
| Run | 4446 | One execution of a flow. | Keep. Use carefully because it also appears in `npm run`. | `AGENTS.md:5`, `UBIQUITOUS_LANGUAGE.md:16` |
| Checkpoint | 1767 | Pause for operator input or a declared default. | Keep. Strong operator-facing term. | `UBIQUITOUS_LANGUAGE.md:17`, `src/runtime/run/checkpoint-resume.ts` |
| Check | 1882 | Validation that decides whether work may continue. | Keep for validation. Avoid overusing where a plain "command" is clearer. | `UBIQUITOUS_LANGUAGE.md:18`, `AGENTS.md:48` |
| Trace | 866 | Ordered record of what happened during a run. | Keep for runtime history. | `UBIQUITOUS_LANGUAGE.md:19`, `src/runtime/run/run-values.ts` |
| Report | 4714 | Typed output written by a step or close stage. | Keep for typed outputs. | `AGENTS.md:99`, `UBIQUITOUS_LANGUAGE.md:20` |
| Evidence | 1082 | Supporting facts, files, checks, and reports. | Keep for proof material. | `AGENTS.md:16`, `UBIQUITOUS_LANGUAGE.md:21` |
| Run folder | 136 | Directory where run state is stored. | Keep for operator prose. | `UBIQUITOUS_LANGUAGE.md:22`, `src/run-status/runtime-run-folder.ts` |
| Depth | 992 | Requested thoroughness for a run or step. | Keep if the product wants "how much care" as a slider/choice. | `UBIQUITOUS_LANGUAGE.md:23`, `src/cli/circuit.ts` |
| Mode | 1355 | Named flow entry option, often paired with depth. | Keep for entry choices. | `UBIQUITOUS_LANGUAGE.md:24`, `src/runtime/run/compiled-flow-runner.ts` |
| Relay | 2511 | Handoff to another worker or host. | Keep if the product wants a distinct term for delegated work. | `AGENTS.md:92`, `UBIQUITOUS_LANGUAGE.md:53` |
| Connector | 1219 | Backend or host that can run relayed work. | Keep for integrations. | `UBIQUITOUS_LANGUAGE.md:54`, `src/connectors/` |
| Connector reference | not counted | Config or trace value naming a connector. | Keep in low-level contracts. | `UBIQUITOUS_LANGUAGE.md:55` |
| Connector name | not counted | Custom connector identifier. | Keep in low-level contracts. | `UBIQUITOUS_LANGUAGE.md:56` |
| Custom connector descriptor | not counted | Registered local command for a custom connector. | Keep in connector docs. | `UBIQUITOUS_LANGUAGE.md:57` |
| Role | 612 | Worker responsibility for a relay. | Keep if paired with relay. Avoid "executor" in operator prose. | `UBIQUITOUS_LANGUAGE.md:58`, `src/flows/*/data.ts` |
| Relay role | not counted | Serialized role value on a relay step. | Keep as runtime/internal phrase. | `UBIQUITOUS_LANGUAGE.md:59` |
| Relay resolution | not counted | Choosing a connector for a relay step. | Keep in config/runtime docs. | `UBIQUITOUS_LANGUAGE.md:60` |
| Relay transcript | not counted | Request/result/completion records for relayed work. | Keep for troubleshooting. | `UBIQUITOUS_LANGUAGE.md:62` |
| Config layer | 19 | One source of configuration. | Keep for static config sources. | `UBIQUITOUS_LANGUAGE.md:68`, `docs/contracts/config.md:42` |
| Selection layer | 9 | Contributor to model/effort/skill/depth selection. | Keep if selection stays separate from static config. | `UBIQUITOUS_LANGUAGE.md:69`, `docs/contracts/config.md:66` |
| Selection override | 8 | Partial selection record contributed by a layer. | Keep in config contracts. | `UBIQUITOUS_LANGUAGE.md:70`, `docs/contracts/config.md:59` |
| Resolved selection | 11 | Effective model, effort, skills, depth, and invocation options. | Keep in relay/config internals. | `UBIQUITOUS_LANGUAGE.md:71`, `docs/contracts/config.md:67` |
| Selection resolution | 2 | Resolved selection plus provenance. | Keep in contracts. | `UBIQUITOUS_LANGUAGE.md:72`, `docs/contracts/config.md:120` |
| Provider-scoped model | not counted | Model named with its provider. | Keep where provider ambiguity matters. | `UBIQUITOUS_LANGUAGE.md:73` |
| Effort | 217 | Provider-level reasoning allocation. | Keep distinct from Depth. | `UBIQUITOUS_LANGUAGE.md:74`, connector config code |
| Continuity record | 52 | Cross-session handoff record. | Keep if continuity remains a product capability. | `UBIQUITOUS_LANGUAGE.md:80`, `docs/contracts/continuity.md` |
| Continuity index | 11 | Resolver file for active continuity state. | Keep in continuity internals. | `UBIQUITOUS_LANGUAGE.md:81`, `docs/contracts/continuity.md:53` |
| Resume contract | 4 | Declared posture for resuming. | Keep in continuity contracts. | `UBIQUITOUS_LANGUAGE.md:82`, `docs/contracts/continuity.md:32` |
| Run-attached provenance | not counted | Saved run state embedded in a continuity record. | Keep in contracts only. | `UBIQUITOUS_LANGUAGE.md:83` |
| Pending-record pointer | not counted | Index entry naming the continuity record to read next. | Keep in contracts only. | `UBIQUITOUS_LANGUAGE.md:84` |
| Attached-run pointer | not counted | Index entry naming the live attached run. | Keep in contracts only. | `UBIQUITOUS_LANGUAGE.md:85` |
| Dangling reference | not counted | Pointer to missing continuity state. | Keep in troubleshooting. | `UBIQUITOUS_LANGUAGE.md:86` |
| Skill | 1102 | Discoverable capability with trigger metadata. | Keep for host skill surfaces. | `UBIQUITOUS_LANGUAGE.md:92`, `plugins/claude/skills/` |
| Skill slot | 18 | Flow-authored placeholder an operator may bind. | Keep if customization remains slot-based. | `UBIQUITOUS_LANGUAGE.md:93`, `docs/contracts/selection.md:165` |
| Plugin | 992 | Host-installable Circuit package. | Keep. | `AGENTS.md:5`, `plugins/` |
| Catalog compiler | 11 | Build-time tool that regenerates command and skill outputs. | Keep or consider plainer "flow emitter" if we want less compiler language. | `UBIQUITOUS_LANGUAGE.md:95`, `docs/contracts/compiled-flow.md:108` |
| Generated surface | 40 | Committed output regenerated from source files. | Keep. Clear ownership term. | `AGENTS.md:80`, `UBIQUITOUS_LANGUAGE.md:96` |
| CompiledFlow | not counted separately | Runtime graph loaded by the engine. | Keep in schemas/code. Use "compiled flow" in prose. | `UBIQUITOUS_LANGUAGE.md:34`, `docs/contracts/compiled-flow.md` |
| Compiled manifest | not counted | Serialized compiled-flow file under `generated/flows`. | Keep in generated-output docs. | `UBIQUITOUS_LANGUAGE.md:35` |
| pass | not counted | Runtime success route key. | Keep in code/schema only. Use "success route" in prose. | `UBIQUITOUS_LANGUAGE.md:36` |
| Compose step | not counted | Runtime step where the orchestrator writes a report. | Keep in runtime docs. | `UBIQUITOUS_LANGUAGE.md:37` |
| Relay step | not counted | Runtime step where Circuit delegates work. | Keep in runtime docs. | `UBIQUITOUS_LANGUAGE.md:38` |
| Verification step | not counted | Runtime step that runs verification commands. | Keep in runtime docs. | `UBIQUITOUS_LANGUAGE.md:39` |
| Checkpoint step | not counted | Runtime step that pauses for a checkpoint decision. | Keep in runtime docs. | `UBIQUITOUS_LANGUAGE.md:40` |
| Sub-run step | not counted | Runtime step that executes a child flow. | Keep, but explain as "child flow step" in prose. | `UBIQUITOUS_LANGUAGE.md:41` |
| Fanout step | not counted | Runtime step that runs branches and joins outputs. | Keep in runtime docs. | `UBIQUITOUS_LANGUAGE.md:42` |
| Trace entry | not counted | One append-only trace record. | Keep in runtime code/docs. | `UBIQUITOUS_LANGUAGE.md:43` |
| Report reference | not counted | Schema/path pair pointing at a report. | Keep in contracts. | `UBIQUITOUS_LANGUAGE.md:44` |
| Snapshot | not counted | Derived runtime projection from trace entries and compiled flow. | Keep in runtime internals. | `UBIQUITOUS_LANGUAGE.md:45` |
| Fixture | not counted | Saved test example or input. | Keep in tests. Avoid product prose. | `UBIQUITOUS_LANGUAGE.md:46` |
| Runtime proof | 201 | Internal flow used as runtime proof and test surface. | Keep internal. Do not market as a public flow. | `UBIQUITOUS_LANGUAGE.md:47`, runtime-proof fixtures/tests |

## Ambiguous, Deprecated, Or Disputed Terms

| Term | Current count | Why it is ambiguous | Candidate decision, not yet approved | Evidence |
| --- | ---: | --- | --- | --- |
| workflow | 1 exact prose alias plus 17 serialized/compatibility matches | Competes with Flow. | Use Flow in prose; keep serialized compatibility fields. | `UBIQUITOUS_LANGUAGE.md:10`, `src/flows/explore/reports.ts:253` |
| pipeline | 42 | Sometimes means generic CI/data pipeline, sometimes product flow. | Do not sweep broadly. Review case by case. | `docs/architecture/data-first-functional-flow-architecture.md:135`, `docs/flows/research-intake.md:132` |
| recipe | 2 | Older authored-flow term. | Use Schematic only where it means flow definition; otherwise use process/pattern. | `UBIQUITOUS_LANGUAGE.md:108` |
| primitive | 10 | Can mean flow block or generic programming primitive. | Use Block for flow composition; keep generic programming use. | `src/connectors/codex.ts:357`, `src/shared/html/components.ts:1` |
| phase | 6 | Competes with Stage but also names process failure phase. | Use Stage for flow grouping; keep connector error `phase`. | `src/connectors/codex.ts:434`, `UBIQUITOUS_LANGUAGE.md:117` |
| task | 475 | Sometimes ordinary human task, sometimes Step/Block. | Do not sweep. Use Step/Block only when the flow model is meant. | `AGENTS.md:27`, `UBIQUITOUS_LANGUAGE.md:14` |
| job | 31 | Generic work item, sometimes Step or Relay. | Avoid in product prose unless it means a host job. | `UBIQUITOUS_LANGUAGE.md:14`, `UBIQUITOUS_LANGUAGE.md:53` |
| edge | 93 | Graph theory term. | Prefer Route in flow prose; keep in graph internals when precise. | `UBIQUITOUS_LANGUAGE.md:15`, architecture docs |
| branch | 413 | Git branch, graph branch, or fanout branch. | Do not sweep. Prefer Route only for flow outcomes. | `docs/contracts/connector.md:339`, fanout code |
| transition | 14 | State-machine move or route. | Keep in state-machine docs; use Route for flow outcomes. | `docs/contracts/run.md:67` |
| gate | 2 | Deprecated alias for Check/Checkpoint. | Cleaned from validation prose and comments; remaining matches are the alias table. | `UBIQUITOUS_LANGUAGE.md:17`, `UBIQUITOUS_LANGUAGE.md:18` |
| artifact | 18 | Vague bucket for report/evidence/output/doc. | Cleaned from product prose where safe; remaining matches are alias docs, generic build artifacts, and Build checkpoint compatibility fields/tests. | `UBIQUITOUS_LANGUAGE.md:113`, Build checkpoint tests |
| proof | 1274 | Sometimes evidence, sometimes release proof, sometimes test proof. | Keep where it means release/test proof. Prefer Evidence for run support material. | `AGENTS.md:63`, `docs/release/proofs/` |
| run root | 2 | Old name for Run folder. | Use Run folder in prose. Do not rename compatibility flags casually. | `UBIQUITOUS_LANGUAGE.md:115` |
| run-root | 7 | Historical filename/flag residue. | Defer unless we approve file/flag migration. | `docs/plans/circuit-simplicity-migration-ledger.md:1120` |
| event log | 3 | Old name for Trace. | Use Trace in prose. Historical test temp names can wait. | `tests/unit/runtime/event-log-round-trip.test.ts:54` |
| rigor | 55 | Competes with Depth, but appears in a product-spec concept. | Needs product decision. Do not silently rewrite the 3-axis spec. | `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:1` |
| change_kind | 140 | Serialized field that overlaps Mode/Depth. | Keep unless a compatibility migration is approved. | `docs/contracts/compiled-flow.md:146`, `src/schemas/run.ts` |
| dispatch | 5 by exact noun, 17 including variants | Can mean relay, route, or generic code dispatch. | Use Relay for delegated work. Keep generic dispatch. | `plugins/claude/scripts/auto-open-policy.mjs:3` |
| adapter | 179 | Older connector/integration term, but also a real software pattern. | Prefer Connector for Circuit backends. Keep "adapter" where it means thin code adapter. | `UBIQUITOUS_LANGUAGE.md:54`, `AGENTS.md:99` |
| executor | 716 | Can mean Role, Connector, or runtime executor. | Use Role for worker responsibility, Connector for backend, executor for runtime code. | `UBIQUITOUS_LANGUAGE.md:58`, `src/runtime/executors/` |
| synthesis | 1 exact noun, 154 including `synthesize` names | Explore has serialized synthesize surfaces. | Defer. Needs explicit migration if renamed. | `docs/flows/explore-tournament.md:97`, generated Explore outputs |
| scalar | 46 | Bad for flow composition, valid for schema scalar types. | Keep in schema contracts. Avoid for product composition. | `docs/contracts/continuity.md:62`, `src/schemas/scalars.ts` |
| generator | not counted | Competes with Catalog compiler and emit scripts. | Prefer Catalog compiler for the tool, emit script for the command. | `UBIQUITOUS_LANGUAGE.md:95` |
| sync script | not counted | Vague generated-output term. | Prefer emit script when it writes generated surfaces. | `UBIQUITOUS_LANGUAGE.md:95` |
| handoff | not counted | Common operator word and continuity implementation word. | Keep if it describes cross-session context transfer. | `src/cli/handoff.ts`, continuity docs |
| session | not counted | Often host session, not necessarily Circuit Run. | Use Run only for Circuit execution. Keep session for host processes. | `UBIQUITOUS_LANGUAGE.md:16` |
| invocation | not counted | Can mean command call or run. | Keep for CLI calls. Use Run for flow execution. | `UBIQUITOUS_LANGUAGE.md:16` |

## Recurring Function Verb Inventory

These are actual recurring stems from function names. Counts come from `src/`,
`tests/`, `scripts/`, and `bin/`.

| Verb | Count | Observed examples | Suggested meaning |
| --- | ---: | --- | --- |
| build | 70 | `buildCodexArgs`, `buildClaudeCodeArgs`, `buildRecord` | Assemble an in-memory value or bundle from inputs. Watch for overuse where `render`, `compile`, or `write` is clearer. |
| load | 69 | `loadFixture`, `loadTemplateFlow`, `loadDraftFlow` | Read and parse a durable source into a usable object. |
| write | 66 | `writeSchemaTempFile`, `writeResult`, `writeText` | Persist bytes/text/JSON to disk or another output. |
| read | 63 | `readOriginal`, `readJson`, `readSourceVersion` | Read raw or lightly parsed data from a source. |
| run | 57 | `runConnectorSubprocess`, `runDoctor`, `runVersionCommand` | Start a command, check, script, or flow execution. |
| relay | 38 | `relayCustom`, `relayCodex`, `relayClaudeCode` | Delegate work to a connector/host/worker. This is a strong domain verb. |
| resolve | 32 | `resolveFixturePath`, `resolveCompiledFlowRoute`, `resolveEntryModeSelection` | Choose an effective value from inputs, defaults, and context. |
| parse | 31 | `parseCodexStdout`, `parseClaudeCodeStdout`, `parseArgs` | Convert text/argv/events into structured data. |
| render | 29 | `renderHandoffBrief`, `renderClaudeHostCommand`, `renderReadinessReport` | Turn structured data into human/host-facing text. |
| project | 26 | `projectBuildVerification`, `projectBuildResult`, `projectRootFromHookInput` | Derive a narrower view or report shape from richer data. Good existing verb for writer projections. |
| execute | 24 | `executeExecutableFlowOutcome`, `executeRelayFanoutBranch`, `executeSubRunFanoutBranch` | Run runtime graph logic. More internal than "run". |
| add | 20 | `addSkill`, `addWarning`, `addRunFilePathIssues` | Add an item to a collection. |
| assert | 20 | `assertCodexEffort`, `assertCodexSpawnArgvBoundary`, `assertFixtureMatchesRoute` | Throw if an invariant is false. |
| validate | 20 | `validateModeDepthAliasConsistency`, `validateFlowDepth`, `validateCustomFlow` | Check input shape or domain validity and report failures. |
| find | 18 | `findOnPath`, `findCompiledFlowPackageById`, `findFlowRuntimeSurfaceById` | Locate an item, often optional. |
| remove | 18 | `remove`, `removeStaleSiblingIfPresent`, `removeDirIfPresent` | Delete or drop an item. |
| capture | 15 | `captureCodexVersion`, `captureFailure`, `captureStream` | Record observed external/runtime output. |
| compose | 15 | `composeHandoffBrief`, `composeConfigLayerSelection`, `composeRelayPrompt` | Combine parts into a prompt, brief, or selection value. |
| check | 14 | `checkCanonicalStagePolicyVariant`, `checkFixManifest`, `checkRegistry` | Run a pass/fail guard, often in tests or scripts. |
| create | 14 | `createResultRoot`, `createCodexWrapper`, `createProviderWrapper` | Allocate or initialize something new. |
| trace | 14 | `traceString`, `traceLogPortFromStore`, `traceEntryLabel` | Read or label trace-derived values. Avoid using as a synonym for logging. |
| list | 11 | `listFiles`, `listMarkdownBasenames`, `listPackageDirs` | Return many items. |
| stub | 11 | `stubChildRunner`, `stubWorktreeRunner`, `stubProse` | Test-only replacement behavior. |
| compile | 10 | `compileOneSchematic`, `compileRuntimeSurface`, `compileFlowDefinition` | Convert authored source into executable/generated runtime structures. |
| require | 9 | `requireFlowRuntimeSurfaceById`, `requireResolvedVerificationCommands`, `requireValue` | Locate a value and fail if missing. |
| collect | 7 | `collectGitState`, `collectUntrackedFiles`, `collectReviewEvidence` | Gather a set of observations/files/evidence. |
| emit | 7 | `emitCommandFile`, `emitHostDirectCommands`, `emitGeneratedSurfaceMap` | Generate committed host/docs/flow surfaces from source. |
| make | 7 | `makeRoutable`, `makeFixture`, `makeVerificationProjectRoot` | Test/helper construction. Prefer `create` or `build` in production code if clearer. |
| append | 5 | `appendCapped`, `appendStatus`, `appendRepoFile` | Add to the end of text, status, or collections. |
| classify | 5 | `classifyRuntimeSupport`, `classifyPlanExecutionRequest`, `classifyTaskAgainstRoutables` | Assign a category from observed inputs. |
| compute | 5 | `computeObservedChangeSet`, `computeReviewVerdict`, `computeReachableForMode` | Calculate a value without side effects. |
| define | 5 | `defineFlow`, `defineFlowDataValue`, `defineFlowData` | Declare a typed source-of-truth definition. |
| resume | 5 | `resumeContinuity`, `resumeCommandForChoice`, `resumeCompiledFlowResult` | Continue paused or saved work. |
| split | 5 | `splitShellWords`, `splitMarkdownFrontmatter`, `splitLines` | Break text/data into parts. |
| apply | 4 | `applyFixturePolicy`, `applyComposeWriterPolicy`, `applySkillOp` | Apply a rule, policy, or operation to state. |
| clean | 4 | `cleanOptionLabel`, `cleanRelayResult`, `cleanPluginEnv` | Remove noise for display or tests. |
| derive | 4 | `deriveResolvedSelection`, `deriveTerminalVerdict`, `deriveRoutingForTesting` | Infer a value from other values. Similar to `compute`, but often domain-shaped. |
| normalize | 4 | `normalizeRelativePath`, `normalizeStatusText`, `normalizeAxisValue` | Convert equivalent inputs to a canonical form. |
| format | 3 | `formatWithBiome`, `formatMarkdown`, `formatContractSet` | Apply presentation/serialization formatting. |
| select | 1 | `selectEntryMode` | Choose one option. Rare as a function verb, but conceptually aligned with Mode/selection language. |

## Function Stem Notes

- Some common stems are nouns or adjectives, not verbs: `deterministic`,
  `checkpoint`, `command`, `flow`, `verification`, `schematic`, `step`, `report`,
  `runtime`, and `tournament`.
- The codebase already has a strong action vocabulary. The clearest verbs are:
  `define`, `compile`, `emit`, `load`, `read`, `parse`, `resolve`, `validate`,
  `check`, `run`, `execute`, `relay`, `compose`, `project`, `render`, and
  `write`.
- The most overloaded verbs are `build`, `run`, and `check`. They are not wrong,
  but they should be narrowed when a more specific verb fits.

## Rename Decisions Still Open

| Decision | Default posture before your review | Why it needs review |
| --- | --- | --- |
| Should `Flow` remain the universal product noun over `workflow`? | Yes. | Prior repo guidance and terminology checks already prefer `flow`, but you said you disagree with some recommendations. |
| Should `Schematic` stay, or is it too abstract? | Keep for authored flow definitions. | It is precise but may be too specialized for operator-facing prose. |
| Should `Relay` stay as the delegation term? | Keep. | It is distinctive and already used heavily, but it may need a plainer operator gloss. |
| Should `Depth` replace all product uses of `Rigor`? | Not until the 3-axis spec is decided. | `Rigor` may be a real product axis in that spec. |
| Should Explore `synthesize-*` names migrate? | Not in this batch. | It is embedded in serialized/generated surfaces. |
| Should `artifact` fields migrate to `report` or `evidence`? | Not without schema migration. | Some report shapes currently expose `artifact`. |
| Should `change_kind` migrate to Mode/Depth? | Not without compatibility work. | It is serialized and contract-bound. |
| Should `pipeline` be swept? | No broad sweep. | Many matches are generic CI/data pipeline language. |
| Should `executor` become Role or Connector? | Case by case. | Runtime executor code is legitimate; operator prose should be clearer. |
| Should `adapter` become Connector? | Case by case. | Thin code adapters are legitimate; Circuit integration backends should be Connector. |

## Changes Applied In This Sweep

These remain in the worktree and should be reviewed against the table above.

- Renamed `docs/ideas/align-workflow.md` to `docs/ideas/align-flow.md`.
- Renamed `docs/ideas/dynamic-workflow-ratchet.md` to
  `docs/ideas/dynamic-flow-ratchet.md`.
- Rewrote selected authored prose from workflow/phase/recipe/dispatch/
  primitive/artifact/rigor toward flow/stage/schematic/relay/block/report/
  evidence/depth.
- Kept compatibility notes around `follow_up_workflow`, Build checkpoint
  `artifact`, Explore `synthesize-step`, and connector spawn-error `phase`.
- Changed the Fix flow purpose from "proof artifacts" to "proof evidence" in
  `src/flows/fix/data.ts`.
- Regenerated flow and host outputs through `npm run emit-flows`.
- Regenerated release parity outputs through `npm run emit-release`.
- Renamed `docs/ideas/per-step-validation-gate.md` to
  `docs/ideas/per-step-validation-check.md`.
- Rewrote validation/check prose and comments so `gate` no longer describes
  validation behavior. Remaining `gate` matches are only the deprecated aliases
  in `UBIQUITOUS_LANGUAGE.md`.
- Rewrote vague product-prose `artifact` references in the 3-axis spec to
  `operator report` or `doc`. Remaining `artifact` matches are compatibility
  fields/tests, generic build artifacts, and deprecated-term aliases.

## Focused Checks For The Next Approved Batch

Run these after any approved rename batch. Keep this audit file excluded.

```bash
rg -n "(?i)\bworkflows?\b|follow_up_workflow" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(phases?|Phase|Phases)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(recipes?|Recipe|Recipes)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(dispatch|dispatches|dispatched|dispatching|dispatcher|Dispatch|Dispatcher)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(primitives?|Primitive|Primitives)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(artifacts?|Artifact|Artifacts)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(synthesis|Synthesis|synthesize|Synthesize|synthesize-step|explore-synthesize)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(rigor|Rigor|rigorous|rigorously)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
rg -n "\b(gate|gates|Gate|Gates)\b" docs src tests plugins generated scripts AGENTS.md UBIQUITOUS_LANGUAGE.md -g '!docs/release/proofs/runs/**' -g '!docs/audit/2026-05-18-terminology-sweep.md' -g '!plugins/*/runtime/**'
```

## Continuation Rule

Use this table before each rename batch:

1. Pick one term family.
2. Make the smallest coherent rename.
3. Regenerate generated surfaces when source changes require it.
4. Run focused old-term checks and document intentional retentions.
5. Run `npm run verify`.
6. Run an adversarial review, fix all medium/high/critical findings, then run a
   second adversarial review. Stop only after two consecutive reviews have no
   medium-or-above findings.
