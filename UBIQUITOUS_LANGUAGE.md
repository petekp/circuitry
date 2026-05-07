# Ubiquitous Language

Circuit runs flows for structured developer work. Use these terms in product
prose, operator docs, contracts, and flow authoring notes.

## Core Flow Language

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Flow** | A named kind of work Circuit can run, such as Build, Fix, Explore, Review, Migrate, or Sweep. | Workflow, pipeline, CompiledFlow |
| **Schematic** | The authored definition of a flow. | Recipe, flow YAML |
| **Block** | A reusable kind of work that can appear in a schematic. | Primitive, task type |
| **Stage** | A grouped part of a flow, such as Frame, Analyze, Plan, Act, Verify, Review, or Close. | Phase, lane |
| **Step** | One executable use of a block inside a schematic or compiled flow. | Task, job |
| **Route** | A named outcome path from one step to the next. | Edge, branch, transition |
| **Run** | One execution of a flow. | Session, invocation |
| **Checkpoint** | A pause where Circuit needs operator input or a declared safe default. | Prompt, approval gate |
| **Check** | Validation that decides whether a step may continue. | Gate |
| **Trace** | The ordered record of what happened during a run. | Event log, runlog |
| **Report** | A typed output written by a step or close stage. | Artifact, output blob |
| **Evidence** | Supporting facts, files, checks, and reports produced or consumed by a run. | Artifact, proof blob |
| **Run folder** | The directory where a run stores its trace, reports, evidence, and resume state. | Run root, run directory |
| **Depth** | The requested thoroughness for a run or step. | Rigor |
| **Mode** | A named flow entry option, often paired with a depth. | Change kind |

## Runtime Language

These names are valid in code, schemas, contracts, tests, low-level docs, and
operator troubleshooting. Introduce them plainly when they appear in user-visible
instructions.

| Term | Definition | Product-facing term |
| --- | --- | --- |
| **CompiledFlow** | The compiled runtime graph loaded by the engine. | Compiled flow |
| **Compiled manifest** | A serialized CompiledFlow file under `generated/flows`. | Compiled flow file |
| **pass** | The runtime success route key that schematic success aliases compile to. | Success route |
| **Compose step** | A runtime step where the orchestrator writes a report. | Compose step |
| **Relay step** | A runtime step where Circuit delegates work to a worker. | Relay step |
| **Verification step** | A runtime step where the orchestrator runs verification commands. | Verification step |
| **Checkpoint step** | A runtime step where Circuit pauses for a checkpoint decision. | Checkpoint step |
| **Sub-run step** | A runtime step that executes a child flow. | Child flow step |
| **Fanout step** | A runtime step that runs multiple branches and joins their outputs. | Fanout step |
| **Trace entry** | One append-only record in a trace. | Trace record |
| **Report reference** | A schema and path pair that points to a report written during a run. | Report pointer |
| **Snapshot** | A derived runtime projection from trace entries and the compiled flow. | Run state |
| **Fixture** | A saved example or test input. | Example, proof file |
| **Runtime proof** | An internal flow used as a runtime proof and test surface. | Public flow |

## Relay Language

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Relay** | A handoff from Circuit to another worker or host. | Dispatch, job |
| **Connector** | A backend or host that can run relayed work. | Adapter, executor |
| **Connector reference** | A config or trace value that names a connector. | Adapter reference |
| **Connector name** | A custom connector identifier that is not a built-in connector or `auto`. | Adapter name |
| **Custom connector descriptor** | A registered local command that satisfies the custom connector contract. | Inline adapter |
| **Role** | The worker responsibility for a relay, such as researcher, implementer, or reviewer. | Executor |
| **Relay role** | The serialized role value on a relay step. | Executor role |
| **Relay resolution** | The procedure that chooses the connector for a relay step. | Connector routing |
| **Relay resolution source** | The provenance record explaining which rule chose a connector. | Connector source |
| **Relay transcript** | The request, receipt, result, and completion trace entries for relayed work. | Worker log |

## Configuration Language

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Config layer** | One source of configuration, such as defaults, user-global config, project config, or invocation overrides. | Settings source |
| **Selection layer** | One contributor to model, effort, skill, depth, and invocation-option selection. | Config layer when flow, stage, or step defaults are included |
| **Selection override** | A partial selection record contributed by one layer. | Override blob |
| **Resolved selection** | The effective model, effort, skills, depth, and invocation options used at relay time. | Final config |
| **Selection resolution** | The resolved selection plus provenance for which layers contributed it. | Audit record |
| **Provider-scoped model** | A model named with its provider. | Model string |
| **Effort** | Provider-level reasoning allocation. | Depth |

