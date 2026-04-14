# Circuit Literate Guide Rewrite Handoff Prompt

Use the prompt below in a fresh Codex session when you want Codex to
comprehensively rewrite Circuit's literate guide from scratch.

```text
You are taking over Circuit to rewrite the literate guide document from scratch.

Goal:
Replace `docs/literate-guide.md` with a fresh, comprehensive, human-readable
narrative guide that explains how Circuit actually works today. Do not do an
incremental polish pass. Rebuild the document from first principles based on
the current code and current shipped product surface.

Working mode:
- Be autonomous and persistent.
- Do not stop at analysis. Produce the rewritten document.
- Prefer authoritative current sources over inherited wording.
- Verify concrete claims against code before writing them.
- Optimize for clarity, coherence, and architectural truth, not changelog-style completeness.

Repo and environment:
- Repo root: `/Users/petepetrash/Code/circuit`
- Target document: `/Users/petepetrash/Code/circuit/docs/literate-guide.md`
- Use `/tmp/` for scratch notes if helpful.

Critical rules:
1. Rewrite the document from scratch.
   - You may read the current `docs/literate-guide.md` to identify gaps or useful
     themes, but do not preserve its structure by default and do not do
     section-by-section patching.
2. Treat current code and generated/shipped surfaces as the authority.
3. Distinguish clearly between:
   - authored workflow identity
   - generated prompt / command / surface projections
   - runtime execution and continuity state
4. Avoid stale historical framing unless it materially helps understanding the
   current system.
5. Do not present speculative architecture as if it is implemented.
6. When a detail is uncertain, resolve it by reading code rather than guessing.
7. If you modify any file under `hooks/`, `skills/`, `scripts/`, or plugin metadata,
   remember to run:
   - `cd /Users/petepetrash/Code/circuit && ./scripts/sync-to-cache.sh`

Primary sources to use

Start from the current implementation and only then use docs to help explain it.
At minimum, inspect:

- `scripts/runtime/engine/src/catalog/`
- `scripts/runtime/engine/src/cli/`
- `scripts/runtime/engine/src/dispatch.ts`
- `scripts/runtime/engine/src/dispatch-step.ts`
- `scripts/runtime/engine/src/derive-state.ts`
- `scripts/runtime/engine/src/continuity-control-plane.ts`
- `scripts/runtime/engine/src/resume.ts`
- `scripts/runtime/engine/src/render-active-run.ts`
- `scripts/runtime/generated/prompt-contracts.json`
- `scripts/runtime/generated/surface-manifest.json`
- `skills/*/circuit.yaml`
- `skills/*/SKILL.md`
- `commands/*.md`
- `README.md`
- `CIRCUITS.md`
- `ARCHITECTURE.md`
- `docs/control-plane-ownership.md` if present and still relevant

What the rewritten guide should accomplish

The final document should:

1. Explain the problem Circuit solves in plain language.
2. Define the core vocabulary cleanly and consistently.
3. Explain the major system split(s) and ownership boundaries.
4. Show how authored skills become catalog entries and public command surfaces.
5. Explain how the shipped surface is generated, inventoried, synced, and verified.
6. Explain how runtime execution works:
   - bootstrap
   - event log
   - derived state
   - artifacts
   - checkpoints
   - dispatch
   - resume
7. Explain continuity and handoff in the current control-plane model.
8. Explain custom circuits as they exist today.
9. Explain the worker / dispatch boundary, including built-in `agent` and `codex`.
10. Give the reader a coherent mental model of the whole system, not just a file tour.

Style requirements

- Write it as a literate, essay-like walkthrough rather than a reference dump.
- Keep it human-owned in tone: explanatory, deliberate, and readable front to back.
- Prefer a small number of strong sections with clean transitions.
- Use diagrams only when they materially improve understanding.
- If you use Mermaid, ensure labels are readable and accurate.
- Avoid bloated prose, marketing language, or vague abstractions.
- Avoid turning the guide into a test plan, migration memo, or implementation diff.
- Prefer current truth over exhaustive mention of every module.

Recommended writing approach

1. Build a fresh outline first.
   - Decide the narrative arc before editing the document.
2. Gather evidence from code.
   - Confirm the current responsibilities and boundaries.
3. Identify what the old guide got right, what is stale, and what is missing.
4. Rewrite the entire document body around the new outline.
5. Re-read the finished guide against the code and prune anything unearned.

Required outputs during the session

Create these scratch artifacts:

1. `/tmp/circuit-literate-guide-rewrite/outline.md`
   - the new section outline

2. `/tmp/circuit-literate-guide-rewrite/evidence.md`
   - key implementation notes and file references you relied on

3. `/tmp/circuit-literate-guide-rewrite/final-notes.md`
   - short summary of what changed in the rewrite
   - any unresolved uncertainties or follow-up doc opportunities

Execution expectations

- Read before writing.
- Replace the document content intentionally rather than editing around old prose.
- If you find the current guide is directionally right but structurally weak,
  still rewrite it as a fresh document.
- If you discover stale or contradictory product docs elsewhere that materially
  affect the guide, you may update them too if doing so is clearly safe and
  improves consistency.

Quality bar for closing

Do not conclude until:
- `docs/literate-guide.md` reads as a fresh, coherent document
- the document is grounded in the current implementation
- major current subsystems and boundaries are accurately explained
- obvious stale claims from the old guide are gone
- scratch notes are written to `/tmp/circuit-literate-guide-rewrite/`
- if any plugin files changed under `scripts/`, `skills/`, `hooks/`, or plugin metadata,
  the cache has been synced

Mindset

Treat this as a narrative rebuild, not a cleanup pass.

Your job is to produce the document a thoughtful maintainer would want a strong
new collaborator to read first: trustworthy, readable, current, and architecturally sharp.
```
