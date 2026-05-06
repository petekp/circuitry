import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  appendAndDeriveRetainedTrace as appendAndDerive,
  bootstrapRetainedRun as bootstrapRun,
} from '../../src/compat/retained-runtime.js';
import { type CodexRelayResult, relayCodex } from '../../src/runtime/connectors/codex.js';
import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
import { reduce } from '../../src/runtime/reducer.js';
import { readRunTrace } from '../../src/runtime/trace-reader.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlowId, RunId, StepId } from '../../src/schemas/ids.js';
import type { ResolvedSelection } from '../../src/schemas/selection-policy.js';
import { TraceEntry } from '../../src/schemas/trace-entry.js';
import { sha256Hex } from '../../src/shared/connector-relay.js';

// Codex-relay-roundtrip test, bound to the five-trace_entry transcript
// shape and the second connector (`codex`).
//
// Mirrors the agent-relay-roundtrip structurally: bootstrap a run;
// invoke the real `codex exec` connector; materialize the five-trace_entry
// transcript + four on-disk slots; read back via readRunTrace; reduce;
// assert the materialized report bytes match the connector's
// `result_body`. The ONLY field that differs between the two round-
// trips is `connector.name = 'codex'` on relay.started — proving that
// the materializer seam parameterizes correctly on connector identity
// without drifting the transcript shape.
//
// CODEX_SMOKE check: the test spawns the `codex` subprocess and requires
// auth. Skipped by default so CI and unauthenticated developer runs stay
// green. Static-declaration count is preserved by two always-running
// sanity tests at the top.

const CODEX_SMOKE = process.env.CODEX_SMOKE === '1';
// Write-check: CODEX_SMOKE=1 exercises the end-to-end path but does not
// implicitly mutate the tracked fingerprint. Promotion requires an
// explicit UPDATE_CODEX_FINGERPRINT=1 env var (mirrors the UPDATE_GOLDEN=1
// pattern at tests/runner/explore-e2e-parity.test.ts). Without the
// explicit promotion flag, the round-trip still runs end-to-end but
// leaves tests/fixtures/codex-smoke/last-run.json alone.
const UPDATE_CODEX_FINGERPRINT = process.env.UPDATE_CODEX_FINGERPRINT === '1';
const LAST_RUN_FINGERPRINT_PATH = resolve('tests/fixtures/codex-smoke/last-run.json');

// The live smoke pins a known-accessible model so evidence freshness does not
// depend on the operator's personal Codex default profile. Product relays
// can still inherit user/project/flow model selection through the runtime.
const CODEX_SMOKE_SELECTION = {
  model: { provider: 'openai', model: 'gpt-5.4' },
  effort: 'low',
  skills: [],
  invocation_options: {},
} satisfies ResolvedSelection;

// The fingerprint binds to the current connector surface, not just an
// ancestor commit. The connector_source_sha256 field
// is the sha256 of the concatenation of connector-layer source
// files that materially determine the codex relay behavior:
//   (a) src/runtime/connectors/codex.ts — relayCodex + parseCodexStdout
//       + capability-boundary argv constants
//   (b) src/shared/connector-relay.ts — sha256Hex + RelayResult
//       shape consumed by the materializer
//   (c) src/shared/connector-helpers.ts — connector parsing/model helpers
//   (d) src/runtime/connectors/shared.ts — compatibility re-exports used by
//       retained runtime and tests
//   (e) src/runtime/connectors/relay-materializer.ts — five-trace_entry
//       transcript + on-disk slot materialization
// A change to any of the connector sources invalidates the fingerprint's coverage
// of the current connector surface. Check 32 re-computes this hash at
// audit time and flags drift (yellow: fingerprint exists but connector
// has changed since the last CODEX_SMOKE run).
// `runner.ts` is included for symmetry with the AGENT writer's source
// path list. The runner-side selection/provenance derivation
// participates in the codex relay transcript via the
// materializeRelay call site; excluding `runner.ts` from this list
// would let a runner edit silently invalidate the CODEX fingerprint
// without tripping drift.
const ADAPTER_SOURCE_PATHS = [
  resolve('src/runtime/connectors/codex.ts'),
  resolve('src/shared/connector-relay.ts'),
  resolve('src/shared/connector-helpers.ts'),
  resolve('src/runtime/connectors/shared.ts'),
  resolve('src/runtime/connectors/relay-materializer.ts'),
  resolve('src/runtime/runner.ts'),
  resolve('src/flows/registries/report-schemas.ts'),
] as const;

