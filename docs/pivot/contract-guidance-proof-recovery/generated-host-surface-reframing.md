# Generated Host Surface Reframing

Status: implementation-spec direction for the Circuit pivot. This is
future-facing. It does not describe current host copy until the matching runtime,
source commands, renderers, generated mirrors, manifests, docs, and tests change.

`Generated Host Surface Reframing` is the spec name. In product prose, say
host surfaces, commands, skills, or plugin copy.

## Purpose

The public surface should teach one simple idea:

> Give Circuit an intent. Circuit chooses the flow, loads the work contract,
> records the important decisions, checks the evidence, recovers when needed,
> and applies changes safely.

Direct flow commands may stay, but they must stop sounding like a way around the
runtime. In V0, a direct flow command means "start from this flow" rather than
"skip Circuit's decision and proof path."

This spec defines how the Claude and Codex commands, Codex skills, plugin
manifests, generated flow mirrors, docs mirrors, drift checks, and tests should
change when the runtime can support the pivot.

## Source Evidence

| Source | Evidence used |
| --- | --- |
| [Pivot brief](pivot-brief.md) | The doctrine says flows carry work contracts, guidance runs those contracts within the rules, trace proves what happened, and safe apply turns edits into inspected proposed changes. See `pivot-brief.md:14-32`. The brief also says current host surfaces still teach host-side flow selection and direct flow bypass, and sets generated-surface acceptance rules. See `pivot-brief.md:129-132` and `pivot-brief.md:733-767`. |
| [Order of operations](order-of-operations.md) | Generated surface changes should happen after the runtime can back the new story. Exit criteria require `src/commands/run.md` and generated host mirrors to stop teaching the old story, while direct flow commands remain expert or developer controls that still run guidance, proof, recovery, and trace. See `order-of-operations.md:180-198`. |
| [WorkContract Projection V0](work-contract-projection-v0.md) | Generated host commands and plugin mirrors must carry the same contract, guidance, proof, and recovery runtime after cutover; direct flow commands, if kept, must be expert or developer controls. See `work-contract-projection-v0.md:48-73` and `work-contract-projection-v0.md:98-139`. |
| [GuidanceDecision Trace Invariant](guidance-decision-trace-invariant.md) | Flow selection is recorded as a `guidance.decision` before material work starts. Host recommendations are allowed only when Circuit validates and records acceptance or rejection. See `guidance-decision-trace-invariant.md:1-21`, `guidance-decision-trace-invariant.md:66-107`, and `guidance-decision-trace-invariant.md:336-360`. |
| [PolicyEnvelope Config V2 Cutover](policy-envelope-config-v2-cutover.md) | Rules, limits, preferences, defaults, and overrides can feed guidance but cannot be final runtime authority. See `policy-envelope-config-v2-cutover.md:1-21`, `policy-envelope-config-v2-cutover.md:70-96`, and `policy-envelope-config-v2-cutover.md:337-371`. |
| [CheckpointBoundary Authority](checkpoint-boundary-authority.md) | Generated surfaces must stop describing checkpoint resolution as an autonomous mode. Checkpoint choices and resume commands still surface from waiting runtime state. See `checkpoint-boundary-authority.md:487-497`. |
| [ProofAssessment And Evidence Adapter](proof-assessment-evidence-adapter.md) | Generated-surface proof must be command-backed evidence, not prose. Write-capable close requires proof refs. See `proof-assessment-evidence-adapter.md:442-456`, `proof-assessment-evidence-adapter.md:575-595`, and `proof-assessment-evidence-adapter.md:794-808`. |
| [RecoveryRouteKind](recovery-route-kind.md) | Direct flow commands, if kept, must state that recovery still uses the same WorkContract, GuidanceDecision, proof, checkpoint, and trace rules. See `recovery-route-kind.md:844-852`. |
| [ChangePacket And SafeApply](change-packet-safe-apply.md) | Safe apply is a runtime-owned check and apply path. Generated mirrors touched by a change need source refs, output refs, and drift-check evidence. See `change-packet-safe-apply.md:9-12` and `change-packet-safe-apply.md:468-486`. |
| [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md) | Canonical product words include flow, schematic, block, route, relay, connector, trace, report, evidence, checkpoint, and plugin. The glossary also lists aliases to avoid for core terms. See `UBIQUITOUS_LANGUAGE.md:1-35`, `UBIQUITOUS_LANGUAGE.md:128-142`, and `UBIQUITOUS_LANGUAGE.md:221-236`. |
| [docs/generated-surfaces.md](../../generated-surfaces.md) | Authored command sources, generated command mirrors, Codex skills, generated manifests, host mirrors, and the drift check are source-owned. Do not hand-edit generated mirrors. See `docs/generated-surfaces.md:1-70`. |
| [src/commands/run.md](../../../src/commands/run.md) | The current run command says it is a flow selector, tells the host model to choose the flow before Circuit, lists explicit flow commands, and has a "Direct Flow Bypass" section. See `src/commands/run.md:1-23`, `src/commands/run.md:36-60`, and `src/commands/run.md:214-221`. |
| [plugins/codex/skills/run/SKILL.md](../../../plugins/codex/skills/run/SKILL.md) | The current generated Codex run skill says it chooses and runs the best flow, tells Codex to select the flow before invoking Circuit, and says direct flow skills remain available. See `plugins/codex/skills/run/SKILL.md:1-26` and `plugins/codex/skills/run/SKILL.md:31-57`. |
| [Flow command sources](../../../src/flows/build/command.md) | Current direct flow sources describe running a flow without asking the router first, and some still teach `--rigor` or `--autonomous` entry flags. See `src/flows/build/command.md:1-14`, `src/flows/fix/command.md:1-15`, and `src/flows/prototype/command.md:1-82`. |
| [host renderers](../../../scripts/flows/host-renderers.ts) | Codex skill metadata and renderer replacements are script-owned. The renderer already removes slash-command tokens from skills and asserts forbidden placeholders. See `scripts/flows/host-renderers.ts:1-49`, `scripts/flows/host-renderers.ts:167-245`. |
| [emit script](../../../scripts/flows/emit.ts) | `HOST_DIRECT_COMMANDS` currently emits `create`, `handoff`, and `run`; public flow commands emit Claude commands, Codex command mirrors, and Codex skills; check mode verifies drift, stale mirrors, stale skill dirs, and obsolete root host surfaces. See `scripts/flows/emit.ts:104-110`, `scripts/flows/emit.ts:164-207`, and `scripts/flows/emit.ts:867-997`. |
| [plugin manifests](../../../plugins/codex/.codex-plugin/plugin.json) | Current Claude and Codex manifest copy still says Circuit chooses/runs flows and mentions direct flow skills as available when the operator knows the flow. See `plugins/claude/.claude-plugin/plugin.json:1-8` and `plugins/codex/.codex-plugin/plugin.json:1-28`. |
| [host surface tests](../../../tests/contracts/codex-host-plugin.test.ts) | Current tests assert the old Codex run-skill wording and also enforce useful skill safety rules: no `/circuit:` tokens, no `$ARGUMENTS`, no `argument-hint`, and no slash-command wording in Codex skills. See `tests/contracts/codex-host-plugin.test.ts:261-294` and `tests/contracts/codex-host-plugin.test.ts:804-831`. |
| [generated surface tests](../../../tests/contracts/catalog-completeness.test.ts) | Current tests prove command surface ownership is documented and matches `emit.ts`. See `tests/contracts/catalog-completeness.test.ts:430-474`. |
| [Claude host tests](../../../tests/contracts/claude-host-plugin.test.ts) | Current tests list expected Claude commands and assert the manifest/package shape. See `tests/contracts/claude-host-plugin.test.ts:21-31` and `tests/contracts/claude-host-plugin.test.ts:82-94`. |

