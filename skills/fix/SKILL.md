---
name: circuit:fix
description: >
  Bug fix circuit that enforces test-first discipline. 4 steps across 4 phases:
  Bug Framing -> Regression Contract -> Fix Execution -> Ship Review. Stronger
  than run (requires regression tests before code changes), lighter than
  repair-flow (no forensic causal mapping). Use when you have a known bug with
  a clear reproduction path, not for complex multi-layer failures (use
  repair-flow) or feature work (use run or develop).
---

# Fix Circuit

Test-first bug fixing. Every fix starts with a regression test, not a code change.

## When to Use

- Known bug with a clear reproduction path
- Local bugfix work where you can describe expected vs actual behavior
- Cases where regression-test-first discipline is needed
- Bugs that need structured tracking through fix and review

Do NOT use for:

- Complex multi-layer failures where root cause is unclear (use `circuit:repair-flow`)
- Feature work, even if it touches buggy code (use `circuit:run` or `circuit:develop`)
- One-line typo fixes or config edits (skip circuits entirely)
- Flaky or intermittent failures needing forensic investigation (use `circuit:repair-flow`)

## How Fix Compares

**fix vs run:** Fix requires a regression test before any code change. Run does not
enforce test-first discipline. If you know the bug and can write a failing test, use
fix. If you are building or changing features and want planning and review, use run.

**fix vs repair-flow:** Fix is for known bugs with clear repro. Repair-flow is for
complex, multi-layer failures needing forensic investigation -- causal mapping, layered
audit, ordered repair across dependencies. If you can describe the bug in one sentence
and reproduce it, use fix. If the failure spans multiple subsystems and the root cause
is unclear, use repair-flow.

## Glossary

- **Bug Brief** -- The interactive artifact capturing expected behavior, actual behavior,
  scope, and known reproduction steps. Written with the user during Bug Framing.
- **Regression Contract** -- A synthesis artifact that defines either a failing automated
  regression test or a manual_only exemption with detailed repro steps. The test must
  fail before any code change begins.
- **Fix Handoff** -- The dispatch artifact from workers execution. Contains what was
  changed, tests run, and convergence verdict.
- **Fix Review** -- The final dispatch artifact. An independent review of the fix
  against the bug brief and regression contract.

## Principles

- **Test first, always.** No code change happens before a regression test (or explicit
  manual_only exemption) exists. This is the core difference from circuit:run.
- **Scope the bug, not the system.** The bug brief defines the boundary. Workers that
  stray beyond the bug scope are caught in review.
- **Regression tests are the contract.** The regression contract is what proves the fix
  works. If the test passes after the fix, the bug is fixed. If it does not, the fix
  is not done.
- **Independent review catches regressions.** Ship review checks that the fix does not
  introduce new problems, and that the regression test actually covers the reported bug.

## Setup

```bash
RUN_SLUG="<bug-slug>"
RUN_ROOT=".circuitry/circuit-runs/${RUN_SLUG}"
mkdir -p "${RUN_ROOT}/artifacts"
```

Record `RUN_ROOT`. All paths below are relative to it.

## Domain Skill Selection

When dispatching workers, pick 1-2 domain skills matching the affected code.
Check `circuit.config.yaml` for a `fix:` entry first. If no config exists,
auto-detect from the file scope in the bug brief.

Never exceed 3 total skills per dispatch.

## Dispatch Backend

Same as all circuits. Auto-detect: if `codex` is on PATH, use Codex CLI.
Otherwise, use Claude Code's Agent tool with `isolation: "worktree"`.

```bash
if command -v codex >/dev/null 2>&1; then
  # Codex backend
  cat ${step_dir}/prompt.md | codex exec --full-auto -o ${step_dir}/last-messages/last-message.txt -
else
  # Agent backend -- invoke the Agent tool with prompt content
  # Agent(task=<prompt contents>, isolation="worktree")
fi
```

Or use the dispatch helper:
```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/dispatch.sh" \
  --prompt ${step_dir}/prompt.md \
  --output ${step_dir}/last-messages/last-message.txt
```

---

## Phase 1: Bug Framing

### Step 1: Bug Brief -- `interactive`

**Objective:** Capture the bug with enough detail to write a regression test.

Ask the user (via conversation, not a form):

> Describe the bug. Then answer:
> 1. What is the expected behavior?
> 2. What is the actual behavior?
> 3. What is the scope of the fix (which files, modules, or flows are affected)?
> 4. How do you reproduce the bug? (steps, commands, or test scenario)

Write their response to `${RUN_ROOT}/artifacts/bug-brief.md`:

```markdown
# Bug Brief: <bug summary>
## Expected Behavior
## Actual Behavior
## Scope
## Known Repro
```

**Gate:** `bug-brief.md` exists with non-empty Expected Behavior, Actual Behavior,
Scope, and Known Repro.

---

## Phase 2: Regression Contract

### Step 2: Regression Contract -- `synthesis`

**Objective:** Define a failing regression test before any code change.

Read `bug-brief.md`. Based on the Known Repro and Scope, write a regression contract
that specifies either:

1. **Automated regression test:** A test command that currently FAILS and will PASS
   once the bug is fixed. Include the exact test file, test name, and the command to
   run it.

2. **Manual-only exemption:** If the bug cannot be covered by an automated test
   (UI-only behavior, third-party API interaction, timing-dependent), document the
   exemption with detailed manual repro steps that a reviewer can follow.

