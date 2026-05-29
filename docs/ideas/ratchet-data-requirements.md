# Ratchet Data Requirements

Status: research report plus selected prototype  
Date: 2026-05-29  
Scope: local `circuit` repository, local `.circuit/runs`, and local `.circuit/history`

## Purpose

Circuit has a product direction called the effectiveness ratchet: it should get
durably better at working in a project over time. The hard question is what
would make that real compounding, rather than a better notes file.

This report answers that question in data terms:

- what mechanisms can ratchet,
- what each mechanism needs to know,
- what Circuit captures today,
- what it does not capture,
- what would have to change to capture the missing data,
- which ratchets are reachable now, and which need investment.

This began as an investigation report. It now also records the selected
prototype: an additive trace event for verification command results. The change
does not add memory writes, routing changes, or self-evolving flows.

## Boundaries From `CONTEXT.md`

The ratchet must follow the current memory posture:

- Memory is agent-facing and hint-only.
- A brief human-facing indicator is appropriate when memory updates affect future
  behavior.
- The likely first scope is project plus flow memory.
- Operator-level memory comes later.
- The first use of memory is to improve flow execution: known verification
  commands, flaky tests, subsystem rules, previous failure causes, risky files,
  and useful prior evidence.
- Memory must not become hidden self-editing, magic optimization, routing
  authority, proof authority, or self-evolving flows.

Evidence: `CONTEXT.md:108-126`.

## Bottom Line

Real compounding requires more than remembering text. It requires a closed loop:

1. current runs capture comparable facts,
2. those facts are tied to source refs and staleness,
3. the next run consumes them at a bounded decision point,
4. the system records whether the hint helped, misled, or was ignored,
5. repeated evidence changes future execution in a durable but reviewable way.

A flat markdown notes file can help a person remember. It cannot, by itself,
prove staleness, compute recurrence, compare step outcomes across runs, retire a
bad hint, tune retry or emphasis policy, or crystallize a repeated process into a
typed flow with contracts.

Today's Circuit has the first layer of this loop, but not the loop itself. It
can recall prior-run snippets with provenance and hint-only authority. It can
compute descriptive run statistics from trace and history artifacts. It cannot
yet tell whether recalled memory helped, emit project memory, promote repeated
failures into process hints, or crystallize dynamic run motifs into reusable
typed flows. Evidence: `src/history/memory-preview.ts:68-83`,
`src/schemas/memory-input.ts:56-66`, `src/schemas/trace-entry.ts:48-85`,
`src/schemas/history.ts:53-89`, `src/schemas/history.ts:176-221`, and
`.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json`.

The strongest reachable near-term ratchet is not automatic flow evolution. The
best capture change by value, cost, and risk is to make verification command
results first-class trace data. It gives future project plus flow execution
memory the command, status, duration, and output summaries needed to detect
recurring verification failure or slowness without mining every flow-specific
report.

## Prototype Selection

Chosen change:

- Add `verification.command_evaluated` to `trace.ndjson` for each runtime-owned
  verification command that returns a command observation.

Selection rationale:

| Candidate capture change | Compounding value | Cost and risk | Decision |
| --- | --- | --- | --- |
| Post-run memory use report | High: measures whether recall helped or misled | Medium: needs honest attribution and can overclaim usefulness | Defer until command and check evidence is richer. |
| Project memory producer | High: fills `kind: "project"` and run-envelope memory slots | Medium: promotion policy is easy to make noisy | Defer until the evidence being promoted is stronger. |
| Verification command trace event | High: supports recurring command failure, flake, and duration signals | Low: the verification executor already has command observations | Prototype now. |
| Touched-file or diff summary | High for risky-file memory | Medium to high: privacy, artifact size, and causality risk | Defer. |
| Dynamic motif candidate reports | Highest long-term value | High: depends on dynamic-flow infrastructure | Defer. |

Why this wins:

- Process-tuning memory needs command-level facts before it can front-load known
  verification failures or tune step emphasis.
- The current trace had no `command` or `argv` keys in the read-only corpus pass,
  while verification reports had only 6 command observations across 22 runs.
- The runtime already owns verification command execution in
  `src/runtime/executors/verification.ts:273-292`.
- The schema can add a strict trace event without changing stored runs or making
  memory authoritative. Evidence: `src/schemas/trace-entry.ts:87-102` and
  `src/schemas/trace-entry.ts:525-569`.

Before and after:

- Before: a future run could see a failed `check.evaluated` for
  `schema_sections`, but trace did not identify which verification command ran.
- After: trace records `command_id`, `cwd`, `argv`, `exit_code`, `status`,
  `duration_ms`, `stdout_summary`, and `stderr_summary` for each verification
  command that returns an observation. A future consolidation pass can group by
  command and flow, then produce a hint-only known-failure or known-slow-command
  memory when recurrence is proven.
Prototype test pass:

- Passing fixture:
  `/var/folders/hs/xnk080153dn7fq5qk9bk3g7w0000gn/T/circuit-ratchet-prototype-e2e-valid-21241901-aeb0-44da-b7ac-1202710c1e93/.circuit/runs/pass-d63f15c9-a980-4811-bd4a-40c4b03da86d/trace.ndjson`
  contains sequence 6 with `kind: "verification.command_evaluated"`,
  `command_id: "ratchet-pass"`, `exit_code: 0`, `status: "passed"`,
  `duration_ms: 27`, and `stdout_summary: "pass-signal"`.
