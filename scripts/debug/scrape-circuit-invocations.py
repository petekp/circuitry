#!/usr/bin/env python3
"""
Internal maintainer tool for debugging Circuit invocation behavior.

This script inspects Claude Code session transcripts under ~/.claude/projects,
extracts Circuit invocations over a time range, correlates them with local
.circuit/circuit-runs state when possible, and writes analysis-ready outputs.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, time
from pathlib import Path
from typing import Any


BUILTIN_WORKFLOW_COMMANDS = {
    "circuit:build",
    "circuit:explore",
    "circuit:migrate",
    "circuit:repair",
    "circuit:run",
    "circuit:sweep",
}

CIRCUIT_COMMAND_PATTERN = re.compile(r"/circuit:([a-z0-9-]+)([^\r\n]*)", re.IGNORECASE)
DATE_ONLY_PATTERN = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")

WORKFLOW_COMMANDS = BUILTIN_WORKFLOW_COMMANDS


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def to_iso(ms: int | None) -> str | None:
    if ms is None:
        return None
    return datetime.fromtimestamp(ms / 1000).astimezone().isoformat()


def parse_timestamp(value: Any) -> int | None:
    if not isinstance(value, str) or not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return int(datetime.fromisoformat(normalized).timestamp() * 1000)
    except ValueError:
        return None


def parse_date_boundary(raw: str, end_of_day: bool) -> int:
    date_only = DATE_ONLY_PATTERN.match(raw)
    if date_only:
      year, month, day = (int(part) for part in date_only.groups())
      boundary_time = time(23, 59, 59, 999000) if end_of_day else time(0, 0, 0, 0)
      local_dt = datetime.combine(datetime(year, month, day).date(), boundary_time).astimezone()
      return int(local_dt.timestamp() * 1000)

    normalized = raw.replace("Z", "+00:00")
    try:
        return int(datetime.fromisoformat(normalized).timestamp() * 1000)
    except ValueError as exc:
        raise SystemExit(f"Invalid date/time: {raw}") from exc


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
    except Exception:
        return []
    return rows


def derive_run_state(run_root: Path) -> dict[str, Any] | None:
    derive_state_cli = repo_root() / "scripts" / "runtime" / "bin" / "derive-state.js"
    if not derive_state_cli.exists():
        return None

    result = subprocess.run(
        ["node", str(derive_state_cli), "--json", "--no-persist", str(run_root)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None

    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def as_dict(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def as_str(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def as_int(value: Any) -> int | None:
    return value if isinstance(value, int | float) and math.isfinite(value) else None


def trim_excerpt(value: str | None, limit: int = 280) -> str | None:
    if not value:
        return None
    compact = " ".join(value.split())
    return compact if len(compact) <= limit else f"{compact[: limit - 1]}…"


def flatten_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content

    parts: list[str] = []
    for item in as_list(content):
        record = as_dict(item)
        if not record:
            continue
        if record.get("type") == "text" and isinstance(record.get("text"), str):
            parts.append(record["text"])
        elif record.get("type") == "tool_result" and isinstance(record.get("content"), str):
            parts.append(record["content"])
    return "\n".join(parts)


def load_known_commands(plugin_root: Path, circuit_home: Path | None = None) -> list[str]:
    """Dynamic known-surface discovery from plugin commands and user-global custom circuits."""
    commands: set[str] = set()

    # Built-in commands from the plugin commands/ directory.
    commands_dir = plugin_root / "commands"
    if commands_dir.exists():
        for entry in commands_dir.iterdir():
            if entry.is_file() and entry.suffix == ".md":
                commands.add(f"circuit:{entry.stem}")

    # Custom circuits from ~/.claude/circuit/skills/.
    if circuit_home is None:
        circuit_home = Path.home() / ".claude" / "circuit"
    skills_dir = circuit_home / "skills"
    if skills_dir.exists():
        for entry in skills_dir.iterdir():
            if entry.is_dir() and (entry / "circuit.yaml").exists():
                commands.add(f"circuit:{entry.name}")

    return sorted(commands)


def read_invocation_ledger(
    circuit_home: Path | None = None,
    from_ms: int | None = None,
    to_ms: int | None = None,
) -> list[dict[str, Any]]:
    """Read the invocation ledger NDJSON, filtering by time range and grouping by invocation_id."""
    if circuit_home is None:
        circuit_home = Path.home() / ".claude" / "circuit"
    ledger_path = circuit_home / "invocation-ledger.ndjson"
    if not ledger_path.exists():
        return []

    entries = read_jsonl(ledger_path)
    if not entries:
        return []

    # Filter by time range.
    if from_ms is not None or to_ms is not None:
        filtered: list[dict[str, Any]] = []
        for entry in entries:
            occurred_at = as_str(entry.get("occurred_at"))
            entry_ms = parse_timestamp(occurred_at) if occurred_at else None
            if entry_ms is None:
                continue
            if from_ms is not None and entry_ms < from_ms:
                continue
            if to_ms is not None and entry_ms > to_ms:
                continue
            filtered.append(entry)
        entries = filtered

    # Group by invocation_id and take the last status per ID.
    by_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        inv_id = as_str(entry.get("invocation_id"))
        if inv_id:
            by_id[inv_id].append(entry)

    # Build a merged record per invocation using the latest entry as the primary.
    results: list[dict[str, Any]] = []
    for inv_id, group in by_id.items():
        merged: dict[str, Any] = {}
        for entry in group:
            merged.update({k: v for k, v in entry.items() if v is not None})
        merged["source"] = "ledger"
        merged["confidence"] = 1.0
        results.append(merged)

    results.sort(key=lambda row: parse_timestamp(as_str(row.get("occurred_at"))) or 0)
    return results


def ledger_invocations_to_finalized(
    ledger_entries: list[dict[str, Any]],
    known_commands: set[str],
) -> list[dict[str, Any]]:
    """Convert ledger entries into the same schema as transcript-derived invocations."""
    invocations: list[dict[str, Any]] = []
    for entry in ledger_entries:
        command_name = as_str(entry.get("requested_command")) or ""
        command_slug = as_str(entry.get("command_slug")) or command_name.replace("circuit:", "", 1)
        command_args = as_str(entry.get("command_args")) or ""
        occurred_at = as_str(entry.get("occurred_at"))
        occurred_ms = parse_timestamp(occurred_at) if occurred_at else None

        invocation: dict[str, Any] = {
            "assistant_message_count": None,
            "assistant_tool_use_count": None,
            "command_args": command_args,
            "command_name": command_name,
            "command_slug": command_slug,
            "current_surface_known": command_name in known_commands,
            "cwd": as_str(entry.get("cwd")),
            "entrypoint": None,
            "first_assistant_response_at": None,
            "first_error_excerpt": None,
            "git_branch": as_str(entry.get("git_branch")),
            "hook_error_count": 0,
            "invocation_id": as_str(entry.get("invocation_id")) or "",
            "launch_confirmed": entry.get("status") == "routed",
            "launch_confirmed_at": None,
            "matched_run": entry.get("status") == "routed",
            "matched_run_circuit_id": as_str(entry.get("circuit_id")),
            "matched_run_current_step": None,
            "matched_run_duration_ms": None,
            "matched_run_goal": as_str(entry.get("goal")),
            "matched_run_id": as_str(entry.get("run_id")),
            "matched_run_root": as_str(entry.get("run_root")),
            "matched_run_selected_entry_mode": as_str(entry.get("entry_mode")),
            "matched_run_started_at": occurred_at,
            "matched_run_status": "routed" if entry.get("status") == "routed" else None,
            "matched_run_terminal_target": None,
            "matched_run_updated_at": None,
            "next_invocation_at": None,
            "project_path": as_str(entry.get("project_root")),
            "raw_excerpt": trim_excerpt(command_args),
            "requested_at": occurred_at,
            "run_artifact_count": None,
            "run_blocked_job_count": None,
            "run_checkpoint_requested_count": None,
            "run_checkpoint_resolved_count": None,
            "run_completed": None,
            "run_dispatch_count": None,
            "run_event_count": None,
            "run_failed": entry.get("status") == "failed",
            "run_gate_failed_count": None,
            "run_gate_passed_count": None,
            "run_handed_off": None,
            "run_job_completed_count": None,
            "run_match_confidence": "exact",
            "run_partial_job_count": None,
            "run_time_to_start_ms": None,
            "session_created_at": None,
            "session_first_prompt": None,
            "session_id": as_str(entry.get("session_id")) or "",
            "session_message_count": None,
            "session_modified_at": None,
            "session_path": None,
            "source": "ledger",
            "source_kind": "ledger",
            "time_to_first_assistant_response_ms": None,
            "time_to_launch_ms": None,
            "tool_error_count": 0,
            "user_rejected_tool_use_count": 0,
        }
        invocations.append(invocation)

    return invocations


def session_overlaps(created_ms: int | None, modified_ms: int | None, from_ms: int, to_ms: int) -> bool:
    if created_ms is None and modified_ms is None:
        return True
    start = created_ms if created_ms is not None else (modified_ms if modified_ms is not None else from_ms)
    end = modified_ms if modified_ms is not None else (created_ms if created_ms is not None else to_ms)
    return end >= from_ms and start <= to_ms


def discover_sessions(
    sessions_root: Path,
    from_ms: int,
    to_ms: int,
    project_path: str | None,
) -> list[dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    if not sessions_root.exists():
        return []

    normalized_project_path = os.path.realpath(project_path) if project_path else None

    for project_dir in sorted(path for path in sessions_root.iterdir() if path.is_dir()):
        index_path = project_dir / "sessions-index.json"
        indexed_paths: set[str] = set()

        if index_path.exists():
            index_root = read_json(index_path) or {}
            for entry_value in as_list(index_root.get("entries")):
                entry = as_dict(entry_value)
                if not entry:
                    continue

                full_path = as_str(entry.get("fullPath"))
                session_id = as_str(entry.get("sessionId"))
                if not full_path or not session_id:
                    continue
                if "/subagents/" in full_path or not full_path.endswith(".jsonl"):
                    continue
                session_path = os.path.realpath(full_path)
                if not os.path.exists(session_path):
                    continue
                indexed_paths.add(session_path)

                created_at = as_str(entry.get("created"))
                modified_at = as_str(entry.get("modified"))
                created_ms = parse_timestamp(created_at)
                modified_ms = parse_timestamp(modified_at)
                if modified_ms is None:
                    file_mtime = entry.get("fileMtime")
                    modified_ms = as_int(file_mtime)

                if not session_overlaps(created_ms, modified_ms, from_ms, to_ms):
                    continue

                entry_project_path = as_str(entry.get("projectPath"))
                normalized_entry_project_path = (
                    os.path.realpath(entry_project_path) if entry_project_path else None
                )
                if normalized_project_path and normalized_entry_project_path and normalized_entry_project_path != normalized_project_path:
                    continue

                results[session_path] = {
                    "created_at": created_at,
                    "created_ms": created_ms,
                    "first_prompt": as_str(entry.get("firstPrompt")),
                    "git_branch": as_str(entry.get("gitBranch")),
                    "message_count": as_int(entry.get("messageCount")),
                    "modified_at": modified_at,
                    "modified_ms": modified_ms,
                    "project_dir": str(project_dir),
                    "project_path": normalized_entry_project_path,
                    "session_id": session_id,
                    "session_path": session_path,
                }

        for child in sorted(project_dir.iterdir()):
            if not child.is_file() or child.suffix != ".jsonl":
                continue
            if child.name == "skill-injections.jsonl":
                continue

            session_path = os.path.realpath(str(child))
            if session_path in indexed_paths:
                continue

            modified_ms = int(child.stat().st_mtime * 1000)
            if modified_ms < from_ms or modified_ms > to_ms:
                continue

            results[session_path] = {
                "created_at": None,
                "created_ms": None,
                "first_prompt": None,
                "git_branch": None,
                "message_count": None,
                "modified_at": datetime.fromtimestamp(modified_ms / 1000).astimezone().isoformat(),
                "modified_ms": modified_ms,
                "project_dir": str(project_dir),
                "project_path": None,
                "session_id": child.stem,
                "session_path": session_path,
            }

    return sorted(
        results.values(),
        key=lambda item: (item.get("created_ms") or item.get("modified_ms") or 0, item["session_path"]),
    )


def parse_timeline(session_path: Path) -> list[dict[str, Any]]:
    timeline: list[dict[str, Any]] = []
    for line_number, line in enumerate(session_path.read_text().splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            raw = json.loads(stripped)
        except Exception:
            continue
        if not isinstance(raw, dict):
            continue
        timestamp = as_str(raw.get("timestamp"))
        timeline.append(
            {
                "cwd": as_str(raw.get("cwd")),
                "entrypoint": as_str(raw.get("entrypoint")),
                "git_branch": as_str(raw.get("gitBranch")),
                "line_number": line_number,
                "raw": raw,
                "timestamp": timestamp,
                "timestamp_ms": parse_timestamp(timestamp),
                "type": as_str(raw.get("type")),
                "uuid": as_str(raw.get("uuid")),
            }
        )
    return timeline


def infer_project_path(session: dict[str, Any], timeline: list[dict[str, Any]]) -> str | None:
    if session.get("project_path"):
        return session["project_path"]
    for record in timeline:
        cwd = record.get("cwd")
        if cwd:
            return os.path.realpath(cwd)
    return None


def parse_command_message(text: str) -> tuple[str, str] | None:
    command_name_match = re.search(r"<command-name>\s*(/circuit:[^<\s]+)\s*</command-name>", text, re.IGNORECASE)
    if command_name_match:
        args_match = re.search(r"<command-args>([\s\S]*?)</command-args>", text, re.IGNORECASE)
        return command_name_match.group(1).lstrip("/").strip().lower(), (args_match.group(1) if args_match else "").strip()

    inline_match = CIRCUIT_COMMAND_PATTERN.search(text)
    if not inline_match:
        return None
    return f"circuit:{inline_match.group(1).lower()}", inline_match.group(2).strip()


def parse_user_invocation(record: dict[str, Any]) -> dict[str, Any] | None:
    if record.get("type") != "user":
        return None
    raw = record["raw"]
    if raw.get("isMeta") is True:
        return None
    message = as_dict(raw.get("message"))
    if not message or message.get("role") != "user":
        return None

    text = flatten_message_text(message.get("content"))
    if not text:
        return None

    parsed = parse_command_message(text)
    if not parsed:
        return None

    command_name, command_args = parsed
    return {
        "command_args": command_args,
        "command_name": command_name,
        "raw_excerpt": trim_excerpt(command_args or text),
        "source_kind": "user_command" if "<command-name>" in text else "plain_text",
    }


def extract_skill_tool_use(record: dict[str, Any]) -> dict[str, str] | None:
    message = as_dict(record["raw"].get("message"))
    if not message or message.get("role") != "assistant":
        return None

    for item in as_list(message.get("content")):
        item_record = as_dict(item)
        if not item_record or item_record.get("type") != "tool_use":
            continue
        if item_record.get("name") != "Skill":
            continue
        input_record = as_dict(item_record.get("input")) or {}
        command_name = as_str(input_record.get("skill"))
        if not command_name or not command_name.startswith("circuit:"):
            continue
        return {
            "command_args": as_str(input_record.get("args")) or "",
            "command_name": command_name,
        }
    return None


def extract_launch_result(record: dict[str, Any]) -> dict[str, Any] | None:
    raw = record["raw"]
    tool_use_result = as_dict(raw.get("toolUseResult"))
    command_name = as_str((tool_use_result or {}).get("commandName"))
    if command_name and command_name.startswith("circuit:"):
        return {
            "command_name": command_name,
            "success": (tool_use_result or {}).get("success") is not False,
        }

    message = as_dict(raw.get("message"))
    if not message or message.get("role") != "user":
        return None

    text = flatten_message_text(message.get("content"))
    launch_match = re.search(r"Launching skill:\s*(circuit:[a-z0-9-]+)", text, re.IGNORECASE)
    if not launch_match:
        return None

    return {
        "command_name": launch_match.group(1).lower(),
        "success": "is_error" not in text.lower(),
    }


def extract_tool_error(record: dict[str, Any]) -> str | None:
    if record.get("type") != "user":
        return None

    message = as_dict(record["raw"].get("message"))
    if not message:
        return None

    for item in as_list(message.get("content")):
        item_record = as_dict(item)
        if not item_record:
            continue
        if item_record.get("type") == "tool_result" and item_record.get("is_error") is True:
            return as_str(item_record.get("content"))
    return None


def assistant_tool_use_count(record: dict[str, Any]) -> int:
    message = as_dict(record["raw"].get("message"))
    if not message or message.get("role") != "assistant":
        return 0
    return sum(1 for item in as_list(message.get("content")) if as_dict(item) and as_dict(item).get("type") == "tool_use")


def is_assistant_message(record: dict[str, Any]) -> bool:
    message = as_dict(record["raw"].get("message"))
    return bool(message and message.get("role") == "assistant")


def is_hook_error(record: dict[str, Any]) -> bool:
    attachment = as_dict(record["raw"].get("attachment"))
    return bool(attachment and attachment.get("type") == "hook_error")


def build_draft(
    session: dict[str, Any],
    record: dict[str, Any],
    command_name: str,
    command_args: str,
    source_kind: str,
    raw_excerpt: str | None,
    known_commands: set[str],
) -> dict[str, Any] | None:
    if record.get("timestamp_ms") is None or not record.get("timestamp"):
        return None
    return {
        "assistant_message_count": 0,
        "assistant_tool_use_count": 0,
        "command_args": command_args,
        "command_name": command_name,
        "command_slug": command_name.replace("circuit:", "", 1),
        "current_surface_known": command_name in known_commands,
        "cwd": record.get("cwd"),
        "entrypoint": record.get("entrypoint"),
        "first_assistant_response_at_ms": None,
        "first_error_excerpt": None,
        "git_branch": record.get("git_branch") or session.get("git_branch"),
        "hook_error_count": 0,
        "invocation_id": f"{session['session_id']}:{record.get('uuid') or f'line-{record['line_number']}'}:{command_name}",
        "launch_confirmed": False,
        "launch_confirmed_at_ms": None,
        "matched_run": None,
        "next_invocation_at_ms": None,
        "project_path": None,
        "raw_excerpt": raw_excerpt,
        "requested_at": record["timestamp"],
        "requested_at_ms": record["timestamp_ms"],
        "session": session,
        "source_kind": source_kind,
        "time_to_first_assistant_response_ms": None,
        "time_to_launch_ms": None,
        "tool_error_count": 0,
        "user_rejected_tool_use_count": 0,
    }


def find_recent_invocation(drafts: list[dict[str, Any]], command_name: str, at_ms: int) -> dict[str, Any] | None:
    for draft in reversed(drafts):
        if draft["command_name"] != command_name:
            continue
        delta = abs(at_ms - draft["requested_at_ms"])
        if delta <= 30_000:
            return draft
        if draft["requested_at_ms"] < at_ms - 30_000:
            return None
    return None


def infer_run_circuit(command_name: str, command_args: str) -> str | None:
    if command_name != "circuit:run":
        return command_name.replace("circuit:", "", 1)

    lowered = command_args.strip().lower()
    if lowered.startswith(("develop:", "build:")):
        return "build"
    if lowered.startswith(("fix:", "repair:")):
        return "repair"
    if lowered.startswith("migrate:"):
        return "migrate"
    if lowered.startswith(("cleanup:", "sweep:")):
        return "sweep"
    if lowered.startswith(("decide:", "explore:")):
        return "explore"
    return None


def load_run_record(run_root: Path) -> dict[str, Any] | None:
    manifest_path = run_root / "circuit.manifest.yaml"
    events_path = run_root / "events.ndjson"
    if not manifest_path.exists() or not events_path.exists():
        return None

    state = derive_run_state(run_root)
    if not state:
        return None
    events = read_jsonl(events_path) if events_path.exists() else []
    run_started = next((event for event in events if event.get("event_type") == "run_started"), None)

    started_at = as_str((state or {}).get("started_at")) or as_str((run_started or {}).get("occurred_at"))
    updated_at = as_str((state or {}).get("updated_at")) or as_str((events[-1] if events else {}).get("occurred_at"))
    started_at_ms = parse_timestamp(started_at)
    updated_at_ms = parse_timestamp(updated_at)

    dispatch_count = sum(1 for event in events if event.get("event_type") == "dispatch_requested")
    gate_passed_count = sum(1 for event in events if event.get("event_type") == "gate_passed")
    gate_failed_count = sum(1 for event in events if event.get("event_type") == "gate_failed")
    checkpoint_requested_count = sum(1 for event in events if event.get("event_type") == "checkpoint_requested")
    checkpoint_resolved_count = sum(1 for event in events if event.get("event_type") == "checkpoint_resolved")
    partial_job_count = 0
    blocked_job_count = 0
    job_completed_count = 0
    for event in events:
        if event.get("event_type") != "job_completed":
            continue
        job_completed_count += 1
        payload = as_dict(event.get("payload")) or {}
        completion = payload.get("completion")
        if completion == "partial":
            partial_job_count += 1
        elif completion == "blocked":
            blocked_job_count += 1

    artifacts = as_dict((state or {}).get("artifacts")) or {}
    status = as_str((state or {}).get("status"))

    return {
        "artifact_count": len(artifacts),
        "blocked_job_count": blocked_job_count,
        "checkpoint_requested_count": checkpoint_requested_count,
        "checkpoint_resolved_count": checkpoint_resolved_count,
        "circuit_id": as_str((state or {}).get("circuit_id")) or as_str((run_started or {}).get("circuit_id")),
        "current_step": as_str((state or {}).get("current_step")),
        "dispatch_count": dispatch_count,
        "duration_ms": (updated_at_ms - started_at_ms) if started_at_ms is not None and updated_at_ms is not None else None,
        "event_count": len(events),
        "gate_failed_count": gate_failed_count,
        "gate_passed_count": gate_passed_count,
        "goal": as_str((state or {}).get("goal")) or as_str((as_dict((run_started or {}).get("payload")) or {}).get("goal")),
        "handed_off": status == "handed_off",
        "id": as_str((state or {}).get("run_id")) or run_root.name,
        "job_completed_count": job_completed_count,
        "partial_job_count": partial_job_count,
        "root": str(run_root),
        "selected_entry_mode": as_str((state or {}).get("selected_entry_mode")) or as_str((as_dict((run_started or {}).get("payload")) or {}).get("entry_mode")),
        "started_at": started_at,
        "started_at_ms": started_at_ms,
        "status": status,
        "terminal_target": as_str((state or {}).get("terminal_target")),
        "updated_at": updated_at,
        "updated_at_ms": updated_at_ms,
    }


def collect_runs_for_project(project_path: str) -> list[dict[str, Any]]:
    runs_root = Path(project_path) / ".circuit" / "circuit-runs"
    if not runs_root.exists():
        return []

    runs: list[dict[str, Any]] = []
    for child in sorted(path for path in runs_root.iterdir() if path.is_dir()):
        run_record = load_run_record(child)
        if run_record:
            runs.append(run_record)
    runs.sort(key=lambda item: item.get("started_at_ms") or 0)
    return runs


def classify_match_confidence(score_ms: int) -> str | None:
    if score_ms <= 30_000:
        return "exact"
    if score_ms <= 2 * 60_000:
        return "high"
    if score_ms <= 10 * 60_000:
        return "medium"
    if score_ms <= 30 * 60_000:
        return "low"
    return None


def match_run_for_invocation(draft: dict[str, Any], runs: list[dict[str, Any]]) -> dict[str, Any] | None:
    if draft["command_name"] not in WORKFLOW_COMMANDS:
        return None

    command_circuit = infer_run_circuit(draft["command_name"], draft["command_args"])
    window_start = draft["requested_at_ms"] - 2 * 60_000
    window_end = (draft["next_invocation_at_ms"] or (draft["requested_at_ms"] + 90 * 60_000)) + 5 * 60_000

    best_run = None
    best_score = None
    for run in runs:
        started_at_ms = run.get("started_at_ms")
        if started_at_ms is None or started_at_ms < window_start or started_at_ms > window_end:
            continue

        score = abs(started_at_ms - draft["requested_at_ms"])
        if started_at_ms < draft["requested_at_ms"]:
            score += 30_000
        if command_circuit and run.get("circuit_id") == command_circuit:
            score -= 90_000
        elif command_circuit and run.get("circuit_id") and run.get("circuit_id") != command_circuit:
            score += 5 * 60_000

        if best_score is None or score < best_score:
            best_score = score
            best_run = run

    if best_run is None or best_score is None:
        return None

    confidence = classify_match_confidence(max(best_score, 0))
    if confidence is None:
        return None
    return {"confidence": confidence, "run": best_run}


def median(values: list[int]) -> int | None:
    if not values:
        return None
    values = sorted(values)
    middle = len(values) // 2
    if len(values) % 2:
        return values[middle]
    return round((values[middle - 1] + values[middle]) / 2)


def finalize_invocation(draft: dict[str, Any], matched: dict[str, Any] | None) -> dict[str, Any]:
    run = matched["run"] if matched else None
    started_at_ms = run.get("started_at_ms") if run else None
    run_status = run.get("status") if run else None

    return {
        "assistant_message_count": draft["assistant_message_count"],
        "assistant_tool_use_count": draft["assistant_tool_use_count"],
        "command_args": draft["command_args"],
        "command_name": draft["command_name"],
        "command_slug": draft["command_slug"],
        "current_surface_known": draft["current_surface_known"],
        "cwd": draft["cwd"],
        "entrypoint": draft["entrypoint"],
        "first_assistant_response_at": to_iso(draft["first_assistant_response_at_ms"]),
        "first_error_excerpt": draft["first_error_excerpt"],
        "git_branch": draft["git_branch"],
        "hook_error_count": draft["hook_error_count"],
        "invocation_id": draft["invocation_id"],
        "launch_confirmed": draft["launch_confirmed"],
        "launch_confirmed_at": to_iso(draft["launch_confirmed_at_ms"]),
        "matched_run": bool(run),
        "matched_run_circuit_id": run.get("circuit_id") if run else None,
        "matched_run_current_step": run.get("current_step") if run else None,
        "matched_run_duration_ms": run.get("duration_ms") if run else None,
        "matched_run_goal": run.get("goal") if run else None,
        "matched_run_id": run.get("id") if run else None,
        "matched_run_root": run.get("root") if run else None,
        "matched_run_selected_entry_mode": run.get("selected_entry_mode") if run else None,
        "matched_run_started_at": run.get("started_at") if run else None,
        "matched_run_status": run_status,
        "matched_run_terminal_target": run.get("terminal_target") if run else None,
        "matched_run_updated_at": run.get("updated_at") if run else None,
        "next_invocation_at": to_iso(draft["next_invocation_at_ms"]),
        "project_path": draft["project_path"],
        "raw_excerpt": draft["raw_excerpt"],
        "requested_at": draft["requested_at"],
        "run_artifact_count": run.get("artifact_count") if run else None,
        "run_blocked_job_count": run.get("blocked_job_count") if run else None,
        "run_checkpoint_requested_count": run.get("checkpoint_requested_count") if run else None,
        "run_checkpoint_resolved_count": run.get("checkpoint_resolved_count") if run else None,
        "run_completed": run_status == "completed" if run else None,
        "run_dispatch_count": run.get("dispatch_count") if run else None,
        "run_event_count": run.get("event_count") if run else None,
        "run_failed": (run_status not in {"completed", "handed_off"}) if run else None,
        "run_gate_failed_count": run.get("gate_failed_count") if run else None,
        "run_gate_passed_count": run.get("gate_passed_count") if run else None,
        "run_handed_off": run.get("handed_off") if run else None,
        "run_job_completed_count": run.get("job_completed_count") if run else None,
        "run_match_confidence": matched["confidence"] if matched else None,
        "run_partial_job_count": run.get("partial_job_count") if run else None,
        "run_time_to_start_ms": (started_at_ms - draft["requested_at_ms"]) if started_at_ms is not None else None,
        "session_created_at": draft["session"].get("created_at"),
        "session_first_prompt": draft["session"].get("first_prompt"),
        "session_id": draft["session"]["session_id"],
        "session_message_count": draft["session"].get("message_count"),
        "session_modified_at": draft["session"].get("modified_at"),
        "session_path": draft["session"]["session_path"],
        "source_kind": draft["source_kind"],
        "time_to_first_assistant_response_ms": draft["time_to_first_assistant_response_ms"],
        "time_to_launch_ms": draft["time_to_launch_ms"],
        "tool_error_count": draft["tool_error_count"],
        "user_rejected_tool_use_count": draft["user_rejected_tool_use_count"],
    }


def build_summary(invocations: list[dict[str, Any]], known_commands: list[str], from_ms: int, to_ms: int, sessions_scanned: int) -> dict[str, Any]:
    by_command: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_project: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for invocation in invocations:
        by_command[invocation["command_name"]].append(invocation)
        if invocation.get("project_path"):
            by_project[invocation["project_path"]].append(invocation)

    command_summaries = []
    for command_name, rows in by_command.items():
        command_summaries.append(
            {
                "command_name": command_name,
                "completed_runs": sum(1 for row in rows if row.get("run_completed") is True),
                "invocations": len(rows),
                "matched_runs": sum(1 for row in rows if row.get("matched_run")),
                "median_run_duration_ms": median([row["matched_run_duration_ms"] for row in rows if row.get("matched_run_duration_ms") is not None]),
                "median_time_to_launch_ms": median([row["time_to_launch_ms"] for row in rows if row.get("time_to_launch_ms") is not None]),
                "no_run_match_invocations": sum(1 for row in rows if row["command_name"] in WORKFLOW_COMMANDS and not row.get("matched_run")),
                "run_gate_failed_invocations": sum(1 for row in rows if (row.get("run_gate_failed_count") or 0) > 0),
                "tool_error_invocations": sum(1 for row in rows if row.get("tool_error_count", 0) > 0),
                "unknown_surface_invocations": sum(1 for row in rows if not row.get("current_surface_known")),
            }
        )
    command_summaries.sort(key=lambda item: (-item["invocations"], item["command_name"]))

    project_summaries = []
    for project_path, rows in by_project.items():
        project_summaries.append(
            {
                "failed_or_incomplete_runs": sum(1 for row in rows if row.get("matched_run") and row.get("run_completed") is not True),
                "invocations": len(rows),
                "matched_runs": sum(1 for row in rows if row.get("matched_run")),
                "no_run_match_invocations": sum(1 for row in rows if row["command_name"] in WORKFLOW_COMMANDS and not row.get("matched_run")),
                "project_path": project_path,
                "tool_error_invocations": sum(1 for row in rows if row.get("tool_error_count", 0) > 0),
            }
        )
    project_summaries.sort(key=lambda item: (-item["invocations"], item["project_path"]))

    issue_signals: list[dict[str, Any]] = []
    unknown_commands = [row for row in invocations if not row.get("current_surface_known")]
    unmatched_workflow_invocations = [row for row in invocations if row["command_name"] in WORKFLOW_COMMANDS and not row.get("matched_run")]
    tool_error_invocations = [row for row in invocations if row.get("tool_error_count", 0) > 0]
    incomplete_runs = [row for row in invocations if row.get("matched_run") and row.get("run_completed") is not True]
    gate_failed_invocations = [row for row in invocations if (row.get("run_gate_failed_count") or 0) > 0]
    if unknown_commands:
        counts = Counter(row["command_name"] for row in unknown_commands)
        issue_signals.append(
            {
                "count": len(unknown_commands),
                "details": ", ".join(f"{name} ({count})" for name, count in counts.most_common()),
                "examples": [row["invocation_id"] for row in unknown_commands[:5]],
                "severity": "low",
                "title": "Non-built-in or custom Circuit surfaces were invoked",
            }
        )

    if unmatched_workflow_invocations:
        issue_signals.append(
            {
                "count": len(unmatched_workflow_invocations),
                "details": f"{len(unmatched_workflow_invocations)} workflow-style invocations had no matching on-disk run record",
                "examples": [row["invocation_id"] for row in unmatched_workflow_invocations[:5]],
                "severity": "medium",
                "title": "Workflow invocations without run-state evidence",
            }
        )

    if tool_error_invocations:
        issue_signals.append(
            {
                "count": len(tool_error_invocations),
                "details": f"{len(tool_error_invocations)} invocations emitted at least one Claude tool error before the next Circuit invocation",
                "examples": [row["invocation_id"] for row in tool_error_invocations[:5]],
                "severity": "medium",
                "title": "Claude tool friction during Circuit runs",
            }
        )

    if incomplete_runs:
        statuses = sorted({row.get("matched_run_status") or "unknown" for row in incomplete_runs})
        issue_signals.append(
            {
                "count": len(incomplete_runs),
                "details": f"{len(incomplete_runs)} matched runs ended as {', '.join(statuses)}",
                "examples": [row["invocation_id"] for row in incomplete_runs[:5]],
                "severity": "medium",
                "title": "Matched runs did not finish cleanly",
            }
        )

    if gate_failed_invocations:
        issue_signals.append(
            {
                "count": len(gate_failed_invocations),
                "details": f"{len(gate_failed_invocations)} matched runs recorded at least one gate failure",
                "examples": [row["invocation_id"] for row in gate_failed_invocations[:5]],
                "severity": "low",
                "title": "Gate failures are showing up in real runs",
            }
        )

    improvement_opportunities: list[dict[str, Any]] = []
    for item in command_summaries:
        if item["command_name"] in WORKFLOW_COMMANDS and item["no_run_match_invocations"] > 0:
            improvement_opportunities.append(
                {
                    "command_name": item["command_name"],
                    "details": f"{item['no_run_match_invocations']}/{item['invocations']} invocations did not correlate to a local run root. Improve hook-side correlation or explicitly model untracked/manual paths.",
                    "evidence_count": item["no_run_match_invocations"],
                    "priority": "high" if item["no_run_match_invocations"] >= 5 else "medium",
                    "title": "Tighten invocation-to-run observability",
                }
            )

        if item["tool_error_invocations"] > 0:
            improvement_opportunities.append(
                {
                    "command_name": item["command_name"],
                    "details": f"{item['tool_error_invocations']}/{item['invocations']} invocations saw Claude tool errors before the next Circuit invocation. Inspect transcript excerpts for avoidable launch friction.",
                    "evidence_count": item["tool_error_invocations"],
                    "priority": "high" if item["tool_error_invocations"] >= 3 else "medium",
                    "title": "Reduce launch/tool friction",
                }
            )

        launch_latency = item["median_time_to_launch_ms"] or 0
        if launch_latency >= 2_000:
            improvement_opportunities.append(
                {
                    "command_name": item["command_name"],
                    "details": f"Median time-to-launch is {launch_latency}ms. This suggests prompt-surface or hook overhead that may be worth streamlining.",
                    "evidence_count": item["invocations"],
                    "priority": "medium" if launch_latency >= 5_000 else "low",
                    "title": "Trim launch latency",
                }
            )

    if unknown_commands:
        improvement_opportunities.append(
            {
                "command_name": None,
                "details": "Custom and experimental surfaces are present in transcript history. Split built-in reliability analysis from custom-surface experimentation when triaging product issues.",
                "evidence_count": len(unknown_commands),
                "priority": "low",
                "title": "Separate built-in analysis from custom-surface traffic",
            }
        )

    priority_rank = {"high": 0, "medium": 1, "low": 2}
    improvement_opportunities.sort(
        key=lambda item: (priority_rank[item["priority"]], -item["evidence_count"], item["title"])
    )

    return {
        "analysis_intent": "internal_debug",
        "by_command": command_summaries,
        "by_project": project_summaries[:20],
        "debug_signals": issue_signals,
        "generated_at": datetime.now().astimezone().isoformat(),
        "improvement_opportunities": improvement_opportunities[:12],
        "issue_signals": issue_signals,
        "invocations_total": len(invocations),
        "known_commands": known_commands,
        "maintainer_notes": [
            "This report is for Circuit maintainer debugging and product improvement, not end-user reporting.",
            "Non-built-in surfaces usually mean custom or experimental circuits, not necessarily a built-in product defect.",
            "Workflow invocations without matched runs indicate either an observability gap or an untracked/manual execution path worth understanding.",
        ],
        "matched_runs_total": sum(1 for row in invocations if row.get("matched_run")),
        "range_from": to_iso(from_ms),
        "range_to": to_iso(to_ms),
        "sessions_scanned": sessions_scanned,
        "sessions_with_invocations": len({row["session_id"] for row in invocations}),
        "workflow_invocations_total": sum(1 for row in invocations if row["command_name"] in WORKFLOW_COMMANDS),
    }


def render_summary_markdown(summary: dict[str, Any]) -> str:
    lines = [
        "# Circuit Invocation Summary",
        "",
        "> Internal development/debug report for Circuit maintainers.",
        "",
        f"- Window: {summary['range_from']} to {summary['range_to']}",
        f"- Sessions scanned: {summary['sessions_scanned']}",
        f"- Sessions with Circuit activity: {summary['sessions_with_invocations']}",
        f"- Circuit invocations: {summary['invocations_total']}",
        f"- Matched run records: {summary['matched_runs_total']}",
        f"- Workflow invocations: {summary['workflow_invocations_total']}",
        "",
        "## Maintainer Notes",
        "",
    ]
    lines.extend(f"- {note}" for note in summary["maintainer_notes"])
    lines.extend(
        [
            "",
            "## Top Commands",
            "",
            "| Command | Invocations | Matched Runs | Completed Runs | Median Run Duration (ms) | Tool Error Invocations | No-Run-Match |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )

    for item in summary["by_command"][:10]:
        lines.append(
            f"| {item['command_name']} | {item['invocations']} | {item['matched_runs']} | {item['completed_runs']} | {item['median_run_duration_ms'] or ''} | {item['tool_error_invocations']} | {item['no_run_match_invocations']} |"
        )

    if summary["debug_signals"]:
        lines.extend(["", "## Debug Signals", ""])
        for signal in summary["debug_signals"]:
            lines.append(f"- [{signal['severity']}] {signal['title']}: {signal['details']}")
            if signal["examples"]:
                lines.append(f"  Examples: {', '.join(signal['examples'])}")

    if summary["improvement_opportunities"]:
        lines.extend(["", "## Improvement Opportunities", ""])
        for item in summary["improvement_opportunities"]:
            scope = f" ({item['command_name']})" if item["command_name"] else ""
            lines.append(f"- [{item['priority']}] {item['title']}{scope}: {item['details']}")

    if summary["by_project"]:
        lines.extend(
            [
                "",
                "## Busy Projects",
                "",
                "| Project | Invocations | Matched Runs | Failed or Incomplete Runs | Tool Error Invocations |",
                "| --- | ---: | ---: | ---: | ---: |",
            ]
        )
        for item in summary["by_project"][:10]:
            lines.append(
                f"| {item['project_path']} | {item['invocations']} | {item['matched_runs']} | {item['failed_or_incomplete_runs']} | {item['tool_error_invocations']} |"
            )

    lines.append("")
    return "\n".join(lines)


def write_outputs(out_dir: Path, invocations: list[dict[str, Any]], summary: dict[str, Any]) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    invocations_json = out_dir / "invocations.json"
    invocations_ndjson = out_dir / "invocations.ndjson"
    invocations_csv = out_dir / "invocations.csv"
    summary_json = out_dir / "summary.json"
    summary_md = out_dir / "summary.md"

    invocations_json.write_text(json.dumps(invocations, indent=2) + "\n")
    invocations_ndjson.write_text("".join(json.dumps(row) + "\n" for row in invocations))

    csv_headers = [
        "requested_at",
        "command_name",
        "command_args",
        "source_kind",
        "project_path",
        "session_id",
        "entrypoint",
        "git_branch",
        "launch_confirmed",
        "time_to_launch_ms",
        "tool_error_count",
        "hook_error_count",
        "matched_run",
        "matched_run_status",
        "matched_run_circuit_id",
        "matched_run_selected_entry_mode",
        "matched_run_duration_ms",
        "run_time_to_start_ms",
        "run_gate_failed_count",
        "run_partial_job_count",
        "run_blocked_job_count",
        "run_match_confidence",
        "raw_excerpt",
    ]
    with invocations_csv.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=csv_headers)
        writer.writeheader()
        for row in invocations:
            writer.writerow({header: row.get(header) for header in csv_headers})

    summary_json.write_text(json.dumps(summary, indent=2) + "\n")
    summary_md.write_text(render_summary_markdown(summary))
    return [str(path) for path in [invocations_json, invocations_ndjson, invocations_csv, summary_json, summary_md]]


def scrape(
    from_ms: int,
    to_ms: int,
    sessions_root: Path,
    project_path: str | None,
    source: str = "both",
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    known_commands = load_known_commands(repo_root())
    known_command_set = set(known_commands)

    # Ledger-first: read structured invocation data when available.
    ledger_invocations: list[dict[str, Any]] = []
    if source in ("ledger", "both"):
        ledger_entries = read_invocation_ledger(from_ms=from_ms, to_ms=to_ms)
        ledger_invocations = ledger_invocations_to_finalized(ledger_entries, known_command_set)

    if source == "ledger":
        return ledger_invocations, build_summary(ledger_invocations, known_commands, from_ms, to_ms, 0)
    sessions = discover_sessions(sessions_root, from_ms, to_ms, project_path)
    drafts: list[dict[str, Any]] = []
    project_runs: dict[str, list[dict[str, Any]]] = {}
    sessions_scanned = 0

    normalized_project_path = os.path.realpath(project_path) if project_path else None

    for session in sessions:
        timeline = parse_timeline(Path(session["session_path"]))
        inferred_project_path = infer_project_path(session, timeline)
        session["project_path"] = inferred_project_path
        if normalized_project_path and inferred_project_path and inferred_project_path != normalized_project_path:
            continue

        sessions_scanned += 1

        for record in timeline:
            parsed_user = parse_user_invocation(record)
            if parsed_user:
                draft = build_draft(
                    session,
                    record,
                    parsed_user["command_name"],
                    parsed_user["command_args"],
                    parsed_user["source_kind"],
                    parsed_user["raw_excerpt"],
                    known_command_set,
                )
                if draft:
                    draft["project_path"] = inferred_project_path
                    drafts.append(draft)

            skill_tool_use = extract_skill_tool_use(record)
            if skill_tool_use and record.get("timestamp_ms") is not None:
                existing = find_recent_invocation(drafts, skill_tool_use["command_name"], record["timestamp_ms"])
                if not existing:
                    draft = build_draft(
                        session,
                        record,
                        skill_tool_use["command_name"],
                        skill_tool_use["command_args"],
                        "assistant_skill_tool",
                        trim_excerpt(skill_tool_use["command_args"]),
                        known_command_set,
                    )
                    if draft:
                        draft["project_path"] = inferred_project_path
                        drafts.append(draft)

            launch_result = extract_launch_result(record)
            if launch_result and record.get("timestamp_ms") is not None:
                existing = find_recent_invocation(drafts, launch_result["command_name"], record["timestamp_ms"])
                if existing:
                    existing["launch_confirmed"] = launch_result["success"]
                    existing["launch_confirmed_at_ms"] = record["timestamp_ms"]
                    existing["time_to_launch_ms"] = record["timestamp_ms"] - existing["requested_at_ms"]
                else:
                    draft = build_draft(
                        session,
                        record,
                        launch_result["command_name"],
                        "",
                        "launch_result",
                        trim_excerpt(launch_result["command_name"]),
                        known_command_set,
                    )
                    if draft:
                        draft["project_path"] = inferred_project_path
                        draft["launch_confirmed"] = launch_result["success"]
                        draft["launch_confirmed_at_ms"] = record["timestamp_ms"]
                        draft["time_to_launch_ms"] = 0
                        drafts.append(draft)

        session_drafts = sorted(
            [draft for draft in drafts if draft["session"]["session_path"] == session["session_path"]],
            key=lambda draft: draft["requested_at_ms"],
        )
        for index, draft in enumerate(session_drafts):
            draft["next_invocation_at_ms"] = session_drafts[index + 1]["requested_at_ms"] if index + 1 < len(session_drafts) else None

        if not session_drafts:
            continue

        draft_index = 0
        for record in timeline:
            timestamp_ms = record.get("timestamp_ms")
            if timestamp_ms is None:
                continue
            while (
                draft_index < len(session_drafts)
                and session_drafts[draft_index]["next_invocation_at_ms"] is not None
                and timestamp_ms >= session_drafts[draft_index]["next_invocation_at_ms"]
            ):
                draft_index += 1
            if draft_index >= len(session_drafts):
                break

            draft = session_drafts[draft_index]
            if timestamp_ms < draft["requested_at_ms"]:
                continue

            if is_assistant_message(record):
                draft["assistant_message_count"] += 1
                draft["assistant_tool_use_count"] += assistant_tool_use_count(record)
                if draft["first_assistant_response_at_ms"] is None:
                    draft["first_assistant_response_at_ms"] = timestamp_ms
                    draft["time_to_first_assistant_response_ms"] = timestamp_ms - draft["requested_at_ms"]

            tool_error = extract_tool_error(record)
            if tool_error:
                draft["tool_error_count"] += 1
                if draft["first_error_excerpt"] is None:
                    draft["first_error_excerpt"] = trim_excerpt(tool_error)
                if "user rejected tool use" in tool_error.lower():
                    draft["user_rejected_tool_use_count"] += 1

            if is_hook_error(record):
                draft["hook_error_count"] += 1

        if inferred_project_path:
            if inferred_project_path not in project_runs:
                project_runs[inferred_project_path] = collect_runs_for_project(inferred_project_path)
            for draft in session_drafts:
                matched = match_run_for_invocation(draft, project_runs[inferred_project_path])
                if matched:
                    draft["matched_run"] = matched["run"]
                    draft["matched_run_confidence"] = matched["confidence"]

    finalized = []
    for draft in sorted(
        [draft for draft in drafts if from_ms <= draft["requested_at_ms"] <= to_ms],
        key=lambda draft: draft["requested_at_ms"],
    ):
        matched = None
        if draft.get("matched_run"):
            matched = {"confidence": draft.get("matched_run_confidence") or "exact", "run": draft["matched_run"]}
        row = finalize_invocation(draft, matched)
        row["source"] = "transcript"
        finalized.append(row)

    # Merge ledger and transcript results when using both sources.
    if source == "both" and ledger_invocations:
        ledger_ids = {row["invocation_id"] for row in ledger_invocations if row.get("invocation_id")}
        # Deduplicate: ledger entries win over transcript entries with the same invocation_id.
        # Transcript-only entries that have no ledger counterpart get demoted confidence.
        deduplicated = list(ledger_invocations)
        for row in finalized:
            if row.get("invocation_id") not in ledger_ids:
                row["source"] = "transcript"
                deduplicated.append(row)
        finalized = sorted(deduplicated, key=lambda row: row.get("requested_at") or "")

    return finalized, build_summary(finalized, known_commands, from_ms, to_ms, sessions_scanned)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Internal debug tool for analyzing Circuit invocations from Claude Code session history.",
    )
    parser.add_argument("--from", dest="from_value", required=True, help="Inclusive start date/time (YYYY-MM-DD or ISO timestamp)")
    parser.add_argument("--to", dest="to_value", required=True, help="Inclusive end date/time (YYYY-MM-DD or ISO timestamp)")
    parser.add_argument("--out-dir", required=True, help="Directory where outputs should be written")
    parser.add_argument(
        "--sessions-root",
        default=str(Path.home() / ".claude" / "projects"),
        help="Claude sessions root (defaults to ~/.claude/projects)",
    )
    parser.add_argument("--project-path", help="Restrict analysis to a single Claude project path")
    parser.add_argument(
        "--source",
        choices=["ledger", "transcript", "both"],
        default="both",
        help="Data source: 'ledger' (structured only), 'transcript' (session mining), 'both' (merge with dedup, default)",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    from_ms = parse_date_boundary(args.from_value, end_of_day=False)
    to_ms = parse_date_boundary(args.to_value, end_of_day=True)
    sessions_root = Path(args.sessions_root).expanduser().resolve()

    invocations, summary = scrape(from_ms, to_ms, sessions_root, args.project_path, source=args.source)
    output_paths = write_outputs(Path(args.out_dir).expanduser().resolve(), invocations, summary)

    payload = {
        "analysis_intent": "internal_debug",
        "invocations": len(invocations),
        "output_paths": output_paths,
        "range_from": to_iso(from_ms),
        "range_to": to_iso(to_ms),
        "sessions_root": str(sessions_root),
        "summary": summary,
    }
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
