# Runtime Architecture

The runtime in `src/runtime/` is Circuit's engine foundation. The CLI loads a
compiled flow, validates the executable graph, writes a manifest snapshot, and
records the run trace as the graph advances through compose, relay,
verification, checkpoint, sub-run, and fanout steps.

Run folders are current only when they contain a valid manifest snapshot and a
runtime bootstrap trace entry whose manifest identity matches that snapshot.
Status projection, checkpoint resume, handoff continuity, and result writing
all read that same folder contract. Unrecognized folders are invalid run
folders.

Flow-specific behavior stays in flow packages and registries under
`src/flows/`. The runtime owns execution mechanics, trace storage, report-file
validation, connector resolution, checkpoint resume, sub-run orchestration, and
fanout joining. Adding or changing a flow should update the flow package and
generated surfaces, not add flow-specific branches to the engine.

Relay acceptance criteria follow that boundary. Flow packages author optional
`acceptance_criteria` on relay steps; the compiler and manifest projections
carry the field through unchanged; the relay executor evaluates the
deterministic criteria after the result verdict and report schema pass. A failed
criterion either aborts the step or returns through the existing retry route
with feedback, so retry bounds stay owned by the graph runner's normal attempt
logic.

The long-term runtime direction is a functional effect shell around the same
explicit graph walk. The graph runner should continue to make step advancement
plain: enter step, run executor, evaluate route, append trace, move to the next
step. Capabilities such as files, trace persistence, clocks, subprocesses,
connectors, progress, child runs, and worktrees should be supplied at the edge
and should return typed errors as values. See
[docs/architecture/data-first-functional-flow-architecture.md](data-first-functional-flow-architecture.md).

The CLI routes supported fresh invocations directly through this runtime.
Published custom flows carry a manifest entry that maps the custom slug to a
supported archetype, so the normal `circuit run <slug> --flow-root <root>`
command uses the same foundation as generated flows.
