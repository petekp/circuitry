# Continuity Control Plane RFC

Status: Selected for implementation

## Decision

Circuit continuity moves to a single engine-owned control plane:

- authoritative index: `.circuit/control-plane/continuity-index.json`
- authoritative records: `.circuit/control-plane/continuity-records/<record-id>.json`

Everything else is deleted from the design.

There is:

- no canonical `~/.claude/projects/.../handoff.md`
- no run-local `artifacts/handoff.md`
- no continuity `render` command
- no legacy import path
- no downgrade or compatibility story

This repo is treated as a new codebase. We optimize for one clear authority model, not migration safety for older installs.

## Mission

Replace prompt-authored markdown continuity with engine-owned structured continuity so save, resume, clear, and session-start all resolve through one deterministic state model.

## Invariants

| ID | Invariant | Testable statement |
|---|---|---|
| I1 | Ordinary save is non-terminal | Saving continuity during a live run does not append `run_completed` and does not set `state.status=handed_off`. |
| I2 | One selector exists | Continuity reads resolve only through the continuity index and the pointed record. |
| I3 | No filesystem scans | Continuity does not discover state by scanning run roots. |
| I4 | Session-start is passive | Session-start may announce availability but never auto-resumes or inlines saved continuity as execution input. |
| I5 | Clear is deterministic | Clear removes the pending record and detaches the indexed current run. |
| I6 | Corrupt authority fails closed | Invalid index or record data produces an explicit failure instead of fallback guessing. |

## Authority Model

| Domain | Authority |
|---|---|
| Run execution | `<runRoot>/circuit.manifest.yaml` + `<runRoot>/events.ndjson` (`state.json` is derived output) |
| Continuity | `.circuit/control-plane/continuity-index.json` + pointed record |
| Active-run dashboard | `<runRoot>/artifacts/active-run.md` as runtime output only |

`active-run.md` may still exist as a runtime dashboard, but it is not continuity authority and is not a continuity compatibility surface.

## Storage Layout

```text
.circuit/
  control-plane/
    continuity-index.json
    continuity-records/
      <record-id>.json
  circuit-runs/
    <run-slug>/
      circuit.manifest.yaml
      events.ndjson
      state.json
      artifacts/
        active-run.md
```

## Schemas

### ContinuityIndexV1

```ts
interface ContinuityIndexV1 {
  schema_version: "1";
  project_root: string;
  current_run: null | {
    run_slug: string;
    run_root_rel: `.circuit/circuit-runs/${string}`;
    manifest_present: boolean;
    runtime_status: string | null;
    current_step: string | null;
    attached_at: string;
    last_validated_at: string;
  };
  pending_record: null | {
    record_id: string;
    payload_rel: `.circuit/control-plane/continuity-records/${string}.json`;
    continuity_kind: "run_ref" | "standalone";
    run_slug: string | null;
    created_at: string;
  };
}
```

### ContinuityRecordV1

```ts
interface ContinuityRecordV1 {
  schema_version: "1";
  record_id: string;
  created_at: string;
  project_root: string;
  run_ref: null | {
    run_slug: string;
    run_root_rel: `.circuit/circuit-runs/${string}`;
    manifest_present: boolean;
    runtime_status_at_save: string | null;
    current_step_at_save: string | null;
    runtime_updated_at_at_save: string | null;
  };
  git: {
    branch: string | null;
    head: string | null;
    base_commit: string | null;
    cwd: string;
  };
  narrative: {
    goal: string;
    next: string;
    state_markdown: string;
    debt_markdown: string;
  };
  resume_contract: {
    mode: "resume_run" | "resume_standalone";
    requires_explicit_resume: true;
    auto_resume: false;
  };
}
```

## CLI Contracts

### `circuit-engine continuity status`

- Reads only the index and pointed record.
- Returns current run attachment, pending record metadata, and warnings.

### `circuit-engine continuity save`

- Input: structured save request plus optional `--run-root`.
- Writes the continuity record and updates the index.
- Does not write markdown.
- Does not mutate runtime terminal state.

### `circuit-engine continuity resume`

- Selection order:
  1. `index.pending_record`
  2. `index.current_run`
  3. nothing
- Does not read handoff markdown.

### `circuit-engine continuity clear`

- Deletes the pending record if present.
- Clears `index.pending_record`.
- Clears `index.current_run`.
- Leaves no hidden continuity fallback.

There is no `render` or `import-legacy` command.

## Session-Start Rules

1. Read continuity status.
2. If `pending_record` exists, print a passive continuity banner only.
3. Else if `current_run` exists, refresh `active-run.md` from runtime state and print a passive active-run banner.
4. Do not auto-resume.
5. Do not read handoff markdown.
6. Do not scan run roots.

## Slash-Command Rules

- `/circuit:handoff resume` calls `circuit-engine continuity resume`
- `/circuit:handoff done` calls `circuit-engine continuity clear`
- host `/clear` re-runs passive `SessionStart`; it does not clear saved continuity
- `/circuit:handoff` save calls `circuit-engine continuity save`

Prompt surfaces may present record content or active-run fallback, but they do not read or mutate continuity files directly.

## Failure Model

- Missing or corrupt index/record data fails closed.
- There is no fallback to markdown, scan, or home-directory state.
- Atomic temp-write-plus-rename is required for both index and record writes.

## Out of Scope

- Preserving continuity from older installs
- Importing any historical handoff markdown
- Writing compatibility projections for other tools
- Downgrade correctness

## Exit Criteria

- All continuity paths use the control plane only.
- `findLatestActiveRun()` and markdown continuity selection are deleted.
- Session-start stays passive.
- Save is non-terminal.
- Clear is deterministic.
