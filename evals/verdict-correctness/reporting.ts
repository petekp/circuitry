import type { EvalCase, EvalCaseResult, EvalSourcePoolSummary } from './types.ts';

type SourcePoolCase = Pick<EvalCase, 'source_run_id' | 'source_subject'>;

function normalizeSubject(subject: string | undefined): string {
  return subject?.replace(/\s+/g, ' ').trim() ?? '';
}

export function summarizeCaseSourcePool(
  cases: readonly SourcePoolCase[],
): EvalSourcePoolSummary {
  const subjectBySource = new Map<string, string>();
  for (const caseDef of cases) {
    const subject = normalizeSubject(caseDef.source_subject);
    const existing = subjectBySource.get(caseDef.source_run_id);
    if (existing === undefined || existing === '') {
      subjectBySource.set(caseDef.source_run_id, subject);
    }
  }
  const subjects = Array.from(new Set([...subjectBySource.values()].filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  return {
    source_count: subjectBySource.size,
    distinct_subjects: subjects.length,
    subjects,
  };
}

export function summarizeSourcePool(
  results: readonly EvalCaseResult[],
): EvalSourcePoolSummary {
  return summarizeCaseSourcePool(results.map((result) => result.case));
}