## Plain Language Rules

Use the formal spec names in implementation specs, schemas, tests, and trace
validators. Use plain words in commands, skills, manifests, and operator docs.

| Formal name | Plain host wording |
| --- | --- |
| `WorkContract` | work contract, contract |
| `GuidanceDecision` | recorded decision |
| `PolicyEnvelope` | rules, limits, preferences |
| `ProofAssessment` | proof check, evidence check |
| `RecoveryRouteKind` | recovery path |
| `ChangePacket` | proposed change |
| `SafeApply` | safe apply, apply safely |
| `flow_selection` guidance | Circuit records the chosen flow |

Host surfaces should not describe Circuit as a broad platform. They should say
what the operator can do and what Circuit will prove.

Avoid these product patterns:

- "choose the flow" as the main operator story;
- "direct command bypass" as a promise;
- "autonomous mode" as a broad safety claim;
- "proof" described as an agent report rather than runtime evidence;
- "safe apply" described as a prompt instruction.

## Surface Classes

### Default Intent Front Door

Surface examples:

- `src/commands/run.md`
- `plugins/claude/commands/run.md`
- `plugins/codex/commands/run.md`
- `plugins/codex/skills/run/SKILL.md`
- plugin manifest default prompts and descriptions

Target rule:

> The default surface says the operator gives Circuit an intent. Circuit records
> the selected flow and runs the same contract, guidance, proof, recovery, and
> trace path as any other entry.

