# Architecture Exploration: Model And Effort Selection For Circuit Steps

## Goal

Allow Circuit workflows to express what model and/or effort level should be used
for a given step, while preserving adapter portability across Claude Code, Codex,
Cursor Agent, and custom process adapters.

The secondary goal is bounded dynamic selection: Circuit should be able to pick a
more or less capable model/effort profile from context when the workflow allows
it, without turning model choice into untraceable magic.

## Problem

Circuit currently routes worker dispatch by adapter, role, and circuit. That is
enough to choose "Codex vs Claude Code Agent vs custom wrapper", but it does not
express the compute shape of a step.

This makes several useful cases awkward:

- run cheap models for low-risk surveys or formatting checks
- force high-effort models for architecture decisions, migrations, and reviews
- let a later retry or large diff escalate from standard to high
- use Cursor Agent model IDs when Cursor has the best model for the work
- preserve reproducibility when a run selected a model dynamically

The design tension is that "model" and "effort" are not uniform concepts across
tools:

- Claude Code has separate `--model` and `--effort` CLI flags, but Circuit's
  current built-in `agent` adapter returns an in-process Agent receipt rather
  than launching `claude -p`.
- Codex has `--model` and accepts config overrides such as
  `model_reasoning_effort`, but Circuit intentionally launches Codex in an
  isolated `CODEX_HOME`.
- Cursor Agent exposes `--model`, but effort is encoded in model IDs such as
  `gpt-5.4-high`, `gpt-5.4-xhigh`, or thinking model variants. It does not expose
  a separate `--effort` flag in the local CLI.
- Custom adapters can already bake any flags into wrapper argv arrays, but
  Circuit cannot reason about those flags.

## Invariants

- Workflow manifests should remain adapter-agnostic unless a workflow truly
  requires a provider-specific capability.
- Runtime core events should not be polluted with transport-specific fields.
  Existing runtime architecture explicitly keeps adapter name, command argv,
  fallback details, and diagnostics outside canonical worker events.
- Model selection must be observable for debugging and cost review.
- User and project config must be able to override shipped defaults.
- Existing `dispatch.roles`, `dispatch.circuits`, and `dispatch.default`
  semantics should continue to work.
- Static custom wrappers must remain supported.
- Dynamic selection must be bounded by an explicit policy. It should not silently
  choose arbitrary premium models.

## Non-Goals

- Replacing Circuit's adapter system.
- Making shipped workflow manifests depend on the user's current paid model
  catalog.
- Forcing all adapters to expose the same flags.
- Building a full cost optimizer in the first implementation.
- Changing checkpoint/orchestrator synthesis behavior in the first slice.
  This exploration is mainly about worker dispatch, though the same policy
  vocabulary could later apply to orchestrator-launched subprocesses.

## Constraints

- `schemas/circuit-manifest.schema.json` is strict:
  `additionalProperties: false` on steps. Any step-level field must be added to
  the schema and tests.
- Step manifests currently include `id`, `title`, `executor`, `kind`, `protocol`,
  `reads`, `writes`, `gate`, `routes`, optional `budgets`, optional
  `capabilities`, and optional checkpoint metadata.
- `scripts/runtime/engine/src/dispatch.ts` currently resolves only adapter,
  command argv, runtime boundary, and transport.
- `scripts/runtime/engine/src/cli/dispatch.ts` accepts only `--prompt`,
  `--output`, `--adapter`, `--circuit`, `--config`, and `--role`. `--step` is
  explicitly rejected.
- Built-in Codex dispatch currently runs:
  `codex exec --full-auto --ephemeral -C WORKSPACE -o OUTPUT -`
- Circuit's isolated Codex runtime writes its own `config.toml` and does not
  inherit ambient project-local Codex config.
- Custom adapters are static argv arrays under
  `dispatch.adapters.<name>.command`; Circuit appends `PROMPT_FILE OUTPUT_FILE`.
- The Agent adapter currently returns a structured receipt:
  `agent_params.description`, `agent_params.isolation`, `agent_params.output_path`,
  and `agent_params.prompt`.
- Plugin file changes under `hooks/`, `skills/`, `scripts/`, or
  `.claude-plugin/` require `./scripts/sync-to-cache.sh` before use in Claude
  Code.

## External Surfaces