Write `${RUN_ROOT}/artifacts/regression-contract.md`:

```markdown
# Regression Contract: <bug summary>

## Test Type
automated | manual_only

## Regression Test
### Command
<exact command to run the test>
### File
<test file path>
### Test Name
<test function or describe block name>
### Current Result
FAIL -- <brief description of failure>
### Expected Result After Fix
PASS -- <brief description of expected passing behavior>

## Manual Exemption (if manual_only)
### Reason
<why automated testing is not feasible>
### Manual Repro Steps
1. <step>
2. <step>
3. <step>
### Expected Outcome After Fix
<what the reviewer should observe>
```

**Gate:** `regression-contract.md` exists with at least one failing regression test
command OR a manual_only exemption with repro steps.

---

## Phase 3: Fix Execution

### Step 3: Implement -- `dispatch` (via workers)

> **Protocol reference:** See `protocols/workers-execute.md` for the canonical version of this pattern.

**Objective:** Fix the bug, guided by the regression contract.

This step delegates to workers for the full implement -> review -> converge cycle.
The orchestrator creates the workspace and translates the bug brief and regression
contract into a CHARTER.md.

**Setup:**

```bash
IMPL_ROOT="${RUN_ROOT}/phases/implement"
mkdir -p "${IMPL_ROOT}/archive" "${IMPL_ROOT}/reports" \
  "${IMPL_ROOT}/last-messages"
```

**Create CHARTER.md from bug-brief.md and regression-contract.md:**

Read both artifacts and write `${IMPL_ROOT}/CHARTER.md` with this mapping:

| Artifact | CHARTER.md |
|----------|------------|
| `bug-brief.md` Expected Behavior | Mission preamble: what should happen |
| `bug-brief.md` Actual Behavior | Mission preamble: what currently happens |
| `bug-brief.md` Scope | File scope for workers |
| `regression-contract.md` Regression Test | Primary verification command |
| `regression-contract.md` Test Type | Determines verification strategy |

The CHARTER must include:
- The regression test command as the PRIMARY verification command
- The bug scope as the file scope constraint
- An explicit instruction: "The regression test must pass after your changes"

**Compose and dispatch:**

```bash
"$CLAUDE_PLUGIN_ROOT/scripts/relay/compose-prompt.sh" \
  --header ${IMPL_ROOT}/prompt-header.md \
  --skills workers,<domain-skills> \
  --root ${IMPL_ROOT} \
  --out ${IMPL_ROOT}/prompt.md

"$CLAUDE_PLUGIN_ROOT/scripts/relay/dispatch.sh" \
  --prompt ${IMPL_ROOT}/prompt.md \
  --output ${IMPL_ROOT}/last-messages/last-message.txt
```

**After workers completes**, synthesize `fix-handoff.md`:

Read (in this order):
1. `${IMPL_ROOT}/reports/report-converge.md` (convergence verdict)
2. `${IMPL_ROOT}/job-result.json` (execution status and slice metadata)
3. The last implementation slice report

Write `${RUN_ROOT}/artifacts/fix-handoff.md`:

```markdown
# Fix Handoff: <bug summary>
## What Was Changed
## Regression Test Results
## Other Tests Run
## Convergence Verdict
## Open Issues (if any)
```

**Gate:** `fix-handoff.md` exists AND convergence verdict is `COMPLETE AND HARDENED`
AND regression tests pass.

---

## Phase 4: Ship Review

### Step 4: Ship Review -- `dispatch`

**Objective:** Independent review of the fix before shipping.

Dispatch a review worker that reads all three prior artifacts and evaluates:

1. Does the fix actually address the bug described in bug-brief.md?
2. Does the regression test in regression-contract.md cover the reported bug?
3. Are there any new regressions or side effects introduced by the fix?
4. Is the fix minimal and scoped to the bug (no scope creep)?

Write `${RUN_ROOT}/artifacts/fix-review.md`:

```markdown
# Fix Review: <bug summary>

## Verdict
SHIP_READY | ISSUES_FOUND

## Bug Coverage
<Does the fix address the bug as described in the bug brief?>

## Regression Test Coverage
<Does the regression test actually test the reported bug?>

## Side Effects
<Any new regressions or unintended changes?>

## Scope Compliance
<Did the fix stay within the scope defined in the bug brief?>

## Issues (if ISSUES_FOUND)
- <issue 1>
- <issue 2>
```

**Gate:** `fix-review.md` exists with verdict `SHIP_READY` or `ISSUES_FOUND`.
If `ISSUES_FOUND`, present issues to the user for decision (fix them or ship anyway).

---

## Artifact Chain Summary

```
bug-brief.md -> regression-contract.md -> fix-handoff.md -> fix-review.md
```

Four artifacts. The bug brief is the problem statement. The regression contract is
the test-first proof. The fix handoff is the implementation result. The fix review
is the independent verdict.

## Circuit Breaker

Escalate to the user when:
- Any workers slice hits `impl_attempts > 3` or
  `impl_attempts + review_rejections > 5`
- Convergence fails after max attempts
- The regression test cannot be made to pass (the bug may be more complex
  than initially scoped -- consider switching to `circuit:repair-flow`)

Include in the escalation: counter values, failure output, the failure pattern,
and options (adjust scope, switch to `circuit:repair-flow`, or abort).
