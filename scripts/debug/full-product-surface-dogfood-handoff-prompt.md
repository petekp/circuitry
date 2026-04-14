# Circuit Full-Product Dogfood Handoff Prompt

Use the prompt below in a fresh Codex session when you want Codex to perform a
deep, end-to-end manual test of Circuit's full product surface, fix real issues,
and call out opportunities to simplify and improve the product.

```text
You are taking over Circuit for a full-product dogfood and quality-improvement pass.

Goal:
Manually test the entire real product surface of Circuit on the installed plugin,
not just the source tree, until you are confident it works to spec. Fix any real
issues you find, verify the fixes, and identify opportunities to further simplify
the architecture, streamline the user experience, reduce operational friction,
and improve overall product quality.

Working mode:
- Be autonomous and persistent.
- Do not stop at analysis. If you find a bug and can fix it safely, fix it.
- Prefer real product usage over synthetic reasoning.
- Use the installed/synced plugin surface as the authority for acceptance.
- Keep a running evidence trail so every issue has reproduction steps and proof.

Repo and environment:
- Repo root: `/Users/petepetrash/Code/circuit`
- Use fresh scratch repos under `/tmp/` for acceptance passes.
- Circuit has already gone through a major runtime simplification migration.
- The active migration path should now be inactive; the archive is under:
  `/Users/petepetrash/Code/circuit/.claude/history/migrations/2026-04-v2-runtime-convergence/`

Critical rules:
1. Test the real installed product surface, not just source files.
2. Regenerate/sync when needed:
   - `cd /Users/petepetrash/Code/circuit/scripts/runtime/engine && npm run prepare`
   - `node /Users/petepetrash/Code/circuit/scripts/runtime/bin/catalog-compiler.js generate`
   - `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`
3. Use fresh Claude/Codex sessions where that matters for slash-command visibility.
4. Prefer proving behavior by actually invoking `/circuit:*` commands or installed helper CLIs.
5. When a path is blocked by an approval prompt or host UI limitation, use Terminal.app plus macOS AX automation if needed, and clearly record what required manual approval.
6. When you fix something, rerun the narrowest relevant reproduction first, then rerun the broader impacted checks.
7. Keep a high bar for “works to spec”: both behavior and product ergonomics matter.

What to test

Test the entire built-in product surface, including at minimum:

## 1. Installed surface integrity
- `./scripts/verify-install.sh`
- installed command/menu overlay materialization
- generated command shims and bundled runtime bins
- cache and marketplace sync behavior

## 2. Core slash-command workflows
- `/circuit:build`
- `/circuit:explore`
- `/circuit:repair`
- `/circuit:migrate`
- `/circuit:sweep`
- `/circuit:run`
- `/circuit:review`
- `/circuit:handoff`
- `/circuit:create`

For each one, verify:
- bootstrap correctness
- prompt surface correctness
- run-state materialization
- continuity/control-plane behavior where relevant
- expected stop conditions for smoke/bootstrap flows
- expected end-to-end progression for real flows

## 3. Handoff / continuity
- `/circuit:handoff`
- `/circuit:handoff resume`
- `/circuit:handoff done`
- session-start passive continuity behavior
- current_run attachment / detachment semantics
- control-plane-only authority model

## 4. Worker dispatch surface
- built-in `codex`
- built-in `agent`
- dispatch receipts and runtime boundaries
- explicit adapter overrides
- meaningful error handling when a dispatch path fails

## 5. Custom circuits
- `/circuit:create`
- draft validation
- publish
- overlay materialization
- direct `/circuit:<slug>` invocation
- `/circuit:run` routing into a published custom circuit
- custom-circuit behavior after `/reload-plugins` / fresh session reload behavior

## 6. Documentation and operator experience
- README accuracy against actual behavior
- CIRCUITS/CUSTOM-CIRCUITS/workflow docs against actual behavior
- help text, prompts, summaries, and error messages
- rough edges that make the product harder to understand or operate

Testing strategy

1. Build a product-surface checklist first.
   Break the product into concrete surfaces and mark each as:
   - not tested
   - in progress
   - passed
   - failed
   - blocked by host approval / external limitation

2. Start with broad smoke coverage.
   Quickly verify every major surface at least once so you find the highest-signal failures early.

3. Then deepen into real end-to-end flows.
   Do real tasks in scratch repos, not toy no-op checks only.

4. For every issue:
   - capture exact repro steps
   - capture expected vs actual behavior
   - identify likely root cause
   - fix it if feasible
   - rerun the repro
   - rerun nearby regression checks

5. Keep an explicit list of “spec mismatches” vs “quality opportunities”.
   Not every improvement is a bug. Separate:
   - correctness bugs / regressions
   - UX/documentation clarity issues
   - architecture simplification opportunities
   - maintainability / observability improvements

Required outputs

Create and maintain these working artifacts during the session:

1. `/tmp/circuit-full-dogfood/checklist.md`
   - full testing matrix
   - pass/fail/blocked status per surface

2. `/tmp/circuit-full-dogfood/findings.md`
   For each confirmed issue:
   - title
   - severity
   - product surface
   - repro steps
   - expected behavior
   - actual behavior
   - root cause
   - fix status
   - verification after fix

3. `/tmp/circuit-full-dogfood/opportunities.md`
   For each non-bug improvement opportunity:
   - title
   - category: simplification, UX, quality, observability, maintainability
   - evidence
   - why it matters
   - concrete recommendation

4. `/tmp/circuit-full-dogfood/final-report.md`
   Final report structure:

   # Circuit Full Product Dogfood

   ## Scope Tested
   ## Environment
   ## Surfaces Passed
   ## Issues Found
   ## Issues Fixed
   ## Remaining Known Problems
   ## Simplification Opportunities
   ## Quality Improvement Opportunities
   ## Recommended Next Actions

Fix-and-verify loop

When you find a real issue:
- make the fix in the repo
- run relevant automated checks
- sync/regenerate if the installed surface depends on it
- rerun the affected real product flow
- update the evidence files

If you make repo changes under `hooks/`, `skills/`, `scripts/`, or plugin metadata,
remember to run:
- `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`

Quality bar for closing the session

Do not conclude until:
- every major built-in surface has been exercised
- custom-circuit creation/publish/routing has been exercised
- handoff/continuity has been exercised
- both `codex` and `agent` dispatch have been exercised
- every confirmed issue has either been fixed or explicitly documented as blocked
- the final report clearly separates:
  - what is truly working
  - what was broken and got fixed
  - what is still broken
  - what should be simplified or improved next

Mindset

Treat this as both:
- a product QA pass
- and a product-quality editorial pass

You are not only looking for breakage.
You are also looking for:
- unnecessary complexity
- duplicated concepts
- confusing operator flows
- brittle setup/reload expectations
- unclear prompts or docs
- places where the simplified architecture can be made even simpler

If you find a meaningful simplification that is safe and clearly improves the product,
make it rather than just noting it.
```