The host may recommend a flow, but Circuit owns the recorded decision. A host
recommendation must become either:

- `guidance.decision.subject === "flow_selection"` with
  `source: "host_recommended"` and a selected flow that Circuit accepts; or
- a rejected option followed by a different allowed flow selection.

The host surface should not tell the host to choose the final flow before
Circuit. It may give the host a plain rubric to prepare a recommendation, but
that recommendation is not final authority.

### Direct Flow Expert Controls

V0 keeps current public direct flow controls as expert controls:

| Flow | Current source | V0 surface fate |
| --- | --- | --- |
| `build` | `src/flows/build/command.md` | Keep as public expert control. |
| `fix` | `src/flows/fix/command.md` | Keep as public expert control. |
| `review` | `src/flows/review/command.md` | Keep as public expert control. |
| `explore` | `src/flows/explore/command.md` | Keep as public expert control. |
| `prototype` | `src/flows/prototype/command.md` | Keep as public expert control. |
| `goal` | `src/flows/goal/command.md` | Keep as public expert control. |
| `pursue` | no command source today | Do not add a direct host command in this spec. Keep it routable until a Pursue surface spec decides otherwise. |

Plain rule:

> A direct flow command is a deliberate starting point. It is not a bypass.

Each direct flow command must say, in plain language:

- when to use that flow directly;
- Circuit still validates and records the chosen flow;
- Circuit still loads the work contract;
- relays still require recorded decisions;
- proof, recovery, checkpoints, trace, and safe apply still apply.

The command may say "run Build directly" as a host control. It must not say it
skips guidance, proof, recovery, trace, or Circuit's recorded decision.

### Utility Commands

`create`, `handoff`, and `run` are direct command sources under `src/commands/`
today. V0 keeps this ownership, but clarifies the product role:

| Command | V0 surface fate |
| --- | --- |
| `run` | Default intent front door. |
| `create` | Utility surface for drafting, validating, or publishing custom flows. It should not teach custom flow creation as the main product path during the pivot. |
| `handoff` | Utility surface for continuity. It should keep using trace, report, evidence, and run-folder language. |

### Codex Skills

Codex skill files are runnable host instructions, not just docs. Keep the
existing safety guardrails:

- no `/circuit:` tokens;
- no `$ARGUMENTS`;
- no `argument-hint`;
- no source-only authority footer;
- no slash-command wording.

The skill metadata should move from "chooses and runs the best flow" to
intent-first wording. Example target:

```yaml
description: "Runs Circuit on a coding intent with contract, proof, recovery, and trace."
```

Direct Codex skills may remain available, but the run skill should not describe
them as a bypass. It should describe them as expert controls for operators who
already know which flow they want Circuit to start from.

