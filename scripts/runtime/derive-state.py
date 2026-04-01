#!/usr/bin/env python3
"""Rebuild state.json from events.ndjson for a Circuitry v2 run.

Usage:
    python3 scripts/runtime/derive-state.py <run-root>

Reads circuit.manifest.yaml and events.ndjson, applies the state projection
rules from the v2 spec (Section 5), validates the result against
schemas/state.schema.json, and writes state.json.

Exits 0 on success, 1 on invalid state.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import jsonschema
import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_SCHEMA_PATH = REPO_ROOT / "schemas" / "state.schema.json"


def load_state_schema() -> dict:
    with open(STATE_SCHEMA_PATH) as f:
        return json.load(f)


def load_manifest(run_root: Path) -> dict:
    manifest_path = run_root / "circuit.manifest.yaml"
    if not manifest_path.exists():
        raise FileNotFoundError(f"circuit.manifest.yaml not found in {run_root}")
    with open(manifest_path) as f:
        return yaml.safe_load(f)


def load_events(run_root: Path) -> list[dict]:
    events_path = run_root / "events.ndjson"
    if not events_path.exists():
        return []
    events = []
    with open(events_path) as f:
        for line in f:
            line = line.strip()
            if line:
                events.append(json.loads(line))
    return events


def derive_state(manifest: dict, events: list[dict]) -> dict:
    """Apply state projection rules over events to produce state.json content.

    This implements the deterministic projection function f(events) -> state
    as specified in Section 5 of the v2 architecture spec.
    """
    circuit = manifest.get("circuit", {})
    circuit_id = circuit.get("id", "")
    manifest_version = circuit.get("version", "")

    # Initialize empty state
    state: dict = {
        "schema_version": "1",
        "run_id": "",
        "circuit_id": circuit_id,
        "manifest_version": manifest_version,
        "status": "initialized",
        "current_step": None,
        "selected_entry_mode": "default",
        "git": {"head_at_start": "0000000"},
        "artifacts": {},
        "jobs": {},
        "checkpoints": {},
    }

    # Internal tracking for step completion (not serialized to state.json)
    # step_completion[step_id] = {"gate_evaluated": bool, "route": str|None}
    step_completion: dict[str, dict] = {}

    for event in events:
        event_type = event.get("event_type", "")
        payload = event.get("payload", {})
        occurred_at = event.get("occurred_at", "")

        # Rule 3: run_started initializes identity, mode, times, git, status
        if event_type == "run_started":
            state["run_id"] = event.get("run_id", "")
            state["selected_entry_mode"] = payload.get("entry_mode", "default")
            state["started_at"] = occurred_at
            state["updated_at"] = occurred_at
            state["git"]["head_at_start"] = payload.get("head_at_start", "0000000")
            state["status"] = "initialized"

        # Rule 4: step_started sets current_step and status
        elif event_type == "step_started":
            step_id = payload.get("step_id", "")
            state["current_step"] = step_id
            state["status"] = "in_progress"
            state["updated_at"] = occurred_at

        # Rule 5: dispatch_requested upserts jobs
        elif event_type == "dispatch_requested":
            step_id = event.get("step_id", payload.get("step_id", ""))
            if not step_id:
                step_id = state.get("current_step", "")
            attempt = payload.get("attempt", 1)
            state["jobs"][step_id] = {
                "attempt": attempt,
                "status": "requested",
                "request": payload.get("request_path", ""),
            }
            state["status"] = "waiting_worker"
            state["updated_at"] = occurred_at

        # Rule 5: dispatch_received upserts jobs
        elif event_type == "dispatch_received":
            step_id = event.get("step_id", payload.get("step_id", ""))
            if not step_id:
                step_id = state.get("current_step", "")
            attempt = payload.get("attempt", 1)
            job = state["jobs"].get(step_id, {"attempt": attempt, "status": "requested"})
            job["status"] = "running"
            job["receipt"] = payload.get("receipt_path", "")
            job["attempt"] = attempt
            state["jobs"][step_id] = job
            state["status"] = "waiting_worker"
            state["updated_at"] = occurred_at

        # Rule 5: job_completed upserts jobs
        elif event_type == "job_completed":
            step_id = event.get("step_id", payload.get("step_id", ""))
            if not step_id:
                step_id = state.get("current_step", "")
            attempt = payload.get("attempt", 1)
            completion = payload.get("completion", "complete")
            job = state["jobs"].get(step_id, {"attempt": attempt, "status": "requested"})
            job["status"] = "complete" if completion == "complete" else "failed"
            job["result"] = payload.get("result_path", "")
            job["attempt"] = attempt
            state["jobs"][step_id] = job
            state["status"] = "in_progress"
            state["updated_at"] = occurred_at

        # Rule 7: checkpoint_requested upserts checkpoints
        elif event_type == "checkpoint_requested":
            step_id = event.get("step_id", payload.get("step_id", ""))
            if not step_id:
                step_id = state.get("current_step", "")
            attempt = payload.get("attempt", 1)
            state["checkpoints"][step_id] = {
                "attempt": attempt,
                "status": "waiting",
                "request_path": payload.get("request_path", ""),
            }
            state["status"] = "waiting_checkpoint"
            state["updated_at"] = occurred_at

        # Rule 7: checkpoint_resolved upserts checkpoints
        elif event_type == "checkpoint_resolved":
            step_id = event.get("step_id", payload.get("step_id", ""))
            if not step_id:
                step_id = state.get("current_step", "")
            attempt = payload.get("attempt", 1)
            cp = state["checkpoints"].get(step_id, {"attempt": attempt, "status": "waiting"})
            cp["status"] = "resolved"
            cp["response_path"] = payload.get("response_path", "")
            cp["selection"] = payload.get("selection", "")
            cp["attempt"] = attempt
            state["checkpoints"][step_id] = cp
            state["status"] = "in_progress"
            state["updated_at"] = occurred_at

        # Rule 8: artifact_written updates artifacts
        elif event_type == "artifact_written":
            artifact_path = payload.get("artifact_path", "")
            step_id = event.get("step_id", "")
            if not step_id:
                step_id = state.get("current_step", "")
            state["artifacts"][artifact_path] = {
                "status": "complete",
                "gate": "pending",
                "produced_by": step_id or "",
                "updated_at": occurred_at,
            }
            state["updated_at"] = occurred_at

        # Rule 8/9: gate_passed updates artifacts and marks step complete
        elif event_type == "gate_passed":
            gate_step_id = payload.get("step_id", "")
            route = payload.get("route", "")
            # Update artifact gate status for artifacts produced by this step
            for art_path, art_info in state["artifacts"].items():
                if art_info.get("produced_by") == gate_step_id:
                    art_info["gate"] = "pass"
                    art_info["updated_at"] = occurred_at
            # Track step completion
            step_completion[gate_step_id] = {"gate_evaluated": True, "route": route}
            state["updated_at"] = occurred_at

        # Rule 8/9: gate_failed updates artifacts
        elif event_type == "gate_failed":
            gate_step_id = payload.get("step_id", "")
            route = payload.get("route", "")
            for art_path, art_info in state["artifacts"].items():
                if art_info.get("produced_by") == gate_step_id:
                    art_info["gate"] = "fail"
                    art_info["updated_at"] = occurred_at
            # A gate_failed with a terminal route still marks the step complete
            step_completion[gate_step_id] = {"gate_evaluated": True, "route": route}
            state["updated_at"] = occurred_at

        # Rule 10: step_reopened resets step, marks artifacts stale
        elif event_type == "step_reopened":
            to_step = payload.get("to_step", "")
            # Reset step completion
            if to_step in step_completion:
                del step_completion[to_step]
            # Mark artifacts produced by the reopened step as stale
            for art_path, art_info in state["artifacts"].items():
                if art_info.get("produced_by") == to_step:
                    art_info["status"] = "stale"
                    art_info["gate"] = "pending"
                    art_info["updated_at"] = occurred_at
            # Reset job/checkpoint records for that step (they no longer make it complete)
            if to_step in state["jobs"]:
                del state["jobs"][to_step]
            if to_step in state["checkpoints"]:
                del state["checkpoints"][to_step]
            state["current_step"] = to_step
            state["status"] = "in_progress"
            state["updated_at"] = occurred_at

        # Rule 11: run_completed sets final state
        elif event_type == "run_completed":
            status = payload.get("status", "completed")
            terminal_target = payload.get("terminal_target", "@complete")
            state["status"] = status
            state["terminal_target"] = terminal_target
            state["current_step"] = None
            state["updated_at"] = occurred_at

    return state


def validate_state(state: dict, schema: dict) -> list[str]:
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(state), key=lambda e: list(e.path))
    return [f"{'.'.join(str(p) for p in e.absolute_path)}: {e.message}" for e in errors]


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/runtime/derive-state.py <run-root>", file=sys.stderr)
        return 1

    run_root = Path(sys.argv[1]).resolve()
    if not run_root.is_dir():
        print(f"Error: run root does not exist: {run_root}", file=sys.stderr)
        return 1

    try:
        manifest = load_manifest(run_root)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    events = load_events(run_root)
    state = derive_state(manifest, events)

    schema = load_state_schema()
    errors = validate_state(state, schema)
    if errors:
        print("State validation errors:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    state_path = run_root / "state.json"
    with open(state_path, "w") as f:
        json.dump(state, f, indent=2)
        f.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
