#!/usr/bin/env python3

from __future__ import annotations

import importlib.util
from pathlib import Path


def load_scraper_module():
    repo_root = Path(__file__).resolve().parents[2]
    scraper_path = repo_root / "scripts" / "debug" / "scrape-circuit-invocations.py"
    spec = importlib.util.spec_from_file_location("scrape_circuit_invocations", scraper_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    scraper = load_scraper_module()
    known_commands = {"circuit:review", "circuit:run"}
    ledger_entries = [
        {
            "command_slug": "run",
            "invocation_id": "inv-routed",
            "occurred_at": "2026-04-14T10:00:00Z",
            "project_root": "/tmp/project",
            "requested_command": "circuit:run",
            "session_id": "session-1",
            "status": "routed",
        },
        {
            "command_slug": "review",
            "invocation_id": "inv-standalone",
            "occurred_at": "2026-04-14T10:01:00Z",
            "project_root": "/tmp/project",
            "requested_command": "circuit:review",
            "session_id": "session-1",
            "status": "classified_standalone",
        },
        {
            "command_slug": "run",
            "invocation_id": "inv-trivial",
            "occurred_at": "2026-04-14T10:02:00Z",
            "project_root": "/tmp/project",
            "requested_command": "circuit:run",
            "session_id": "session-1",
            "status": "classified_trivial",
        },
        {
            "command_slug": "run",
            "invocation_id": "inv-abandoned",
            "occurred_at": "2026-04-14T10:03:00Z",
            "project_root": "/tmp/project",
            "requested_command": "circuit:run",
            "session_id": "session-1",
            "status": "abandoned",
        },
        {
            "command_slug": "run",
            "invocation_id": "inv-received",
            "occurred_at": "2026-04-14T10:04:00Z",
            "project_root": "/tmp/project",
            "requested_command": "circuit:run",
            "session_id": "session-1",
            "status": "received",
        },
    ]

    finalized = scraper.ledger_invocations_to_finalized(ledger_entries, known_commands)
    by_id = {row["invocation_id"]: row for row in finalized}

    assert by_id["inv-routed"]["matched_run"] is True
    assert by_id["inv-routed"]["launch_outcome_category"] == "workflow_launched"

    assert by_id["inv-standalone"]["matched_run"] is True
    assert by_id["inv-standalone"]["launch_outcome_category"] == "standalone_complete"

    assert by_id["inv-trivial"]["matched_run"] is True
    assert by_id["inv-trivial"]["launch_outcome_category"] == "trivial_complete"

    assert by_id["inv-abandoned"]["matched_run"] is False
    assert by_id["inv-abandoned"]["launch_outcome_category"] == "abandoned"

    assert by_id["inv-received"]["matched_run"] is False
    assert by_id["inv-received"]["launch_outcome_category"] == "no_terminal_status"

    summary = scraper.build_summary(finalized, sorted(known_commands), 0, 1, 0)
    assert summary["matched_runs_total"] == 3
    assert summary["launch_outcome_breakdown"] == {
        "abandoned": 1,
        "no_terminal_status": 1,
        "standalone_complete": 1,
        "trivial_complete": 1,
        "workflow_launched": 1,
    }
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