- `skills/*/circuit.yaml`
- `schemas/circuit-manifest.schema.json`
- `circuit.config.yaml` and `~/.claude/circuit.config.yaml`
- `.circuit/bin/compose-prompt`
- `.circuit/bin/dispatch`
- `scripts/runtime/engine/src/dispatch.ts`
- `scripts/runtime/engine/src/codex-runtime.ts`
- adapter receipts and diagnostics files
- dispatch request/receipt/result files under run roots
- README, `ARCHITECTURE.md`, and generated surface manifests

## Current System

| Area | Current Owner | Inputs | Outputs | Dependencies | Pain |
|------|---------------|--------|---------|--------------|------|
| Step topology | `skills/*/circuit.yaml` | Workflow author intent | Strict manifest steps | Manifest schema | No field for model, effort, or compute intent |
| Manifest validation | `schemas/circuit-manifest.schema.json` | YAML manifest | Validated manifest snapshot | Ajv/runtime bootstrap | New fields require explicit schema migration |
| Adapter routing | `dispatch.ts` + config | `--adapter`, role, circuit, default | Resolved adapter and transport | `circuit.config.yaml` | Routes transport, not model/effort |
| Codex adapter | `codex-runtime.ts` | Prompt file, output file, workspace | `codex exec` process plus diagnostics | Codex CLI and isolated `CODEX_HOME` | No per-dispatch model or effort flags |
| Agent adapter | `dispatch.ts` receipt | Prompt file, output file | Structured Agent receipt | Claude Code host Agent tool | Receipt has no model/effort field today |
| Custom process adapters | `dispatch.adapters.*.command` | Static argv + prompt/output paths | Wrapper process result | User wrapper scripts | Can set model statically, but Circuit cannot vary it per step |
| Prompt composition | `compose-prompt.sh` | Header, skills, template | Prompt file | Config skill lookup | Model choice is not part of prompt assembly except ad hoc prose |
| Runtime core | runtime-core docs/types | Manifest, ledger, observed files | Transport-neutral events/state | Worker exchange reader | Correctly keeps adapter metadata out of canonical events |
| Worker loop | `skills/workers/SKILL.md` | Parent circuit and role | Implement/review/converge dispatches | Shared dispatch helper | Uses semantic roles only: implementer/reviewer/researcher |

## Tool Findings

Verified locally on 2026-04-17.

| Tool | Local Evidence | Model Control | Effort Control | Notes |
|------|----------------|---------------|----------------|-------|
| Claude Code `2.1.113` | `claude --help` | `--model <model>` | `--effort <level>` with `low`, `medium`, `high`, `xhigh`, `max` | CLI supports the shape directly. Current Circuit `agent` adapter is not a Claude CLI process, so support inside the in-process Agent receipt is still unproven. `claude agents` lists configured agents with model affinity such as `inherit`, `haiku`, or `sonnet`. |
| Codex CLI `0.118.0` | `codex exec --help` | `-m, --model <MODEL>` | No first-class `--effort` flag in help, but config override exists and local config uses `model_reasoning_effort = "xhigh"` | Circuit can pass `-m` and `-c model_reasoning_effort="high"` to `codex exec`. The isolated runtime currently writes only project trust config, so ambient effort config does not carry through. |
| Cursor Agent `2026.04.14-ee4b43a` | `cursor-agent --help` and `cursor-agent models` | `--model <model>` | Encoded in model IDs, not a separate flag | Local account models include Composer 2, Codex 5.3 low/high/xhigh variants, GPT-5.4 low/medium/high/xhigh variants, Claude Opus/Sonnet thinking variants, Gemini 3.1 Pro, Grok, Kimi, and more. |
| Cursor app CLI `3.1.15` | `cursor --help` | `cursor agent` delegates to Cursor Agent | Same as Cursor Agent | Useful as an alternate entrypoint, but `cursor-agent` is the clearer adapter target. |

## Option 1: Config-Only Adapter Variants

### Architecture Shape

Keep manifests unchanged. Users create named adapter variants in config:

```yaml
dispatch:
  adapters:
    cursor-gpt54-high:
      command:
        - cursor-agent
        - --print
        - --trust
        - --model
        - gpt-5.4-high
    codex-low:
      command:
        - codex
        - exec
        - --full-auto
        - --ephemeral
        - --model
        - gpt-5.4-mini
        - -c
        - model_reasoning_effort="low"
  roles:
    implementer: codex-low
    reviewer: cursor-gpt54-high
```

Dynamic behavior, if any, lives inside wrapper scripts.

### Why It Might Work

- Very small change.
- Uses the current custom adapter contract.
- Avoids manifest schema churn.
- Gives advanced users immediate control.

