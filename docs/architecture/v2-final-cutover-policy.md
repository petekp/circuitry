# Core-v2 Final Cutover Policy

Date: 2026-05-06

## Decision

The retained-runtime compatibility posture is superseded. There are zero
external users, so the product should move to a final cutover instead of
preserving old runtime compatibility for outside callers.

Do not prepare more external review packets by default. The Phase 5.60 review
packet path stops here unless a genuinely new ambiguity appears.

## Numbered Groups

1. Policy reset only. Done.
2. Code cutover. Done: retained and v1 run folders fail closed with exactly:

   ```text
   This run folder was created by the retired runtime. Start a fresh run.
   ```

3. Doc compression. Keep the historical checkpoint docs until this group.

## Guardrails

- Do not add an adapter for v1 run folders.
- Do not delete the 100+ checkpoint docs during the policy reset or code
  cutover groups.
- Batch work by numbered group, not tiny migration slices.
- Use local adversarial self-review before each numbered group.
- Preserve unrelated dirty work while cutting over.

## Immediate Next Step

Choose the next batch:

- remove dead retained/v1 projection code that no active CLI path calls anymore;
- or start doc compression and update the historical checkpoint docs in one
  deliberate pass.
