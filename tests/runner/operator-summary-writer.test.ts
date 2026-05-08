import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OperatorSummary } from '../../src/schemas/operator-summary.js';
import { RunResult } from '../../src/schemas/result.js';
import { writeOperatorSummary } from '../../src/shared/operator-summary-writer.js';

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'circuit-operator-summary-'));
  mkdirSync(join(runFolder, 'reports'), { recursive: true });
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

function writeReport(relPath: string, body: unknown): void {
  const path = join(runFolder, relPath);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
}

function baseResult(flowId: string): RunResult {
  return RunResult.parse({
    schema_version: 1,
    run_id: '87000000-0000-0000-0000-000000000001',
    flow_id: flowId,
    goal: `run ${flowId}`,
    outcome: 'complete',
    summary: `${flowId} v0.1.0 closed 3 step(s) for goal "run ${flowId}".`,
    closed_at: '2026-04-28T12:00:00.000Z',
    trace_entries_observed: 3,
    manifest_hash: 'abc123',
  });
}

function markdownBullets(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

describe('operator summary writer', () => {
  it('writes Review summary files with verdict, finding count, warnings, and report paths', () => {
    writeReport('reports/review-result.json', {
      scope: 'review current changes',
      findings: [],
      verdict: 'CLEAN',
      evidence_summary: {
        kind: 'git-working-tree',
        untracked_content_policy: 'include-content',
        untracked_file_count: 1,
        untracked_files_sampled: 1,
        untracked_files_truncated: false,
      },
      evidence_warnings: [
        {
          kind: 'diff_truncated',
          message: 'staged diff was truncated before relay',
        },
      ],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('review'),
      route: {
        selectedFlow: 'review',
        routedBy: 'classifier',
        routerReason: 'matched review',
      },
    });

    expect(existsSync(written.jsonPath)).toBe(true);
    expect(existsSync(written.markdownPath)).toBe(true);
    const summary = OperatorSummary.parse(JSON.parse(readFileSync(written.jsonPath, 'utf8')));
    expect(summary.headline).toBe('Circuit finished Review. Verdict: CLEAN. Findings: 0.');
    expect(summary.details).toContain(
      'Untracked evidence: contents included for 1 file (1 untracked file found).',
    );
    expect(summary.evidence_warnings).toContainEqual(
      expect.objectContaining({ kind: 'diff_truncated' }),
    );
    expect(summary.report_paths.map((report) => report.label)).toEqual([
      'Run result',
      'review result',
    ]);
    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdown).toContain('Circuit finished Review. Verdict: CLEAN. Findings: 0.');
    expect(markdown).toContain('Untracked evidence: contents included for 1 file');
    expect(markdown).toContain('diff_truncated');
    expect(markdown).not.toContain('write-capable Claude Code worker');
    expect(markdown).not.toContain('v0.1.0 closed');
  });

  it('summarizes Build, Fix, and Migrate close reports with verification and review status', () => {
    const cases = [
      {
        flow: 'build',
        label: 'Build',
        relPath: 'reports/build-result.json',
        body: {
          summary: 'Build result for feature: implemented change',
          outcome: 'complete',
          verification_status: 'passed',
          review_verdict: 'accept',
          evidence_links: [
            {
              report_id: 'build.review',
              path: 'reports/build/review.json',
              schema: 'build.review@v1',
            },
          ],
        },
        expected:
          'Circuit finished Build. The change was implemented, verification passed, and review accepted it.',
      },
      {
        flow: 'build',
        label: 'Build',
        relPath: 'reports/build-result.json',
        body: {
          summary: 'Build result for feature: implemented change with follow-ups',
          outcome: 'needs_attention',
          verification_status: 'passed',
          review_verdict: 'accept-with-fixes',
          evidence_links: [
            {
              report_id: 'build.review',
              path: 'reports/build/review.json',
              schema: 'build.review@v1',
            },
          ],
        },
        expected:
          'Circuit finished Build. Verification passed, but review requested follow-up fixes.',
      },
      {
        flow: 'fix',
        label: 'Fix',
        relPath: 'reports/fix-result.json',
        body: {
          summary: 'Fix bug: patched change',
          outcome: 'fixed',
          verification_status: 'passed',
          review_verdict: 'accept',
          evidence_links: [
            { report_id: 'fix.review', path: 'reports/fix/review.json', schema: 'fix.review@v1' },
          ],
        },
        expected: 'Circuit finished Fix with outcome fixed. Verification: passed. Review: accept.',
      },
      {
        flow: 'migrate',
        label: 'Migrate',
        relPath: 'reports/migrate-result.json',
        body: {
          summary: 'Migrate SDK: release approved',
          outcome: 'complete',
          verification_status: 'passed',
          review_verdict: 'release-approved',
          evidence_links: [
            {
              report_id: 'migrate.review',
              path: 'reports/migrate/review.json',
              schema: 'migrate.review@v1',
            },
          ],
        },
        expected:
          'Circuit finished Migrate with outcome complete. Verification: passed. Review: release-approved.',
      },
    ];

    for (const entry of cases) {
      writeReport(entry.relPath, entry.body);
      const written = writeOperatorSummary({
        runFolder,
        runResult: baseResult(entry.flow),
        route: { selectedFlow: entry.flow },
      });
      expect(written.summary.headline).toBe(entry.expected);
      expect(written.summary.details).toContain(
        `Run note: Circuit completed 3 ${entry.label} steps for this goal.`,
      );
      expect(written.summary.details).toContainEqual(
        expect.stringContaining('write-capable Claude Code worker'),
      );
      expect(written.summary.details.join('\n')).not.toContain(`${entry.flow} v0.1.0 closed`);
      expect(written.summary.details.join('\n')).not.toContain('result for');
      expect(written.summary.report_paths.some((report) => report.schema?.endsWith('@v1'))).toBe(
        true,
      );
    }
  });

  it('renders Explore summaries from structured brief slots and keeps deeper notes in JSON', () => {
    writeReport('reports/compose.json', {
      verdict: 'accept',
      subject: 'Explore integration',
      recommendation: 'Keep hardening host rendering with a presentation wrapper.',
      success_condition_alignment: 'The recommendation keeps the CLI contract machine-readable.',
      supporting_aspects: [
        {
          aspect: 'host output',
          contribution:
            'A presentation wrapper solves the visible transcript problem at the host edge.',
          evidence_refs: ['reports/analysis.json'],
        },
      ],
    });
    writeReport('reports/review-verdict.json', {
      verdict: 'accept-with-fold-ins',
      overall_assessment: 'Good enough to use, but it needs one proof callout.',
      objections: [
        'Clarify whether host output was inspected directly.',
        'Confirm the generated command is updated, not only the checked-in mirror.',
      ],
      missed_angles: [
        'Check the operator summary markdown, not only the JSON report.',
        'Keep debug paths out of the visible host transcript.',
      ],
    });
    writeReport('reports/explore-result.json', {
      summary: 'Explore integration: keep hardening host rendering',
      verdict_snapshot: {
        compose_verdict: 'accept',
        review_verdict: 'accept-with-fold-ins',
        objection_count: 2,
        missed_angle_count: 2,
      },
      review_fold_ins: {
        overall_assessment: 'Good enough to use, but it needs one proof callout.',
        objections: [
          'Clarify whether host output was inspected directly.',
          'Confirm the generated command is updated, not only the checked-in mirror.',
        ],
        missed_angles: [
          'Check the operator summary markdown, not only the JSON report.',
          'Keep debug paths out of the visible host transcript.',
        ],
      },
      evidence_links: [
        {
          report_id: 'explore.compose',
          path: 'reports/compose.json',
          schema: 'explore.compose@v1',
        },
        {
          report_id: 'explore.review-verdict',
          path: 'reports/review-verdict.json',
          schema: 'explore.review-verdict@v1',
        },
      ],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    expect(written.summary.headline).toBe('Circuit finished Explore.');
    expect(written.summary.brief_slots).toMatchObject({
      primary: {
        label: 'Recommendation',
        text: 'Keep hardening host rendering with a presentation wrapper.',
      },
      why: 'A presentation wrapper solves the visible transcript problem at the host edge.',
      cautions: [
        'Clarify whether host output was inspected directly.',
        'Confirm the generated command is updated, not only the checked-in mirror.',
        'Check the operator summary markdown, not only the JSON report.',
      ],
    });
    expect(written.summary.details).toContain(
      'Review assessment: Good enough to use, but it needs one proof callout.',
    );
    expect(written.summary.details).toContain(
      'Review objections: Clarify whether host output was inspected directly.; Confirm the generated command is updated, not only the checked-in mirror.',
    );
    expect(written.summary.details).toContain(
      'Review missed angles: Check the operator summary markdown, not only the JSON report.; Keep debug paths out of the visible host transcript.',
    );
    expect(written.summary.report_paths.map((report) => report.label)).toContain('explore.compose');
    const markdown = readFileSync(written.markdownPath, 'utf8');
    const bullets = markdownBullets(markdown);
    expect(bullets).toHaveLength(5);
    expect(markdown).toContain('Recommendation: Keep hardening host rendering');
    expect(markdown).toContain('Check the operator summary markdown, not only the JSON report.');
    expect(markdown).not.toContain('Keep debug paths out of the visible host transcript.');
    expect(markdown).not.toContain(runFolder);
    expect(markdown).not.toContain('reports/compose.json');
    expect(markdown).not.toContain('## Run Files');
    expect(markdown).not.toContain('## Reports');
  });

  it('summarizes Explore tournament decisions with selected option, rationale, risks, and next action', () => {
    writeReport('reports/decision.json', {
      verdict: 'decided',
      decision_question: 'Which frontend framework should the project use?',
      selected_option_id: 'option-2',
      selected_option_label: 'Vue',
      decision: 'Choose Vue for a smaller surface and faster product iteration.',
      rationale: 'Vue gives this team the fastest path to a polished prototype.',
      rejected_options: [{ option_id: 'option-1', reason: 'React was safer but slower here.' }],
      evidence_links: [
        'reports/decision-options.json',
        'reports/tournament-aggregate.json',
        'reports/tournament-review.json',
        'reports/checkpoints/tradeoff-response.json',
      ],
      assumptions: ['The team is comfortable learning Vue quickly.'],
      residual_risks: ['Hiring familiarity may be thinner.'],
      next_action: 'Run a Build plan for a Vue prototype.',
      follow_up_workflow: 'Build',
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'decide: React vs Vue': Choose Vue for a smaller surface.",
      verdict_snapshot: {
        decision_verdict: 'decided',
        tournament_review_verdict: 'recommend',
        selected_option_id: 'option-2',
        objection_count: 1,
        missing_evidence_count: 1,
      },
      evidence_links: [
        { report_id: 'explore.brief', path: 'reports/brief.json', schema: 'explore.brief@v1' },
        {
          report_id: 'explore.analysis',
          path: 'reports/analysis.json',
          schema: 'explore.analysis@v1',
        },
        {
          report_id: 'explore.decision-options',
          path: 'reports/decision-options.json',
          schema: 'explore.decision-options@v1',
        },
        {
          report_id: 'explore.tournament-aggregate',
          path: 'reports/tournament-aggregate.json',
          schema: 'explore.tournament-aggregate@v1',
        },
        {
          report_id: 'explore.tournament-review',
          path: 'reports/tournament-review.json',
          schema: 'explore.tournament-review@v1',
        },
        {
          report_id: 'explore.decision',
          path: 'reports/decision.json',
          schema: 'explore.decision@v1',
        },
      ],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    expect(written.summary.headline).toBe('Circuit finished Explore decision. Selected: Vue.');
    expect(written.summary.brief_slots).toMatchObject({
      primary: {
        label: 'Decision',
        text: 'Choose Vue for a smaller surface and faster product iteration.',
      },
      why: 'Vue gives this team the fastest path to a polished prototype.',
      cautions: ['Hiring familiarity may be thinner.'],
      nextStep: 'Run a Build plan for a Vue prototype.',
    });
    expect(written.summary.details).toContain(
      'Decision question: Which frontend framework should the project use?',
    );
    expect(written.summary.details).toContain(
      'Rationale: Vue gives this team the fastest path to a polished prototype.',
    );
    expect(written.summary.details).toContain('Residual risks: Hiring familiarity may be thinner.');
    expect(written.summary.details).toContain('Next action: Run a Build plan for a Vue prototype.');
    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdownBullets(markdown)).toHaveLength(4);
    expect(markdown).not.toContain(runFolder);
    expect(markdown).not.toContain('reports/decision.json');
  });

  it('caps long Explore visible text without expanding freeform numbered lists', () => {
    const longRecommendation = [
      '1. First, replace the raw Claude transcript with a presentation wrapper that hides progress JSONL and final stdout JSON from the visible answer.',
      '2. Second, rewrite every generated command mirror so the raw invocation cannot come back during regeneration.',
      '3. Third, keep the machine-readable CLI output available for automation and debug use.',
    ].join(' ');
    writeReport('reports/compose.json', {
      verdict: 'accept',
      subject: 'Claude transcript cleanup',
      recommendation: longRecommendation,
      success_condition_alignment: 'The recommendation protects the host transcript.',
      supporting_aspects: [
        {
          aspect: 'wrapper',
          contribution:
            'The wrapper can stream clean progress while leaving raw machine output intact.',
          evidence_refs: ['reports/analysis.json'],
        },
      ],
    });
    writeReport('reports/review-verdict.json', {
      verdict: 'accept-with-fold-ins',
      overall_assessment: 'Usable with capped cautions.',
      objections: ['Objection one.', 'Objection two.', 'Objection three.'],
      missed_angles: ['Missed angle four.', 'Missed angle five.'],
    });
    writeReport('reports/explore-result.json', {
      summary: `Explore transcript cleanup: ${longRecommendation}`,
      verdict_snapshot: {
        compose_verdict: 'accept',
        review_verdict: 'accept-with-fold-ins',
        objection_count: 3,
        missed_angle_count: 2,
      },
      review_fold_ins: {
        overall_assessment: 'Usable with capped cautions.',
        objections: ['Objection one.', 'Objection two.', 'Objection three.'],
        missed_angles: ['Missed angle four.', 'Missed angle five.'],
      },
      evidence_links: [
        {
          report_id: 'explore.compose',
          path: 'reports/compose.json',
          schema: 'explore.compose@v1',
        },
        {
          report_id: 'explore.review-verdict',
          path: 'reports/review-verdict.json',
          schema: 'explore.review-verdict@v1',
        },
      ],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    const markdown = readFileSync(written.markdownPath, 'utf8');
    const bullets = markdownBullets(markdown);
    expect(bullets).toHaveLength(5);
    expect(bullets.filter((bullet) => bullet.startsWith('Caution:'))).toHaveLength(3);
    expect(markdown).toContain('Objection one.');
    expect(markdown).toContain('Objection three.');
    expect(markdown).not.toContain('Missed angle four.');
    expect(markdown).not.toContain('## Run Files');
    expect(markdown).not.toContain('## Reports');
    expect(markdown).not.toContain('{"');
    expect(written.summary.brief_slots?.primary.text.length).toBeLessThan(
      longRecommendation.length,
    );
    expect(written.summary.details.join('\n')).toContain('Missed angle four.');
  });

  it('includes abort reasons in aborted summaries', () => {
    const result = RunResult.parse({
      ...baseResult('review'),
      outcome: 'aborted',
      summary: 'review aborted',
      reason: 'relay result failed schema validation',
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: result,
      route: { selectedFlow: 'review' },
    });

    expect(written.summary.headline).toBe('Circuit run aborted.');
    expect(written.summary.details).toContain(
      'Abort reason: relay result failed schema validation',
    );
    expect(readFileSync(written.markdownPath, 'utf8')).toContain(
      'relay result failed schema validation',
    );
  });
});
