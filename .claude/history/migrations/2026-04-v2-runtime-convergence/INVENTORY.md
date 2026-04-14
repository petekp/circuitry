# Codebase Inventory: Circuitry v1-to-v2 Migration

Generated 2026-03-31.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total skills | 13 |
| Skills with circuit.yaml | 10 |
| Skills without circuit.yaml | 3 (router, setup, workers) |
| Total SKILL.md lines | 6,877 |
| Total circuit.yaml lines | 1,576 |
| Total relay script lines | 1,048 |
| Total worker template lines | 285 |
| Total infra lines (hooks, verify, plugin) | 284 |
| Grand total prose + code lines | ~10,070 |

---

## Per-Skill Inventory

| Skill | SKILL.md Lines | circuit.yaml | circuit.yaml Lines | Has Resume Awareness | compose-prompt refs | dispatch.sh refs | Runtime Prose (approx) | Human Doc (approx) |
|-------|---------------|--------------|--------------------|--------------------|-------------------|-----------------|----------------------|-------------------|
| router | 112 | No | -- | No | 0 | 0 | ~30 (routing logic) | ~82 (disambiguation, route table) |
| setup | 133 | No | -- | No | 2 | 0 | ~90 (workflow steps, bash) | ~43 (when to use, output) |
| workers | 178 | No | -- | Yes (Resume section) | 1 | 2 | ~140 (dispatch, plan, implement, review, converge) | ~38 (glossary, principles) |
| run | 386 | Yes | 92 | Yes | 1 | 2 | ~310 (phases, dispatch, synthesis, resume) | ~76 (when to use, glossary, principles) |
| develop | 812 | Yes | 143 | Yes (full + light) | 8 | 8 | ~680 (10 steps, dispatch patterns, light mode) | ~132 (when to use, glossary, principles) |
| cleanup | 730 | Yes | 183 | Yes | 6 | 5 | ~600 (8 steps, 5 workers, batched execution) | ~130 (when to use, glossary, principles) |
| repair-flow | 609 | Yes | 142 | Yes | 5 | 5 | ~500 (8 steps, forensics, workers adapter) | ~109 (when to use, glossary, principles) |
| harden-spec | 646 | Yes | 161 | Yes | 5 | 5 | ~520 (10 steps, 3 parallel reviews) | ~126 (when to use, glossary, principles) |
| create | 860 | Yes | 108 | Yes | 9 | 8 | ~580 (5 steps, reference pack, anti-patterns) | ~280 (reference pack, starters, checklists) |
| decide | 628 | Yes | 141 | Yes | 4 | 4 | ~510 (8 steps, scoring, pressure test) | ~118 (when to use, glossary, principles) |
| migrate | 617 | Yes | 135 | Yes | 6 | 4 | ~500 (8 steps, coexistence, batch migration) | ~117 (when to use, glossary, principles) |
| ratchet-quality | 761 | Yes | 394 | Yes | 1 | 1 | ~650 (17 steps, 6 phases, calibration) | ~111 (when to use, glossary, principles) |
| dry-run | 406 | Yes | 77 | No (validator, not circuit) | 5 | 1 | ~340 (checklist, simulation, trace model) | ~66 (when to use, core model) |

**Totals:** 6,877 SKILL.md lines + 1,576 circuit.yaml lines = 8,453 lines of skill definition.

**Runtime prose vs. human documentation split:** Roughly 80-85% of SKILL.md content is runtime prose (dispatch instructions, bash commands, artifact schemas, gate definitions, resume logic, adapter contracts). Only 15-20% is human-facing documentation (When to Use, Glossary, Principles, front matter).

---

## Scripts Inventory

### Relay Scripts (`scripts/relay/`)

| Script | Lines | Role | Dependencies |
|--------|-------|------|-------------|
| compose-prompt.sh | 291 | Assembles worker prompts from header + skills + template | bash, python3 (for YAML config parsing), PyYAML |
| dispatch.sh | 142 | Backend-agnostic worker dispatch (codex / agent / custom) | bash, python3 (for config parsing), codex CLI (optional) |
| update-batch.sh | 615 | Deterministic batch.json state machine | bash, python3 (embedded Python for JSON manipulation) |

Total relay script lines: 1,048.

Key design note: `update-batch.sh` is entirely a bash wrapper around an embedded Python script (lines 109-615). The Python handles all JSON state transitions, event sourcing (events.ndjson), validation, and rebuild.

### Worker Templates (`skills/workers/references/`)

| Template | Lines | Used By |
|----------|-------|---------|
| implement-template.md | 42 | Workers implement phase |
| review-template.md | 50 | Workers review phase |
| review-preamble.md | 17 | Prepended before review/ship-review/converge templates |
| ship-review-template.md | 47 | Final ship reviews |
| converge-template.md | 59 | Workers convergence phase |
| relay-protocol.md | 25 | Legacy fallback appended when inline relay headings missing |
| agents-md-template.md | 45 | Template for AGENTS.md creation |

Total template lines: 285.

### Other Scripts

| Script | Lines | Role |
|--------|-------|------|
| scripts/verify-install.sh | 193 | Prerequisite checker (codex, python3, PyYAML, bash, skills, scripts, templates) |

---

## Infrastructure Inventory

