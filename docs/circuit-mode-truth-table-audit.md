# Circuit Mode Truth Table Audit

Status: schema-validation audit  
Date: 2026-04-17  
Purpose: resolve the current rigor/mode behavior before encoding v3 mode deltas.

Post-audit cleanup note: this audit drove targeted updates to
`ARCHITECTURE.md`, `docs/workflow-matrix.md`, and
`skills/run/references/rigor-profiles.md`, plus the explicit decision log in
`docs/circuit-schema-product-decisions.md`. The findings below preserve the
evidence that motivated those changes.

## Verdict

Do not encode `modes.skip_phases`, `modes.add_work_units`, or checkpoint
auto-resolution rules in a v3 schema yet.

The current repo has enough mode drift that a schema would freeze
contradictions:

- Build has moved to a fixed graph where Review still runs in Lite, but
  `docs/workflow-matrix.md` and `skills/run/references/rigor-profiles.md` still
  describe the older "Lite skips Review" rule.
- `ARCHITECTURE.md` says Build does not do a same-run Build -> Explore
  transfer; `docs/workflow-matrix.md` still describes same-run workflow
  transfers.
- Migrate Autonomous is inconsistent: the manifest and workflow matrix say the
  coexistence-plan checkpoint is excepted from auto-resolution, while
  `skills/migrate/SKILL.md` allows auto-resolving it when the plan is concrete
  and reuses an established coexistence pattern.
- Explore Tournament dispatch counts are inconsistent: the profile reference
  says about seven dispatch steps, while the Explore skill describes four
  parallel rounds of three workers each, plus orchestrator convergence and
  pre-mortem.
- Runtime checkpoint integration is uneven. Build uses `request-checkpoint` and
  `resolve-checkpoint` commands explicitly; several other workflow skills still
  describe checkpoint behavior mostly as prose plus `active-run.md` updates.

Before the schema owns mode behavior, Circuit needs a per-workflow truth table
that names phases run, dispatch patterns, checkpoints, review behavior, and stop
conditions for every supported mode.

## Source Priority

For this audit, the source priority is:

1. Current `skills/<workflow>/SKILL.md` execution contract.
2. Current `skills/<workflow>/circuit.yaml` entry-mode availability and maximum
   topology.
3. `ARCHITECTURE.md` where it describes current runtime architecture.
4. `docs/workflow-matrix.md` and `skills/run/references/rigor-profiles.md` as
   public/reference docs, but not authoritative when they contradict current
   workflow skills.

This priority follows the existing architecture contract: the manifest owns
machine topology, and the skill owns the execution contract. It also reflects
that Build is the most recently hardened runtime path.

## Current Engine Fact

All current workflow entry modes start at `frame`.

| Workflow | Modes In Manifest | Engine Start Behavior |
|----------|-------------------|-----------------------|
| Explore | default, lite, deep, tournament, autonomous | all start at `frame` |
| Build | default, lite, deep, autonomous | all start at `frame` |
| Repair | default, lite, deep, autonomous | all start at `frame` |
| Migrate | default, deep, autonomous | all start at `frame`; no Lite mode |
| Sweep | default, lite, deep, autonomous | all start at `frame` |

The runtime engine currently reads `entry_mode.start_at`. It does not
mechanically enforce per-mode skipped phases, added work units, checkpoint
policy, dispatch pattern changes, or review behavior.

## Explore Truth Table

