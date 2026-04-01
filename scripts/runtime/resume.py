#!/usr/bin/env python3
"""Find the resume point for a Circuitry v2 run.

Usage:
    python3 scripts/runtime/resume.py <run-root>

Loads circuit.manifest.yaml and state.json, walks steps in graph order,
and returns the first incomplete step as the resume point.

Output (JSON to stdout):
    {"resume_step": "<step-id>", "status": "<run-status>", "reason": "<why>"}
    or
    {"resume_step": null, "status": "completed", "reason": "all steps complete"}

Exits 0 always (the resume point is informational).
"""

import json
import os
import sys
from pathlib import Path

import yaml

# Import derive_state logic for rebuilding stale state
sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module


REPO_ROOT = Path(__file__).resolve().parents[2]


def load_manifest(run_root: Path) -> dict:
    manifest_path = run_root / "circuit.manifest.yaml"
    if not manifest_path.exists():
        return {}
    with open(manifest_path) as f:
        return yaml.safe_load(f)


def load_or_rebuild_state(run_root: Path) -> dict:
    """Load state.json, rebuilding from events if missing or stale."""
    state_path = run_root / "state.json"
    events_path = run_root / "events.ndjson"

    needs_rebuild = False

    if not state_path.exists():
        needs_rebuild = True
    elif events_path.exists():
        state_mtime = os.path.getmtime(state_path)
        events_mtime = os.path.getmtime(events_path)
        if events_mtime > state_mtime:
            needs_rebuild = True

    if needs_rebuild:
        # Import and run derive_state
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "derive_state",
                Path(__file__).resolve().parent / "derive-state.py"
            )
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            manifest = mod.load_manifest(run_root)
            events = mod.load_events(run_root)
            state = mod.derive_state(manifest, events)

            # Write rebuilt state
            with open(state_path, "w") as f:
                json.dump(state, f, indent=2)
                f.write("\n")

            return state
        except Exception as e:
            # If rebuild fails, try loading existing state anyway
            if state_path.exists():
                with open(state_path) as f:
                    return json.load(f)
            return {}

    with open(state_path) as f:
        return json.load(f)


def build_step_graph(manifest: dict) -> list[dict]:
    """Extract the ordered list of steps from the manifest."""
    return manifest.get("circuit", {}).get("steps", [])


def get_entry_mode_start(manifest: dict, mode_name: str) -> str | None:
    """Get the start_at step for a given entry mode."""
    entry_modes = manifest.get("circuit", {}).get("entry_modes", {})
    mode = entry_modes.get(mode_name, {})
    return mode.get("start_at")


def walk_step_order(manifest: dict, start_step: str | None) -> list[str]:
    """Walk steps in graph order starting from start_step.

    For simplicity, if no explicit start is given, use the manifest step order.
    If a start is given, begin from that step in the ordered list.
    """
    steps = build_step_graph(manifest)
    step_ids = [s["id"] for s in steps]

    if start_step and start_step in step_ids:
        start_idx = step_ids.index(start_step)
        return step_ids[start_idx:]

    return step_ids


def is_step_complete(step_id: str, state: dict) -> bool:
    """A step is complete when its gate was evaluated and a route was recorded.

    We detect this from the events/state: if the step has a gate result in
    artifacts (pass or fail with a route), it's complete. We check by looking
    for any artifact produced by this step that has a non-pending gate status.
    Also check jobs and checkpoints for completion indicators.
    """
    # Check artifacts produced by this step
    artifacts = state.get("artifacts", {})
    step_has_artifacts = False
    all_gates_evaluated = True

    for art_path, art_info in artifacts.items():
        if art_info.get("produced_by") == step_id:
            step_has_artifacts = True
            gate = art_info.get("gate")
            if gate == "pending" or gate is None:
                all_gates_evaluated = False

    if step_has_artifacts and all_gates_evaluated:
        return True

    # Check if this is a dispatch step that completed
    jobs = state.get("jobs", {})
    if step_id in jobs:
        job = jobs[step_id]
        if job.get("status") == "complete":
            # Job completed, but step is only complete if gate was evaluated.
            # If we have artifacts from this step with pass/fail gate, it's complete.
            if step_has_artifacts and all_gates_evaluated:
                return True
            # If no artifacts but job is complete and there's a gate result
            # tracked elsewhere, consider it complete
            if not step_has_artifacts:
                return False

    # Check if this is a checkpoint step that was resolved
    checkpoints = state.get("checkpoints", {})
    if step_id in checkpoints:
        cp = checkpoints[step_id]
        if cp.get("status") == "resolved":
            # Checkpoint resolved means the step has been evaluated
            if step_has_artifacts and all_gates_evaluated:
                return True
            # For checkpoint steps, resolution itself may indicate completion
            # if there are no artifacts to check
            if not step_has_artifacts:
                return True

    return False


def find_resume_point(manifest: dict, state: dict) -> dict:
    """Find the first incomplete step in graph order."""
    status = state.get("status", "initialized")

    # Terminal states
    if status in ("completed", "stopped", "blocked", "handed_off"):
        return {
            "resume_step": None,
            "status": status,
            "reason": f"run is {status}",
        }

    # Get the entry mode and walk from its start
    selected_mode = state.get("selected_entry_mode", "default")
    start_step = get_entry_mode_start(manifest, selected_mode)
    step_order = walk_step_order(manifest, start_step)

    if not step_order:
        return {
            "resume_step": None,
            "status": status,
            "reason": "no steps found in manifest",
        }

    # Walk steps and find first incomplete
    for step_id in step_order:
        if not is_step_complete(step_id, state):
            # Determine reason
            current_step = state.get("current_step")
            if current_step == step_id and status == "waiting_checkpoint":
                reason = f"step {step_id} is waiting for checkpoint resolution"
            elif current_step == step_id and status == "waiting_worker":
                reason = f"step {step_id} is waiting for worker completion"
            elif step_id in state.get("jobs", {}) and state["jobs"][step_id].get("status") == "failed":
                reason = f"step {step_id} job failed, needs retry or reroute"
            else:
                reason = f"step {step_id} has not been completed"

            return {
                "resume_step": step_id,
                "status": status,
                "reason": reason,
            }

    # All steps complete
    return {
        "resume_step": None,
        "status": "completed",
        "reason": "all steps complete",
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/runtime/resume.py <run-root>", file=sys.stderr)
        return 0

    run_root = Path(sys.argv[1]).resolve()
    if not run_root.is_dir():
        print(json.dumps({
            "resume_step": None,
            "status": "error",
            "reason": f"run root does not exist: {run_root}",
        }))
        return 0

    manifest = load_manifest(run_root)
    if not manifest:
        print(json.dumps({
            "resume_step": None,
            "status": "error",
            "reason": "circuit.manifest.yaml not found or empty",
        }))
        return 0

    state = load_or_rebuild_state(run_root)
    if not state:
        print(json.dumps({
            "resume_step": None,
            "status": "error",
            "reason": "could not load or rebuild state",
        }))
        return 0

    result = find_resume_point(manifest, state)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
