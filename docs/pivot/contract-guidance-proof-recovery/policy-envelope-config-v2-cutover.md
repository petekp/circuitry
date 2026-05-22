# PolicyEnvelope Config V2 Cutover

Status: implementation-spec direction for the Circuit pivot. This is not
current runtime behavior until the matching schema, runtime, tests, docs, and
generated surfaces change.

`PolicyEnvelope` is the proposed spec name. In product prose, call it Circuit's
rules, limits, preferences, and defaults.

## Purpose

PolicyEnvelope v2 replaces selection-centered config as runtime authority.

The rule is:

> Config can bound or suggest a decision. It cannot be the decision.

After this cutover, connector, model, effort, skills, proof profile, checkpoint
default, recovery, and safe-apply choices are made by GuidanceDecision inside
WorkContract and policy bounds. Old config and selection fields may be migrated
into policy inputs, but they must not directly choose worker behavior.

## Source Evidence

- The pivot brief defines PolicyEnvelope as rules, limits, preferences, and
  defaults, and says hard constraints compose restrictively. See
  [pivot-brief.md](pivot-brief.md#policyenvelope).
- The pivot brief names the v2 cutover rule: old routing and selection fields
  may migrate into policy inputs only; they must never directly determine
  connector, model, effort, or skills without a matching GuidanceDecision. See
  [pivot-brief.md](pivot-brief.md#policyenvelope-v2-cutover-rules).
- WorkContract Projection V0 says flow, stage, step, config, and invocation
  selection become guidance seeds only, while budgets and routes remain contract
  authority. See
  [work-contract-projection-v0.md](work-contract-projection-v0.md).
- GuidanceDecision Trace Invariant requires non-empty `constraint_refs`,
  `contract_refs`, and `policy_refs`, and says the recorded decision is the
  runtime-validated decision. See
  [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md).
- Ubiquitous Language defines the current config and selection vocabulary, and
  keeps flow, relay, connector, skill, trace, report, evidence, and checkpoint
  as canonical terms. See
  [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md).
- Current `Config` is `schema_version: 1` and includes `relay.default`,
  `relay.roles`, `relay.circuits`, custom connector registry, top-level skill
  bindings, per-flow circuit overrides, `variant_models`, and
  `defaults.selection`. See [src/schemas/config.ts](../../../src/schemas/config.ts).
- Current `SelectionOverride` carries model, effort, skills, depth, and
  invocation options; `SelectionResolution` flattens config, flow, stage, step,
  and invocation layers under an ordered selection chain. See
  [src/schemas/selection-policy.ts](../../../src/schemas/selection-policy.ts).
- Current selection resolution folds `defaults.selection`,
  `circuits.<flow>.selection`, flow defaults, stage selection, step selection,
  and invocation selection into `ResolvedSelection`. See
  [src/shared/selection-resolver.ts](../../../src/shared/selection-resolver.ts).
- Current relay connector resolution chooses explicit connector, role routing,
  flow routing, default routing, then auto fallback. See
  [src/runtime/connectors/resolver.ts](../../../src/runtime/connectors/resolver.ts).
- Current config discovery loads user-global and project YAML files, plus an
  optional invocation config, as `LayeredConfig` records. See
  [src/shared/config-loader.ts](../../../src/shared/config-loader.ts).
- Current config docs teach `schema_version: 1`, selection composition, skill
  bindings, connector routing, and Prototype variant models. See
  [docs/configuration.md](../../configuration.md),
  [docs/contracts/config.md](../../contracts/config.md), and
  [docs/contracts/selection.md](../../contracts/selection.md).
- Current generated surfaces are source-owned and drift-checked by the emit
  script. See [docs/generated-surfaces.md](../../generated-surfaces.md).

## Cutover Rule

The hard cutover is not "rename config fields." It is a change in authority.

Today:

```text
config / flow / stage / step / invocation selection
-> ResolvedSelection
-> relay runs with that connector/model/effort/skills
```

After cutover:

```text
PolicyEnvelope + WorkContract + current intent
-> GuidanceDecision
-> relay runs only if the decision matches policy and contract refs
```

`ResolvedSelection` may survive only as:

- a migration helper;
- a test fixture for old behavior;
- a nested value inside `GuidanceDecision.selected`.

It must not be the final relay authority.

## Proposed V2 Shape

```ts
type PolicyEnvelopeV2 = {
  schema_version: 2;
  policy: {
    rules?: PolicyRules;
    limits?: PolicyLimits;
    preferences?: PolicyPreferences;
    defaults?: PolicyDefaults;
  };
};

type PolicyLayer = {
  source: 'built-in' | 'user-global' | 'project' | 'invocation';
  source_path?: string;
  envelope: PolicyEnvelopeV2;
};
```

Plain meanings:

- **Rules** say what must or must not happen.
- **Limits** cap cost, attempts, time, effort, branch count, and write reach.
- **Preferences** rank allowed choices.
- **Defaults** fill gaps when no preference applies.
- **Invocation layers** record operator input for this run.

Implementation names can stay exact in schemas and tests. Product docs should
explain them with the plain meanings above.

`PolicyLayer` replaces `LayeredConfig` in the runtime path. `source_path` is
kept for file-backed user and project policy refs. Invocation overrides use the
same layer wrapper, but their rules can only tighten hard constraints unless a
separate policy-change event exists.

## Hard Constraint Composition

Hard constraints do not use ordinary "later layer wins" composition. They
compose restrictively.

Use these rules:

| Constraint shape | Composition rule |
| --- | --- |
| Allowed set | Intersect all allowed sets. If the result is empty, stop or checkpoint. |
| Denied set | Union all denied sets. Any denial blocks the option. |
| Maximum number | Use the smallest maximum. |
| Minimum requirement | Use the largest minimum requirement. |
| Boolean permission | `false` wins for permissions such as auto-apply or write access. |
| Required checkpoint globs | Union the globs. If any layer protects a path, it is protected. |
| Required proof/review | Union requirements. Any required proof stays required. |
| Budget cap | Use the smallest cap across contract, project, user, and invocation. |

Missing constraints have explicit identities:

- A missing allowed set does not narrow the candidate universe. The candidate
  universe still comes from installed connectors, WorkContract, and runtime
  capabilities.
- A missing denied set is empty.
- A missing maximum is no cap from that layer.
- A missing minimum is no requirement from that layer.
- A missing required-checkpoint or required-proof set is empty.
- A missing boolean permission is not a grant. For guarded actions such as
  auto-apply, the action is allowed only when WorkContract and policy explicitly
  allow it and no layer denies it.

Examples:

- If user-global policy allows `claude-code` and `codex`, but project policy
  allows only `codex`, the allowed connector set is `codex`.
- If any layer denies provider `custom`, provider `custom` is denied.
- If WorkContract caps a step at three attempts and project policy caps it at
  two, the runtime cap is two.
- If project policy sets `auto_apply: false`, an invocation override cannot turn
  auto-apply on.
- If either project policy or WorkContract requires a checkpoint for
  `src/runtime/**`, touching that path requires a checkpoint.

When constraints conflict so no allowed option remains, GuidanceDecision should
route to a declared checkpoint, escalation, stop, or contract-missing path. It
must not silently pick the closest option.

## Preferences, Defaults, And Overrides

Preferences and defaults are not hard constraints.

Use this source order only for non-hard inputs:

```text
built-in default < user-global < project < flow/work kind < stage/step hint < invocation
```

`built-in`, `user-global`, `project`, and `invocation` are PolicyLayer sources.
`flow/work kind` and `stage/step hint` are WorkContract or flow-authored
guidance seeds, not PolicyLayer sources.

Rules:

- A later preference may outrank an earlier preference only inside the hard
  constraint set.
- Preference ranking is deterministic: first remove options blocked by rules or
  limits, then score the remaining options by the source order above, then use a
  stable built-in tie-breaker if scores are equal. The tie-breaker must be
  documented in the guidance spec and referenced in `rejected_options` when it
  matters.
- Invocation overrides may express what the operator wants for this run, but
  they cannot loosen a hard project, contract, or system constraint.
- If an operator really needs to loosen a hard constraint, that is a separate
  policy-change event, not an ordinary invocation override. The exact event name
  is unsettled.
- Defaults apply only when no rule or preference gives guidance.
- Every material use of a preference, default, or override must appear in
  `GuidanceDecision.policy_refs` or `GuidanceDecision.constraint_refs`.

## Field Projection

### Current Config Fields

| Current field | V2 fate | Rule |
| --- | --- | --- |
| `schema_version: 1` | Deleted from runtime | Runtime v2 parser rejects it. Migration helpers may parse it only under an explicit migration command or test. |
| `host` | Keep / defer | Host presentation settings are not relay authority. Keep them separate from worker choice until a host policy spec exists. |
| `relay.default` | Default or preference | May seed fallback connector preference. It cannot choose the connector without GuidanceDecision. |
| `relay.roles` | Preference or hard rule | May express role-level connector preference, or a hard allow/require rule if v2 says so explicitly. It cannot be final connector authority. |
| `relay.circuits` | Replace | Flow-id connector routing is old choose-by-flow shape. Migrate only to work-kind or flow-specific preference if still needed; never as final authority. |
| `relay.connectors` | Keep as registry | Custom connector definitions remain useful, but registration does not grant permission to use them. Rules decide whether a connector is allowed for a role or write. |
| `skills.bindings` | Guidance input | Binds skill slots to concrete local skills. Guidance still records selected skills before relay. |
| `circuits.<flow>.selection` | Guidance input only | May seed preferences for model, effort, skills, depth, or connector options. It cannot be final authority. |
| `circuits.<flow>.skill_bindings` | Guidance input | Flow-specific slot binding can rank or fill skill choices. Guidance records the final skill set. |
| `circuits.<flow>.variant_models` | Defer / replace | Prototype comparison options may become branch options under fanout policy. They cannot directly select branch connector/model/effort. |
| `defaults.selection` | Defaults / preferences | May migrate into global defaults or preferences. It cannot become final relay selection. |
| `LayeredConfig.layer` | Keep as source ref | Useful provenance for policy refs. Hard constraints still compose restrictively regardless of source order. |
| `LayeredConfig.source_path` | Keep as source ref | Use in `GuidanceDecision.policy_refs`; file-backed policy refs need hashes per GuidanceDecision spec. |

### Current Selection Fields

| Current field | V2 fate | Rule |
| --- | --- | --- |
| `SelectionOverride.model` | Preference / request | Use as a model preference unless represented under hard allow/deny model rules. |
| `SelectionOverride.effort` | Preference / request | Use as provider effort preference. Hard caps belong under limits, such as `max_effort`. |
| `SelectionOverride.skills` | Preference / request | Use as skill preference or slot-fill input. Skill activation still requires GuidanceDecision and `skills.loaded` evidence. |
| `SelectionOverride.depth` | Split / replace | Flow depth remains a flow-axis concern. Relay model effort is guidance-owned. Do not use selection depth as final relay authority. |
| `SelectionOverride.invocation_options` | Connector option input | Allowed only for the selected connector and only inside policy rules. It cannot smuggle model, effort, connector, write, or proof changes. |
| `ResolvedSelection` | Replace as authority | May appear only as nested selected data or migration evidence. |
| `SelectionResolution.applied` | Reuse as provenance | The provenance rigor is useful. The authority center moves to GuidanceDecision. |

### Current Budget And Limit Fields

| Current input | V2 fate | Rule |
| --- | --- | --- |
| Step `budgets.max_attempts` | Contract hard cap | WorkContract owns the cap. Policy may only tighten it. |
| Step `budgets.wall_clock_ms` | Contract hard cap | WorkContract owns the cap. Policy may only tighten it. |
| Flow axes such as `allowed_rigors`, tournament support, and autonomous support | Contract / flow support | Flow says which entry options exist. Policy can narrow options or lower branch count. |
| Config v1 | No budget fields today | V2 introduces policy `limits` for attempts, time, effort, branch count, and similar caps. |
| Invocation flags | Request / cap input | Invocation may request a stricter limit or supported flow option. It cannot raise a hard cap. |

### Current Relay Connector Fields

| Current behavior | V2 fate | Rule |
| --- | --- | --- |
| Explicit connector injection | Test/helper or operator input | Must be validated by policy and recorded in GuidanceDecision. It cannot bypass rules. |
| `relay.roles` beats flow/default | Preference ranking only | Role preference can rank allowed connectors. It cannot skip policy or contract checks. |
| `relay.circuits` beats default | Replace | Flow-id routing cannot be final connector authority. |
| `relay.default` beats auto | Default only | Default connector fills a gap when guidance has no better preference. |
| Auto fallback to `claude-code` | Default only | Auto fallback is a default, not authority. It must still be recorded and validated. |
| Connector capability check | Keep as hard rule | Read-only connectors cannot run implementer relays. Provider/effort compatibility remains a hard validation. |

### Current Invocation Flags

| Current input | V2 fate | Rule |
| --- | --- | --- |
| `--rigor` | Request / flow-axis input | May influence proof profile, flow depth, or care level inside flow support. It does not directly set provider effort. |
| `--tournament`, `--tournament-n` | Request / limit-checked option | Allowed only if the flow and policy permit branch fanout. Policy may lower max branch count. |
| `--autonomous` | Replace as product language | Treat as a request to use declared defaults where allowed. It cannot cross a checkpoint without policy, WorkContract, and GuidanceDecision. |
| `--include-untracked-content` | Evidence-policy request | May be allowed only inside privacy/source rules. It cannot override a project rule that forbids sending untracked content. |
| `--flow-root`, `--fixture`, `--run-folder` | Runtime source/path inputs | Not PolicyEnvelope authority. Keep them under runtime-source and run-folder rules. |

## Proposed Rule Groups

This is a starter shape for implementation specs. Field names can change during
schema work, but the authority split should not.

```yaml
schema_version: 2

policy:
  rules:
    connectors:
      allow: ["claude-code", "codex"]
      deny: []
      deny_for_write:
        - "custom:*"

    models:
      deny_providers: ["custom"]
      require_provider_for_connector:
        claude-code: anthropic
        codex: openai
        cursor-agent: gemini

    writes:
      auto_apply: false
      require_checkpoint_globs:
        - "src/runtime/**"
        - "scripts/release/**"

    skills:
      deny: []
      require_known: true

    proof:
      require_independent_review_for:
        - "runtime"
        - "generated-surfaces"

  limits:
    max_attempts_per_step: 3
    max_wall_clock_ms: 900000
    max_effort: high
    max_tournament_n: 3

  preferences:
    relay:
      reviewer:
        prefer_connector: codex
      implementer:
        prefer_connector: claude-code

    effort_by_risk:
      low: low
      medium: medium
      high: high

  defaults:
    connector: claude-code
    proof_profile: standard
```

Important details:

- `rules` and `limits` are hard.
- `preferences` rank allowed options.
- `defaults` fill blanks.
- `overrides` may be represented as an invocation layer or attached run input,
  but they cannot loosen hard rules.
- Connector registry entries need a home in v2, likely under
  `policy.connectors.registry` or a sibling `connectors` object. That exact
  storage shape is unsettled.

## Runtime Cutover

The v2 runtime path must do this:

```text
load PolicyEnvelope layers
-> compose hard rules restrictively
-> collect preferences/defaults/overrides as guidance inputs
-> GuidanceDecision selects allowed connector/model/effort/skills
-> relay/checkpoint/proof/recovery/safe-apply action matches GuidanceDecision
```

It must not do this:

```text
load config v1
-> deriveResolvedSelection
-> resolveConnectorForRelay
-> relay starts
```

Old resolver functions can remain temporarily if wrapped behind guidance and
marked as migration/internal helpers. They must not be callable from the relay
executor as the final decision path.

## Death Tests

Schema tests:

- `PolicyEnvelopeV2` accepts `schema_version: 2` and rejects missing
  `schema_version`.
- Runtime policy parser rejects `schema_version: 1`.
- Runtime policy parser rejects v1 fields at their old locations:
  `relay.default`, `relay.roles`, `relay.circuits`,
  `circuits.<flow>.selection`, `circuits.<flow>.skill_bindings`,
  `defaults.selection`, `skills.bindings`, and
  `circuits.<flow>.variant_models[*].selection`.
- Policy parser rejects a hard rule that is shaped like a preference, such as
  `rules.connectors.prefer_connector`.
- Policy parser rejects a preference that claims hard permission, such as
  `preferences.writes.auto_apply: true`.
- Policy parser rejects connector `invocation_options` that try to smuggle
  connector, model, effort, skill, write, proof, checkpoint, recovery, or
  safe-apply authority.
- Policy parser rejects unknown connector references unless the connector is in
  the v2 connector registry.
- Policy parser rejects connector registry entries that use reserved built-in
  names, preserving the current reserved-name discipline.
- Runtime code cannot import the v1 `Config` parser outside migration helpers,
  tests, or clearly marked compatibility probes.

Composition tests:

- Allowed connector sets compose by intersection.
- Denied connector/model/provider sets compose by union.
- Max attempts, wall clock, tournament count, and effort caps compose by the
  smallest cap.
- Required checkpoint globs compose by union.
- Independent review requirements compose by union.
- `auto_apply: false` in any hard layer blocks an invocation override that asks
  for auto-apply.
- Project policy denying provider `custom` blocks a user-global preference for a
  custom model.
- WorkContract budget caps and PolicyEnvelope budget caps compose by the
  smaller cap.

Runtime tests:

- Relay executor cannot start from `deriveResolvedSelection` alone.
- Relay executor cannot use `resolveConnectorForRelay` as a final decision path.
- Relay executor cannot start unless the matching `guidance.decision` carries
  non-empty `policy_refs` and `constraint_refs`.
- `ResolvedSelection` cannot be emitted directly as final relay authority
  outside `GuidanceDecision.selected`.
- Role connector preference does not bypass a hard deny rule.
- Flow connector preference does not bypass a hard deny rule.
- Invocation override cannot loosen a hard project rule without an explicit
  policy-change event.
- Explicit test relayer or connector injection still produces a
  GuidanceDecision and passes connector/model/effort compatibility checks.
- Memory refs cannot loosen hard policy or replace `policy_refs`.

Trace tests:

- Every relay `guidance.decision` has policy refs for the policy layers that
  bounded connector/model/effort/skill selection.
- Rejected connector/model/skill options are recorded when a hard rule blocks a
  preference or override.
- If no allowed connector remains, the trace records a declared checkpoint,
  stop, escalation, or contract-missing route instead of a relay start.

Generated-surface and docs tests:

- Public config docs stop teaching `schema_version: 1` as the active runtime
  config after cutover.
- Public docs describe PolicyEnvelope as rules, limits, preferences, and
  defaults, not as a model router.
- Generated host surfaces do not tell operators to choose model/effort/skills
  manually as the normal path.
- Generated mirrors stay byte-for-byte drift checked after any config wording
  changes.

Probe commands for the implementation branch:

```bash
rg -n "Config\\.parse\\(\\{\\s*schema_version:\\s*1|LayeredConfig\\.parse|deriveResolvedSelection|resolveSelectionForRelay|resolveConnectorForRelay" src tests
rg -n "relay\\.circuits|circuits\\..*selection|defaults\\.selection|variant_models.*selection|ResolvedSelection|SelectionOverride" src docs tests plugins
rg -n "schema_version:\\s*1" docs/configuration.md docs/contracts/config.md src/schemas/config.ts tests/contracts/config-schema.test.ts
```

The first two probes should become allow-list driven after the cutover. The
third probe should target config runtime paths only, because many non-config
schemas legitimately remain at version 1.

## Implementation Order

1. Add the PolicyEnvelope v2 schema and hard-constraint composition tests.
2. Add a migration-only adapter that can read config v1 and produce policy
   inputs for comparison tests. Keep it out of runtime execution.
3. Update guidance to consume policy rules, limits, preferences, defaults, and
   overrides.
4. Move relay connector/model/effort/skill choice behind GuidanceDecision.
5. Make runtime config loading reject v1 in the execution path.
6. Update config docs and generated host wording through source files and emit
   scripts.
7. Turn anti-cruft probes into release checks.

Do not implement the full proof model, SafeApply, or memory behavior in this
slice.

## Still Unsettled

- Exact v2 schema names under `policy.rules`, `policy.limits`,
  `policy.preferences`, and `policy.defaults`.
- Exact storage location for custom connector registry entries.
- Whether flow-specific preferences remain keyed by flow id or move fully to
  work kind / risk / role.
- How Prototype `variant_models` migrate without keeping branch model choice as
  old authority.
- Exact policy-change event for operator-authorized loosening of a hard rule.
- How `--rigor` maps to proof profile once ProofAssessment exists.
- Whether host config stays inside PolicyEnvelope or remains a separate host
  settings surface.
- Whether v1 config migration is a CLI command, docs-only guide, or temporary
  branch helper.

## Review Record

First pass found three medium risks:

- old `relay.default`, `relay.roles`, `skills.bindings`, and
  `circuits.<flow>.skill_bindings` were not explicit enough in death tests;
- flow/work-kind and stage/step hints could be mistaken for PolicyLayer sources;
- hard-constraint composition did not define what missing constraints mean.

The spec now names the old authority fields in death tests, separates
PolicyLayer sources from flow-authored guidance seeds, defines deterministic
preference ranking, and gives explicit identities for missing constraints.

Two clean review passes after those fixes found no medium-or-above findings.
Remaining issues are named as unsettled items.
