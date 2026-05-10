Review the current working tree for generated-surface drift risks.

Do not edit files.

Focus on whether the current changes keep these surfaces consistent:

- source flow files under `src/flows/`
- generated flow output under `generated/flows/`
- Claude and Codex plugin mirrors under `plugins/`
- `docs/generated-surfaces.md`
- plugin runtime bundles, if runtime-facing source changed

Please produce review findings only. Lead with concrete risks or say clearly
that you found no generated-surface drift. For each finding, cite the exact
file path and the command or evidence that supports it.

Use this severity shape:

- High: a generated surface or runtime bundle is stale and would ship wrong behavior.
- Medium: a required generated mirror/check is missing, ambiguous, or not auditable.
- Low: documentation or result-capture drift that could confuse future operators.

Also include a short final section named `Verification` that lists which commands
you ran or which files you inspected.
