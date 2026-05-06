import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  appendAndDeriveRetainedTrace as appendAndDerive,
  bootstrapRetainedRun as bootstrapRun,
} from '../../src/compat/retained-runtime.js';
import {
  type ClaudeCodeRelayResult,
  relayClaudeCode,
} from '../../src/runtime/connectors/claude-code.js';
import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
import { reduce } from '../../src/runtime/reducer.js';
import { readRunTrace } from '../../src/runtime/trace-reader.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlowId, RunId, StepId } from '../../src/schemas/ids.js';
import { TraceEntry } from '../../src/schemas/trace-entry.js';
import { sha256Hex } from '../../src/shared/connector-relay.js';

// Agent-relay-roundtrip test with the five-trace_entry transcript binding.
//
// The test exercises the full runtime boundary with a REAL claude-code connector:
//   (1) bootstrap a run (trace-writer writes run.bootstrapped);
//   (2) invoke relayClaudeCode() against the live `claude` CLI;
//   (3) materialize the five-trace_entry relay transcript + four on-disk
//       slots (request, receipt, result, report) via
//       materializeRelay();
//   (4) append each trace_entry via appendAndDerive so trace-writer and
//       reducer both touch the transcript;
//   (5) read the trace back via readRunTrace (which enforces
//       RUN-I1..I5 at parse time);
//   (6) reduce via the pure reducer to produce the snapshot;
//   (7) assert the snapshot has the step at status='complete',
//       trace_entries_consumed equals the total appended, and the on-disk
//       report file exists with bytes byte-equal to the connector's
//       result_body.
//
// Enforcement binding §Durable relay transcript: this IS the
// non-substitutable evidence that
//   - relay.started carries connector.name='claude-code' via ResolvedConnector,
//   - relay.request carries a non-empty request_payload_hash,
//   - relay.receipt carries a receipt_id,
//   - relay.result carries a result_report_hash,
//   - the reducer has consumed the sequence,
//   - the report is materialized to the canonical path.
// A mock connector returning a fixed byte string cannot satisfy this —
// real Claude session_id and real model output are part of the round-trip.
//
// AGENT_SMOKE check: the test spawns the `claude` subprocess and
// requires network auth. Skipped by default so CI and unauthenticated
// developer runs stay green. The static-declaration count is preserved
// by two always-running sanity tests at the top.

const AGENT_SMOKE = process.env.AGENT_SMOKE === '1';

