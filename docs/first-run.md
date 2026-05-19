# First Run

Start with doctor before the first useful run:

```bash
node plugins/circuit/scripts/circuit.mjs doctor
```

Doctor checks the packaged plugin files, command wrapper, generated flows, and
basic Review/checkpoint behavior. A passing doctor should report
`runtime_source: bundled`, which means the installed plugin is using its
packaged runtime and not a local `PATH` binary.

For the safest first real run, use Review. Review is read-only:

```bash
./bin/circuit run review --goal 'review this checkout for obvious release blockers'
```

Build and Fix may invoke a write-capable Claude Code worker:

> A worker can edit this checkout.

Use `codex` only for read-only Codex relays. Use `claude-code` for trusted
same-workspace writes. `codex-isolated` is planned, not current.
