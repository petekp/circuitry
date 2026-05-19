# Circuit-vs-Vanilla Benchmark Design

Status: design-only.

This benchmark is for internal engineering decisions. It is not public
marketing, and early results must not be presented as product claims.

## Purpose

The first pilot compares whether Circuit helps Codex produce better
developer-work artifacts than the same Codex setup used directly. It should
measure useful operator outcomes, not just whether a final answer sounds good.

Do not start this benchmark until the verdict-correctness eval slice is landed:

- Manifest-based source loading works.
- Smoke and subtle suites are split.
- Skips are first-class.
- Control false positives are auditable.
- Zero scored cases render catch rate as `n/a`.
- At least one subtle manifest run has completed, or environment failures are
  clearly isolated as infrastructure failures.

The verdict-correctness subtle suite should now act as a regression guard. Do
not keep tuning it unless a new real failure mode appears.

## Pilot Arms

The initial pilot has two arms only.

| Arm ID | Definition |
| --- | --- |
| `circuit-codex` | Circuit flow run through Codex with normal Circuit plugin behavior. The user task is given as the flow goal. Circuit may use its normal flow selection, prompt decomposition, relay hints, reports, and operator-summary behavior. |
| `vanilla-codex` | Same Codex CLI and model, same repo snapshot, same `AGENTS.md`, same tool permissions, same time budget, and same user task prompt, but no Circuit flow wrapper and no Circuit-generated prompt decomposition. This arm must not invoke `/circuit:*`, `bin/circuit`, or the Circuit plugin runtime. It may inspect files and run ordinary shell/tool commands. |

Claude Code arms are deferred until the Codex-only pilot is stable. The future
Claude comparison should be added as a new design revision, not quietly mixed
into this pilot.

## Equal Conditions

Every arm for a task must use the same:

- Repo commit.
- Task prompt.
- Time budget.
- Sandbox and tool permissions.
- `AGENTS.md` and project instructions.
- Starting working tree state.
- Artifact capture policy.
- Rules for asking clarifying questions.

If any of these differ, the run is not a valid pairwise comparison.

## Held-Out Policy

All task candidates below are held-out candidates. If any task is used to tune
Circuit prompts, tune scorers, debug the runner, or shape the benchmark itself,
move that task to a regression set and replace it with a fresh held-out task.

Keep three buckets separate:

- Smoke and regression tasks: allowed for tuning and ongoing checks.
- Measurement tasks: hard current cases, reviewed regularly.
- Held-out benchmark tasks: frozen and not used for tuning.

## Draft Task Set

These are starting candidates, not a final public benchmark. Before the first
pilot, freeze each prompt and record the repo commit used.

| Task ID | Category | Prompt Stub | Expected Artifact | Deterministic Checks | Human-Review Focus |
| --- | --- | --- | --- | --- | --- |
| `review-generated-surface-drift` | Review / risk detection | Review a proposed flow prompt or relay-hint change. Identify whether generated host surfaces, plugin cache sync, and `docs/generated-surfaces.md` expectations remain consistent. Do not edit files. | Review findings | `node scripts/flows/emit.ts --check` | Catches generated-surface drift, gives concrete file references, avoids overclaiming. |
| `review-release-proof-risk` | Review / risk detection | Review a proposed release-proof change. Identify risks around public claims, proof freshness, and regeneration expectations. Do not edit files. | Review findings | `npm run check-release-infra`, if relevant to the change | Separates real release risk from cleanup noise; keeps public-claim caution explicit. |
| `plan-host-skill-slots` | Implementation planning | Produce an implementation plan for replacing built-in-flow concrete skill IDs with optional capability slots while preserving current user-configured skill bindings. Do not implement. | Plan document or structured prose | None | Respects selection contracts, names migration risks, avoids premature runtime changes. |
| `plan-from-run-context` | Implementation planning | Plan support for a `--from-run <run-folder>` option that lets one flow consume a prior flow output as context, without auto-chaining or silent continuation. Do not implement. | Plan document or structured prose | None | Preserves operator control, identifies trace/report contracts, avoids hidden coupling. |
| `code-generated-surfaces-check` | Small code change | Add a focused check that fails when generated flow surfaces are stale after flow emission. Keep the change narrow and update or add focused tests. | Code and test diff | `node scripts/flows/emit.ts --check`; focused test chosen by the implementer | Minimal diff, useful failure message, no unrelated generated churn. |
| `code-release-proof-index-check` | Small code change | Add or improve a narrow release-proof infrastructure check so stale or misplaced proof-run artifacts are caught. Keep behavior scoped and testable. | Code and test diff | `npm run check-release-infra`; focused test chosen by the implementer | Clear acceptance criteria, low blast radius, no unrelated release-doc rewriting. |
| `decide-compound-engineering-borrowing` | Synthesis / decision | Read the current product docs and `docs/ideas/circuit-vs-compound-engineering.md`. Recommend one borrowing idea to prototype first, and explain why. | Decision memo | None | Grounded tradeoff analysis, realistic sequencing, no marketing tone. |
| `design-operator-summary-eval` | Eval / regression design | Design a small internal eval for operator-summary prose quality using current operator-summary code and docs. Define corpus, rubric, and acceptance criteria only. Do not implement. | Eval design document | None | Small-project appropriate, clear rubric, no LLM-as-judge overbuild, held-out policy preserved. |