| Mode | Phases | Dispatch Pattern | Checkpoints | Review Behavior | Stop / Handoff |
|------|--------|------------------|-------------|-----------------|----------------|
| Lite | Frame -> Analyze -> Decide/Plan -> Close | Analyze inline; no external research | Frame is a manifest checkpoint, but skill prose does not use the semantic checkpoint commands | No Review phase; self-contained analysis/plan | Close with findings/next steps or plan for Build |
| Standard | Frame -> Analyze -> Decide/Plan -> Close | Two evidence workers: external research and internal analysis | Consequential decisions may take one user checkpoint; not modeled as a manifest step beyond Frame | No formal Review phase; decision may include critique pass | Close with plan or decision |
| Deep | Standard plus seam proof after Plan/Decision | Standard evidence fanout plus one seam-proof worker | Optional tradeoff/scope checkpoint by prose | Seam proof is proof/review-like but not a Review phase | Continue, adjust plan, or escalate on invalidated design |
| Tournament | Standard evidence first; Tournament happens inside Decide | Diverge 3, adversarial review 3, revise 3, stress-test 3, then orchestrator converge/pre-mortem | One tradeoff checkpoint after convergence; explicitly not a separate manifest gate | Review is embedded in adversarial/stress-test rounds | Decision artifact or escalation if proposals fail |
| Autonomous | Same as Standard | Same as Standard | Checkpoints auto-resolve; ambiguous findings carried forward | No formal Review phase | Analysis/plan completes; ambiguous findings are labeled instead of blocking |

Explore schema implication:

- A v3 definition should model Tournament as a bounded `tournament` work pattern,
  but the actual child rounds should be receipt-visible first, not
  runtime-core-visible.
- The Tournament dispatch-count contradiction in the profile reference should
  be fixed before budgets are schema-owned.

## Build Truth Table

| Mode | Phases | Dispatch Pattern | Checkpoints | Review Behavior | Stop / Handoff |
|------|--------|------------------|-------------|-----------------|----------------|
| Lite | Frame -> Plan -> Act -> Verify -> Review -> Close | Act always dispatches through `workers`; Review dispatches direct reviewer | Frame request is created; Lite auto-resolves continue | Review runs, including Lite, per current Build SKILL and manifest description | Complete through fixed graph; no same-run Explore transfer |
| Standard | Frame -> Plan -> Act -> Verify -> Review -> Close | Act via `workers`; Review direct fresh-context reviewer | Frame auto-resolves unless ambiguity/irreversibility requires user handling | Review runs | Complete or loop on review findings |
| Deep | Frame -> Plan -> Act -> Verify -> Review -> Close | Same as Standard; seam proof folded into Plan | Frame waits for explicit user confirmation | Review runs | If architecture uncertainty appears, stop and tell user to restart via Explore |
| Autonomous | Frame -> Plan -> Act -> Verify -> Review -> Close | Same as Standard | Frame auto-resolves | Review runs | Complete or circuit-breaker escalation |

Build contradictions to fix:

- `docs/workflow-matrix.md` says Build Lite skips Review.
- `skills/run/references/rigor-profiles.md` says Lite skips Review and Build
  Lite can escalate by adding Review.
- `ARCHITECTURE.md` has two conflicting remnants: the newer fixed-graph section
  says no Lite skip-review path, while the later Entry Modes example still says
  the old Build SKILL skipped Review.
- `docs/workflow-matrix.md` still describes same-run workflow transfer, while
  the newer Build architecture says stop and restart via Explore.

Build schema implication:

- Do not use generic Lite behavior to infer phase skipping. Build needs a
  workflow-specific mode table.
- If v3 has mode deltas, Build Lite should not set `skip_phases: [review]`.

## Repair Truth Table

| Mode | Phases | Dispatch Pattern | Checkpoints | Review Behavior | Stop / Handoff |
|------|--------|------------------|-------------|-----------------|----------------|
| Lite | Frame -> Analyze -> Fix -> Verify -> Close | Fix may be inline or single worker; no `workers` loop required | Frame is a manifest checkpoint, but skill prose does not use semantic checkpoint commands | Review skipped | Escalate after 3 repro variations/hypotheses without root cause |
| Standard | Frame -> Analyze -> Fix -> Verify -> Review -> Close | Fix via `workers` implement-review-converge | Prose-owned checkpoint behavior | Independent review runs | Escalate after bounded hypotheses, worker limits, or critical review loop |
| Deep | Frame -> Analyze -> Fix -> Verify -> Review -> Close | Analyze adds parallel evidence probes; Fix via workers | Prose-owned checkpoint behavior | Independent review runs | Broader search, max 5 hypotheses, then escalate |
| Autonomous | Frame -> Analyze -> Fix -> Verify -> Review -> Close | Standard behavior | Auto-resolved checkpoints by prose | Independent review runs | Escalates on no-repro after bounded search |

