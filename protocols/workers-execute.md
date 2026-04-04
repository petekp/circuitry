# Protocol: Workers Execute

## Purpose

This protocol covers the full workers delegation pattern: setting up a child
workspace, writing a CHARTER.md, assembling and dispatching the workers prompt,
and synthesizing the parent artifact from workers output. Use this protocol
whenever a circuit step delegates its implementation phase to the `workers`
skill for an implement -> review -> converge cycle.

Circuits that use this protocol: `run` (quick/researched Step 3, adversarial
Step 9), `cleanup` (Step 6).

## Prerequisites

Before invoking this protocol, the circuit must have:

1. A **source contract artifact** -- the upstream artifact that defines what
   workers must build. Examples: `execution-packet.md`, `scope-confirmed.md`,
   `repair-packet.md`, `execution-charter.md`.
2. A known `RUN_ROOT` for the current circuit run.
3. Domain skills selected per the circuit's Domain Skill Selection rules.

## Workspace Setup

Create the child root with the standard directory layout:

```bash
CHILD_ROOT="${RUN_ROOT}/phases/<step-name>"
mkdir -p "${CHILD_ROOT}/archive" "${CHILD_ROOT}/reports" \
  "${CHILD_ROOT}/last-messages"
```

All three directories are required. `archive/` holds reverted or superseded
state. `reports/` holds worker output including slice reports and the
convergence report. `last-messages/` holds raw worker output traces.

Workers creates its own internal directories (like `review-findings/`,
`batch.json`, `plan.json`) as needed. Parent circuits should not create or
read these -- they are worker-private state.

Some circuits use variant child root paths:
- `cleanup` Step 6: `${RUN_ROOT}/phases/step-6/batches/<batch-id>`
- `run` ratchet mode: `${RUN_ROOT}/phases/<step>/batches/<batch-id>`

The directory layout is identical regardless of path depth.

### CHARTER.md Creation

Write `${CHILD_ROOT}/CHARTER.md` from the source contract artifact. The
mapping depends on the circuit:

| Circuit | Source artifact | Mapping |
|---------|---------------|---------|
| `run` (quick/researched) | `scope-confirmed.md` | Translate scope sections to charter fields |
| `run` (adversarial) | `execution-packet.md` | Direct copy |
| `cleanup` | Per-batch manifest | Batch Items, Evidence References, Allowed File Scope, Verification Commands, Revert Rule |

The charter is the single source of truth for the workers loop. Everything the
worker needs must be in CHARTER.md or composed into the prompt -- workers do
not read upstream circuit artifacts directly.

## Prompt Assembly

### Writing the Prompt Header

Write `${CHILD_ROOT}/prompt-header.md` using the circuit's canonical header
schema:

```markdown
# Step N: <title>

## Mission
Implement the work described in CHARTER.md using the workers
implement -> review -> converge cycle.

## Inputs
[Full text of the source contract, already copied as CHARTER.md]

## Output
- **Path:** `${CHILD_ROOT}/reports/report-converge.md`
- **Schema:** workers convergence report format

## Success Criteria
All slices converged with `COMPLETE AND HARDENED` verdict.

## Report Instructions
Write your primary output to the path above. Also write a standard report to
`reports/report.md` with these exact section headings:

### Files Changed
[List files modified or created]

### Tests Run
[List test commands and results, or "None" if no tests]

### Verification
[How the output was verified]

### Verdict
[CLEAN / ISSUES FOUND]

### Completion Claim
[COMPLETE / PARTIAL]

### Issues Found
[List any issues, or "None"]

### Next Steps
[What the next phase should focus on]
```

The Report Instructions section with exact relay headings is required.
`compose-prompt.sh` checks for `### Files Changed`, `### Tests Run`, and
`### Completion Claim`. If missing, it appends `relay-protocol.md` which
contains unresolved `{slice_id}` placeholders that contaminate the prompt.

Also include in the header:
- Domain skills and verification commands from the source contract
- Any circuit-specific constraints (slice order, boundary ownership, etc.)

### Composing the Prompt

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/compose-prompt.sh" \
  --header ${CHILD_ROOT}/prompt-header.md \
  --skills workers,<domain-skills> \
  --root ${CHILD_ROOT} \
  --out ${CHILD_ROOT}/prompt.md