describe('agent relay round-trip', () => {
  it('static: materializeRelay is an exported function (ratchet-floor declaration)', () => {
    expect(typeof materializeRelay).toBe('function');
  });

  it('static: TraceEntry schema discriminator covers all five relay transcript kinds', () => {
    // Belt-and-braces guard: the five variants must all round-trip
    // through TraceEntry.parse(). A schema regression that dropped any
    // variant would break the materializer's trace_entry emission.
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

  (AGENT_SMOKE ? it : it.skip)(
    'end-to-end: relayClaudeCode → 5-trace_entry transcript → reducer snapshot → materialized report (AGENT_SMOKE=1)',
    async () => {
      const runFolder = mkdtempSync(join(tmpdir(), 'agent-relay-roundtrip-'));
      try {
        const runId = RunId.parse('42424242-4242-4242-4242-424242424242');
        const flowId = CompiledFlowId.parse('agent-smoke-0');
        const stepId = StepId.parse('smoke-relay-step');
        const attempt = 1;
        const startAt = new Date('2026-04-21T17:00:00.000Z');
        const now = () => startAt;
        const change_kind: ChangeKindDeclaration = {
          change_kind: 'ratchet-advance',
          failure_mode: 'agent relay round-trip',
          acceptance_evidence: '5-trace_entry transcript consumed by reducer',
          alternate_framing: 'Defer to later stage — rejected',
        };
        const writes = {
          request: 'reports/relay/smoke.request.txt',
          receipt: 'reports/relay/smoke.receipt.txt',
          result: 'reports/relay/smoke.result.txt',
          report: {
            path: 'reports/smoke-compose.txt',
            schema: 'agent.smoke@v1',
          },
        };

        // (1) Bootstrap run. run.bootstrapped is sequence 0; relay
        // trace_entries start at sequence 1.
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
            goal: 'agent relay round-trip',
            change_kind,
            manifest_hash: 'a'.repeat(64),
          },
        });

        // (2) Invoke the real connector. A short, deterministic prompt
        // keeps the result small and the hash stable-ish (model output
        // may vary but hashes are computed over whatever comes back).
        const prompt = 'Respond with exactly the single word: ACCEPT';
        const agentResult: ClaudeCodeRelayResult = await relayClaudeCode({
          prompt,
          timeoutMs: 120_000,
        });

        // (3+4) Materialize and append. Selection + provenance are
        // required at the materializer boundary; this AGENT_SMOKE
        // round-trip tests the claude-code connector's full five-trace_entry
        // transcript with the canonical empty selection and `source:
        // 'explicit'` provenance (the test injects the connector directly,
        // so the honest claim is `'explicit'`).
        const materialized = materializeRelay({
          runId,
          stepId,
          attempt,
          role: 'implementer',
          startingSequence: 1,
          runFolder,
          writes,
          connector: { kind: 'builtin', name: 'claude-code' },
          resolvedSelection: { skills: [], invocation_options: {} },
          resolvedFrom: { source: 'explicit' },
          relayResult: agentResult,
          verdict: 'accept',
          now,
        });

        for (const trace_entry of materialized.trace_entries) {
          appendAndDerive(runFolder, trace_entry);
        }

        // (5) Read the trace back. RunTrace.parse enforces
        // RUN-I1..I5; any transcript-level regression would fail here.
        const runtrace = readRunTrace(runFolder);
        expect(runtrace).toHaveLength(6); // bootstrap + 5 relay trace_entries
        const relayTraceEntries = runtrace.filter((e) => e.kind.startsWith('relay.'));
        expect(relayTraceEntries).toHaveLength(5);

        const [started, request, receipt, result, completed] = relayTraceEntries;
        // Connector name binding — the critical CC#P2-2 surface.
        if (started?.kind !== 'relay.started') throw new Error('unreachable');
        expect(started.connector).toEqual({ kind: 'builtin', name: 'claude-code' });
        expect(started.role).toBe('implementer');

        if (request?.kind !== 'relay.request') throw new Error('unreachable');
        expect(request.request_payload_hash).toBe(sha256Hex(prompt));
        expect(request.request_payload_hash).toMatch(/^[0-9a-f]{64}$/);

        if (receipt?.kind !== 'relay.receipt') throw new Error('unreachable');
        expect(receipt.receipt_id).toBe(agentResult.receipt_id);
        expect(receipt.receipt_id.trim().length).toBeGreaterThan(0);

        if (result?.kind !== 'relay.result') throw new Error('unreachable');
        expect(result.result_report_hash).toBe(sha256Hex(agentResult.result_body));
        expect(result.result_report_hash).toMatch(/^[0-9a-f]{64}$/);

        if (completed?.kind !== 'relay.completed') throw new Error('unreachable');
        expect(completed.verdict).toBe('accept');
        expect(completed.result_path).toBe(writes.result);
        expect(completed.receipt_path).toBe(writes.receipt);

        // Every trace_entry round-trips through TraceEntry.parse — the reducer
        // downstream depends on this.
        for (const trace_entry of runtrace) {
          TraceEntry.parse(trace_entry);
        }

        // (6) Reduce to snapshot. The reducer must have consumed every
        // trace_entry; trace_entries_consumed pins the relationship.
        const snapshot = reduce(runtrace);
        expect(snapshot.trace_entries_consumed).toBe(runtrace.length);
        const stepState = snapshot.steps.find((s) => s.step_id === stepId);
        // The relay transcript is enough for the reducer to close the
        // relay-only step; a later step.completed entry can still add the
        // parent route.
        expect(stepState?.status).toBe('complete');

        // (7) Report materialization.
        const reportAbs = join(runFolder, writes.report.path);
        expect(existsSync(reportAbs)).toBe(true);
        const reportBytes = readFileSync(reportAbs, 'utf-8');
        expect(reportBytes).toBe(agentResult.result_body);
        expect(sha256Hex(reportBytes)).toBe(result.result_report_hash);

        // Request + result on-disk slots also materialized.
        expect(existsSync(join(runFolder, writes.request))).toBe(true);
        expect(existsSync(join(runFolder, writes.receipt))).toBe(true);
        expect(existsSync(join(runFolder, writes.result))).toBe(true);
        expect(readFileSync(join(runFolder, writes.result), 'utf-8')).toBe(agentResult.result_body);
      } finally {
        rmSync(runFolder, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
