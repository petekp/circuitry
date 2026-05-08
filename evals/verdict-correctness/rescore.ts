// Re-score a previous results.json with the current scorer. Useful
// after the scorer is improved: the expensive model calls do not need
// to be re-run; just the catch/miss verdict is re-derived from the
// captured ExploreReviewVerdict.
//
// Usage:
//   node --experimental-strip-types evals/verdict-correctness/rescore.ts \
//     evals/verdict-correctness/results/<dir>/results.json

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFECT_IDS } from './defect-taxonomy.ts';
import { scoreDefect } from './scorer.ts';
import type { DefectId, EvalCaseResult, EvalSummary } from './types.ts';

function isDefectId(value: unknown): value is DefectId {
  return typeof value === 'string' && (DEFECT_IDS as readonly string[]).includes(value);
}

function rescore(results: EvalCaseResult[]): EvalCaseResult[] {
  return results.map((r) => {
    if (r.outcome.kind !== 'success') return r;
    if (r.case.defect_id === 'control') return r;
    if (!isDefectId(r.case.defect_id)) return r;
    const score = scoreDefect(r.case.defect_id, r.outcome.result.verdict);
    return {
      ...r,
      score: score.caught
        ? { kind: 'caught', matched_signal: score.matched_signal ?? 'unknown' }
        : { kind: 'missed' },
    };
  });
}

function summarize(results: readonly EvalCaseResult[]): EvalSummary {
  const perDefect = Object.fromEntries(
    DEFECT_IDS.map((id) => [id, { catches: 0, misses: 0, errors: 0, cases: 0 }]),
  ) as EvalSummary['per_defect'];
  const controls = { passes: 0, fails: 0, errors: 0, cases: 0 };
  let successfulCalls = 0;
  let catches = 0;
  let misses = 0;
  let errors = 0;
  const durations: number[] = [];

  for (const r of results) {
    if (r.case.defect_id === 'control') {
      controls.cases += 1;
      if (r.outcome.kind === 'success') {
        successfulCalls += 1;
        durations.push(r.outcome.result.duration_ms);
        controls.passes += 1;
      } else {
        controls.errors += 1;
        errors += 1;
      }
      continue;
    }
    if (!isDefectId(r.case.defect_id)) continue;
    const bucket = perDefect[r.case.defect_id];
    bucket.cases += 1;
    if (r.outcome.kind !== 'success') {
      bucket.errors += 1;
      errors += 1;
      continue;
    }
    successfulCalls += 1;
    durations.push(r.outcome.result.duration_ms);
    if (r.score.kind === 'caught') {
      bucket.catches += 1;
      catches += 1;
    } else if (r.score.kind === 'missed') {
      bucket.misses += 1;
      misses += 1;
    }
  }

  durations.sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const upperMiddle = durations[middle];
  const lowerMiddle = durations[middle - 1];
  const median =
    durations.length === 0 || upperMiddle === undefined
      ? 0
      : durations.length % 2 === 1
        ? upperMiddle
        : ((lowerMiddle ?? upperMiddle) + upperMiddle) / 2;
  const total = durations.reduce((a, b) => a + b, 0);
  const totalScored = catches + misses;

  return {
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    judge: 'codex',
    wallclock_ms: 0,
    per_defect: perDefect,
    controls,
    overall: {
      cases: results.length,
      successful_calls: successfulCalls,
      catches,
      misses,
      errors,
      catch_rate: totalScored === 0 ? 0 : catches / totalScored,
      total_duration_ms: total,
      median_duration_ms: median,
    },
  };
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: rescore.ts <path-to-results.json>');
    process.exit(1);
  }
  const resolved = resolve(path);
  const original = JSON.parse(readFileSync(resolved, 'utf8')) as EvalCaseResult[];
  const rescored = rescore(original);
  const summary = summarize(rescored);

  const outDir = dirname(resolved);
  writeFileSync(resolve(outDir, 'rescored-results.json'), JSON.stringify(rescored, null, 2));
  writeFileSync(resolve(outDir, 'rescored-summary.json'), JSON.stringify(summary, null, 2));

  console.log('=== RE-SCORED SUMMARY ===');
  console.log(`Cases: ${summary.overall.cases}`);
  console.log(
    `Catches: ${summary.overall.catches} / ${summary.overall.catches + summary.overall.misses}`,
  );
  console.log(`Catch rate: ${(summary.overall.catch_rate * 100).toFixed(1)}%`);
  console.log(`Errors: ${summary.overall.errors}`);
  console.log('');
  console.log('Per-defect:');
  for (const id of DEFECT_IDS) {
    const b = summary.per_defect[id];
    const scored = b.catches + b.misses;
    const rate = scored === 0 ? 'n/a' : `${((b.catches / scored) * 100).toFixed(0)}%`;
    console.log(`  ${id}: ${b.catches}/${scored} catches (${rate}), errors ${b.errors}`);
  }
}

main();