### Plugin Definition (`.claude-plugin/`)

| File | Lines | Purpose |
|------|-------|---------|
| plugin.json | 21 | Plugin identity: name, version (0.2.0), description, author, repo, license, keywords |
| marketplace.json | 22 | Marketplace registration: owner, plugin list |

### Hooks (`hooks/`)

| File | Lines | Purpose |
|------|-------|---------|
| hooks.json | 16 | SessionStart hook binding (fires on startup/resume/clear/compact) |
| session-start.sh | 75 | Session banner: checks codex + python3 prerequisites, prints circuit reference table |

### Key Runtime Dependencies

- **Python 3** -- required by `update-batch.sh` (batch state machine) and config parsing in `compose-prompt.sh` / `dispatch.sh`
- **PyYAML** -- optional, for `circuit.config.yaml` skill resolution via `--circuit` flag
- **Codex CLI** -- optional, preferred dispatch backend; Agent tool is automatic fallback
- **Bash 3.2+** -- all scripts compatible with macOS default bash

---

## v1 Anti-Pattern Counts

These patterns represent v1 runtime machinery embedded directly in SKILL.md prose. In v2, most of this should move to structured metadata, a runtime engine, or code.

| Pattern | Occurrences | Files | Notes |
|---------|------------|-------|-------|
| `Resume Awareness` sections | 11 | 9 skills | Every circuit skill (except router, setup, dry-run) has hand-written resume logic in prose |
| `compose-prompt` references | 54 | 13 files | Every dispatch-capable skill contains bash invocations of compose-prompt.sh |
| `dispatch.sh` references | 45 | 11 files | Near-identical dispatch blocks repeated across skills |
| `{relay_root}` tokens | 33 | 7 files | Placeholder substitution embedded in templates and workers skill |
| `batch.json` references | 42 | 9 files | Batch state management instructions repeated in prose |

### Additional Structural Patterns (not counted above)

- **Canonical Header Schema**: Duplicated in full (20+ lines) across develop, decide, harden-spec, repair-flow, cleanup, migrate, create, dry-run. Eight near-identical copies.
- **Dispatch Backend section**: Every circuit skill contains a ~15-line section explaining codex vs. agent detection. Identical across 10+ skills.
- **Domain Skill Selection section**: Every circuit has a variant. Same rules, different examples.
- **Circuit Breaker section**: Every circuit has one. Similar structure, circuit-specific triggers.
- **Glossary definitions**: "Artifact", "Worker report", "Synthesis" repeated identically across 8+ skills.

---

## Migration Leverage Assessment

### Highest-Leverage Targets (most duplication to eliminate)

1. **Canonical Header Schema** -- 8 copies of the same 20-line block. A v2 runtime could enforce this structurally, eliminating ~160 lines of repeated prose.

2. **Dispatch Backend / compose-prompt / dispatch.sh blocks** -- 54 compose-prompt references + 45 dispatch.sh references across skills. These are near-identical bash incantations. A v2 runtime that owns dispatch would eliminate all of them from SKILL.md, saving roughly 300-500 lines of repeated shell ceremony across the corpus.

3. **Resume Awareness sections** -- 11 occurrences across 9 skills. Each is hand-written prose describing artifact chain traversal logic. A v2 runtime with built-in resume-from-artifacts could replace all of these with structured metadata in circuit.yaml, saving ~200 lines.

4. **Glossary and shared definitions** -- Identical Artifact/Worker report/Synthesis glossary entries appear in 8+ skills. Could be a single shared reference.

5. **batch.json prose** -- 42 references across 9 files. The workers skill and every skill that delegates to workers contains prose describing batch.json structure and readback order. A v2 workers adapter contract could absorb this.

### What Must Stay in SKILL.md (v2-safe)

- **Step-specific prompt header content** -- Mission, inputs, output schema, success criteria. This is the differentiated content per circuit.
- **Gate definitions** -- What "done" means for each step. Step-specific by nature.
- **Reopen choreography** -- What happens when a verdict says REVISE or REOPEN. Circuit-specific branching.
- **When to Use / When NOT to Use** -- Human-facing routing guidance.
- **Principles** -- Circuit-specific design constraints (though shared ones like "Artifacts, not activities" could be factored out).

### Estimated Line Reduction

Conservative estimate: a v2 runtime that handles dispatch, resume, header schema, and shared glossary could reduce the total SKILL.md corpus from ~6,877 lines to ~3,500-4,200 lines (40-50% reduction). The eliminated lines are mechanical repetition, not differentiated content.

### Risk Areas

- **ratchet-quality** is the largest and most complex circuit (761 SKILL.md lines + 394 circuit.yaml lines = 1,155 total). It has 17 steps and a calibration subsystem. Migration here will be the hardest to validate.
- **create** contains the Reference Pack (starters, checklists, anti-pattern catalog) that other circuits were authored from. If v2 changes the circuit contract, the Reference Pack becomes stale.
- **workers** is a shared dependency -- every circuit that dispatches implementation work delegates to it. Changes to the workers contract propagate to 7+ circuits.
- **compose-prompt.sh** is the only prompt assembler. It has organic complexity (relay-root substitution, template contamination guards, legacy fallback). Any v2 replacement must preserve its behavior or explicitly break compatibility.