### Tradeoffs

- Per-step selection is still awkward because current config routes by role or
  circuit, not by step.
- Shipped workflows cannot express compute intent.
- Dynamic selection becomes invisible wrapper behavior.
- Adapter names proliferate.
- Users must know each tool's current model IDs and flags.

### Failure Modes

- A wrapper silently changes model behavior and no run artifact records why.
- Review and implementation both use the same role profile even when their risk
  differs by step.
- Config becomes a pile of provider-specific adapter aliases.

### Disqualifiers

- Wrong if Circuit wants first-class step-level policy.
- Wrong if dynamic selection must be auditable by Circuit itself.

### Cleanup / Migration Implications

- Lowest migration cost.
- Highest long-term cleanup burden if later replaced by first-class policy.

### Unknowns

- Whether users would tolerate static adapter alias naming as the primary UX.
- Whether wrappers can reliably normalize output/report contracts for Cursor
  without first-class adapter support.

## Option 2: Concrete Model And Effort Fields In Step Manifests

### Architecture Shape

Add provider-specific fields directly to each step:

```yaml
steps:
  - id: review
    executor: worker
    kind: dispatch
    model: gpt-5.4
    effort: xhigh
```

Dispatch reads the step, resolves the adapter, and maps `model`/`effort` to
adapter flags.

### Why It Might Work

- Directly answers "what model should this step use?"
- Easy to inspect in `circuit.yaml`.
- Easy to test for built-in Codex because Codex has `--model` plus config
  overrides.

### Tradeoffs

- Couples shipped workflow manifests to current vendor catalogs.
- Poor portability: `gpt-5.4-high` is valid Cursor syntax, `gpt-5.4` plus
  `model_reasoning_effort` is Codex syntax, and Claude uses aliases/full Claude
  model names plus separate effort.
- Forces the manifest schema to understand unstable provider-specific values.
- Encourages workflow authors to overfit to their local account rather than
  expressing task intent.

### Failure Modes

- A built-in workflow pins a model unavailable to a user's account.
- A model name ages out and every shipped manifest needs churn.
- "effort" gets interpreted differently by each adapter.

### Disqualifiers

- Wrong if built-in workflows must remain portable.
- Wrong if model catalogs are expected to change often.

### Cleanup / Migration Implications

- Moderate implementation cost.
- High future churn in manifests and docs.

### Unknowns

- Whether there are any workflows that truly require a concrete provider model.
  If so, those may be better expressed as capabilities rather than defaults.

## Option 3: Logical Compute Profiles With Adapter Bindings

### Architecture Shape

Add a small, adapter-neutral step policy to manifests and/or config. The step
expresses intent, not a provider model:

```yaml
steps:
  - id: review
    executor: worker
    kind: dispatch
    model_policy:
      default_profile: deep-review
      allowed_profiles: [standard, deep-review, max-review]
      dynamic: bounded
```

Config maps logical profiles to concrete adapter settings:

```yaml
model_profiles:
  standard:
    codex:
      model: gpt-5.4
      effort: medium
    claude-cli:
      model: sonnet
      effort: medium
    cursor-agent:
      model: gpt-5.4-medium
  deep-review:
    codex:
      model: gpt-5.4
      effort: xhigh
    claude-cli:
      model: opus
      effort: high
    cursor-agent:
      model: claude-opus-4-7-thinking-high
```

Dispatch resolves:

1. adapter as it does today
2. step policy from manifest plus config overrides
3. concrete model/effort for that adapter
4. final transport args or Agent receipt metadata

The resolved profile, model, effort, source, and reason are recorded in adapter
receipt/diagnostics. Canonical runtime events stay transport-neutral.

### Why It Might Work

- Preserves manifest portability.
- Gives workflow authors a real way to express step compute intent.
- Lets users map the same workflow to Claude, Codex, Cursor, or custom models.
- Supports dynamic selection inside explicit bounds.
- Fits the current architecture: adapter details stay in dispatch, not runtime
  core events.

### Tradeoffs

- Adds a new concept: compute profile.
- Needs schema, config parser, dispatch resolver, docs, and tests.
- Requires a default profile catalog and validation story.
- Cannot fully normalize every provider. Some mappings will be lossy.

### Failure Modes

- Profiles become vague labels with inconsistent meanings.
- Config maps a profile to an unavailable Cursor model.
- Dynamic resolver escalates too often and surprises users with cost.
- Agent receipt metadata is ignored by the host if Claude Code's in-process
  Agent transport cannot accept model/effort.