- Failing fixture:
  `/var/folders/hs/xnk080153dn7fq5qk9bk3g7w0000gn/T/circuit-ratchet-prototype-e2e-valid-21241901-aeb0-44da-b7ac-1202710c1e93/.circuit/runs/fail-5b68b64f-ebfa-4107-aca6-0fbecf5eb6f7/trace.ndjson`
  contains failed command events for attempts 1 and 2 with
  `command_id: "ratchet-fail"`, `exit_code: 7`, `status: "failed"`, and
  `stderr_summary: "fail-signal"`.
- Blocked fixture:
  `/var/folders/hs/xnk080153dn7fq5qk9bk3g7w0000gn/T/circuit-ratchet-prototype-e2e-valid-21241901-aeb0-44da-b7ac-1202710c1e93/.circuit/runs/blocked-6e7b387d-b81f-41ca-b2b4-707193449302/trace.ndjson`
  contains the completed pre-block command event with
  `command_id: "ratchet-before-block"` and `status: "passed"`, but no
  `verification.command_evaluated` event for `ratchet-missing-script` because
  that command blocked before returning a command observation.

Learning:

- The event is a command observation event, not a configured-command ledger.
  A command that is blocked by preflight still appears in the abort reason, but
  it does not have argv, duration, stdout, or stderr in this event.
- The failing fixture gives the smallest concrete compounding signal: before
  this prototype, the run would only show that verification failed. After it,
  a consolidation pass can group `ratchet-fail` across attempts 1 and 2 with
  the same argv and stderr summary, then produce a hint-only known-failure
  warning if future runs repeat the pattern.
- This is the right boundary for the first slice. It supports recurring
  pass/fail/duration signals for commands that ran, while avoiding a broader
  command-plan capture design.

## Investigation Passes

### Pass 1: Mechanism Inventory

I ranked four ratcheting mechanisms, from weakest to strongest:

1. cited self-invalidating memory,
2. statistics over a comparable run corpus,
3. memory that tunes process execution,
4. pattern crystallization into reusable typed flows.

Each mechanism needs stronger data than the one before it. Text recall needs
source refs and staleness. Statistics need comparable dimensions. Process tuning
needs failure recurrence plus a controlled consume point. Crystallization needs a
closed alphabet of typed steps and contracts, plus successful motif evidence.

### Pass 2: Presence And Absence Proof

I checked the current memory, history, trace, run-envelope, process-evidence,
verification, and guidance-decision schemas and call sites. The main source files
were:

- `src/history/memory-preview.ts`
- `src/history/query.ts`
- `src/history/run-start-recall.ts`
- `src/history/indexer.ts`
- `src/history/extract.ts`
- `src/shared/relay-support.ts`
- `src/schemas/memory-input.ts`
- `src/schemas/run-envelope.ts`
- `src/schemas/history.ts`
- `src/schemas/trace-entry.ts`
- `src/schemas/verification.ts`
- `src/run-envelope/source-record.ts`
- `src/cli/circuit.ts`
- `src/runtime/executors/verification.ts`
- `src/runtime/executors/relay.ts`
- `src/shared/proof-plan.ts`

The key correction from this pass is important. The confirmed gap is mostly
right, but the timing statement needs precision. `trace.ndjson` does not capture
shell command text, uniform command results, or file-level diffs. It does
capture `duration_ms` for relay, sub-run, and fanout branch completion events.
Verification reports can capture command `argv`, `cwd`, `exit_code`, `status`,
and `duration_ms`, but that is not uniform trace data.

### Pass 3: Corpus Quantification

I ran a read-only local pass over `.circuit/runs` and `.circuit/history`. The
pass parsed JSON reports and `trace.ndjson` files. It wrote no files.

Current local corpus:

| Metric | Count |
| --- | ---: |
| Run folders under `.circuit/runs` | 22 |
| Runs with `trace.ndjson` | 22 |
| Parsed JSON report files | 257 |
| Parsed trace entries | 776 |
| Runs with `reports/run-envelope.json` | 1 |
| Runs with `reports/process-evidence.json` | 1 |
| Runs with `reports/history/recall.json` | 1 |
| History documents in `.circuit/history/documents.v1.jsonl` | 202 |

Observed outcomes in the local corpus:

| Outcome | Count | Share |
| --- | ---: | ---: |
| complete | 13 | 59.1% |
| aborted | 4 | 18.2% |
| unknown or missing closed result | 5 | 22.7% |

Observed outcomes by flow:

| Flow and outcome | Count |
| --- | ---: |
| `explore`, complete | 10 |
| `prototype`, unknown | 5 |
| `prototype`, aborted | 2 |
| `review`, complete | 2 |
| `build`, aborted | 1 |
| `goal`, aborted | 1 |
| `prototype`, complete | 1 |

Observed trace kinds:

| Trace kind | Count |
| --- | ---: |
| `step.entered` | 123 |
| `step.completed` | 114 |
| `step.report_written` | 85 |
| `check.evaluated` | 64 |
| `relay.request` | 51 |
| `relay.started` | 51 |
| `relay.completed` | 47 |
| `relay.receipt` | 47 |
| `relay.result` | 47 |
| `guidance.decision` | 29 |
| `fanout.branch_started` | 22 |
| `fanout.branch_completed` | 22 |
| `run.bootstrapped` | 22 |
| `run.closed` | 17 |
| `checkpoint.requested` | 8 |
| `fanout.started` | 7 |
| `fanout.joined` | 7 |
| `relay.failed` | 4 |
| `step.aborted` | 4 |
| `checkpoint.resolved` | 3 |
| `sub_run.started` | 1 |
| `sub_run.completed` | 1 |

