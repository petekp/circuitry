# HANDOFF

Last updated: 2026-05-07. The retained-runtime compatibility posture is superseded. There are zero external users, so the v2 work is in final cutover mode instead of external review-packet mode. Retained and v1 run folders fail closed with “This run folder was created by the retired runtime. Start a fresh run.” The old `src/runtime/**` public surface has been removed: runner, runner types, checkpoint stubs, handler, trace, reducer, snapshot, relay-selection, retained compatibility facade, v1 run-status projector, flow-authoring wrappers, shared-helper wrappers, registry wrappers, connector wrappers, run-status wrapper, progress projection wrapper, and result writer wrapper.

Next group: final doc compression. Keep the numbered checkpoint docs compressed into `docs/architecture/v2-checkpoint-history.md`; do not recreate review packets unless a genuinely new ambiguity appears. Preserve unrelated dirty work in the repo.
