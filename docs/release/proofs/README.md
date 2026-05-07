# Release Proofs

`runs/` contains committed release proof files captured by the release proof
scripts. These are not casual examples. They are fixtures that back public
release claims and are parsed by the release infrastructure tests.

Update them with:

```bash
npm run capture-proofs:golden-runs
```

The release tests enforce that proof paths stay under `docs/release/proofs/runs`
and that the old `examples/runs` location does not come back.
