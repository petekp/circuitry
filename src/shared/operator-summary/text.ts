// Text-projection helpers used across per-flow summary projectors.
//
// Two categories:
//   - small primitives (sentence, plural, capitalized, withoutFinalPunctuation)
//     that mostly enforce surface conventions
//   - friendly-* projections that translate machine-shaped values
//     (status enums, summary prefixes, run-result framing) into operator-
//     readable phrases

export function plural(count: number, singular: string, pluralText = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralText}`;
}

export function capitalized(value: string): string {
  const first = value[0];
  if (first === undefined) return value;
  return `${first.toUpperCase()}${value.slice(1)}`;
}

export function sentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

export function withoutFinalPunctuation(value: string): string {
  return value.replace(/[.!?]\s*$/, '');
}

export function friendlyRunNote(flowId: string, summary: string): string {
  const match = /^([a-z-]+) v[\d.]+ closed (\d+) step\(s\) for goal ".+"\.$/.exec(summary);
  if (match !== null) {
    return `Completed ${match[2]} ${capitalized(flowId)} steps for this goal.`;
  }
  return summary;
}

export function friendlyResultSummary(summary: string): string {
  return summary
    .replace(/^(?:Build|Fix|Migrate|Review|Explore|Sweep) result for .+?:\s*/, '')
    .replace(/^Explore .+?:\s*/, '');
}

export function friendlyReviewStatus(status: string): string {
  if (status === 'accept') return 'accepted';
  if (status === 'accept-with-fixes') return 'requested follow-up fixes';
  if (status === 'accept-with-fold-ins') return 'accepted with follow-up notes';
  if (status === 'release-approved') return 'approved for release';
  if (status === 'release-with-followups') return 'approved with follow-ups';
  if (status === 'release-blocked') return 'blocked from release';
  return status;
}

export function friendlyVerificationStatus(status: string): string {
  if (status === 'passed') return 'passed';
  if (status === 'failed') return 'failed';
  return status;
}
