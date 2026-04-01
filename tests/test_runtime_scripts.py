"""Tests for the v2 runtime scripts: append-event, derive-state, resume.

These tests verify the event-sourced runtime foundation:
- append-event creates valid NDJSON
- derive-state rebuilds state from events
- derive-state handles step_reopened (marks artifacts stale)
- resume finds the correct resume point
- round-trip: append events -> derive state -> resume -> correct step
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
APPEND_EVENT = REPO_ROOT / "scripts" / "runtime" / "append-event.py"
DERIVE_STATE = REPO_ROOT / "scripts" / "runtime" / "derive-state.py"
RESUME = REPO_ROOT / "scripts" / "runtime" / "resume.py"

# Add scripts/runtime to path so we can import derive_state functions directly
sys.path.insert(0, str(REPO_ROOT / "scripts" / "runtime"))


MINIMAL_MANIFEST = {
    "schema_version": "2",
    "circuit": {
        "id": "test-circuit",
        "version": "2026-04-01",
        "purpose": "Test circuit for runtime script tests",
        "entry": {
            "signals": {
                "include": ["test_signal"]
            }
        },
        "entry_modes": {
            "default": {
                "start_at": "step-one",
                "description": "Default test mode"
            }
        },
        "steps": [
            {
                "id": "step-one",
                "title": "First Step",
                "executor": "orchestrator",
                "kind": "synthesis",
                "reads": ["user.task"],
                "writes": {
                    "artifact": {"path": "artifacts/step-one-output.md"}
                },
                "gate": {
                    "kind": "all_outputs_present",
                    "required_paths": ["artifacts/step-one-output.md"]
                },
                "routes": {
                    "pass": "step-two",
                    "fail": "@stop"
                }
            },
            {
                "id": "step-two",
                "title": "Second Step",
                "executor": "orchestrator",
                "kind": "synthesis",
                "reads": ["artifacts/step-one-output.md"],
                "writes": {
                    "artifact": {"path": "artifacts/step-two-output.md"}
                },
                "gate": {
                    "kind": "all_outputs_present",
                    "required_paths": ["artifacts/step-two-output.md"]
                },
                "routes": {
                    "pass": "step-three",
                    "fail": "@stop"
                }
            },
            {
                "id": "step-three",
                "title": "Third Step",
                "executor": "orchestrator",
                "kind": "synthesis",
                "reads": ["artifacts/step-two-output.md"],
                "writes": {
                    "artifact": {"path": "artifacts/step-three-output.md"}
                },
                "gate": {
                    "kind": "all_outputs_present",
                    "required_paths": ["artifacts/step-three-output.md"]
                },
                "routes": {
                    "pass": "@complete",
                    "fail": "@stop"
                }
            }
        ]
    }
}


@pytest.fixture
def run_root(tmp_path):
    """Create a temporary run root with a minimal manifest."""
    manifest_path = tmp_path / "circuit.manifest.yaml"
    with open(manifest_path, "w") as f:
        yaml.dump(MINIMAL_MANIFEST, f)
    return tmp_path


def run_script(script: Path, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a Python script and return the result."""
    result = subprocess.run(
        [sys.executable, str(script)] + args,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )
    if check and result.returncode != 0:
        raise AssertionError(
            f"Script {script.name} failed with code {result.returncode}\n"
            f"stderr: {result.stderr}\nstdout: {result.stdout}"
        )
    return result


def append_event_via_script(run_root: Path, event_type: str, payload: dict,
                            step_id: str | None = None, attempt: int | None = None) -> None:
    """Helper to append an event using the append-event.py script."""
    args = [str(run_root), event_type, "--payload", json.dumps(payload)]
    if step_id:
        args += ["--step-id", step_id]
    if attempt is not None:
        args += ["--attempt", str(attempt)]
    run_script(APPEND_EVENT, args)


# ---------------------------------------------------------------------------
# Test: append-event creates valid NDJSON
# ---------------------------------------------------------------------------

