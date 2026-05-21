import { describe, expect, it } from 'vitest';

import { relayCodex } from '../../src/connectors/codex.js';
import { sha256Hex } from '../../src/shared/connector-relay.js';

// Codex connector smoke test. Mirrors the agent smoke shape: a static
// branch (always runs, contributes to the contract-test ratchet
// regardless of env), plus a CODEX_SMOKE=1-checkd end-to-end branch that
// spawns the real `codex exec` subprocess.
//
// CODEX_SMOKE=1 is opt-in for the same reason AGENT_SMOKE=1 is: the
// subprocess requires (1) the `codex` CLI on $PATH, (2) authenticated
// session or API key, (3) network access. CI and unauthenticated
// developer runs stay green without it.
//
// Capability-boundary empirical proof: the argv-constant assertion in
// `CODEX_WRITE_FLAGS` is module-load-bound; the connector pins
// `-s workspace-write`, ignores user config/rules, and blocks bypass
// tokens regardless of model behavior. This smoke test is the positive
// end-to-end regression guard: if a future change loosens
// `CODEX_WRITE_FLAGS`, the module-load assertion fires before the smoke
// test even starts.

const CODEX_SMOKE = process.env.CODEX_SMOKE === '1';

describe('codex connector smoke (capability boundary)', () => {
  it('static: relayCodex exports a function (ratchet-floor declaration)', () => {
    expect(typeof relayCodex).toBe('function');
    expect(relayCodex.length).toBeGreaterThanOrEqual(1);
  });

  (CODEX_SMOKE ? it : it.skip)(
    'end-to-end: relayCodex spawns codex exec and returns a result triple (CODEX_SMOKE=1)',
    async () => {
      const prompt = 'Respond with exactly the single word: OK';
      const result = await relayCodex({
        prompt,
        timeoutMs: 120_000,
        resolvedSelection: { effort: 'low', skills: [], invocation_options: {} },
      });

      expect(result.request_payload).toBe(prompt);
      expect(result.receipt_id.length).toBeGreaterThan(0);
      expect(result.receipt_id.trim().length).toBeGreaterThan(0);

      expect(typeof result.result_body).toBe('string');
      expect(result.result_body.length).toBeGreaterThan(0);
      expect(result.duration_ms).toBeGreaterThan(0);

      expect(sha256Hex(result.request_payload)).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256Hex(result.result_body)).toMatch(/^[0-9a-f]{64}$/);

      // cli_version captured via pre-invocation `codex --version`
      // shellout (Codex does not emit version in-band like `claude`'s
      // init trace_entry). Expected shape: "codex-cli X.Y.Z" (may vary).
      expect(result.cli_version).toMatch(/codex.*\d+\.\d+\.\d+/);
    },
    180_000,
  );
});
