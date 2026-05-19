# Types

Types in `circuit` are **inferred from Zod schemas** in `../schemas/`.

Contract source of truth lives in `../schemas/*.ts`. Each schema exports a
`z.infer`-derived TypeScript type of the same name. A contract-parity test
under `tests/contracts/` verifies schemas and inferred types stay aligned.

This directory is reserved for:
- Branded-type helpers that require hand-written TypeScript
- Phantom types used at boundaries that don't participate in runtime validation
- Utility types that compose the schema-inferred types

Prefer authoring a Zod schema in `../schemas/` first and exporting its
inferred type. Add a hand-written `.ts` here only when the Zod inference is
insufficient or the type is intentionally structural-only.