### Claude Commands

Claude command files may keep slash-command presentation because Claude uses
that host surface. The target copy should still be intent-first:

- `/circuit:run` is the default entry;
- direct `/circuit:<flow>` commands are expert controls;
- direct commands still run the same runtime path;
- examples should avoid old product flags unless the config and checkpoint specs
  have replaced them with current terms.

### Plugin Manifests

Manifest descriptions and default prompts are part of the product surface.

Target manifest copy should say:

- Circuit runs coding intents through flows with contracts, proof, recovery, and
  trace;
- the default prompt is intent-first;
- direct flow skills or commands exist as expert controls, not the main story;
- write-capable work is subject to proof and safe apply once SafeApply exists.

Do not make manifests promise runtime behavior before that behavior exists. Until
then, leave current manifest copy or mark the pivot language as future-facing in
docs only.

### Generated Flow Manifests And Mirrors

Generated compiled outputs remain generated data. They should not become product
copy.

After WorkContract Projection V0 exists, generated manifests should include or
reference the WorkContract projection data needed by hosts and tests:

- flow id and variant;
- WorkContract projection ref or embedded projection;
- route and recovery binding data;
- checkpoint boundary projection data;
- proof requirement refs;
- generated-surface source refs when relevant.

The exact JSON shape belongs to the WorkContract projection and generated output
implementation. This spec only requires generated mirrors to stay in sync and
not preserve old authority by accident.

### Docs Mirrors And Generated Surface Map

`docs/generated-surfaces.md` should remain the source map for generated outputs.
After reframing, it should add acceptance rules for product wording:

- authored command files own command copy;
- host mirrors are generated;
- Codex skill wording is produced by `scripts/flows/host-renderers.ts`;
- direct flow commands are expert controls;
- stale generated mirrors fail checks;
- public host copy cannot claim direct commands bypass guidance, proof, recovery,
  or trace.

## Current State Versus Target

| Area | Current repo evidence | Target rule |
| --- | --- | --- |
| Run command story | `src/commands/run.md` says the host chooses the flow before Circuit and has a "Direct Flow Bypass" section. See `src/commands/run.md:13-23` and `src/commands/run.md:214-221`. | `run` becomes the intent front door. Host flow choice is a recommendation that Circuit validates and records. |
| Codex run skill | Current generated skill says it chooses and runs the best flow and asks Codex to select the flow first. See `plugins/codex/skills/run/SKILL.md:1-26` and `plugins/codex/skills/run/SKILL.md:31-57`. | Codex run skill says Circuit runs an intent and records the selected flow. |
| Direct flow command copy | Current Build/Fix/Prototype sources say they run without asking the router first. See `src/flows/build/command.md:6-14`, `src/flows/fix/command.md:6-15`, and `src/flows/prototype/command.md:6-17`. | Direct flow commands say they are expert controls that still use the same contract, guidance, proof, recovery, checkpoint, trace, and safe apply rules. |
| Old entry flags | Some current surfaces teach `--rigor` and `--autonomous`. See `src/commands/run.md:124-133`, `src/flows/build/command.md:70-72`, and `src/flows/prototype/command.md:76-82`. | Future surfaces use policy, proof, checkpoint, and default language once those runtime flags are replaced. |
| Codex skill rendering | Renderer already removes `/circuit:`, `$ARGUMENTS`, and source-only footers from Codex skills. See `scripts/flows/host-renderers.ts:167-245`. | Keep these guardrails and add framing checks. |
| Generated ownership | Generated surface map says authored sources own command copy and host mirrors are generated. See `docs/generated-surfaces.md:7-18` and `docs/generated-surfaces.md:29-70`. | Keep source ownership. Change sources and renderers, regenerate mirrors, then run drift checks. |
| Tests | Current tests assert old run-skill wording but also enforce useful no-placeholder rules. See `tests/contracts/codex-host-plugin.test.ts:261-294` and `tests/contracts/codex-host-plugin.test.ts:804-831`. | Replace old wording assertions with intent-first assertions and keep no-placeholder assertions. |