Repair schema implication:

- Analyze is conditionally mutating under the Diagnostic Path. A single
  `mutation: read_only` or `mutation: safe_edit` mode field would be misleading.
- v3 should support conditional safety notes or keep Diagnostic Path behavior in
  prose until runtime can enforce it.

## Migrate Truth Table

| Mode | Phases | Dispatch Pattern | Checkpoints | Review Behavior | Stop / Handoff |
|------|--------|------------------|-------------|-----------------|----------------|
| Standard | Frame -> Inventory -> Plan -> Execute -> Verify -> Review -> Close | Inventory two-worker fanout; Execute batches via `workers`; Verify worker; Cutover Review worker | Coexistence plan checkpoint | Cutover Review runs | Reroute to Plan on `coexistence_invalidated`; retry Review max 2 |
| Deep | Same maximum topology | Same as Standard; direct invocation defaults to Deep | Manifest says "steering checkpoints," but skill mainly specifies coexistence plan checkpoint | Cutover Review runs | Same safety gates; stronger posture is under-specified |
| Autonomous | Same maximum topology | Same as Standard | Skill allows auto-resolve of plan checkpoint when concrete and established; docs/manifest say coexistence checkpoint is excepted | Cutover Review runs | Hold for human review on novel/hand-wavy coexistence; halt on critical safety gaps |

Migrate contradictions to fix:

- Direct `/circuit:migrate` defaults to Deep in public docs/skill, but the
  manifest still has a `default` entry mode that means Standard. That can be
  valid, but the command/default distinction must be explicit in any v3 schema.
- Deep's "steering checkpoints" are not enumerated as distinct behavior beyond
  the coexistence plan checkpoint.
- Autonomous coexistence-plan behavior conflicts between manifest/reference docs
  and the skill.

Migrate schema implication:

- v3 must distinguish "mode id named default" from "public direct invocation
  default." They are not necessarily the same.
- Checkpoint policy needs named evidence criteria if it is going to be
  machine-owned.

## Sweep Truth Table

| Mode | Phases | Dispatch Pattern | Checkpoints | Review Behavior | Stop / Handoff |
|------|--------|------------------|-------------|-----------------|----------------|
| Lite | Frame -> Survey -> Triage -> Execute -> Verify -> Deferred -> Close | Survey is inline/short high-confidence scan; Execute may still use workers for eligible batches | Prose-owned; quick path avoids high-risk work | `review.md` is produced during Verify, not a separate Review phase | Defer ambiguous items; close with verification |
| Standard | Frame -> Survey -> Triage -> Execute -> Verify -> Deferred -> Close | Survey fanout by category; PROVE items get evidence adjudication; Execute sequential workers batches | Pause before high-risk/prove batches | Independent audit during Verify writes `review.md` | Retry batches up to 3; reverted/deferred items go to deferred.md |
| Deep | Same maximum topology | Standard plus stronger PROVE adjudication and false-positive aversion | Confirm every batch | Independent audit during Verify | Defer rather than risky removal |
| Autonomous | Same maximum topology | Sequential execution; max 3 batches or time budget; injection check | No pause; auto-approve by triage table | Independent audit plus injection check during Verify | Stop after cap; critical injections halt; deferred decision log |

Sweep schema implication:

- Generic "Lite skips Review" does not map cleanly to Sweep because Sweep has
  no separate Review phase and still writes `review.md` during Verify.
- Survey fanout and execute batches are runtime-derived patterns, not static
  concrete work units.

## Cross-Workflow Contradictions

