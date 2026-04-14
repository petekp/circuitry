# Continuity Control Plane Validation Matrix

Status: Shipped (companion to `docs/continuity-control-plane-rfc.md`). Validation scenarios correspond to shipped behavior.

## Scenario Matrix

| ID | Scenario | Expected behavior | Invariants |
|---|---|---|---|
| S1 | Active run save then explicit resume | Save writes one record and one index update; resume returns the saved record; runtime stays non-terminal | I1, I2 |
| S2 | Standalone save then explicit resume | Save writes a standalone record; resume returns it without requiring any run attachment | I2 |
| S3 | Session-start sees pending continuity | Session-start prints a passive banner and does not inline saved continuity | I4 |
| S4 | Session-start sees only current run | Session-start refreshes `active-run.md` from runtime state and stays passive | I4 |
| S5 | Clear after save | Pending record is deleted and index fields are cleared | I5 |
| S6 | Corrupt authoritative record | Resume/status fail closed with an explicit error | I6 |
| S7 | Corrupt index | Status/session-start fail closed with an explicit error | I6 |
| S8 | Attached run advances after save | Resume still returns the saved record and warns that runtime moved on | I1, I2 |
| S9 | Explicit resume with no pending record but valid current run | Resume returns deterministic active-run fallback based on indexed current run | I2 |
| S10 | No saved continuity and no active run | Resume reports nothing to resume without guessing from scans or markdown | I2, I3 |

## Negative Guarantees

The implementation is incomplete if any of these remain true:

- continuity reads `handoff.md`
- continuity writes `handoff.md`
- continuity scans `.circuit/circuit-runs/**`
- continuity exposes `import-legacy`
- continuity exposes `render`

## Exit Criteria

- all scenarios above have automated coverage
- source and bundled CLIs agree on the no-compat behavior
- repo verification passes after generated and bundled surfaces are refreshed