### Disqualifiers

- Wrong if the product wants exact provider model pinning inside workflow
  manifests as the primary authoring model.
- Wrong if no one wants to maintain a profile-to-adapter mapping.

### Cleanup / Migration Implications

- Moderate migration cost.
- Low cleanup burden because provider-specific details remain in config and
  adapter code.

### Unknowns

- Whether the in-process Claude Code Agent receipt can accept model/effort
  metadata. If not, Claude model control should use a `claude-cli` process
  adapter while the existing `agent` adapter stays `inherit`.
- Best default profile names. `fast`, `standard`, `deep`, and `max` may be too
  generic for review vs implementation.

## Option 4: Dynamic Model Router As A First-Class Runtime Component

### Architecture Shape

Introduce a model router that inspects the current run context before every
dispatch and chooses adapter, model, and effort. Inputs might include:

- workflow id
- step id and role
- rigor profile
- attempt number
- previous worker verdicts
- diff size and file count
- touched language/framework
- explicit user budget/cost preference
- model availability

The router can be rule-based first and later optionally AI-assisted.

### Why It Might Work

- Best long-term automation story.
- Can escalate on retries or high-risk diffs.
- Can prefer cheap models when the task is tiny.
- Can handle rapidly changing provider catalogs through a resolver.

### Tradeoffs

- More operationally complex.
- Harder to test deterministically if AI-assisted.
- Can hide product behavior from users unless receipts and dashboards are very
  clear.
- Risks turning a workflow orchestrator into a cost/model optimizer too early.

### Failure Modes

- Router picks a weak model for a critical review because the context heuristic
  underestimates risk.
- Router picks premium models too often and users lose trust.
- Availability checks make dispatch slower or flaky.
- Run replay cannot explain why a model was selected.

### Disqualifiers

- Wrong as the first implementation if static step policy has not landed.
- Wrong if the team is not ready to own cost and availability heuristics.

### Cleanup / Migration Implications

- High initial implementation cost.
- Medium cleanup burden if built before the profile vocabulary is stable.

### Unknowns

- Which context signals actually predict model need.
- Whether users prefer automatic escalation or explicit profile declarations.

## Tradeoff Matrix

| Dimension | Option 1: Config Variants | Option 2: Concrete Fields | Option 3: Logical Profiles | Option 4: Dynamic Router |
|-----------|---------------------------|----------------------------|-----------------------------|--------------------------|
| Concept Count | Low - reuses adapters | Low-Medium - obvious fields, hidden provider meaning | Medium - adds profile and binding concepts | High - adds router, policy, availability, and receipts |
| Boundary Clarity | Medium - config owns everything | Low - manifests learn provider details | High - manifests own intent, config/adapters own concrete flags | Medium - router becomes a new owner |
| Migration Difficulty | Low | Medium | Medium | High |
| Cleanup Burden | High if later replaced | High model-name churn | Low-Medium | Medium-High |
| Rollback Story | Easy | Medium, schema rollback | Medium, disable profile resolution | Harder, especially if dynamic defaults spread |
| Operability | Medium - wrapper behavior opaque | Medium - easy to see but brittle | High - explicit resolution records | Medium unless heavily instrumented |
| Testability | Medium | Medium | High - resolver can be unit-tested | Medium-Low if AI-assisted |
| Extensibility | Low | Low-Medium | High | High after complexity is paid |
| Lock-In | Medium through adapter aliases | High through manifest model pins | Low-Medium through profile mappings | Medium through router logic |

## Assumptions

| Assumption | Why It Matters | How to Verify | Fastest Disproof |
|------------|----------------|---------------|------------------|
| Codex accepts `-c model_reasoning_effort="high"` during `codex exec` | Needed for effort control in built-in Codex adapter | Fake-Codex argv test plus one real dry run with a harmless prompt if cost is acceptable | Codex rejects the config key or ignores it |
| Cursor Agent model IDs are account-scoped and discoverable | Config validation can warn on unavailable model IDs | Parse `cursor-agent models` output and validate configured Cursor IDs | `cursor-agent models` requires interaction or output changes too often |
| Claude CLI supports `--model` and `--effort` reliably | Enables a first-class `claude-cli` process adapter | Help already proves flags; run a low-cost smoke test if needed | CLI rejects a selected alias or effort in print mode |
| Claude Code's in-process Agent receipt can be extended, or can safely remain inherit-only | Determines whether existing `agent` adapter can honor profiles | Build a receipt spike with extra model/effort fields in a controlled plugin run | Host ignores or rejects the fields |
| Logical profiles can cover most workflow intent | This is the core bet of Option 3 | Map all built-in dispatch steps to default profiles without provider names | Many steps require provider-specific concrete model requirements |
| Dynamic selection can be bounded by profile allow-lists | Keeps automation explainable and cost-safe | Unit-test resolver outcomes for large diff, retry, review, and low-risk cases | Real tasks repeatedly need models outside the allowed list |

