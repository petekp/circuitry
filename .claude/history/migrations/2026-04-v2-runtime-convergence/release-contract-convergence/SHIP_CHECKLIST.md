# Ship Checklist: Release Contract Convergence

## Automated Checks

- [ ] `npm ci --prefix scripts/runtime/engine`
- [ ] `./scripts/verify-install.sh`
- [ ] `cd scripts/runtime/engine && node esbuild.config.mjs && npx vitest run`
- [ ] `git diff --quiet scripts/runtime/bin/`
- [ ] `cd scripts/runtime/engine && npx vitest run src/release-integrity.test.ts src/relay-scripts.test.ts src/runtime-cli-integration.test.ts src/resume.test.ts`

## Installed-Surface Evidence

- [ ] `./scripts/verify-install.sh` passes from the repo root
- [ ] `./scripts/verify-install.sh` passes from a temp reconstructed install root
- [ ] verifier exercises config precedence, malformed-config failure, template composition, and append-event -> derive-state -> resume round trips

## Manual Host Acceptance

- [ ] `./scripts/qa/manual-host-surface-smoke.sh`
- [ ] inspect any failed-case logs under `.circuit/manual-host-surface-smoke/<timestamp>/`

## Documentation and Taxonomy

- [ ] no workflow docs still contain `--skills "workers`
- [ ] README no longer labels `review` and `handoff` as direct circuits
- [ ] README, CIRCUITS, ARCHITECTURE, and CUSTOM-CIRCUITS agree on circuit-vs-utility taxonomy

## Cleanup and Cache

- [ ] `./scripts/sync-to-cache.sh`
- [ ] write final `HANDOFF.md`
- [ ] tell the user to `/clear`