## Target Wording Patterns

These are examples for implementation, not required final copy.

Default entry:

> Use Circuit on this coding intent. Circuit records the chosen flow, loads the
> work contract, checks evidence, recovers when needed, and applies changes
> safely.

Direct flow:

> Use this expert control when you intentionally want Circuit to start from the
> Fix flow. Circuit still records that choice, runs the work contract, checks
> proof, follows declared recovery routes, and records trace.

Checkpoint:

> If Circuit reaches a checkpoint, show the choices and resume command from the
> waiting run state. Do not call it autonomous approval.

Safe apply:

> For write-capable work, agents propose changes. Circuit checks and applies or
> rejects them.

Generated surfaces:

> Edit the source command or renderer, regenerate host mirrors, and run the drift
> check.

## Field And Surface Projection

| Current field or surface | V0 fate | Rule |
| --- | --- | --- |
| `src/commands/run.md` frontmatter description | replace | Intent-first wording. It must not say the host makes the final flow choice. |
| `# /circuit:run - flow selector` style heading | replace | Use an intent-front-door heading. |
| Run command selection rubric | keep as guidance seed | May help the host recommend a flow, but must say Circuit validates and records the chosen flow. |
| Deterministic router fallback wording | replace | The fallback is not the only path where Circuit chooses. Circuit records flow selection for all entries. |
| "Direct Flow Bypass" section | delete/replace | Replace with "Direct flow expert controls" and say no runtime bypass is allowed. |
| Flow-owned command headings | keep/reframe | Direct flow command names can stay, but copy must say expert control and same runtime path. |
| `--rigor` examples | replace later | Keep current examples until PolicyEnvelope cutover exists. After cutover, use proof/profile/rule wording instead of product-facing rigor. |
| `--autonomous` examples | replace later | Remove as product copy once checkpoint defaults and policy resolution replace the old flag path. |
| Codex skill metadata descriptions | replace | Use intent-first wording for `run`; direct skills can say "Runs Circuit <Flow>" but must not imply bypass. |
| Codex skill no-placeholder checks | keep | Keep existing assertions and add wording checks. |
| Claude command mirrors | generated | Do not hand-edit. Regenerate from source. |
| Codex command mirrors | generated | Do not hand-edit. Regenerate from source. |
| Codex skill surfaces | generated | Change renderer/source metadata, then regenerate. |
| `plugins/claude/.claude-plugin/plugin.json` description | replace | Intent-first, no direct-flow list as main story. |
| `plugins/codex/.codex-plugin/plugin.json` interface copy | replace | Intent-first, direct skills as expert controls only. |
| `docs/generated-surfaces.md` | generated | Add generated framing rules through `scripts/flows/emit.ts`, not direct edits. |
| Generated compiled flow JSON | keep | Add WorkContract projection refs only through the compiler/emitter slice. |

## Host Recommendation Rules

Host surfaces can help the model route the request, but they must be honest
about authority.

Rules:

1. The host may recommend a flow based on the user's request.
2. Circuit validates that recommendation against the available flows, the work
   contract projection, and policy.
3. Circuit records a `guidance.decision` for flow selection before material work.
4. If the host recommendation is invalid, Circuit rejects it and records why.
5. A direct flow command is represented as a host or operator recommendation,
   not final runtime authority.
6. A direct flow command cannot skip relay guidance, proof checks, recovery
   guidance, checkpoint rules, or safe apply.

This means current phrases such as "host model chooses the flow before invoking
Circuit" and "skip this classifier layer" are not allowed in future public
surfaces.

## Direct Flow V0 Decision

V0 should not remove direct flow commands. Removing them would mix product
reframing with compatibility churn.

V0 keeps these surfaces as public expert controls:

- Claude commands for `build`, `fix`, `review`, `explore`, `prototype`, and
  `goal`;
- Codex command mirrors for the same flows;
- Codex skills for the same flows.

V0 does not add new direct host commands for Pursue. Pursue stays available
through the intent front door and explicit CLI flow invocation until a separate
Pursue surface spec chooses otherwise.