## Risk Register

| Risk | Option(s) Affected | Likelihood | Impact | Mitigation |
|------|--------------------|------------|--------|------------|
| Provider model IDs churn | 1, 2, 3, 4 | High | Medium | Keep concrete IDs in config, not shipped manifests; validate at dispatch |
| Dynamic selection is not explainable | 4, partial 3 | Medium | High | Record selected profile/model/effort/source/reason in receipt diagnostics |
| Claude Agent transport cannot accept model metadata | 3, 4 | Medium | Medium | Add `claude-cli` process adapter; keep `agent` as inherit-only |
| Runtime events become transport-specific | 2, 4 | Medium | High | Keep model details in request/receipt/diagnostics, not canonical event payloads |
| Cost surprises | 3, 4 | Medium | High | Profile allow-lists, default caps, and visible selected profile in active run/report |
| Config becomes too verbose | 1, 3 | Medium | Medium | Ship default profile mappings and allow sparse overrides |
| Cursor wrapper output does not match worker report contract | 1, 3, 4 | Medium | Medium | First-class Cursor adapter wrapper should normalize stdout and output path |

## Validation Spikes

| Spike | Question Answered | Cost | Success Signal | Failure Signal |
|-------|-------------------|------|----------------|----------------|
| Codex argv/config spike | Can built-in isolated Codex pass model and effort? | Low | Dispatch contract test sees `codex exec -m MODEL -c model_reasoning_effort="LEVEL"` and isolated config remains clean | Codex adapter shape becomes ambiguous or config leaks ambient settings |
| Cursor adapter wrapper spike | Can `cursor-agent --print --model MODEL` satisfy Circuit's prompt/output contract? | Medium | Wrapper writes output file, returns nonzero on failure, and supports configured model IDs | Cursor Agent requires interaction or ignores output redirection needs |
| Claude Agent receipt spike | Can the in-process Agent transport honor model/effort metadata? | Medium | Agent receipt with metadata is accepted and worker uses requested model | Host rejects/ignores metadata, pushing Claude control to a process adapter |
| Profile schema spike | Does `model_policy` fit manifest validation without weakening strictness? | Low | Built-in manifests validate with absent policy and fixtures validate with policy | Schema becomes too permissive or awkward |
| Dynamic resolver fixture spike | Are basic escalation rules deterministic and useful? | Low | Tests cover retry escalation, review deepening, small-task downgrade, and user cap | Rules are too noisy or too provider-specific |
| Audit visibility spike | Where should selected profile appear? | Low | Receipt/diagnostic file and active-run view can show selected profile without changing canonical events | Debugging requires digging into opaque wrapper logs |

## Recommendation

Choose Option 3: logical compute profiles with adapter bindings, plus a bounded
dynamic selector as a later layer inside the same policy model.

Later architecture work refines this into the Bounded Adaptive Profile Stack:
logical profiles remain the deterministic compute-control primitive, and
broader `intent` metadata explains the work shape without replacing explicit
profile floors/defaults/allowed ranges. If schema evolution introduces work
patterns under dispatch steps, apply the same profile policy to those patterns
rather than only to the outer step.

The recommended first shape:

- Add optional step-level `model_policy` with logical profile names.
- Add `model_profiles` to config for concrete adapter mappings.
- Add `dispatch.steps.<circuit>.<step>` config overrides so users can override
  shipped policy without editing manifests.
- Extend dispatch resolution to accept `--step` again, but as a model-policy
  resolution input rather than the removed legacy routing key.
- Record selected profile, model, effort, resolution source, and selection
  reason in the adapter receipt or diagnostics.
- Keep canonical runtime events transport-neutral.
- Implement concrete mappings first for Codex and Cursor Agent. Treat Claude
  Code in two paths:
  - `agent`: inherit-only until a receipt spike proves model/effort metadata
    works.
  - `claude-cli`: process adapter using `claude -p --model --effort` if explicit
    Claude model control is required.