```

The `workers` skill is always first in the skills list. Domain skills follow.
Never exceed 3 total skills. The `--root` flag resolves `{relay_root}` tokens
in the assembled prompt.

## Dispatch

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/dispatch.sh" \
  --prompt ${CHILD_ROOT}/prompt.md \
  --output ${CHILD_ROOT}/last-messages/last-message-workers.txt
```

The dispatch helper auto-detects the backend:
- **Codex CLI** (when `codex` is on PATH): pipes the prompt to
  `codex exec --full-auto`
- **Agent fallback** (when Codex is not installed): invokes the Claude Code
  Agent tool with `isolation: "worktree"`

The artifact chain, gates, and report format are identical regardless of
backend.

## Post-Dispatch Synthesis

After workers completes, the orchestrator reads child state and synthesizes
the parent circuit artifact. Always read in this order:

1. `${CHILD_ROOT}/reports/report-converge.md` -- the convergence verdict
   (primary source of truth)
2. `${CHILD_ROOT}/job-result.json` -- execution status and slice metadata
3. `${CHILD_ROOT}/reports/report-<last-slice-id>.md` -- the last
   implementation slice report (find the slice id from `job-result.json`)

**Important:** Workers review workers may overwrite per-slice report files.
If a slice report is missing or appears to be a review artifact, use
`job-result.json` slice metadata and the convergence report to reconstruct
what was built. Do not guess from chat residue.

### Public vs. Private Boundary

The workers-execute protocol defines a sealed boundary between parent
circuits and the workers skill. Parent circuits interact with workers
exclusively through these public contract files:

| File | Direction | Purpose |
|------|-----------|---------|
| `dispatch-request.json` | Parent -> Workers | What to do (slice definitions, file scope, verification commands) |
| `dispatch-receipt.json` | Workers -> Parent | Confirmation that workers started processing |
| `job-result.json` | Workers -> Parent | What happened (execution status, slice metadata, convergence) |
| `reports/report-converge.md` | Workers -> Parent | Human-readable convergence verdict |
| `reports/report-<slice-id>.md` | Workers -> Parent | Human-readable per-slice reports |
| The declared handoff artifact | Workers -> Parent | The output artifact (e.g., `execution-handoff.md`) |

The following are **worker-private** and must not be read or depended on
by parent circuits:

- `batch.json` -- internal state machine (use `job-result.json` instead)
- `plan.json` -- internal planning state
- `events.ndjson` -- internal event log
- `review-findings/` -- internal review state
- Slice-level reports in `archive/` -- internal versioning state

### Writing the Parent Artifact

The parent artifact schema varies by circuit:

| Circuit | Parent artifact | Key sections |
|---------|----------------|-------------|
| `run` (quick/researched) | `implementation-handoff.md` | What Was Built, Tests Run, Convergence Verdict, Open Issues |
| `run` (adversarial) | `implementation-handoff.md` | What Was Built, Tests Run, Convergence Verdict, Open Issues |
| `cleanup` | `cleanup-batches.md` (appended per batch) | Items, Verification, Disposition |

## Gate

The protocol is complete when:

1. The parent artifact exists at its expected path
2. The convergence verdict is `COMPLETE AND HARDENED`
3. Verification commands from the source contract pass

If convergence says `ISSUES REMAIN`, the workers loop should have addressed
them internally. If it did not, escalate to the user.

### Verification

```bash
test -f ${CHILD_ROOT}/reports/report-converge.md
test -f ${RUN_ROOT}/artifacts/<parent-artifact>.md
```

## Circuit Breaker

Escalate to the user when:

- Any workers slice hits `impl_attempts > 3` or
  `impl_attempts + review_rejections > 5`
- Convergence fails after max attempts (circuit-specific retry budget)
- A review reveals the task is more complex than the source contract
  anticipated (unexpected dependencies, architectural issues)
- Workers reports a scope violation (out-of-scope edits detected)

Include in the escalation: counter values, failure output, the failure
pattern, and options (adjust scope, skip the problematic slice, switch
circuits, or abort).

### Retry and Revert

- Retry budgets are circuit-specific. Circuits typically allow 1-2
  full workers dispatches per step.
- Revert means `git reset --hard <baseline-commit>` for the allowed file
  scope. The baseline commit should be recorded in CHARTER.md under
  `## Baseline Commit` before dispatch.
- On revert, archive the child root state and record the reverted SHA and
  reason in the parent artifact.