## Continuity Language

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Continuity record** | A cross-session handoff record for resuming work. | Handoff note |
| **Continuity index** | The resolver file that chooses the active continuity record and attached run. | Resume index |
| **Resume contract** | The declared posture for how the next session should resume. | Resume mode |
| **Run-attached provenance** | The saved run state embedded in a run-backed continuity record. | Run pointer |
| **Pending-record pointer** | The index entry naming the continuity record to read next. | Pending handoff |
| **Attached-run pointer** | The index entry naming the currently live run. | Active run |
| **Dangling reference** | A pointer to a missing continuity record. | Missing handoff |

## Skill And Plugin Language

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Skill** | A discoverable capability with trigger metadata and optional supporting files. | Tool, command |
| **Plugin** | The host-installable surface Circuit ships into Claude Code or Codex. | Package |
| **Catalog compiler** | The build-time tool that regenerates command and skill outputs from source-of-truth files. | Generator, sync script |
| **Generated surface** | A committed output regenerated from source files by an emit script. | Hand-authored doc |

## Deprecated Or Methodology Terms

Avoid these in user-facing product prose and command help. They may still appear
inside historical docs, tests, migrations, or compatibility shims when the
context is explicit.

| Term | Replacement | Notes |
| --- | --- | --- |
| **change_kind** | **Mode** or **Depth** | Keep only where serialized compatibility requires it. |
| **runtime-proof** | **Runtime proof** | Internal test flow, not a visible user flow. |
| **recipe** | **Schematic** | Older authored-flow term. |
| **scalar** | **Block** or schema-specific name | Avoid for flow composition. |
| **primitive** | **Block** | Use only for generic programming language discussion. |
| **dispatch** | **Relay** or **route** | Pick based on whether work is delegated or a path is chosen. |
| **synthesis** | **Close** or **report composition** | Avoid as product vocabulary. |
| **artifact** | **Report** or **evidence** | Pick the concrete surface. |
| **event log** | **Trace** | The serialized run record is a trace. |
| **run root** | **Run folder** | Also avoid `--run-root` in product prose. |
| **rigor** | **Depth** | Depth is the product term. |
| **phase** | **Stage** | Stage is the flow grouping term. |

## Relationships

- A **Flow** has one active **Schematic** per authored version.
- A **Schematic** wires one or more **Blocks** into ordered **Steps**.
- A **Step** belongs to one **Stage**.
- A **Step** may produce one **Report** and any amount of supporting **Evidence**.
- A **Run** follows **Routes** through a compiled flow.
- A **Run** records a **Trace** in its **Run folder**.
- A **Relay** uses one **Connector** and one **Role**.
- A **Checkpoint** is a step-level pause, not a separate flow.
- A **Depth** describes product thoroughness; an **Effort** describes model reasoning allocation.
- A **Plugin** exposes **Skills**, commands, and generated compiled-flow outputs.

## Example Dialogue

> **Dev:** "For Fix, should I add another **Flow**?"
>
> **Domain expert:** "No. Add a **Block** only if the reusable kind of work is missing. Otherwise update the Fix **Schematic**."
>
> **Dev:** "The worker needs to gather context before diagnosing. Is that a **Relay**?"
>
> **Domain expert:** "Yes. The schematic has a **Step** in the Analyze **Stage** that relays work through a researcher **Role** using a **Connector**."
>
> **Dev:** "Where does the result go?"
>
> **Domain expert:** "Into a typed **Report** in the **Run folder**, with supporting **Evidence** linked from the final close report."

## Flagged Ambiguities

- **CompiledFlow** can sound like the product flow. Use **Flow** for the product and **CompiledFlow** only for the runtime schema.
- **Report** can mean a typed output or a vague file. Use **Report** for typed outputs and **Evidence** for supporting proof.
- **Relay** can name product delegation or serialized `relay.*` trace entries. Use **Relay** in prose and keep serialized names in code or backticks.
- **Depth** and **Effort** both describe intensity. Use **Depth** for run thoroughness and **Effort** for provider-level reasoning allocation.
- **Stage** appears in both product prose and runtime fields. The term is canonical in both places, but runtime field names should stay in backticks when discussing serialization.
- **Fixture** is useful in tests, but it should not describe product-facing generated flows.
- **Runtime proof** is an internal proof flow, not a public capability.

## Anti-Patterns

- **Prose/schema drift**: prose disagrees with the schematic, compiled flow, schema, or generated output it describes.
- **Hidden runtime**: product prose carries execution policy that is not represented in schemas, schematics, or runtime code.
- **Synonym creep**: new terms appear without being added here or explicitly mapped to canonical terms.
- **Product/internal collapse**: user-facing prose teaches runtime names before operator-facing concepts.
