# Decisions: Isolated Codex Dispatch Default

Historical note: these decisions record the original migration plan.
`codex-ambient` was removed from the live repo on 2026-04-14.

## Decision 1: Keep `codex` as a user-facing alias

Date: 2026-04-11

`codex` remains a valid built-in adapter name, but it now maps to the isolated runtime boundary. This preserves existing config intent while making the default deterministic.

## Decision 2: Preserve ambient mode only as an explicit adapter

Date: 2026-04-11

The previous ambient behavior is retained as `codex-ambient` for one release train. Circuit does not silently fall back to it.

## Decision 3: Phase 1 stops at isolation plus diagnostics

Date: 2026-04-11

The verification-runner split is intentionally deferred. This slice owns runtime isolation, auth bootstrap, launch diagnostics, and owned cleanup only.
