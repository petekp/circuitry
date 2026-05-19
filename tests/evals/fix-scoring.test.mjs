import { describe, expect, it } from 'vitest';
import {
  circuitProofQuality,
  decideClaim,
  parseCircuitResult,
  parseVanillaClaim,
  scoreArm,
} from '../../scripts/evals/fix-vs-vanilla/scoring.mjs';

describe('fix-vs-vanilla scoring', () => {
  it('marks claimed success with failing checks as false-fixed', () => {
    const score = scoreArm({
      task: { id: 'task', split: 'held-out', allowed_changed_files: ['src/fix.mjs'] },
      armId: 'vanilla-claude-code',
      run: { exit_code: 0, timed_out: false, wallclock_ms: 12 },
      checks: [{ id: 'test', passed: false }],
      diff: { changed_files: ['src/fix.mjs'], diff_path: '/tmp/task/diff.txt' },
      claim: { claimed_fixed: true, proof_quality: 2 },
    });

    expect(score.objective_fixed).toBe(false);
    expect(score.false_fixed).toBe(true);
  });

  it('scores complete Circuit proof evidence as quality 3', () => {
    expect(
      circuitProofQuality({
        regression_status: 'proved',
        regression_rerun_status: 'cleared',
        verification_status: 'passed',
        change_set_status: 'pass',
      }),
    ).toBe(3);
    expect(parseCircuitResult({ outcome: 'fixed', verification_status: 'passed' }).claimed_fixed).toBe(true);
  });

  it('parses strong vanilla JSON claims and proof quality', () => {
    const claim = parseVanillaClaim(`Done.

\`\`\`json
{
  "claimed_fixed": true,
  "changed_files": ["src/example.mjs"],
  "commands_run": [
    {"command": "npm test", "status": "failed-before"},
    {"command": "npm test", "status": "passed-after"}
  ],
  "regression_proof": {
    "command": "npm test",
    "failed_before": true,
    "passed_after": true
  },
  "residual_risks": []
}
\`\`\``);

    expect(claim.parse_status).toBe('parsed');
    expect(claim.claimed_fixed).toBe(true);
    expect(claim.proof_quality).toBe(3);
  });

  it('falls back to heuristic vanilla claims when JSON is missing', () => {
    const claim = parseVanillaClaim('The bug is fixed and tests are green.');
    expect(claim.parse_status).toBe('heuristic');
    expect(claim.claimed_fixed).toBe(true);
    expect(claim.proof_quality).toBe(0);
  });

  it('supports a held-out claim only when false-fixed improves and fixed rate is not lower', () => {
    const claim = decideClaim({
      'circuit-claude-code': {
        task_count: 5,
        false_fixed_rate: 0,
        objective_fixed_rate: 1,
      },
      'vanilla-claude-code': {
        task_count: 5,
        false_fixed_rate: 0.2,
        objective_fixed_rate: 0.8,
      },
    });

    expect(claim.supported).toBe(true);
  });
});
