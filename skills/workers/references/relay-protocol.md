# Relay Protocol

Canonical reference. Templates inline this now. `compose-prompt.sh` appends this file only
for legacy templates that do not already contain report sections.

Write report files here:
- implement and review: `{relay_root}/reports/report-{slice_id}.md`
- converge: `{relay_root}/reports/report-converge.md`
- fallback: `{relay_root}/reports/report.md`

Required sections:
- `### Files Changed`
- `### Tests Run` - exact command, pass or fail count, failures; mark sandbox-caused
  failures `SANDBOX_LIMITED`
- `### Verification` - verifier result or `not run`
- `### Verdict`
  - review: `CLEAN` or `ISSUES FOUND`
  - converge: `COMPLETE AND HARDENED` or `ISSUES REMAIN`
  - implement: `N/A - implementation report`
- `### Completion Claim` - `COMPLETE`, `PARTIAL`, or `BLOCKED`
- `### Issues Found`
- `### Next Steps` - required for `PARTIAL` or `BLOCKED`

The canonical review verdict still lives in `{relay_root}/review-findings/review-findings-{slice_id}.md`. Echo it
in the report so the orchestrator can cross-check artifacts.
