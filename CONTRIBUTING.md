# Contributing to Circuitry

## Adding a New Circuit

### Prerequisites

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand how circuits work
- A workflow that fits the circuit model (multi-phase, artifact-producing)

### Authoring a Circuit

1. Create `skills/<circuit-name>/circuit.yaml` and `skills/<circuit-name>/SKILL.md`
2. Follow the schemas documented in [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Validate that `circuit.yaml` and `SKILL.md` agree on topology

### Circuit Quality Checklist

- [ ] `circuit.yaml` and `SKILL.md` agree on topology
- [ ] Every step has a gate stronger than "file exists"
- [ ] Artifact chain is fully traced (no orphaned `produces`/`consumes`)
- [ ] Frontmatter has effective trigger phrases and negative scope
- [ ] Relay headings present in all dispatch headers
- [ ] Resume awareness documented
- [ ] Circuit breaker section present

### Testing

Run the circuit against a concrete task that exercises its hardest seam.
Pick a real scenario, not a toy example. The test should stress the gates
and artifact handoffs that are most likely to fail in practice.

Run the full verification suite:

```bash
# All checks in one pass
./scripts/verify-install.sh && cd scripts/runtime/engine && npx vitest run
```

Or run them separately:

```bash
# Installation and smoke tests
./scripts/verify-install.sh

# Runtime engine unit tests (schema validation, state derivation)
cd scripts/runtime/engine && npx vitest run
```

## Improving Existing Circuits

- Edit `SKILL.md` for runtime behavior changes
- Edit `circuit.yaml` only for topology changes (steps, gates, artifacts)
- Always cross-validate both files after editing

## Improving Relay Scripts

`scripts/relay/compose-prompt.sh` and `scripts/relay/dispatch.sh` are the
shared infrastructure that all circuits depend on.

- Changes here affect **all circuits**. Test thoroughly before committing
- Run `scripts/verify-install.sh` for smoke tests
- If you change argument parsing or output format, audit every circuit that
  calls the script

## Plugin Cache Sync

After modifying any plugin file, run `./scripts/sync-to-cache.sh` before
testing. Claude Code runs the cached copy, not the local repo.

## Submitting Changes

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run the full verification suite: `./scripts/verify-install.sh && cd scripts/runtime/engine && npx vitest run`
5. Open a PR with a clear description of what changed and why

## Code of Conduct

Be respectful. This is a tool for everyone.
