---
contract: fix
status: draft
version: 0.1
schema_source: src/flows/fix/reports.ts
last_updated: 2026-04-28
depends_on: [flow, flow-blocks, flow-schematic, step, connector]
report_ids:
  - fix.brief
  - fix.context
  - fix.diagnosis
  - fix.no-repro-decision
  - fix.change
  - fix.verification
  - fix.review
  - fix.result
invariant_ids: []
property_ids: []
---

# Fix Report Contract

Fix is the clearer v1 successor to the old Repair evidence. Its job is to take
a concrete problem, understand it, make the smallest safe change, prove it, and
close with evidence.

This contract starts as the typed-output home for the Fix schematic draft. It
does not wire a runnable Fix command or runtime behavior.

| Report | Role | Backing path |
|---|---|---|
| `fix.brief` | Problem boundary and proof target | `<run-folder>/reports/fix/brief.json` |
| `fix.context` | Evidence gathered before diagnosis | `<run-folder>/reports/fix/context.json` |
| `fix.diagnosis` | Cause, reproduction status, and uncertainty | `<run-folder>/reports/fix/diagnosis.json` |
| `fix.no-repro-decision` | Operator or mode-policy choice when evidence is uncertain | `<run-folder>/reports/fix/no-repro-decision.json` |
| `fix.change` | Focused change evidence | `<run-folder>/reports/fix/change.json` |
| `fix.verification` | Executed proof evidence | `<run-folder>/reports/fix/verification.json` |
| `fix.review` | Independent review result when the mode requires it | `<run-folder>/reports/fix/review.json` |
| `fix.result` | Close summary | `<run-folder>/reports/fix-result.json` |

Fix role outputs live under `reports/fix/` so they do not collide with
Explore, Review, or Build outputs. The flow-specific Fix result file is
`reports/fix-result.json`; the universal engine result remains
`reports/result.json`.

Any persisted path carried inside a Fix report is treated as a
`RunRelativePath`-style value: it must stay inside the run folder and must not
use absolute, home-directory, parent-directory, Windows absolute, or UNC path
forms. This applies to context source refs, diagnosis refs, verification command
ids, and evidence-link fields registered as path-derived fields in the
authority graph.

`fix.verification@v1` carries direct-argv verification results and reuses the
safe verification command shape already proven for Build. It does not accept
shell command strings, shell `-c` execution, project-root escaping `cwd`,
missing timeouts, or unbounded output.

`fix.diagnosis@v1` must be honest about uncertainty. If the problem was not
cleanly reproduced, it must carry residual uncertainty instead of closing as if
the problem were proven.

`fix.brief@v1` carries a regression contract: expected behavior, actual
behavior, a reproduction command or schematic when available, and either a
failing-before-fix regression test or an explicit deferral reason when the bug
is not yet reproducible.

`fix.result@v1` cannot report `fixed` unless verification passed and the
regression contract is proved. A `not-reproduced` result must point at the
human-decision report that records how the run chose to stop or continue.

Independent review is conditional. When review runs, `fix.result@v1` must carry
a review result and a pointer to `fix.review`. When review is skipped, the
result must carry explicit skipped-review evidence instead of fabricating a
review-result evidence link.
