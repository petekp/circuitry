# Continuity Control Plane Decisions

## D1 — 2026-04-12 — No backward compatibility

This migration assumes a fresh codebase. We do not support legacy import, compatibility projections, or downgrade behavior.

## D2 — 2026-04-12 — Index + records are the only continuity authority

Continuity lives only in `.circuit/control-plane/continuity-index.json` and `.circuit/control-plane/continuity-records/<record-id>.json`.

## D3 — 2026-04-12 — Session-start stays passive

Session-start may announce continuity or an attached run, but it never auto-resumes.

## D4 — 2026-04-12 — Scan fallback is deleted

Continuity never discovers state by scanning `.circuit/circuit-runs/**`.
