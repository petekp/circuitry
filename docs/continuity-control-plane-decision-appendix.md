# Continuity Control Plane Decision Appendix

Status: Companion to `docs/continuity-control-plane-rfc.md`

## Closed Decisions

### D1. No backward compatibility

This work assumes a fresh codebase. We do not carry legacy import, compatibility projections, or downgrade support.

### D2. No markdown continuity

Continuity is not written to `handoff.md` anywhere. Markdown is no longer part of the continuity model.

### D3. No scan fallback

`findLatestActiveRun()` and similar heuristics are deleted from continuity selection. If authoritative continuity is missing, the system says so.

### D4. Session-start remains passive

Passive announcement survives the cutover. Auto-resume does not return.

## Rejected Noise

- Canonical home handoff files
- Run-local handoff mirrors
- Projection revision tracking
- Legacy import state in the index
- Record metadata about imported sources
- Compatibility-only CLI commands like `render` and `import-legacy`

## Why This Is Better

- One place to inspect when continuity is wrong
- Less code in hooks and prompt surfaces
- No migration-time heuristic branches to keep alive forever
- Smaller test matrix

## Reopen Conditions

Reopen only if a real product requirement appears for:

1. continuity portability outside the repo
2. continuity recovery from older installs
3. multiple concurrent saved continuity records per worktree