Dev-only controls may still exist for debugging exact contracts or generated
manifests, but they must be named as dev/debug controls and must not be confused
with the product surface.

## Implementation Order

Do not update generated public copy before the runtime can back it. The surface
work should happen in this order:

1. Add WorkContract projection data and tests.
2. Add GuidanceDecision trace schema and flow-selection matching.
3. Add PolicyEnvelope cutover rules so old selection fields stop being final
   authority.
4. Add proof, recovery, checkpoint, and safe-apply gates required by the surface
   promises being made.
5. Update command sources:
   - `src/commands/run.md`;
   - public `src/flows/<id>/command.md` files;
   - utility command sources only where their copy touches the pivot.
6. Update host renderer metadata and rewrites in
   `scripts/flows/host-renderers.ts`.
7. Update plugin manifest copy.
8. Update generated surface map generation in `scripts/flows/emit.ts` if the map
   needs new framing rules.
9. Run `npm run build && npm run emit-flows`.
10. Add generated-surface framing tests and update old wording assertions.
11. Run `npm run check-flow-drift`, focused host tests, and full verify.

## Death Tests

### Source And Generated Copy

| Death test | Likely test or check |
| --- | --- |
| Public run source does not title itself as a flow selector. | `tests/generated/generated-surface-framing.test.ts` or docs audit |
| Public run source does not say the host makes the final flow choice before Circuit. | `tests/generated/generated-surface-framing.test.ts` |
| Public run source has no "Direct Flow Bypass" section. | `tests/generated/generated-surface-framing.test.ts` |
| Direct flow source files do not say they skip guidance, proof, recovery, trace, or Circuit's recorded decision. | `tests/generated/generated-surface-framing.test.ts` |
| Direct flow source files say they are expert controls or deliberate starting points. | `tests/generated/generated-surface-framing.test.ts` |
| Direct flow source files say the same contract/guidance/proof/recovery/trace rules still apply. | `tests/generated/generated-surface-framing.test.ts` |
| Product surfaces do not describe Circuit primarily as a flow runner. | `scripts/release/audit-public-docs.ts` or framing test |

### Host Runtime Claims

| Death test | Likely test |
| --- | --- |
| Direct flow CLI invocation emits flow-selection or host-recommendation guidance before relay work. | `tests/runner/direct-flow-guidance.test.ts` |
| Direct flow CLI invocation cannot bypass relay guidance. | `tests/runner/direct-flow-guidance.test.ts` |
| Direct flow CLI invocation cannot close write-capable work without ProofAssessment refs. | `tests/runner/direct-flow-guidance.test.ts` |
| Direct flow CLI invocation cannot use undeclared recovery routes. | `tests/runtime/guidance-route-invariant.test.ts` |
| Host-recommended flow selection is accepted or rejected by Circuit and recorded in trace. | `tests/runner/run-flow-selection-guidance.test.ts` |

### Codex Skills

| Death test | Likely test |
| --- | --- |
| Codex run skill uses intent-first wording. | `tests/contracts/codex-host-plugin.test.ts` |
| Codex run skill does not say direct skills bypass the router, guidance, proof, recovery, or trace. | `tests/contracts/codex-host-plugin.test.ts` |
| Codex skills still contain no `/circuit:`, `$ARGUMENTS`, `argument-hint`, source-only authority footer, or slash-command wording. | existing `tests/contracts/codex-host-plugin.test.ts` |
| Codex direct flow skills identify themselves as expert controls or deliberate starting points. | `tests/contracts/codex-host-plugin.test.ts` |

### Claude Commands And Plugin Manifests

| Death test | Likely test |
| --- | --- |
| Claude manifest copy is intent-first and does not list direct flow commands as the main story. | `tests/contracts/claude-host-plugin.test.ts` |
| Codex manifest copy is intent-first and describes direct skills as expert controls. | `tests/contracts/codex-host-plugin.test.ts` |
| Claude direct commands say they still run the same contract/guidance/proof/recovery/trace path. | `tests/contracts/claude-host-plugin.test.ts` |
| Plugin manifest copy does not promise SafeApply before SafeApply exists. | `tests/contracts/host-surface-framing.test.ts` |

