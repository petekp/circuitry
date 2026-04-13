# Circuit Post-Change Usage Audit Prompt

Use the prompt below in a fresh session when you want to analyze how Circuit has been behaving after the recent large product changes.

```text
You are doing an internal maintainer audit of Circuit usage, not user-facing reporting.

Goal:
Use the internal debug scraper at `/Users/petepetrash/Code/circuit/scripts/debug/scrape-circuit-invocations.py` plus direct transcript inspection to identify real issues and improvement opportunities in Circuit usage after the recent larger changes.

Important context:
- This is for the creator/maintainer of Circuit.
- Treat built-in Circuit behavior as the main product surface.
- Treat custom circuits, typos, experiments, aborted sessions, and maintainer-only workflows as possible noise unless they expose a real built-in product problem.
- Do not make code changes in this session unless explicitly asked. This session is for analysis, triage, and recommendations.

Recent larger changes to keep in mind:
- `22b5755` Default Codex dispatch to isolated runtime
- `6dc190b` Harden runtime surface and collapse prompt-surface duplication
- `4acf94e` add first-class global custom circuits
- `18868c9` Replace markdown handoff flow with continuity control plane
- `cea63fc` Fix handoff continuation source of truth

Primary tasks:

1. Run the debug scraper for Circuit usage after the recent change wave.
   Use:
   `python3 /Users/petepetrash/Code/circuit/scripts/debug/scrape-circuit-invocations.py --from 2026-04-11 --to <today> --project-path /Users/petepetrash/Code/circuit --out-dir /tmp/circuit-post-change-audit`

2. Read:
   - `/tmp/circuit-post-change-audit/summary.json`
   - `/tmp/circuit-post-change-audit/summary.md`
   - `/tmp/circuit-post-change-audit/invocations.json`

3. Identify the highest-signal areas for deeper inspection, with special focus on:
   - built-in workflow invocations with no matched `.circuit/circuit-runs` record
   - Claude tool friction during Circuit launches
   - `/circuit:run` behavior after the runtime surface / prompt-surface changes
   - continuity / handoff behavior after the control-plane rollout
   - any changes in behavior that may have come from first-class global custom circuits

4. For each major signal, inspect representative raw evidence directly in the Claude transcript store:
   - `~/.claude/projects/-Users-petepetrash-Code-circuit/*.jsonl`
   - use the invocation IDs from the scraper output to find the exact transcript entries
   - inspect enough examples to separate true product issues from maintainer-only noise

5. Classify every important finding into one of these buckets:
   - real built-in product issue
   - observability gap / analysis limitation
   - expected maintainer-only noise
   - product opportunity / UX improvement

6. For each confirmed issue or opportunity, provide:
   - title
   - evidence
   - likely root cause
   - who is affected
   - severity
   - whether it is caused by the recent large changes, merely exposed by them, or unrelated
   - concrete next action

7. If useful, split the analysis into sub-windows to isolate regressions:
   - `2026-04-11` through `2026-04-12 22:18` for the big runtime/custom-circuit changes before the continuity control-plane cutover
   - `2026-04-12 22:19` through today for the continuity-control-plane era

8. Write the final report to:
   `/tmp/circuit-post-change-audit/findings.md`

Required report structure:

# Circuit Post-Change Usage Audit

## Scope

## Change Windows

## High-Signal Findings

## Confirmed Product Issues

## Observability Gaps

## Expected Maintainer-Only Noise

## Opportunities

## Recommended Next Actions

Expectations:
- Be skeptical of false positives from custom circuits and internal experimentation.
- Prioritize real external-user product risks over raw invocation counts.
- Optimize for actionable maintainer insight, not exhaustive cataloging.
```