Check outcomes:

| Check kind and outcome | Count |
| --- | ---: |
| `result_verdict`, pass | 46 |
| `schema_sections`, pass | 6 |
| `fanout_aggregate`, pass | 6 |
| `checkpoint_selection`, pass | 3 |
| `result_verdict`, fail | 2 |
| `fanout_aggregate`, fail | 1 |

Failing check examples:

- `goal`, `goal-run-build`, `result_verdict`, fail: child result body lacks
  `verdict`.
- `prototype`, `variant-fanout-step-gemini-35-flash-cursor`,
  `result_verdict`, fail: schema parse failed under `prototype_root`.
- `prototype`, `variant-fanout-step`, `fanout_aggregate`, fail: tournament
  collapsed.

Abort reasons:

| Abort reason | Count |
| --- | ---: |
| `prototype.variant-options@v1 requires circuits.prototype.variant_models in Circuit config` | 1 |
| relay step `act-step` connector failed with code 143 | 1 |
| sub-run `goal-run-build` child result body lacks `verdict` | 1 |
| tournament collapsed: fanout step `variant-fanout-step` had 1 survivor | 1 |

No normalized abort reason repeated in this 22-run corpus. One execution-policy
reason did recur:

| Recurring reason | Count |
| --- | ---: |
| Writable relay fanout branches are serialized because relay branches share the parent checkout and no branch-local relay write root is provisioned. | 5 |

Retry and gate observations:

- No step had `attempt > 1` in this corpus.
- One run envelope exists. Its completion gate had `gate_passes` count 2,
  `clean_streak` 2, and `required_passes` 2.

Memory observations:

- One recall report exists. It has status `used`.
- That recall report contains 3 `MemoryInputV0` records.
- All 3 are `kind: "prior_run"`.
- The one run envelope records `memory_context.used: true`.
- The one run envelope records `memory_update_events: []`.
- The one run envelope has no `surface_output.memory_indicator`.

History index observations:

- `.circuit/history/manifest.v1.json` reports 22 runs and 202 documents.
- `.circuit/history/documents.v1.jsonl` has 202 lines.
- Document kinds: 151 report, 22 run, 15 trace, 14 checkpoint.
- `memory_safe` is true for 194 documents and false for 8.
- Common facets include `kind:report` 151, `flow:prototype` 93,
  `flow:explore` 79, `failure` 38, `verification` 23, and `checkpoint` 14.

These counts are descriptive only. The corpus is enough to say what this local
history contains. It is not enough to claim product-wide rates or stable
probabilities.

## Taxonomy Of Ratcheting Mechanisms

### 1. Cited Self-Invalidating Memory

This is the weakest real ratchet.

It stores a small memory hint with:

- a source ref,
- source hash or freshness evidence,
- an applies-to category,
- hint-only authority,
- a way to invalidate or downrank the hint when current evidence contradicts it.

How it compounds:

- It reduces repeated rediscovery.
- It makes bad prior facts decay instead of lingering forever.
- It lets the next run begin with a cited caution, not an unaudited note.

How it merely accumulates:

- If the system only appends notes and replays them, it is accumulation.
- If recall is lexical and has no helped or misled feedback, it can get longer
  without getting better.

Today:

- Circuit has prior-run hint records with source refs, staleness, and hint-only
  authority. Evidence: `src/history/memory-preview.ts:68-83` and
  `src/schemas/memory-input.ts:56-66`.
- Circuit does not emit project memory records today. Evidence:
  `src/schemas/memory-input.ts:8-15`,
  `src/history/memory-preview.ts:68-83`, and the observed recall report at
  `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/history/recall.json`.
- Circuit does not record whether a recalled hint helped, misled, or was
  ignored. Evidence: `src/schemas/history.ts:176-221` and
  `src/schemas/run-envelope.ts:471-493`.
- Circuit does not currently write memory update events in the observed corpus.
  Evidence: `src/schemas/run-envelope.ts:357-390` and the observed run envelope
  at `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json`.

Best near-term use:

- Keep the authority hint-only.
- Add a memory merge report that explains which recalled inputs were used,
  rejected, contradicted, or left unresolved.
- Promote only repeated, cited, execution-facing findings into project or flow
  memory.

### 2. Statistics Over A Comparable Run Corpus

This is stronger than recall because it can see recurrence. It does not require
the model to remember a story. It can count outcomes, failed checks, abort
reasons, policy constraints, and gate rounds across comparable runs.

How it compounds:

- It turns repeated local evidence into front-loaded guidance.
- It can show that a failure is recurrent, not incidental.
- It can identify which flow, step, or check deserves attention.

How it merely accumulates:

- A dashboard that never changes the next run is accumulation.
- A count with no comparable dimensions is accumulation.
- A count that cannot be traced back to source artifacts is weak memory, not a
  ratchet.

Today:

- Circuit captures enough trace structure for descriptive statistics by flow,
  step, check kind, outcome, abort reason, fanout policy, and relay or fanout
  duration. Evidence: `src/schemas/trace-entry.ts:37-85`,
  `src/schemas/trace-entry.ts:283-292`, `src/schemas/trace-entry.ts:382-388`,
  and `src/schemas/trace-entry.ts:434-491`.