class TestAppendEvent:
    def test_creates_valid_ndjson(self, run_root):
        """append-event should create a valid NDJSON file with the event."""
        append_event_via_script(
            run_root,
            "run_started",
            {
                "manifest_path": "circuit.manifest.yaml",
                "entry_mode": "default",
                "head_at_start": "abc1234"
            }
        )

        events_path = run_root / "events.ndjson"
        assert events_path.exists(), "events.ndjson should be created"

        lines = events_path.read_text().strip().split("\n")
        assert len(lines) == 1, "Should have exactly one event line"

        event = json.loads(lines[0])
        assert event["event_type"] == "run_started"
        assert event["schema_version"] == "1"
        assert event["payload"]["entry_mode"] == "default"
        assert "event_id" in event
        assert "occurred_at" in event

    def test_appends_multiple_events(self, run_root):
        """Multiple calls should append, not overwrite."""
        append_event_via_script(
            run_root,
            "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root,
            "step_started",
            {"step_id": "step-one"},
            step_id="step-one"
        )

        events_path = run_root / "events.ndjson"
        lines = events_path.read_text().strip().split("\n")
        assert len(lines) == 2

        event1 = json.loads(lines[0])
        event2 = json.loads(lines[1])
        assert event1["event_type"] == "run_started"
        assert event2["event_type"] == "step_started"

    def test_rejects_invalid_event_type(self, run_root):
        """Invalid event types should be rejected with exit code 1."""
        result = run_script(
            APPEND_EVENT,
            [str(run_root), "invalid_event", "--payload", '{"foo": "bar"}'],
            check=False
        )
        assert result.returncode == 1
        assert "Validation errors" in result.stderr

    def test_includes_step_id_and_attempt(self, run_root):
        """step_id and attempt should be included when provided."""
        append_event_via_script(
            run_root,
            "step_started",
            {"step_id": "step-one"},
            step_id="step-one",
            attempt=1
        )

        events_path = run_root / "events.ndjson"
        event = json.loads(events_path.read_text().strip())
        assert event["step_id"] == "step-one"
        assert event["attempt"] == 1


# ---------------------------------------------------------------------------
# Test: derive-state rebuilds state from events
# ---------------------------------------------------------------------------

