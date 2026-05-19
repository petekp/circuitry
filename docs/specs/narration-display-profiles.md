# Narration Display Profiles

Status: canonical companion spec for `docs/contracts/host-rendering.md`.

Circuit keeps CLI output machine-readable and gives host surfaces a smaller
presentation path.

## Claude Presentation

Claude host commands must use a presentation wrapper for user-facing run,
resume, create, and handoff commands. The wrapper streams approved progress
status blocks, suppresses raw progress lines, handles checkpoint choices, and
prints a final summary line or standalone Markdown summary as appropriate.

Raw stdout JSON and progress JSONL stay available through the non-presentation
wrapper path for automation, tests, and explicit debug use.

## Flow Profiles

Flow profiles provide semantic atoms. They do not provide full prose strings.
The runtime can keep connector names, step ids, report paths, run folders, and
schemas in machine fields while the presentation path renders only useful text.

Summary rendering uses structured slots and visible budgets. Explore summaries
use a headline, one primary recommendation or decision, one support or
start-with note, up to three reviewer cautions, and one next step.

## Transcript Acceptance

Transcript acceptance checks are mandatory:

- no raw JSONL
- no final stdout JSON
- no report section by default
- no path unless failure, checkpoint resume, debug, or user request
- max 4-6 visible final bullets
- max 3 visible reviewer cautions
- explicit `/circuit:explore` starts with useful work progress, not route chatter