- Before this prototype, Circuit captured some verification command observations
  in reports, but not uniformly in trace. Evidence:
  `src/schemas/verification.ts:60-94`, `src/shared/proof-plan.ts:171-209`, and
  `src/schemas/trace-entry.ts:64-85`.
- After this prototype, Circuit captures runtime-owned verification command
  argv in `trace.ndjson`. Evidence: `src/schemas/trace-entry.ts:87-102` and
  `src/runtime/executors/verification.ts:273-292`.
- Circuit does not capture uniform file-level diffs in `trace.ndjson`.
  Evidence: `src/schemas/trace-entry.ts:525-552`.

Best near-term use:

- Use current trace and history data for report-only corpus statistics.
- Avoid claiming command slowness, flaky tests, or risky application files unless
  those facts appear in concrete reports.
- Add command-result and touched-file summaries only if those facts are needed
  for execution memory.

### 3. Memory That Tunes Process Execution

This is the first mechanism that feels like a skilled practitioner. It changes
how the next run works, within explicit bounds.

Examples:

- front-load a known failure mode,
- spend more attention on a brittle step,
- change a retry budget,
- ask for a checkpoint earlier,
- choose a stronger verification path for a flow that has failed before.

How it compounds:

- It changes future execution before the old failure repeats.
- It spends effort where the local project has shown risk.
- It records whether the changed process helped.

How it merely accumulates:

- If the hint is only appended to a long memory file, it does not tune anything.
- If the process changes but the change is not recorded and evaluated, the system
  cannot learn whether the change helped.
- If memory silently changes routing or proof authority, it violates the current
  posture.

Today:

- Circuit captures abort reasons, failed checks, guidance decisions, fanout
  serialization policy, and relay or fanout durations. Evidence:
  `src/schemas/trace-entry.ts:64-85`, `src/schemas/trace-entry.ts:283-292`,
  `src/schemas/trace-entry.ts:382-388`, `src/schemas/trace-entry.ts:434-491`,
  and `src/schemas/guidance-decision.ts:220-240`.
- Circuit does not have enough current corpus evidence to tune retry budgets:
  no step in the corpus had `attempt > 1`. Evidence: the local read-only pass
  over `.circuit/runs/*/trace.ndjson` and the trace attempt field at
  `src/schemas/trace-entry.ts:48-85`.
- Circuit does not capture helped or misled feedback for memory. Evidence:
  `src/schemas/history.ts:176-221` and `src/schemas/run-envelope.ts:471-493`.
- Circuit has schema slots for memory update events and indicators, but the
  observed artifact has no memory update events. Evidence:
  `src/schemas/run-envelope.ts:357-400` and
  `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json`.

Best near-term use:

- Start with prompt emphasis and known-failure warnings, not automatic routing.
- Use flow and project memory first.
- Record every proposed or recorded memory update in the run envelope.
- Keep retry-budget changes as proposed configuration until there is explicit
  policy and enough evidence.

### 4. Pattern Crystallization Into Reusable Typed Flows

This is the strongest mechanism.

The core insight from `docs/ideas/dynamic-flow-ratchet.md` is that a closed
alphabet of typed steps and contracts makes runs comparable. Without that,
dynamic runs become incomparable transcripts. With it, successful motifs can be
counted, compared, tested, and promoted.

How it compounds:

- A repeated successful process becomes a reusable flow.
- The promoted flow has typed steps, report contracts, checks, and a catalog
  entry.
- Future runs no longer rediscover the process. They execute it.

How it merely accumulates:

- A narrative note saying "this process worked" is not crystallization.
- A copied prompt is not crystallization.
- A dynamic transcript with no typed step vocabulary is not comparable enough to
  promote safely.

Today:

- Existing static flows already emit typed step traces and reports. Evidence:
  `src/schemas/trace-entry.ts:48-61` and `src/history/extract.ts:315-357`.
- The current corpus can compare existing flows and steps. Evidence: the local
  read-only pass over `.circuit/runs/*/trace.ndjson` found 123 `step.entered`
  entries and 114 `step.completed` entries.
- Circuit does not capture dynamic planner alternatives, typed motif candidates,
  operator-approved crystallization proposals, or replayable dynamic iteration
  plans. Evidence: `docs/ideas/dynamic-flow-ratchet.md:100-121` and
  `src/schemas/trace-entry.ts:525-552`.
- Near-term constraints say not to make self-evolving flows or route changes.

Best near-term use:

- Treat crystallization as a later design target.
- In the near term, collect the data needed to recognize motifs once dynamic
  planning exists.
- Require operator review before a motif becomes a typed flow.

## Data Need Versus Availability Matrix