| Issue | Current Evidence | Recommended Resolution |
|-------|------------------|------------------------|
| Build Lite Review | Build SKILL and Build manifest say Review runs; workflow matrix and rigor profile say Lite skips Review | Treat Build SKILL/manifest as current truth; update workflow matrix, generic rigor profile, and stale Architecture example |
| Build -> Explore transfer | Newer Architecture says stop and restart via Explore; workflow matrix says same-run transfer | Treat runtime Architecture as current truth until a ledger-backed transfer event exists |
| Migrate Autonomous checkpoint | Manifest/docs say coexistence checkpoint is excepted; skill allows evidence-gated auto-continue | Decide explicitly: either never auto-resolve coexistence, or encode the skill's criteria as policy with receipt evidence |
| Migrate Deep steering | Manifest says steering checkpoints; skill does not enumerate extra Deep checkpoints | Either define the extra checkpoints or downgrade description to "Deep posture, same topology" |
| Explore Tournament budget | Profile reference says about 7 dispatches; Explore skill describes 12 child dispatches plus synthesis | Count rounds and units separately; budgets must name both `rounds` and `max_child_dispatches` |
| Generic Lite | Generic profile says no independent review and skipped Review; Build and Sweep override that | Make generic profiles defaults only; per-workflow mode tables override them |
| Runtime checkpoint commands | Build uses semantic checkpoint commands; other workflows often use prose/manual active-run updates | Mark semantic checkpoint integration status per workflow before schema ownership |

## V3 Schema Implications

Mode behavior should be per workflow, not inherited blindly from generic rigor.

A future v3 mode block should avoid broad global claims like:

```yaml
lite:
  skip_phases: [review]
```

It should instead express mode deltas against named phases or work patterns:

```yaml
modes:
  lite:
    phase_overrides:
      survey:
        work_pattern: inline_scan
        evidence_floor: high_confidence_only
      review:
        behavior: run
        note: "Build keeps review even in Lite."
    checkpoint_policy:
      frame: auto_continue
```

Every mode-owned fact needs an enforcement class:

- `runtime_enforced`: runtime can refuse advancement
- `resolver_enforced`: dispatch/prompt resolver can refuse launch
- `adapter_enforced`: child adapter owns enforcement and receipts result
- `receipt_audited`: recorded, not blocking
- `prompt_guidance`: instruction only
- `prose_only`: intentionally remains in `SKILL.md`

## Required Cleanup Before V3 Mode Encoding

1. Update `docs/workflow-matrix.md` so Build Lite Review behavior matches the
   current Build SKILL and manifest.
2. Update `skills/run/references/rigor-profiles.md` to say generic profile
   behavior is a default vocabulary, overridden by workflow-specific mode
   contracts. Remove or qualify "Build Lite adds Review on escalation."
3. Update the stale Entry Modes example in `ARCHITECTURE.md` that still says
   the Build SKILL skips Review at Lite.
4. Resolve Build -> Explore transfer: either restore same-run transfer with
   ledger-backed runtime support, or update `docs/workflow-matrix.md` to match
   the newer "stop and restart via Explore" rule.
5. Resolve Migrate Autonomous coexistence checkpoint policy. The schema cannot
   own both "except coexistence plan" and "auto-resolve if established pattern."
6. Clarify Migrate Deep steering checkpoints or remove the implication that
   Deep adds extra checkpoint topology.
7. Correct Explore Tournament budget language so it distinguishes dispatch
   rounds from child worker count.
8. Add a workflow-by-mode truth table as the canonical review target before
   adding v3 `modes` fields.

## Recommended Source-Of-Truth Shape

Short term:

- Keep `entry_modes` as availability, start mode, and human description only.
- Treat per-workflow `SKILL.md` as execution truth for mode behavior.
- Treat generic rigor profiles as advisory defaults, not phase-skipping law.
- Add this audit as the checklist for doc/schema cleanup.

V3 proof:

- Add mode behavior only to the experimental v3 definition fixture.
- Generate a human mode truth table from that fixture.
- Compare generated table against this audit before changing runtime behavior.
- Do not let runtime-core consume v3 mode fields until generated v2 manifests
  and receipts prove the behavior without event-schema changes.

## Bottom Line

The mode layer is the riskiest part of the proposed schema because it looks
simple but encodes product promises: review depth, human checkpoints,
Autonomous authority, batch caps, and safety stops.

Current Circuit has useful mode behavior, but it is not clean enough to compile
yet. Fix the source-of-truth contradictions first, then prove v3 mode fields in
a Sweep or Build fixture before making them part of the default authoring
schema.