### Generated Output And Drift

| Death test | Likely test or command |
| --- | --- |
| Generated command mirrors match source command files after renderer transforms. | `npm run check-flow-drift` |
| Generated Codex skill dirs match expected public flow commands plus direct commands. | existing emit drift check |
| Stale host mirrors for internal flows fail drift. | existing emit drift check |
| Stale per-mode generated files fail drift. | existing emit drift check |
| `docs/generated-surfaces.md` is regenerated when emitter-owned surface rules change. | existing emit drift check |
| Generated manifests include WorkContract projection refs once projection exists. | `tests/generated/generated-contract-manifests.test.ts` |

## Anti-Cruft Probes

Run these during implementation. Some should fail until the cutover lands.

```bash
rg -n "flow selector|Direct Flow Bypass|host model chooses the flow before invoking Circuit|skip this classifier layer|Chooses and runs the best Circuit flow|chooses the best bundled Circuit flow" \
  src/commands src/flows plugins docs README.md
```

Expected hard-cut state: public product surfaces do not teach the old entry
story. Allow-list only migration/history docs and death-test fixtures.

```bash
rg -n "bypass(es)? (guidance|proof|recovery|trace)|skip(s)? (guidance|proof|recovery|trace)" \
  src/commands src/flows plugins docs README.md
```

Expected hard-cut state: zero public-surface hits outside death-test fixtures.

```bash
rg -n "/circuit:(fix|build|review|explore|prototype|goal)" \
  src/commands src/flows plugins docs README.md
```

Expected hard-cut state: hits are reviewed, not banned. Direct commands may
remain, but their surrounding copy must mark them as expert controls and same
runtime path.

```bash
rg -n "argument-hint:|\\$ARGUMENTS|/circuit:" plugins/codex/skills -g 'SKILL.md'
```

Expected hard-cut state: zero hits. Codex skills stay native host instructions.

```bash
node scripts/flows/emit.ts --check
```

Expected hard-cut state: all generated mirrors, generated map docs, stale skill
dirs, stale internal mirrors, and obsolete root surfaces are in sync.

## Verification Plan

For the generated-surface implementation slice:

1. Run the anti-cruft probes above and classify allow-listed hits.
2. Run `npm run build && npm run emit-flows`.
3. Run `npm run check-flow-drift`.
4. Run focused host and generated-surface tests:

   ```bash
   npm run test -- \
     tests/contracts/codex-host-plugin.test.ts \
     tests/contracts/claude-host-plugin.test.ts \
     tests/contracts/catalog-completeness.test.ts \
     tests/contracts/documentation-surface.test.ts
   ```

5. Run the new generated-surface framing tests.
6. Run full `npm run verify`.

For this docs-only spec, do not run emit or modify generated outputs.

## Still Unsettled

- Exact final title and short description for the intent front door.
- Whether direct flow commands stay public expert controls long-term or move to
  dev-only after users adapt to the intent front door.
- Whether each direct flow command repeats the same-runtime notice or the
  renderer injects a shared notice.
- Exact JSON shape for generated WorkContract projection refs in compiled flow
  outputs.
- Whether plugin manifests should mention SafeApply before SafeApply is shipped.
- Whether Pursue eventually gets a direct host command.
- How custom flow direct invocations should be described after WorkContract
  projection exists.

## Review Checklist

Before implementing this spec, review for these failures:

- The run surface still teaches "pick a flow" as the main product story.
- Direct flow controls still sound like a bypass.
- Codex skills regain slash-command-only wording.
- Manifest copy promises runtime behavior that is not implemented yet.
- Generated mirrors are hand-edited instead of regenerated.
- Tests assert the new wording without proving drift and stale-surface behavior.
- SafeApply, proof, and checkpoint language is used before those runtime gates
  exist.