| Data need | Mechanism | Availability today | Evidence | Consequence |
| --- | --- | --- | --- | --- |
| Prior-run memory inputs with source refs and hint-only authority | Self-invalidating memory | captured-today | `src/history/memory-preview.ts:68-83`, `src/schemas/memory-input.ts:56-66`, `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/history/recall.json` | Current recall can cite prior runs. |
| Source staleness for history hits | Self-invalidating memory | captured-today | `src/history/query.ts:204-240`, `src/schemas/history.ts:92-115` | A recalled source can be fresh, stale, or unknown. |
| Project memory records | Self-invalidating memory | not-captured | `src/schemas/memory-input.ts:8-15` defines `kind: "project"`; `src/history/memory-preview.ts:68-83` emits `kind: "prior_run"`; observed recall report contains only `prior_run` records | Project memory schema exists, but the current producer is prior-run recall. |
| Memory helped, misled, or ignored feedback | Self-invalidating memory | not-captured | `src/schemas/history.ts:176-221` has recall status and matches, but no helped or misled fields; run envelope schema has no helped or misled field at `src/schemas/run-envelope.ts:471-493` | Circuit cannot learn recall usefulness today. |
| Memory update events with source refs | Self-invalidating memory | partial | Schema exists at `src/schemas/run-envelope.ts:357-390`; writer exists at `src/run-envelope/source-record.ts:496-517`; observed run envelope has `memory_update_events: []` | The envelope can represent updates, but current runs do not produce them. |
| Human-facing memory indicator | Self-invalidating memory | partial | Optional field at `src/schemas/run-envelope.ts:392-400`; writer derives it at `src/run-envelope/source-record.ts:637-639`; observed run envelope has no indicator | Indicator path exists, but no event means no indicator. |
| Flow, step, attempt, check kind, and check outcome | Corpus statistics | captured-today | `src/schemas/trace-entry.ts:48-85`; local corpus has 64 `check.evaluated` entries | Circuit can count check reliability by step and attempt. |
| Abort reason | Corpus statistics and process tuning | captured-today | `src/schemas/trace-entry.ts:382-388`; local corpus has 4 `step.aborted` entries | Circuit can count abort reasons, but this corpus has no repeated normalized abort reason. |
| Fanout serialization reason | Corpus statistics and process tuning | captured-today | `src/schemas/trace-entry.ts:434-464`; local corpus has the writable relay serialization reason 5 times | Circuit can front-load a real known constraint. |
| Relay, sub-run, and fanout durations | Corpus statistics | captured-today | `src/schemas/trace-entry.ts:283-292`, `src/schemas/trace-entry.ts:413-427`, `src/schemas/trace-entry.ts:480-491`; local corpus has 47 relay, 22 fanout branch, and 1 sub-run duration | Circuit can describe coarse runtime costs. |
| Verification command argv and results in trace | Process tuning | captured-today | `src/schemas/trace-entry.ts:87-102`, `src/runtime/executors/verification.ts:273-292` | New runs can group command pass/fail and duration directly from trace when a command returns an observation. |
| Configured verification commands that block before observation | Process tuning | partial | `src/shared/proof-plan.ts:171-178` can block before returning an observation; `src/runtime/executors/verification.ts:273-292` appends only after an observation exists; `/var/folders/hs/xnk080153dn7fq5qk9bk3g7w0000gn/T/circuit-ratchet-prototype-e2e-valid-21241901-aeb0-44da-b7ac-1202710c1e93/.circuit/runs/blocked-6e7b387d-b81f-41ca-b2b4-707193449302/trace.ndjson` has no command event for `ratchet-missing-script` | Abort reasons can name the blocked command, but trace does not yet carry argv, duration, stdout, or stderr for preflight-blocked commands. |
| Verification command argv, status, exit, and duration in reports | Process tuning | partial | `src/schemas/verification.ts:60-94`; `src/shared/proof-plan.ts:171-209`; local corpus has 6 report files with command observations | Some command facts exist in reports, but not enough for broad command-memory claims. |
| Acceptance-criteria command result in trace | Process tuning | partial | `src/runtime/executors/relay.ts:745-760` emits criterion id, exit code, status, and summaries, but not argv | Trace can show an acceptance criterion failed, but not the command text. |
| File-level diffs in trace | Process tuning and crystallization | not-captured | Trace union at `src/schemas/trace-entry.ts:525-552` has no diff event; history extraction prunes `diff` and `patch` fields at `src/history/extract.ts:31-44` | Circuit cannot derive uniform changed-file or diff memory from trace/history. |
| Review intake diffs | Process tuning | partial | `src/flows/review/reports.ts:65-68`, `src/flows/review/writers/intake.ts:196-210` | Review runs can capture diffs, but that is flow-specific and pruned from history text. |
| Comparable typed step vocabulary for existing flows | Crystallization | captured-today | Trace step fields at `src/schemas/trace-entry.ts:48-61`; history facets at `src/history/extract.ts:315-357` | Existing flows can be compared by flow, step, and report schema. |
| Dynamic planner alternatives and motif candidates | Crystallization | not-captured | `docs/ideas/dynamic-flow-ratchet.md:100-121` describes future stages; current trace union at `src/schemas/trace-entry.ts:525-552` has no planner or crystallization event | Strong crystallization needs new dynamic-flow instrumentation. |
| Operator approval for crystallized flow promotion | Crystallization | not-captured | Existing memory authority is hint-only at `src/schemas/memory-input.ts:56-66`; dynamic-flow ratchet is design-only in `docs/ideas/dynamic-flow-ratchet.md:100-121` | Flow promotion must be an explicit reviewed action, not hidden memory. |

## Claim Inventory

Labels:

- confirmed: direct source or artifact proves the claim.
- supported: direct evidence supports the claim, with a stated limitation.
- blocked: the current tree or corpus cannot answer it.
- uncertain: evidence is mixed or incomplete.

