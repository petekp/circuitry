#!/usr/bin/env bash
# session-start.sh -- Outputs the Circuitry plugin session banner as markdown
#
# Called by hooks.json on SessionStart. Checks prerequisites and lists
# available circuits.

set -uo pipefail

# ── Prerequisite check: Codex CLI ─────────────────────────────────────
if command -v codex >/dev/null 2>&1; then
  DISPATCH_BACKEND="codex"
else
  DISPATCH_BACKEND="agent"
  cat <<'NOTE'
> **Dispatch backend: Agent (Codex CLI not found)**
>
> Dispatch steps will use Claude Code's **Agent tool** (`isolation: "worktree"`)
> instead of `codex exec`. Circuits work fully in this mode -- the artifact chain,
> gates, and resume logic are identical regardless of backend.
>
> For better parallelism, you can optionally install Codex CLI:
> ```
> npm install -g @openai/codex
> ```

---

NOTE
fi

# ── Prerequisite check: Python 3 ────────────────────────────────────
if ! command -v python3 >/dev/null 2>&1; then
  cat <<'NOTE'
> **Python 3 not found** -- Circuitry scripts require Python 3 for batch state
> management. Install with: `brew install python3` (macOS) or
> `apt install python3` (Linux).

---

NOTE
fi

# ── Stale .relay/ detection ──────────────────────────────────────────
# Projects that used Circuitry before the .relay -> .circuitry rename
# may still have a .relay/ directory. If Claude sees it on disk, the LLM
# can drift and write state there instead of .circuitry/. Warn loudly.
if [[ -d ".relay" ]]; then
  cat <<'STALE'
> **Stale `.relay/` directory detected.** Circuitry now uses `.circuitry/` as
> its state directory. The `.relay/` directory is from a previous version.
>
> **IMPORTANT:** Always use `.circuitry/` for circuit state. Never write to
> `.relay/` even though it exists on disk. If you need old run data, read
> from `.relay/` but write all new state to `.circuitry/`.
>
> To migrate: `mv .relay .circuitry` and update `.gitignore` to use
> `.circuitry/` instead of `.relay/`.

---

STALE
fi

# ── Handoff resume detection ─────────────────────────────────────────
# Check for a pending handoff file written by the /handoff skill.
# If found, inject it so the fresh session picks up where the last left off.
# Uses git-root normalization so handoffs are found from any subdirectory.
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  handoff_dir="$(git rev-parse --show-toplevel)"
else
  handoff_dir="$PWD"
fi
handoff_slug=$(printf '%s' "$handoff_dir" | tr '/' '-')
handoff_file="$HOME/.claude/projects/${handoff_slug}/handoff.md"

if [[ -f "$handoff_file" ]] && head -1 "$handoff_file" | grep -q '^# Handoff'; then
  cat <<'HANDOFF_HEADER'
> **Pending handoff detected.** A previous session saved its state before ending. Resume context follows.

---

HANDOFF_HEADER
  cat "$handoff_file"
  cat <<'HANDOFF_FOOTER'

---

Resume from the handoff above.

1. Read DIR. This is your working directory for all file operations and git commands.
2. Read GOAL and verify it is still accurate. Check it against current repo state. Do not acknowledge it -- assess it. If it appears stale, say so before acting.
3. Read all DEBT entries. RULED OUT approaches should not be re-investigated unless you have new evidence that changes the original reasoning. BLOCKED entries may be unblocked -- check the unblocking condition. CONSTRAINT entries are operating rules for this session.
4. Read STATE for current facts.
5. If NEXT is DO: execute it. The DO prefix means the action is ready. You have already read DEBT -- use it to operate safely.
6. If NEXT is DECIDE: resolve the decision using STATE and DEBT before taking any action. If the DECIDE text says "need user input," stop and ask.
7. Run /handoff done when this work is complete.

---

HANDOFF_FOOTER
fi

# ── Banner ────────────────────────────────────────────────────────────
cat <<'BANNER'
# Circuitry

```
/circuit <describe your task>
```

The router picks the right circuit for your task automatically. Named circuits like `/circuit:run <task>` are available as expert shortcuts.

Circuits are structured, multi-phase workflows where each step writes a durable file on disk that feeds the next. Heavy implementation is dispatched to isolated worker sessions automatically (via **Codex CLI** when installed, or **Claude Agent** as fallback). If a session crashes, a fresh one reads the files and resumes exactly where it stopped.

---

### Reference: All Circuits

| Circuit | Invoke | Use When |
|---------|--------|----------|
| **Run** | `/circuit:run` | Clear task that benefits from planning and review |
| **Develop** | `/circuit:develop` | Feature delivery with unclear approach (`--spec-review` for existing specs) |
| **Decide** | `/circuit:decide` | Architecture choices with real tradeoffs |
| **Fix** | `/circuit:fix` | Known bug with test-first discipline |
| **Repair Flow** | `/circuit:repair-flow` | Fix a broken or flaky end-to-end flow |
| **Ratchet Quality** | `/circuit:ratchet-quality` | Autonomous overnight quality improvement |
| **Cleanup** | `/circuit:cleanup` | Dead code and stale docs sweep |
| **Migrate** | `/circuit:migrate` | Framework swaps, dependency replacements, architecture transitions |
| **Circuit Create** | `/circuit:create` | Author a new circuit from a workflow description |
| **Dry Run** | `/circuit:dry-run` | Validate a circuit skill's mechanical soundness |
| **Setup** | `/circuit:setup` | Discover skills and generate circuit.config.yaml |

Use `/circuit:workers` to orchestrate workers directly without a circuit wrapper.
BANNER
