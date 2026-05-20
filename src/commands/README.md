# Command Sources

This directory contains hand-authored source files for Circuit commands that
are not owned by a flow package.

Flow-owned command sources live beside their flows at
`src/flows/<id>/command.md`. The emit script copies both kinds of command
source into host packages:

- Claude Code commands: `plugins/claude/commands/<id>.md`
- Codex commands: `plugins/codex/commands/<id>.md`
- Codex skills: `plugins/codex/skills/<id>/SKILL.md`

Do not edit generated host command files by hand. Edit the source here or in
the relevant flow package, then run `npm run emit-flows`.
