#!/usr/bin/env python3
"""Append a typed event to events.ndjson for a Circuitry v2 run.

Usage:
    python3 scripts/runtime/append-event.py <run-root> <event-type> \
        [--payload '{"key": "value"}'] [--step-id <id>] [--attempt <n>]

The event is validated against schemas/event.schema.json before appending.
Exits 0 on success, 1 on validation failure.
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import jsonschema
import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
EVENT_SCHEMA_PATH = REPO_ROOT / "schemas" / "event.schema.json"


def load_event_schema() -> dict:
    with open(EVENT_SCHEMA_PATH) as f:
        return json.load(f)


def read_run_identity(run_root: Path) -> tuple[str, str]:
    """Read circuit_id and run_id from the run root's manifest or state."""
    state_path = run_root / "state.json"
    manifest_path = run_root / "circuit.manifest.yaml"

    if state_path.exists():
        with open(state_path) as f:
            state = json.load(f)
        return state.get("circuit_id", ""), state.get("run_id", "")

    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = yaml.safe_load(f)
        circuit_id = manifest.get("circuit", {}).get("id", "")
        # run_id may come from the directory name if not in manifest
        run_id = run_root.name
        return circuit_id, run_id

    return "", run_root.name


def build_event(
    run_root: Path,
    event_type: str,
    payload: dict,
    step_id: str | None,
    attempt: int | None,
) -> dict:
    circuit_id, run_id = read_run_identity(run_root)

    event = {
        "schema_version": "1",
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "payload": payload,
    }

    if circuit_id:
        event["circuit_id"] = circuit_id
    if step_id:
        event["step_id"] = step_id
    if attempt is not None:
        event["attempt"] = attempt

    return event


def validate_event(event: dict, schema: dict) -> list[str]:
    """Validate an event against the schema. Returns list of error messages."""
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(event), key=lambda e: list(e.path))
    return [f"{'.'.join(str(p) for p in e.absolute_path)}: {e.message}" for e in errors]


def append_event(run_root: Path, event: dict) -> None:
    events_path = run_root / "events.ndjson"
    with open(events_path, "a") as f:
        f.write(json.dumps(event, separators=(",", ":")) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Append a typed event to events.ndjson"
    )
    parser.add_argument("run_root", type=Path, help="Path to the run root directory")
    parser.add_argument("event_type", help="Event type (e.g., run_started, step_started)")
    parser.add_argument("--payload", default="{}", help="JSON payload string")
    parser.add_argument("--step-id", default=None, help="Step ID")
    parser.add_argument("--attempt", type=int, default=None, help="Attempt number")

    args = parser.parse_args()

    run_root = args.run_root.resolve()
    if not run_root.is_dir():
        print(f"Error: run root does not exist: {run_root}", file=sys.stderr)
        return 1

    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError as e:
        print(f"Error: invalid JSON payload: {e}", file=sys.stderr)
        return 1

    schema = load_event_schema()
    event = build_event(run_root, args.event_type, payload, args.step_id, args.attempt)

    errors = validate_event(event, schema)
    if errors:
        print("Validation errors:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    append_event(run_root, event)
    return 0


if __name__ == "__main__":
    sys.exit(main())
