# Types

Most Circuit types come from Zod schemas in `src/schemas/`.

Use this directory only for TypeScript helpers that schemas cannot express
cleanly, such as branded types, phantom boundary types, or structural utility
types.

Prefer adding a schema first when a shape is stored, parsed, relayed, or shown
to a host.