| Claim | Label | Evidence |
| --- | --- | --- |
| Circuit captures prior-run recall as `MemoryInputV0` records at run start on the normal fresh-run path. | confirmed | `src/history/run-start-recall.ts:48-99`, `src/cli/circuit.ts:956-986`, `tests/runner/history-run-start-recall.test.ts:147-206` |
| Circuit's automatic memory producer emits `kind: "prior_run"`. | confirmed | `src/history/memory-preview.ts:68-83`; observed at `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/history/recall.json` |
| Circuit defines `kind: "project"` in the memory schema. | confirmed | `src/schemas/memory-input.ts:8-15` |
| Circuit does not currently emit project memory in the observed run corpus. | supported | `src/history/memory-preview.ts:68-83` emits `prior_run`; observed recall report has only `prior_run` records |
| Circuit marks memory authority as hint-only. | confirmed | `src/schemas/memory-input.ts:56-66`, `src/schemas/history.ts:5-6`, `src/shared/relay-support.ts:147-165` |
| Circuit prevents memory from becoming route, checkpoint, proof, safe-apply, policy, or write authority. | confirmed | `src/schemas/history.ts:5-6`, `tests/contracts/memory-input-schema.test.ts:67-83`, `tests/contracts/guidance-decision-schema.test.ts:459-589` |
| Circuit's current recall query is deterministic lexical scoring over history docs. | confirmed | `src/history/query.ts:94-186` |
| Run-start recall does not pass a flow filter today. | confirmed | `src/history/run-start-recall.ts:48-59`, `src/history/query.ts:289-293` |
| Circuit writes a recall report when run-start recall is prepared. | confirmed | `src/runtime/run/graph-runner.ts:692`; observed at `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/history/recall.json` |
| Circuit records memory context in the run envelope. | confirmed | `src/schemas/run-envelope.ts:478-484`, `src/cli/circuit.ts:715-725`; observed `memory_context.used: true` in `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json` |
| Circuit has a run-envelope schema for memory update events. | confirmed | `src/schemas/run-envelope.ts:357-390` |
| Circuit's observed corpus has no memory update events. | confirmed | `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json` has `memory_update_events: []`; the corpus pass found no other run envelopes |
| Circuit has a human-facing memory indicator field. | confirmed | `src/schemas/run-envelope.ts:392-400`, `src/run-envelope/source-record.ts:637-639` |
| Circuit's observed run envelope has no memory indicator. | confirmed | `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json` has no `surface_output.memory_indicator` value |
| Circuit captures flow id, goal, and run close outcome in trace. | confirmed | `src/schemas/trace-entry.ts:37-45`, `src/schemas/trace-entry.ts:513-517` |
| Circuit captures check kind, attempt, outcome, and optional failure reason in trace. | confirmed | `src/schemas/trace-entry.ts:64-85`; local corpus has 64 `check.evaluated` entries |
| Circuit captures abort reasons in trace. | confirmed | `src/schemas/trace-entry.ts:382-388`; local corpus has 4 `step.aborted` entries |
| Circuit captures fanout execution policy and serialization reason. | confirmed | `src/schemas/trace-entry.ts:434-464`; local corpus has the writable relay serialization reason 5 times |
| Circuit captures relay, fanout branch, and sub-run durations in trace. | confirmed | `src/schemas/trace-entry.ts:283-292`, `src/schemas/trace-entry.ts:413-427`, `src/schemas/trace-entry.ts:480-491` |
| Circuit captures verification command argv and results in `trace.ndjson` after this prototype when a command returns an observation. | confirmed | `src/schemas/trace-entry.ts:87-102`, `src/runtime/executors/verification.ts:273-292`, `tests/runner/build-verification-exec.test.ts:243-264`, `tests/runner/build-verification-exec.test.ts:331-341` |
| Circuit keeps completed command trace evidence when a later verification command blocks. | confirmed | `src/runtime/executors/verification.ts:273-292`, `tests/runner/build-verification-exec.test.ts:377-426`, `/var/folders/hs/xnk080153dn7fq5qk9bk3g7w0000gn/T/circuit-ratchet-prototype-e2e-valid-21241901-aeb0-44da-b7ac-1202710c1e93/.circuit/runs/blocked-6e7b387d-b81f-41ca-b2b4-707193449302/trace.ndjson` |
| The pre-prototype local historical corpus has no verification command trace entries. | confirmed | Read-only pass found `traceCommandEvents: 0` across `.circuit/runs/*/trace.ndjson` |
| Circuit can capture verification command observations in some reports. | confirmed | `src/schemas/verification.ts:60-94`, `src/shared/proof-plan.ts:171-209`; local corpus has 6 report files with command observations |
| Circuit still does not capture command argv for acceptance-criteria checks in trace. | confirmed | `src/runtime/executors/relay.ts:745-760` records criterion id, exit code, status, and summaries, but not argv |
| Circuit does not capture uniform file-level diffs in trace. | confirmed | Trace union at `src/schemas/trace-entry.ts:525-552` has no diff event |
| Circuit history extraction prunes noisy diff and stdout fields. | confirmed | `src/history/extract.ts:31-44`, `src/history/extract.ts:247-305` |
| Review flow intake can capture staged and unstaged diffs. | confirmed | `src/flows/review/reports.ts:65-68`, `src/flows/review/writers/intake.ts:196-210` |
| Process evidence `missing_evidence` is derived from outcome, not from a detailed proof audit. | confirmed | `src/process-evidence/projection.ts:101-117`, `src/process-evidence/projection.ts:119-167` |
| Current history docs are faceted by flow, kind, outcome, schema, and step. | confirmed | `src/history/extract.ts:315-357`, `src/schemas/history.ts:53-89` |
| History indexing does not index successful checks as trace documents. | confirmed | `src/history/extract.ts:655-679` |
| Current corpus supports descriptive outcome and check counts, but not product-wide rates. | supported | Local pass over 22 runs and 776 trace entries |
| Current corpus does not support retry-budget tuning. | supported | Local pass found no step with `attempt > 1` |
| Current corpus supports a known fanout serialization warning. | confirmed | Local pass found the same `fanout.started.execution_policy.reason` in 5 trace entries |
| Current corpus does not support claims that a specific shell command is slow or flaky. | supported | The historical local trace corpus has no verification command argv; local command observations are only 6 report files and all passed |
| Current static flows are comparable by typed flow and step traces. | confirmed | `src/schemas/trace-entry.ts:48-61`, `src/history/extract.ts:315-357` |
| Circuit does not currently capture dynamic planner motif candidates for flow crystallization. | supported | `docs/ideas/dynamic-flow-ratchet.md:100-121` defines this as future design; current trace union at `src/schemas/trace-entry.ts:525-552` has no planner or crystallization event |