class TestDeriveState:
    def test_rebuilds_state_from_events(self, run_root):
        """derive-state should produce valid state.json from events."""
        # Append run_started event
        append_event_via_script(
            run_root,
            "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )

        # Run derive-state
        run_script(DERIVE_STATE, [str(run_root)])

        state_path = run_root / "state.json"
        assert state_path.exists()

        state = json.loads(state_path.read_text())
        assert state["schema_version"] == "1"
        assert state["circuit_id"] == "test-circuit"
        assert state["status"] == "initialized"
        assert state["selected_entry_mode"] == "default"
        assert state["git"]["head_at_start"] == "abc1234"

    def test_step_started_sets_current_step(self, run_root):
        """step_started should set current_step and status=in_progress."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"},
            step_id="step-one"
        )

        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())

        assert state["current_step"] == "step-one"
        assert state["status"] == "in_progress"

    def test_artifact_written_tracked(self, run_root):
        """artifact_written events should appear in state.artifacts."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )

        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())

        assert "artifacts/step-one-output.md" in state["artifacts"]
        art = state["artifacts"]["artifacts/step-one-output.md"]
        assert art["status"] == "complete"
        assert art["gate"] == "pending"
        assert art["produced_by"] == "step-one"

    def test_step_reopened_marks_artifacts_stale(self, run_root):
        """step_reopened should mark artifacts from the reopened step as stale."""
        # Build up state through step-one completion
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-one", "gate_kind": "all_outputs_present", "route": "step-two"},
            step_id="step-one"
        )
        # Start step-two
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-two"}, step_id="step-two"
        )
        # Now reopen step-one
        append_event_via_script(
            run_root, "step_reopened",
            {"from_step": "step-two", "to_step": "step-one", "reason": "dependency changed"},
            step_id="step-one"
        )

        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())

        art = state["artifacts"]["artifacts/step-one-output.md"]
        assert art["status"] == "stale", "Artifact should be marked stale after step_reopened"
        assert art["gate"] == "pending", "Gate should be reset to pending"
        assert state["current_step"] == "step-one"
        assert state["status"] == "in_progress"

    def test_run_completed_sets_terminal_state(self, run_root):
        """run_completed should set final status and terminal_target."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "run_completed",
            {"status": "completed", "terminal_target": "@complete"}
        )

        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())

        assert state["status"] == "completed"
        assert state["terminal_target"] == "@complete"
        assert state["current_step"] is None

    def test_dispatch_job_lifecycle(self, run_root):
        """dispatch_requested -> dispatch_received -> job_completed should track in jobs."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "dispatch_requested",
            {"request_path": "jobs/step-one/001/dispatch-request.json", "protocol": "test-proto@v1", "attempt": 1},
            step_id="step-one", attempt=1
        )
        append_event_via_script(
            run_root, "dispatch_received",
            {"receipt_path": "jobs/step-one/001/dispatch-receipt.json", "backend": "codex", "job_id": "job-123", "attempt": 1},
            step_id="step-one", attempt=1
        )
        append_event_via_script(
            run_root, "job_completed",
            {"result_path": "jobs/step-one/001/job-result.json", "completion": "complete", "verdict": "clean", "attempt": 1},
            step_id="step-one", attempt=1
        )

        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())

        assert "step-one" in state["jobs"]
        job = state["jobs"]["step-one"]
        assert job["status"] == "complete"
        assert job["attempt"] == 1
        assert state["status"] == "in_progress"

    def test_checkpoint_lifecycle(self, run_root):
        """checkpoint_requested -> checkpoint_resolved should track in checkpoints."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "checkpoint_requested",
            {"request_path": "checkpoints/step-one-001.json", "checkpoint_kind": "approval", "attempt": 1},
            step_id="step-one", attempt=1
        )

        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())

        assert "step-one" in state["checkpoints"]
        cp = state["checkpoints"]["step-one"]
        assert cp["status"] == "waiting"
        assert state["status"] == "waiting_checkpoint"

        # Now resolve it
        append_event_via_script(
            run_root, "checkpoint_resolved",
            {"response_path": "checkpoints/step-one-001.response.json", "selection": "approve", "attempt": 1},
            step_id="step-one", attempt=1
        )

        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())

        cp = state["checkpoints"]["step-one"]
        assert cp["status"] == "resolved"
        assert cp["selection"] == "approve"
        assert state["status"] == "in_progress"


# ---------------------------------------------------------------------------
# Test: resume finds correct resume point
# ---------------------------------------------------------------------------

class TestResume:
    def test_resume_finds_first_step_on_fresh_run(self, run_root):
        """On a fresh run with no events, resume should find the first step."""
        # Write a minimal state.json
        state = {
            "schema_version": "1",
            "run_id": "test-run-001",
            "circuit_id": "test-circuit",
            "manifest_version": "2026-04-01",
            "status": "initialized",
            "current_step": None,
            "selected_entry_mode": "default",
            "git": {"head_at_start": "abc1234"},
            "artifacts": {},
            "jobs": {},
            "checkpoints": {}
        }
        with open(run_root / "state.json", "w") as f:
            json.dump(state, f)

        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)

        assert resume["resume_step"] == "step-one"
        assert resume["status"] == "initialized"

    def test_resume_finds_second_step_after_first_completes(self, run_root):
        """After step-one is fully complete, resume should point to step-two."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-one", "gate_kind": "all_outputs_present", "route": "step-two"},
            step_id="step-one"
        )

        # Derive state first, then check resume
        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)

        assert resume["resume_step"] == "step-two"

    def test_resume_returns_completed_when_all_done(self, run_root):
        """When all steps are complete and run_completed, resume should return null."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        # Complete all three steps
        for step_id, next_route in [("step-one", "step-two"), ("step-two", "step-three"), ("step-three", "@complete")]:
            append_event_via_script(
                run_root, "step_started",
                {"step_id": step_id}, step_id=step_id
            )
            append_event_via_script(
                run_root, "artifact_written",
                {"artifact_path": f"artifacts/{step_id}-output.md"},
                step_id=step_id
            )
            append_event_via_script(
                run_root, "gate_passed",
                {"step_id": step_id, "gate_kind": "all_outputs_present", "route": next_route},
                step_id=step_id
            )

        append_event_via_script(
            run_root, "run_completed",
            {"status": "completed", "terminal_target": "@complete"}
        )

        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)

        assert resume["resume_step"] is None
        assert resume["status"] == "completed"

    def test_resume_after_step_reopened(self, run_root):
        """After reopening step-one, resume should point back to step-one."""
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        # Complete step-one
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-one", "gate_kind": "all_outputs_present", "route": "step-two"},
            step_id="step-one"
        )
        # Start step-two
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-two"}, step_id="step-two"
        )
        # Reopen step-one
        append_event_via_script(
            run_root, "step_reopened",
            {"from_step": "step-two", "to_step": "step-one", "reason": "dependency changed"},
            step_id="step-one"
        )

        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)

        assert resume["resume_step"] == "step-one"


# ---------------------------------------------------------------------------
# Test: round-trip append -> derive -> resume
# ---------------------------------------------------------------------------

class TestRoundTrip:
    def test_full_round_trip(self, run_root):
        """Full lifecycle: append events, derive state, resume at correct points."""
        # 1. Start the run
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )

        # Derive and check: should resume at step-one
        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)
        assert resume["resume_step"] == "step-one"

        # 2. Complete step-one
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-one", "gate_kind": "all_outputs_present", "route": "step-two"},
            step_id="step-one"
        )

        # Derive and check: should resume at step-two
        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)
        assert resume["resume_step"] == "step-two"

        # 3. Complete step-two
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-two"}, step_id="step-two"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-two-output.md"},
            step_id="step-two"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-two", "gate_kind": "all_outputs_present", "route": "step-three"},
            step_id="step-two"
        )

        # Derive and check: should resume at step-three
        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)
        assert resume["resume_step"] == "step-three"

        # 4. Complete step-three and finish run
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-three"}, step_id="step-three"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-three-output.md"},
            step_id="step-three"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-three", "gate_kind": "all_outputs_present", "route": "@complete"},
            step_id="step-three"
        )
        append_event_via_script(
            run_root, "run_completed",
            {"status": "completed", "terminal_target": "@complete"}
        )

        # Derive and check: should be completed
        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)
        assert resume["resume_step"] is None
        assert resume["status"] == "completed"

    def test_round_trip_with_reopen(self, run_root):
        """Round-trip including a step_reopened event."""
        # Start run and complete step-one
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-one", "gate_kind": "all_outputs_present", "route": "step-two"},
            step_id="step-one"
        )

        # Start step-two
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-two"}, step_id="step-two"
        )

        # Reopen step-one (simulating a dependency change)
        append_event_via_script(
            run_root, "step_reopened",
            {"from_step": "step-two", "to_step": "step-one", "reason": "upstream artifact updated"},
            step_id="step-one"
        )

        # Derive state and verify artifacts are stale
        run_script(DERIVE_STATE, [str(run_root)])
        state = json.loads((run_root / "state.json").read_text())
        assert state["artifacts"]["artifacts/step-one-output.md"]["status"] == "stale"

        # Resume should point back to step-one
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)
        assert resume["resume_step"] == "step-one"

        # Re-complete step-one
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-one", "gate_kind": "all_outputs_present", "route": "step-two"},
            step_id="step-one"
        )

        # Now resume should be at step-two again
        run_script(DERIVE_STATE, [str(run_root)])
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)
        assert resume["resume_step"] == "step-two"


# ---------------------------------------------------------------------------
# Test: resume rebuilds stale state automatically
# ---------------------------------------------------------------------------

class TestResumeAutoRebuild:
    def test_resume_rebuilds_stale_state(self, run_root):
        """Resume should detect stale state.json and rebuild from events."""
        # Append events and derive state
        append_event_via_script(
            run_root, "run_started",
            {"manifest_path": "circuit.manifest.yaml", "entry_mode": "default", "head_at_start": "abc1234"}
        )
        run_script(DERIVE_STATE, [str(run_root)])

        # Now append more events WITHOUT re-deriving (state.json is now stale)
        append_event_via_script(
            run_root, "step_started",
            {"step_id": "step-one"}, step_id="step-one"
        )
        append_event_via_script(
            run_root, "artifact_written",
            {"artifact_path": "artifacts/step-one-output.md"},
            step_id="step-one"
        )
        append_event_via_script(
            run_root, "gate_passed",
            {"step_id": "step-one", "gate_kind": "all_outputs_present", "route": "step-two"},
            step_id="step-one"
        )

        # Resume should auto-rebuild and find step-two
        result = run_script(RESUME, [str(run_root)])
        resume = json.loads(result.stdout)
        assert resume["resume_step"] == "step-two"