This wins because it matches Circuit's existing separation of concerns:
manifests describe workflow intent, config describes local execution preference,
and adapters translate to provider-specific flags.

## Runner-Up

Option 1 is the pragmatic runner-up. It is good enough if the immediate goal is
"let power users run Cursor or Codex with a pinned model through wrapper
adapters." It loses because it does not give Circuit a durable way to express
per-step intent or bounded dynamic selection.

## Why The Other Options Lose

Option 2 loses because concrete provider model names in shipped manifests would
make workflows brittle and less shareable. It optimizes for obvious YAML at the
cost of long-term portability.

Option 4 loses as the first step because dynamic routing needs a stable policy
vocabulary underneath it. Without logical profiles, the router has to choose
provider-specific models directly, which is harder to test and harder to
explain.

## Decision Needed

The key product decision is whether the first implementation should include only
static `default_profile` resolution, or include bounded dynamic selection in the
same slice.

Recommended decision:

1. Land static logical profiles first.
2. Record enough receipt diagnostics to support future dynamic selection.
3. Add dynamic selection only after the profile vocabulary and adapter mappings
   survive real workflow use.

## Handoff to audit-and-migrate

### Chosen Architecture

Logical compute profiles with adapter-specific bindings in config, plus optional
step-level `model_policy` and future bounded dynamic selection.

### Decision Rationale

This preserves adapter-agnostic manifests, keeps provider-specific details out
of runtime core events, supports Claude/Codex/Cursor differences, and provides a
clean path toward context-aware selection.

### Invariants

- Canonical runtime events remain transport-neutral.
- Concrete provider model IDs live in config or adapter defaults, not as required
  fields in shipped manifests.
- Every resolved model choice is observable in receipt/diagnostics.
- Existing adapter routing continues to work when no model policy is present.

### Non-Goals

- Full cost optimization.
- Provider-specific model pins in built-in workflow manifests.
- Dynamic AI-assisted routing in the first slice.

### Critical Workflows

- `/circuit:run` routes to a workflow and rigor profile.
- Workflow dispatch steps use `.circuit/bin/dispatch --circuit ... --role ...`.
- Worker loop dispatches implementer, reviewer, and convergence prompts.
- Codex isolated adapter launches `codex exec`.
- Custom wrapper adapters receive `PROMPT_FILE OUTPUT_FILE`.

### External Surfaces

- Manifest schema and built-in `skills/*/circuit.yaml`
- `circuit.config.yaml`
- dispatch CLI flags
- adapter receipt JSON shape
- docs: README, ARCHITECTURE, config example
- tests: dispatch contract, schema regression, runtime CLI integration

### Known Hotspots

- `dispatch.ts` currently does adapter resolution and would likely grow profile
  resolution unless split carefully.
- `codex-runtime.ts` builds isolated command argv and config.
- `schemas/circuit-manifest.schema.json` has strict step validation.
- Runtime core docs/tests enforce transport neutrality.
- `compose-prompt.sh` has an unused `--adapter` hint path and should not become
  the source of truth for model selection.

### Leading Migration Risks

- Reintroducing `--step` in dispatch could conflict with the old "no longer
  supported" contract unless clearly repurposed and tested.
- Agent receipt extension may not be supported by Claude Code host.
- Cursor model validation may be brittle if CLI output changes.
- Overloading `capabilities` with compute profiles would blur capability vs
  execution policy.

### Expected Deletion Zones

- None for the first static-profile slice.
- Later, ad hoc wrapper examples that bake model names may be replaced by typed
  profile mappings.
- Any docs that imply adapter selection is the only dispatch policy will need
  revision.

### Validation Spikes Already Run

- Local CLI capability check:
  - Claude Code `2.1.113`: `--model`, `--effort`, `--agent`, `--agents`.
  - Codex CLI `0.118.0`: `--model`, `-c key=value`, local
    `model_reasoning_effort` config key.
  - Cursor Agent `2026.04.14-ee4b43a`: `--model`, `models` catalog command.
- Current-code inspection:
  - dispatch routing is adapter/role/circuit/default only.
  - manifest schema has no model/effort policy.
  - runtime-core docs explicitly keep worker transport details outside canonical
    events.

### What Still Needs Proof

- Whether Claude Code Agent receipt supports model/effort metadata.
- Exact Cursor wrapper contract for reliable output files and non-interactive
  trust/force behavior.
- Preferred profile vocabulary after mapping all built-in dispatch steps.
- Whether selected profile belongs in `active-run.md`, result artifacts, or only
  receipt diagnostics.