## Capture Specifications For Worthwhile Gaps

### A. Memory Use And Self-Invalidation Report

Problem:

Circuit can recall prior-run hints, but it cannot say which ones were useful,
ignored, contradicted, or misleading. Evidence:
`src/history/memory-preview.ts:68-83`, `src/schemas/history.ts:176-221`, and
`src/schemas/run-envelope.ts:471-493`.

Instrumentation point:

- `src/history/run-start-recall.ts` prepares the recall set.
- `src/shared/relay-support.ts` injects memory into relay prompts.
- The close path that already writes result, process evidence, and run envelope
  can write the post-run memory evaluation.

New artifact:

- `reports/history/memory-merge.json`

Suggested schema:

- `schema: "history.memory-merge@v1"`
- `run_id`
- `memory_inputs_considered`
- `memory_inputs_used`
- `memory_inputs_rejected`
- `rejection_reasons`
- `contradicted_input_ids`
- `current_run_outcome`
- `verification_outcome`
- `memory_helped`
- `memory_misled`
- `follow_up_evidence_needed`
- `source_refs`

Authority:

- hint-only,
- explicit evidence-only,
- no routing, proof, write, checkpoint, or policy authority.

Feasibility:

- Low to medium cost.
- The source and recall ids already exist.
- The hardest part is honest helped or misled labeling. It should start as
  explicit agent reporting with citations, not hidden model judgment.

Risks:

- A model can overclaim that memory helped.
- A bad label can reinforce a wrong hint.
- Mitigation: require source refs, current-run evidence, and a separate
  contradicted or unresolved state.

### B. Project And Flow Memory Producer

Problem:

The schema can represent project memory, but the observed producer emits only
prior-run recall.

Instrumentation point:

- After process evidence and run envelope close.
- The caller should pass explicit source refs into the run-envelope source
  record path rather than relying only on the process-evidence ref.

Required source changes:

- Add a consolidation step that reads the closed run artifacts and proposes at
  most a few project or flow memory records.
- Extend `MemoryUpdateInput` in `src/run-envelope/source-record.ts` so callers
  can pass source refs for the exact evidence, not just the process-evidence
  report.
- Populate `RunMemoryUpdateEvent` when a memory is proposed, recorded, skipped,
  or rejected.
- Populate `surface_output.memory_indicator` when proposed or recorded memory
  affects future behavior.

New event or schema field:

- Existing `RunMemoryUpdateEvent` is mostly enough.
- Add explicit `memory_input_id` or `memory_record_ref` so the update event can
  point to the exact memory record.
- Consider adding `supersedes_memory_input_ids` and `contradicts_memory_input_ids`
  for self-invalidation.

Feasibility:

- Medium cost.
- The envelope slots already exist.
- The missing work is the producer and evidence selection.

Risks:

- Memory spam.
- Unstable facts promoted too early.
- Mitigation: begin with `action: "proposed"`, require recurrence or explicit
  operator acceptance for `recorded`, and keep all authority hint-only.

### C. Command Result Trace Or Report Reference

Problem:

The ratchet cannot safely learn "this command is slow", "this command flakes",
or "this check fails after this step" from trace alone. This is the prototype
selected for this slice.

Instrumentation point:

- Implemented in `src/runtime/executors/verification.ts:273-292` after each
  runtime-owned verification command returns an observation.
- Acceptance criteria command argv capture is still deferred.
- `src/shared/proof-plan.ts` already produces command result observations.

New trace event:

- `verification.command_evaluated`

Implemented fields:

- `step_id`
- `attempt`
- `command_id`
- `cwd`
- `argv`
- `status`
- `exit_code`
- `duration_ms`
- `stdout_summary`
- `stderr_summary`

Feasibility:

- Low cost for runtime-owned verification commands.
- Command observations already exist for proof-plan verification reports.
- The remaining work is normalizing acceptance criteria command identity if that
  proves worth the extra privacy and trace-size risk.

Risks:

- Leaking secrets through argv or output.
- Bloated trace files.
- Mitigation in this prototype: reuse verification commands that are already
  captured in reports, keep summaries bounded by the existing command runner,
  and do not extend this to acceptance criteria until there is a stronger need.

### D. Touched-File And Diff Summary

Problem:

The ratchet cannot safely learn "this source file is risky" or "this file
pattern recurs in failed runs" from trace/history alone.

Instrumentation point:

- Review intake already collects diffs.
- Build, fix, and safe-apply paths should emit a shared touched-file summary
  when they create, inspect, or apply changes.

New artifact:

- `reports/workspace/change-summary.json`

Suggested schema:

