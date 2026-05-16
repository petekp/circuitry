# Fix-vs-Vanilla Pilot Results

Latest pilot: `2026-05-15T23-31-25-175Z-held-out`

Result folder:
`evals/fix-vs-vanilla/results/2026-05-15T23-31-25-175Z-held-out/`

## Conclusion

Circuit Fix gets a positive claim from this pilot.

On five held-out tasks, Circuit had zero false-fixed outcomes and fixed every
task. The strong vanilla prompt had one false-fixed outcome and fixed four of
five. The win came from the template escaping task: vanilla could not execute
its checks, reasoned through the patch, claimed fixed, and missed that its
placeholder reconstruction stripped spaces inside unchanged placeholders.
Circuit ran the objective checks and closed only after they passed.

This is a pilot-sized product claim, not a broad benchmark claim. It supports
the specific thesis that Fix reduces babysitting on reproducible bug-fix tasks
where model-only proof can be confidently wrong and machine verification is
available to the flow.

## Conditions

| Condition | Value |
| --- | --- |
| Provider | `claude-code` |
| Model | `claude-haiku-4-5-20251001` |
| Effort | `medium` |
| Timeout | `900000 ms` per arm |
| Circuit mode | `default` |
| Repo commit | `2066b9583f55b327c7608e09dd268969d5652849` |

The runner uses a temporary `claude` wrapper to inject the same model and
effort into both arms. The vanilla prompt and the Circuit Claude connector both
run Claude Code in print mode with bypassed permissions, empty MCP config,
disabled slash commands, empty settings, and no session persistence.

## Held-Out Metrics

| Arm | False-fixed | Objective fixed | Verification pass | Proof quality | Changed files | Mean wallclock |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Circuit Fix | 0% | 100% | 100% | 3.00 | 1.00 | 145708 ms |
| Strong vanilla prompt | 20% | 80% | 80% | 1.40 | 1.00 | 89193 ms |

## Task Results

| Task | Split | Circuit | Vanilla |
| --- | --- | --- | --- |
| `heldout-tax-line-rounding` | held-out | fixed and proved; review skipped after connector failure | fixed, weaker proof |
| `heldout-permission-deny-wildcard` | held-out | fixed and proved; review skipped after connector failure | fixed, weaker proof |
| `heldout-json-pointer-escapes` | held-out | fixed and proved; review skipped after connector failure | fixed, weak proof |
| `heldout-cidr-prefix-zero` | held-out | fixed and proved; review skipped after connector failure | fixed, weak proof |
| `heldout-template-escaping` | held-out | fixed and proved; review skipped after connector failure | false-fixed: claimed fixed, but all objective checks failed |

## Ratchets Since First Pilot

| Ratchet | Evidence |
| --- | --- |
| Review connector failure no longer aborts proof-complete Fix runs | Regression run `2026-05-15T22-18-01-916Z-regression` fixed 4/4 with Circuit `proof=3` and `review=skipped` instead of missing `fix-result.json`. |
| Fix verification honors explicit objective check lists | Regression run `2026-05-15T22-30-48-251Z-regression-money-negative` shows Circuit's verification report ran both `npm test` and `npm run edge`. |
| Baseline proof now runs before specialist relays can edit | Regression run `2026-05-15T23-17-41-354Z-heldout-user-display-name` recovered from the earlier early-edit failure and closed with `proof=3`. |
| Fresh held-out tasks now exercise model-only proof risk | Held-out run `2026-05-15T23-31-25-175Z-held-out` added JSON Pointer escaping, CIDR boundaries, and template escaping; vanilla false-fixed the template task while Circuit proved all five. |
| Review schema fallback restores independent review evidence | Regression run `2026-05-15T23-55-01-651Z-heldout-user-display-name` completed `fix-review` with `review=completed:accept` instead of skipping review after a Claude Code connector failure. |

## Acceptance Audit

| Requirement | Current evidence |
| --- | --- |
| Strong vanilla baseline | `run-fix-comparison.mjs` gives vanilla a process prompt requiring read-before-edit, failing baseline, focused fix, rerun proof, and final JSON claim. |
| Equal model and tool conditions | `summary.json` records the shared provider/model/effort/timeout; the runner's `claude` wrapper injects the same model and effort for both arms; the Claude connector and vanilla arm use the same permission/MCP/slash/session constraints. |
| Discovery, regression, and held-out split | `manifest.json` defines `discovery`, `regression`, and `held-out` sets. |
| Discovery used only for tuning | Earlier discovery runs were used to fix runner/Fix blockers; the claim rule excludes discovery and regression tasks. |
| Held-out used for measurement | The measured run used `--set held-out` and scored only held-out tasks in the claim. Earlier held-out tasks used during tuning were moved to regression before this measurement. |
| Primary metric is false-fixed rate | `summary.json` and `report.md` make false-fixed rate the claim gate. |
| Secondary metrics recorded | `summary.json` records fixed rate, proof quality, verification pass rate, changed files, out-of-scope files, and wallclock. |
| Circuit only gets a claim if it wins held-out | `claim.supported` is `true` because Circuit had a lower held-out false-fixed rate and matched or beat vanilla objective fixed rate. |

## Follow-Up

The next useful ratchet is efficiency. Circuit won on false-fixed rate and proof
quality, and a follow-up regression run restored independent review evidence,
but the held-out measurement still shows Circuit slower than vanilla. The
product story is strongest if Fix keeps the proof/review advantage while
reducing wallclock.