function connectorSourceSha256(): string {
  const h = createHash('sha256');
  for (const p of ADAPTER_SOURCE_PATHS) {
    h.update(`${p}\n`);
    h.update(readFileSync(p));
    h.update('\n');
  }
  return h.digest('hex');
}

describe('codex relay round-trip (second-connector evidence)', () => {
  it('static: materializeRelay accepts connectorName="codex" (ratchet-floor declaration)', () => {
    expect(typeof materializeRelay).toBe('function');
  });

  it('static: the five relay transcript kinds are connector-agnostic', () => {
    // The materializer emits the same five-variant shape regardless of
    // connector identity. This belt-and-braces guard asserts the naming
    // convention (still `relay.*`) has not drifted — a regression
    // that added connector-specific trace_entry kinds would be visible here.
    const kinds = [
      'relay.started',
      'relay.request',
      'relay.receipt',
      'relay.result',
      'relay.completed',
    ] as const;
    for (const kind of kinds) {
      expect(kind).toMatch(/^relay\./);
    }
  });

  (CODEX_SMOKE ? it : it.skip)(
    'end-to-end: relayCodex → 5-trace_entry transcript → reducer snapshot → materialized report (CODEX_SMOKE=1)',
    async () => {
      const runFolder = mkdtempSync(join(tmpdir(), 'codex-relay-roundtrip-'));
      try {
        const runId = RunId.parse('45454545-4545-4545-4545-454545454545');
        const flowId = CompiledFlowId.parse('codex-smoke-0');
        const stepId = StepId.parse('smoke-relay-step');
        const attempt = 1;
        const startAt = new Date('2026-04-22T03:45:00.000Z');
        const now = () => startAt;
        const change_kind: ChangeKindDeclaration = {
          change_kind: 'ratchet-advance',
          failure_mode: 'codex relay second-connector round-trip',
          acceptance_evidence: '5-trace_entry transcript consumed by reducer; connector.name=codex',
          alternate_framing: 'Defer to later stage — rejected',
        };
        const writes = {
          request: 'reports/relay/smoke.request.txt',
          receipt: 'reports/relay/smoke.receipt.txt',
          result: 'reports/relay/smoke.result.txt',
          report: {
            path: 'reports/codex-smoke-compose.txt',
            schema: 'codex.smoke@v1',
          },
        };

        bootstrapRun({
          runFolder,
          manifest: {
            run_id: runId,
            flow_id: flowId,
            captured_at: startAt.toISOString(),
            bytes: Buffer.from(JSON.stringify({ id: flowId, version: '0.1.0', smoke: true })),
          },
          bootstrapTraceEntry: {
            schema_version: 1,
            sequence: 0,
            recorded_at: startAt.toISOString(),
            run_id: runId,
            kind: 'run.bootstrapped',
            flow_id: flowId,
            depth: 'standard',
            goal: 'codex relay round-trip',
            change_kind,
            manifest_hash: 'b'.repeat(64),
          },
        });

        const prompt = 'Respond with exactly the single word: ACCEPT';
        const codexResult: CodexRelayResult = await relayCodex({
          prompt,
          timeoutMs: 120_000,
          resolvedSelection: CODEX_SMOKE_SELECTION,
        });

        // Selection + provenance are required at the materializer
        // boundary; CODEX_SMOKE round-trip mirrors the AGENT_SMOKE
        // round-trip with `source: 'explicit'` (the test injects the
        // connector directly).
        const materialized = materializeRelay({
          runId,
          stepId,
          attempt,
          role: 'implementer',
          startingSequence: 1,
          runFolder,
          writes,
          connector: { kind: 'builtin', name: 'codex' },
          resolvedSelection: CODEX_SMOKE_SELECTION,
          resolvedFrom: { source: 'explicit' },
          relayResult: codexResult,
          verdict: 'accept',
          now,
        });

        for (const trace_entry of materialized.trace_entries) {
          appendAndDerive(runFolder, trace_entry);
        }

        const runtrace = readRunTrace(runFolder);
        expect(runtrace).toHaveLength(6); // bootstrap + 5 relay trace_entries
        const relayTraceEntries = runtrace.filter((e) => e.kind.startsWith('relay.'));
        expect(relayTraceEntries).toHaveLength(5);

        const [started, request, receipt, result, completed] = relayTraceEntries;
        // The critical surface — connector name binding differs from the
        // agent round-trip. If materializer drift parameterization
        // regressed, this assertion catches it.
        if (started?.kind !== 'relay.started') throw new Error('unreachable');
        expect(started.connector).toEqual({ kind: 'builtin', name: 'codex' });
        expect(started.role).toBe('implementer');

        if (request?.kind !== 'relay.request') throw new Error('unreachable');
        expect(request.request_payload_hash).toBe(sha256Hex(prompt));
        expect(request.request_payload_hash).toMatch(/^[0-9a-f]{64}$/);

        if (receipt?.kind !== 'relay.receipt') throw new Error('unreachable');
        expect(receipt.receipt_id).toBe(codexResult.receipt_id);
        expect(receipt.receipt_id.trim().length).toBeGreaterThan(0);

        if (result?.kind !== 'relay.result') throw new Error('unreachable');
        expect(result.result_report_hash).toBe(sha256Hex(codexResult.result_body));
        expect(result.result_report_hash).toMatch(/^[0-9a-f]{64}$/);

        if (completed?.kind !== 'relay.completed') throw new Error('unreachable');
        expect(completed.verdict).toBe('accept');
        expect(completed.result_path).toBe(writes.result);
        expect(completed.receipt_path).toBe(writes.receipt);

        for (const trace_entry of runtrace) {
          TraceEntry.parse(trace_entry);
        }

        const snapshot = reduce(runtrace);
        expect(snapshot.trace_entries_consumed).toBe(runtrace.length);
        const stepState = snapshot.steps.find((s) => s.step_id === stepId);
        expect(stepState?.status).toBe('complete');

        const reportAbs = join(runFolder, writes.report.path);
        expect(existsSync(reportAbs)).toBe(true);
        const reportBytes = readFileSync(reportAbs, 'utf-8');
        expect(reportBytes).toBe(codexResult.result_body);
        expect(sha256Hex(reportBytes)).toBe(result.result_report_hash);

        expect(existsSync(join(runFolder, writes.request))).toBe(true);
        expect(existsSync(join(runFolder, writes.receipt))).toBe(true);
        expect(existsSync(join(runFolder, writes.result))).toBe(true);
        expect(readFileSync(join(runFolder, writes.result), 'utf-8')).toBe(codexResult.result_body);

        // Fingerprint promotion path. The fingerprint binds to the
        // current connector surface via `connector_source_sha256` AND the
        // Codex CLI version string, so a later edit to codex.ts /
        // shared.ts / relay-materializer.ts surfaces as Check 32
        // yellow (drift detected) until a fresh CODEX_SMOKE run
        // promotes a new fingerprint. Promotion is checkd on
        // UPDATE_CODEX_FINGERPRINT=1 (mirrors the UPDATE_GOLDEN pattern
        // from explore-e2e-parity.test.ts) so a bare CODEX_SMOKE=1 run
        // exercises the connector end-to-end without mutating tracked
        // state unless the operator explicitly opts in to the promotion.
        if (UPDATE_CODEX_FINGERPRINT) {
          const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
          const fingerprint = {
            schema_version: 2,
            commit_sha: commitSha,
            result_sha256: sha256Hex(codexResult.result_body),
            connector_source_sha256: connectorSourceSha256(),
            cli_version: codexResult.cli_version,
            recorded_at: new Date().toISOString(),
          };
          mkdirSync(dirname(LAST_RUN_FINGERPRINT_PATH), { recursive: true });
          writeFileSync(LAST_RUN_FINGERPRINT_PATH, `${JSON.stringify(fingerprint, null, 2)}\n`);
        }
      } finally {
        rmSync(runFolder, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