- `schema: "workspace.change-summary@v1"`
- `run_id`
- `flow_id`
- `step_id`
- `changed_files`
- `read_files`
- `generated_files`
- `diff_refs`
- `diff_hashes`
- `language_or_package_facets`
- `redaction_policy`

Feasibility:

- Medium to high cost.
- Review intake proves flow-specific diff capture is possible.
- Making it uniform across flows requires a shared runtime contract.

Risks:

- Privacy and secret leakage.
- Large artifacts.
- Misleading risk labels if the system equates "changed in failed run" with
  "caused the failure".
- Mitigation: store path summaries and diff hashes by default, keep raw diffs in
  separate redacted refs, and label correlation separately from cause.

### E. Comparable Dynamic-Plan And Crystallization Data

Problem:

The strongest ratchet requires dynamic runs to be comparable. A transcript is not
enough.

Instrumentation point:

- Future dynamic planner.
- Future loop executor.
- Future operator-reviewed flow proposal path.

New artifacts:

- `reports/planner/plan.json`
- `reports/planner/iteration.json`
- `reports/crystallization/candidate.json`

Suggested `planner.plan@v1` fields:

- `task_shape`
- `selected_step_kinds`
- `step_contracts`
- `report_schemas`
- `dependency_edges`
- `planned_checks`
- `alternatives_considered`
- `rejection_reasons`
- `source_refs`

Suggested `crystallization.candidate@v1` fields:

- `motif_id`
- `supporting_run_ids`
- `flow_ids`
- `step_sequence`
- `success_rate_in_supporting_corpus`
- `known_failure_modes`
- `operator_acceptance`
- `proposed_flow_package_ref`
- `required_tests`
- `source_refs`

Feasibility:

- High cost.
- This depends on dynamic-flow infrastructure that is not present today.

Risks:

- Hidden self-evolving flows.
- Overfitting to a tiny corpus.
- Broken generated flow contracts.
- Mitigation: proposal-only first, operator approval required, generated tests
  required, and no routing changes until proven.

## Roadmap

### Phase 0: Use Today's Data Honestly

Reachable now:

- descriptive corpus statistics by flow, step, check kind, outcome, abort
  reason, fanout policy, and coarse duration,
- prior-run hint recall with source refs and staleness,
- front-loaded warnings based on repeated trace facts, such as the writable
  relay fanout serialization reason.

Do not claim yet:

- command flakiness,
- command slowness,
- risky application source files,
- memory helpfulness,
- project memory emission,
- automatic retry-budget tuning,
- dynamic flow crystallization.

### Phase 1: Add Report-Only Memory Evaluation

Build:

- `reports/history/memory-merge.json`,
- helped, misled, ignored, contradicted, and unresolved states,
- source refs for every judgment,
- no runtime behavior change.

Why first:

- It turns lexical recall into measurable memory.
- It preserves hint-only posture.
- It gives future memory records a quality signal.

### Phase 2: Add Project And Flow Memory Proposals

Build:

- project and flow `MemoryInputV0` records,
- `RunMemoryUpdateEvent` source refs to exact evidence,
- `surface_output.memory_indicator`,
- proposed first, recorded only after explicit policy.

Candidate first memories:

- recurring fanout serialization warning,
- repeated missing-verdict failure if it recurs in future runs,
- flow-specific verification habits when reports show command evidence.

### Phase 3: Extend Command And Touched-File Evidence

Build:

- command-result capture beyond runtime-owned verification commands when needed,
- command-observation report refs for memory consolidation,
- touched-file and diff-summary reports,
- strict redaction and source refs.

Why later:

- The selected prototype starts the command-result path for verification.
- This phase extends that path to acceptance criteria or shared change evidence
  only when the memory loop proves it needs those facts.
- It carries higher privacy and overclaiming risk.

### Phase 4: Process Tuning Under Explicit Policy

Build:

- bounded prompt emphasis,
- proposed retry-budget changes,
- known-failure front-loading,
- evaluation of whether the changed process helped.

Guardrails:

- no hidden route changes,
- no proof authority from memory,
- no silent configuration mutation,
- no operator-level memory in the first version.

### Phase 5: Dynamic-Flow Crystallization

Build later:

- typed dynamic planner traces,
- comparable iteration records,
- motif candidate reports,
- operator-reviewed flow proposals,
- tests and generated flow package proof.

This is the strongest ratchet. It is also the least reachable on today's data.

## Final Recommendation

Circuit should not try to jump from lexical memory to self-evolving flows. The
data is not there, and the product posture argues against it.

The best next move is a measured execution-memory ratchet:

1. keep all memory hint-only,
2. add a post-run memory evaluation report,
3. propose project and flow memory only from cited recurring evidence,
4. use today's trace corpus for conservative front-loaded warnings,
5. add command and touched-file capture only when the report-only loop proves it
   needs those facts,
6. reserve typed flow crystallization for the dynamic-flow track, where the
   closed alphabet of steps and contracts can make motif promotion safe.

On today's data, Circuit can build a useful but modest ratchet: cited recall,
descriptive statistics, and known-failure hints. To reach real process tuning,
it needs memory usefulness feedback plus normalized command and touched-file
evidence. To reach crystallization, it needs new dynamic-plan and motif-candidate
artifacts. Evidence: `src/history/memory-preview.ts:68-83`,
`src/schemas/trace-entry.ts:37-85`, `src/schemas/history.ts:176-221`,
`src/schemas/verification.ts:60-94`, and
`docs/ideas/dynamic-flow-ratchet.md:100-121`.
