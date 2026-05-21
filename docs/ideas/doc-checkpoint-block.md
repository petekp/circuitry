# Doc checkpoint block — let the operator mark up the agent's markdown

Idea for adding a new checkpoint block to Circuit that pauses a run on a
specific markdown file, lets the operator leave inline comments and
suggested edits, and resumes with that feedback as a typed report. The
trigger is roughdraft (https://github.com/Lex-Inc/roughdraft), a
local-first markdown editor + CLI + MCP server that round-trips
CriticMarkup feedback through the file itself. Captured 2026-05-20 from
a read of the roughdraft repo at depth-1 plus a walk of Circuit's
existing block catalog and review surface.

## The trigger

Roughdraft is built around one loop, codified in its own README and in
the `Plan Writing Workflow` section of its `AGENTS.md`:

1. The agent writes a markdown file to disk.
2. The operator opens it with `roughdraft open <path> --json`.
3. The CLI starts (or reuses) a localhost server, opens the doc in a
   browser editor, registers a fresh watcher, and *blocks* until the
   operator clicks "Done Reviewing."
4. While the doc is open, the operator leaves CriticMarkup comments,
   suggested insertions, deletions, substitutions — all of which are
   written back into the markdown file with canonical `id`/`by`/`at`
   attributes so they survive in the file as durable structured data.
5. The CLI returns event JSON with `path`, `version`, and feedback
   counts; the agent then re-reads the file and parses the CriticMarkup
   to respond.

The whole interface is local: a CLI, a localhost server with a
`/api/review-events/watch` HTTP endpoint, and an optional `roughdraft
mcp` stdio server that exposes six tools (`roughdraft_get_review_index`,
`roughdraft_get_pending_feedback`, `roughdraft_watch_review_events`,
`roughdraft_reply_to_comment`, `roughdraft_mark_resolved`, plus a
placeholder `roughdraft_get_open_documents`). Feedback is parsed by
`@roughdraft/rfm` into a typed `RfmReviewIndex` — item kind (`comment`
/ `suggestion` / `reply`), suggestion kind, parent linkage, author,
timestamp, line/column anchor.

So the file *is* the structured feedback channel. There's no sidecar
database. The agent's next pass can parse the same file deterministically
and respond.

## Why Circuit can't do this today

Circuit reviews code, not docs. The `review` flow
(`src/flows/review/data.ts`) walks Intake → Independent Audit → Verdict
where the audit step is an LLM relay over a git diff
(`src/flows/review/writers/intake.ts:183-215`). The evidence schema in
`src/flows/review/reports.ts:53-74` is `{kind: 'unavailable'} |
{kind: 'git-working-tree'}` — no `{kind: 'document'}` variant. Build and
Explore reuse the same `review` block plus enumerated-choice
checkpoints. None of these surfaces lets the operator mark up a single
markdown file inline.

The closest existing block is `human-decision`
(`docs/flows/block-catalog.json:72-91`). Its `action_surface` is `host`,
its `host_capabilities.claude` is "AskUserQuestion or native
user-question tool," its non-interactive fallback is "use declared
default, pause, fail clearly." But it's a *bounded choice* surface —
"pick option A, B, or C." There's no contract for "here's a 2000-word
doc, leave inline annotations."

What's missing is a checkpoint that takes a document and returns
free-form structured operator feedback. That gap is real, and
roughdraft's RFM index is a near-1:1 fit for the typed report shape
Circuit would want on return.

## The shape that fits Circuit

A new block, `doc-checkpoint`, registered alongside the existing
catalog in `docs/flows/block-catalog.json` and
`src/schemas/flow-block-definitions.ts`. It's a specialization of
`human-decision`, not of `review` — the operator is the reviewer, the
agent is the implementer that must respond on the next pass.

**Inputs.** A new typed contract `doc.checkpoint-request@v1`:

```ts
{
  document_path:    string,      // absolute path; must end .md
  prompt:           string,      // what the operator should look for
  required:         'feedback' | 'review-completed',
  timeout_seconds?: number,
  auto_resolution?: {
    policy: 'accept-as-is' | 'use-default-revision',
    default_summary?: string,
  },
}
```

The block doesn't generate the document. An upstream `act`-style step
must already have written it, and the schematic validator should reject
any flow that wires `doc-checkpoint` without one.

**Output.** A new typed contract `doc.feedback@v1`, projecting roughdraft's
`RfmReviewIndex` into Circuit's snake_case convention and adding an
explicit outcome discriminator:

```ts
{
  document_path:    string,
  document_version: string,      // sha256 of file bytes at resume
  feedback_items:   Array<{
    id:               string,
    kind:             'comment' | 'suggestion' | 'reply',
    suggestion_kind?: 'addition' | 'deletion' | 'substitution',
    parent_id:        string | null,
    author:           string | null,
    created_at:       string | null,
    status:           string | null,
    text:             string,
    original_text?:   string,
    replacement_text?: string,
    anchor_text?:     string,
    line:             number,
    column:           number,
  }>,
  summary: { comments: number, suggestions: number, replies: number, unresolved: number },
  outcome: 'feedback' | 'no-feedback' | 'default-applied' | 'timed-out',
}
```

**Run folder.** Following the prototype/build checkpoint convention
(`src/flows/prototype/data.ts:455-456`) and the per-stage staging
convention (`src/flows/review/data.ts:154`):

```
<run-folder>/
  reports/
    checkpoints/
      <step-id>-request.json   # doc.checkpoint-request@v1
      <step-id>-response.json  # doc.feedback@v1
  stages/
    review/
      <step-id>-snapshot.md    # file bytes at request time
      <step-id>-resumed.md     # file bytes at resume
```

Two markdown snapshots are stage-scoped raw artifacts, not typed
reports — they let the close stage compute a stable doc-version diff
without depending on the operator's working tree at close time.

**Executor.** Lives where checkpoints already live
(`src/runtime/executors/checkpoint.ts`), branching on `protocol:
'doc-checkpoint@v1'`. It writes the request, hands control to the
host's `ask_user` slot
(`docs/contracts/host-capabilities.md:16-27`) with a hint that a
roughdraft connector is preferred, blocks on the host, parses the
response into the typed schema, and resumes.

**Host wiring.** Roughdraft is a *host-capability adapter*, not a worker
connector. There's no `reviewer` role here — the operator is the
reviewer. The cleanest fit is to extend `host-capabilities.md` with a
new slot:

```
doc_feedback: collect inline markdown feedback on a single file.
```

Claude and Codex declare `doc_feedback: model-mediated, prefers
roughdraft when installed, fallback in-thread`. Generic-shell declares
`fallback via circuit resume --run-folder ...`. Non-interactive hosts
declare `fail clearly when required, use default when allowed`.

Document paths can live anywhere in the project — they're not run-folder
files — so the executor must use a project-root containment check (like
`insideProject` at `src/flows/review/writers/intake.ts:98-101`), not
`resolveRunFilePath`.

## The alternative I considered and rejected

The other shape that came up was `audit-doc` — a thin variant of the
existing `review` block that takes a markdown file path and runs the
reviewer relay on it, returning `review.result@v1`. This doesn't need
roughdraft at all (`node:fs` reads the file, the existing `reviewer`
role does the rest), and it overlaps the existing review flow enough
that the proper fix is "add a `{kind: 'document'}` variant to
`ReviewEvidence` and let `/circuit:review` accept an explicit file
scope" — a one-day patch, not a new block.

`audit-doc` also doesn't solve the actual gap. It gives the operator a
second AI opinion. The missing capability is *operator-authored*
structured feedback that the next agent pass can parse. Those are
different problems.

That smaller `review`-extension ticket is worth filing independently of
this idea — it improves the existing flow whether or not the
`doc-checkpoint` block ever ships.

## Why this is uncertain

The integration is technically clean — roughdraft's CLI and MCP
surfaces are stable, the RFM schema is a near-1:1 fit for a Circuit
report, and the block matches Circuit's existing checkpoint
request/response conventions without violating any contract.

What's not provable from the repo is whether Circuit operators want
this workflow at all. Roughdraft's own `AGENTS.md` proves *one team*
wants it. Whether that generalizes to Circuit users is open.

The other risk is dependency posture. Roughdraft is a third-party npm
CLI + local server + state file at `~/.roughdraft/server.json`. That's
fine for an *optional* connector behind a capability slot; it's risky
for a *first-class* block in the canonical catalog tied to another
team's release cadence.

## Suggested next step

Build it as an optional Skill first, not a catalog block. A small
spike that wraps `roughdraft open --json`, parses the RFM index, and
writes `doc.feedback@v1` to a known path the next agent pass reads.
No catalog changes, no engine changes. If two or three flows reach
for it — a future `draft` flow, a Build variant that wants operator
sign-off on `CHANGELOG.md` — promote the spike to a real block per
the shape above.

In parallel, file the small `review`-extension ticket from the
rejected alternative. That one stands on its own.
