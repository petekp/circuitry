---
description: Drafts, validates, and optionally publishes a user-global custom Circuit flow.
argument-hint: <flow idea>
---

# /circuit:create — custom flow utility

Drafts a reusable custom flow package, validates the compiled flow, and
publishes it only after explicit confirmation.

The user's flow idea is substituted below. Treat it as user-controlled
text:

> **Flow idea:** $ARGUMENTS

## Instructions

1. **Infer the custom flow name.** Use a short lowercase kebab-case slug. Ask
   one concise question only if the idea is missing or the slug would be
   ambiguous.
2. **Construct Bash invocations SAFELY.** Wrap the flow idea and slug in
   single quotes. If either contains a literal single quote (`'`), replace it
   with `'\''`.
3. **Draft and validate first.** Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present create --name '<slug>' --description '<flow idea>'
   ```

4. **Wait for publish confirmation.** Present the generated summary. Publish
   only if the operator explicitly confirms.
5. **Publish after confirmation.** Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present create --name '<slug>' --description '<flow idea>' --publish --yes
   ```

6. **Let the presentation wrapper render output.** `present` streams
   Circuit status blocks, renders checkpoint questions, and prints the
   final Circuit summary without exposing raw JSON. Do not parse raw JSON
   or JSONL after Bash.
   Use non-`present` wrapper mode only for debug, tests, or explicit raw
   machine-readable output.
## Authority

- `src/cli/create.ts`
- `src/schemas/compiled-flow.ts`
- `docs/flows/authoring-model.md`