## Result Capture

Each run must record:

- `task_id`
- `arm_id`
- repo commit
- model and CLI version
- start time and end time
- wallclock duration
- retries
- errors, grouped by type when possible
- final artifact path
- commands and tests run
- token usage and cost, if available
- `token_usage: unavailable` and `cost: unavailable` when the connector does
  not expose measured values

Do not estimate token or cost fields in result artifacts. Estimates can live in
operator notes, but measured reports must distinguish measured from unavailable.

## Artifact Capture

For every task-arm run, capture:

- The exact task prompt.
- The starting repo commit.
- The final assistant answer.
- Any created or edited files.
- The command log summary.
- Test output summaries.
- Any error messages that affected the run.

For code-change tasks, keep the final diff available for deterministic checks
and human review. For planning, review, synthesis, and eval-design tasks, save
the final artifact as Markdown.

## Scoring V1

Use the cheapest reliable scorer for each question.

Deterministic checks are required when the expected artifact has objective
properties:

- Build, lint, schema, or test commands.
- Required file output.
- JSON or Markdown shape.
- Generated-surface freshness checks.

Final artifact quality is scored by blinded pairwise human review:

- Compare `circuit-codex` and `vanilla-codex` outputs without arm labels.
- Swap output order across review packets to catch position bias.
- Do not reveal runtime or cost until after quality judgment is recorded.
- Record ties when neither output is meaningfully better.

Do not add LLM-as-judge scoring until there is a small human-calibrated set.
When that exists, judge prompts must be validated against human decisions and
checked for position and length bias.

## Human Rubric

Reviewers should judge:

- Task completion: did the answer actually do what was asked?
- Groundedness: are claims tied to real files, code, docs, or observed output?
- Usefulness: can an operator act on the result without major translation?
- Unnecessary effort: did it waste time, overbuild, or disturb unrelated files?
- Risk and safety handling: did it notice likely failure modes and avoid
  unsupported confidence?

Use pass/fail plus short notes for each dimension. Avoid 1-10 scoring in the
first pilot.

## Interpretation Rules

The benchmark can support internal decisions only when:

- All paired runs use equal conditions.
- Deterministic failures are separated from human preference.
- Environment or connector failures are not counted as model quality failures.
- Held-out tasks were not used for tuning.
- The sample size is described plainly.

One pilot run per arm is enough to find obvious workflow problems. It is not
enough for broad claims. Repeat runs only for close, surprising, or flaky cases.

## Non-Goals

This slice does not build:

- A benchmark runner.
- A dashboard.
- Claude Code arms.
- LLM-as-judge infrastructure.
- A large public benchmark.
- Marketing claims.
- Cost estimates that pretend to be measured token usage.

## Open Questions

- What exact Codex CLI version and model label should be frozen for the pilot?
- What time budget should count as fair for each task class?
- Who performs the blinded human review?
- Which task candidates need replacement because they were already used during
  eval development?
- Can the connector expose measured token and cost data, or only wallclock and
  version metadata?
