import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OperatorSummary } from '../../src/schemas/operator-summary.js';
import { RunResult } from '../../src/schemas/result.js';
import { readPriorRoute, writeOperatorSummary } from '../../src/shared/operator-summary-writer.js';

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
    expect(summary.headline).toBe('Circuit: Review complete. Verdict: CLEAN. Findings: 0.');
    expect(summary.status_text).toBe('Review complete. Verdict: CLEAN. Findings: 0.');
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
    expect(markdown).toContain('Circuit\n⎿ Review complete. Verdict: CLEAN. Findings: 0.');
    expect(markdown).toContain('Untracked evidence: contents included for 1 file');
    expect(markdown).toContain('diff_truncated');
    expect(markdown).not.toContain('write-capable Claude Code worker');
    expect(markdown).not.toContain('v0.1.0 closed');
  });

  it('rewrites the Review headline to flag scope_empty so a CLEAN/0-findings verdict cannot quietly stand in for "nothing was reviewed"', () => {
    writeReport('reports/review-result.json', {
      scope: 'review the new evil.js — flag any safety problems',
      findings: [],
      verdict: 'CLEAN',
      evidence_summary: {
        kind: 'git-working-tree',
        untracked_content_policy: 'metadata-only',
        untracked_file_count: 0,
        untracked_files_sampled: 0,
        untracked_files_truncated: false,
      },
      evidence_warnings: [
        {
          kind: 'scope_empty',
          message:
            'review scoped to uncommitted changes only; HEAD~1 differences not examined. No staged or unstaged diff was present, so committed changes were not part of this review.',
        },
      ],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('review'),
      route: { selectedFlow: 'review' },
    });

    expect(written.summary.headline).toContain('no uncommitted changes to examine');
    expect(written.summary.headline).toContain('reflects scope, not safety');
    expect(written.summary.headline).not.toMatch(/^Circuit: Review complete\./);
    expect(written.summary.evidence_warnings).toContainEqual(
      expect.objectContaining({ kind: 'scope_empty' }),
    );
    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdown).toContain('no uncommitted changes to examine');
    expect(markdown).toContain('scope_empty');
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
          'Circuit: Build complete. Change implemented, verification passed, review accepted.',
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
          'Circuit: Build needs follow-up. Verification passed, but review requested fixes.',
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
        expected:
          'Circuit: Fix finished with outcome fixed. Verification: passed. Review: accepted.',
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
          'Circuit: Migrate finished with outcome complete. Verification: passed. Review: approved for release.',
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
        `Run note: Completed 3 ${entry.label} steps for this goal.`,
      );
      expect(written.summary.details).toContainEqual(
        expect.stringContaining('A worker can edit this checkout.'),
      );
      expect(written.summary.details.join('\n')).not.toContain(`${entry.flow} v0.1.0 closed`);
      expect(written.summary.details.join('\n')).not.toContain('result for');
      expect(written.summary.report_paths.some((report) => report.schema?.endsWith('@v1'))).toBe(
        true,
      );
    }
  });

  it('falls back to the run-level outcome when the flow-result file is missing instead of silently rendering complete', () => {
    // No reports/migrate-result.json on disk — simulates the legacy @stop
    // path where close-step never ran. Without the runOutcome fallback,
    // the migrate projector would default outcome to 'complete' and
    // contradict result.json's stopped outcome.
    const stoppedResult = RunResult.parse({
      schema_version: 1,
      run_id: '87000000-0000-0000-0000-000000000007',
      flow_id: 'migrate',
      goal: 'run migrate',
      outcome: 'stopped',
      summary: 'migrate v0.1.0 closed 3 step(s) for goal "run migrate".',
      closed_at: '2026-04-28T12:00:00.000Z',
      trace_entries_observed: 3,
      manifest_hash: 'abc123',
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: stoppedResult,
      route: { selectedFlow: 'migrate' },
    });

    expect(written.summary.headline).toBe(
      'Circuit: Migrate finished with outcome stopped. Verification: unknown. Review: unknown.',
    );
  });

  it('renders Explore summaries as concise operator guidance', () => {
    writeReport('reports/explore-result.json', {
      summary:
        "Explore 'internal evals': Build a private eval suite around product-specific failure modes. Concretely: (1) Seam-fit eval — trace schema changes before authoring. (2) Operator-prose eval — score final summaries for clarity. Before building, the proof needed is: (a) inspect src/ and tests/ for an existing eval harness; (b) confirm the saved run corpus. Recommend starting with the operator-prose eval.",
      verdict_snapshot: {
        compose_verdict: 'accept',
        review_verdict: 'accept-with-fold-ins',
        objection_count: 1,
        missed_angle_count: 1,
      },
      review_fold_ins: {
        overall_assessment: 'Good enough to use, but it needs one proof callout.',
        objections: ['Clarify whether host output was inspected directly.'],
        missed_angles: ['Check the operator summary markdown, not only the JSON report.'],
      },
      evidence_links: [],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    expect(written.summary.headline).toBe(
      'Circuit: Recommendation ready. The direction is useful, with follow-up notes.',
    );
    expect(written.summary.details).toEqual([
      'Recommendation: Build a private eval suite around product-specific failure modes: Seam-fit eval; Operator-prose eval.',
      'Before building: inspect src/ and tests/ for an existing eval harness; confirm the saved run corpus.',
      'Start with: the operator-prose eval.',
      'Reviewer: Accepted the direction, with notes to fold in.',
      'Follow-up: Clarify whether host output was inspected directly.',
      'Follow-up: Check the operator summary markdown, not only the JSON report.',
    ]);
    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdown).toContain('Circuit\n⎿ Recommendation ready. The direction is useful');
    expect(markdown).toContain(
      'Recommendation: Build a private eval suite around product-specific failure modes',
    );
    expect(markdown).not.toContain('accept-with-fold-ins');
    expect(markdown).not.toContain('Run folder:');
    expect(markdown).not.toContain('## Reports');
    expect(markdown).not.toContain('Evidence Warnings');
  });

  it('does not splice numbered back-references like "(1), (4), and (5)" into the recommendation label list', () => {
    // Regression for cee25546: a compose summary that listed seven
    // numbered options and then referred back to "Of these, (1), (4),
    // and (5) likely return..." caused numberedRecommendationLabels to
    // capture the back-reference as a giant 8th label, producing a
    // malformed duplicate fragment in operator-summary.md.
    writeReport('reports/explore-result.json', {
      summary:
        "Explore 'eval menu': The highest-leverage internal eval categories are: (1) Verdict-correctness evals — seed runs with planted defects. (2) Operator-summary evals — score plain-language. (3) Cross-adapter equivalence evals — diff agent vs codex outputs. (4) Schema-conformance evals — validate report bodies. (5) Adversarial-review catch-rate evals — track defect catches. Of these, (1), (4), and (5) likely return the most signal for the least build cost. Before committing build effort, the next concrete proof needed is to inspect existing evals/ for prior art.",
      verdict_snapshot: {
        compose_verdict: 'accept',
        review_verdict: 'accept-with-fold-ins',
        objection_count: 0,
        missed_angle_count: 0,
      },
      review_fold_ins: {
        overall_assessment: 'Direction is useful.',
        objections: [],
        missed_angles: [],
      },
      evidence_links: [],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    const recommendation = written.summary.details.find((detail) =>
      detail.startsWith('Recommendation:'),
    );
    expect(recommendation).toBeDefined();
    expect(recommendation).not.toContain(', (4), and (5) likely return');
    expect(recommendation).not.toContain('the next concrete proof needed is');
    expect(recommendation).toContain('Verdict-correctness evals');
    expect(recommendation).toContain('Adversarial-review catch-rate evals');
    expect(recommendation).not.toMatch(/(Verdict-correctness evals.*){2}/s);
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

    expect(written.summary.headline).toBe(
      'Circuit: Decision made. Selected: Vue. Choose Vue for a smaller surface and faster product iteration.',
    );
    expect(written.summary.details).toContain(
      'Decision question: Which frontend framework should the project use?',
    );
    expect(written.summary.details).toContain(
      'Rationale: Vue gives this team the fastest path to a polished prototype.',
    );
    expect(written.summary.details).toContain('Residual risks: Hiring familiarity may be thinner.');
    expect(written.summary.details).toContain('Next action: Run a Build plan for a Vue prototype.');
  });

  it('emits operator-summary.html for Explore tournament runs with recommended highlight and XSS escaping', () => {
    writeReport('reports/decision-options.json', {
      decision_question: 'Which framework <should> we pick?',
      recommendation_basis: 'tournament-aggregate@v1 + tournament-review@v1',
      options: [
        {
          id: 'option-1',
          label: 'React',
          summary: 'Mature, large community.',
          best_case_prompt: 'Bootstrap a React prototype with the design system in src/ui.',
          evidence_refs: ['reports/analysis.json#aspect-react'],
          tradeoffs: ['Larger surface area', 'Slower iteration'],
        },
        {
          id: 'option-2',
          label: 'Vue <script>alert(1)</script>',
          summary: 'Smaller surface, faster iteration.',
          best_case_prompt: 'Bootstrap a Vue prototype starting from src/ui/main.ts.',
          evidence_refs: ['reports/analysis.json#aspect-vue'],
          tradeoffs: ['Thinner hiring pool', 'Less ecosystem'],
        },
      ],
    });
    writeReport('reports/tournament-review.json', {
      verdict: 'recommend',
      recommended_option_id: 'option-2',
      comparison: 'Vue wins on iteration speed; React wins on hiring familiarity.',
      objections: ['Vue ecosystem is thinner.'],
      missing_evidence: ['No data on team Vue experience.'],
      tradeoff_question: 'Are we optimizing for speed-to-prototype or long-term hiring?',
      confidence: 'high',
    });
    writeReport('reports/decision.json', {
      verdict: 'decided',
      decision_question: 'Which framework <should> we pick?',
      selected_option_id: 'option-2',
      selected_option_label: 'Vue',
      decision: 'Choose Vue for a smaller surface and faster product iteration.',
      rationale: 'Vue gives this team the fastest path to a polished prototype.',
      rejected_options: [{ option_id: 'option-1', reason: 'Slower for this team.' }],
      evidence_links: ['reports/decision-options.json'],
      assumptions: ['Team can learn Vue quickly.'],
      residual_risks: ['Hiring familiarity may be thinner.'],
      next_action: 'Run a Build plan for a Vue prototype.',
      follow_up_workflow: 'Build',
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'pick framework': Choose Vue.",
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

    expect(written.htmlPath).toBeDefined();
    expect(existsSync(written.htmlPath as string)).toBe(true);
    expect(written.summary.report_paths.map((report) => report.label)).toContain(
      'Operator summary (HTML)',
    );

    const html = readFileSync(written.htmlPath as string, 'utf8');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Which framework &lt;should&gt; we pick?');
    expect(html).toContain('class="card intent-positive"');
    expect(html).toContain('<span class="intent-badge intent-positive">Selected</span>');
    expect(html).toContain('Vue &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('high confidence');

    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdown).toContain(`Rich summary: ${written.htmlPath as string}`);
  });

  it('skips HTML emission when tournament-review.json is malformed', () => {
    writeReport('reports/decision-options.json', {
      decision_question: 'Which framework should we pick?',
      recommendation_basis: 'tournament-aggregate@v1 + tournament-review@v1',
      options: [
        {
          id: 'option-1',
          label: 'React',
          summary: 'Mature.',
          best_case_prompt: 'Bootstrap React.',
          evidence_refs: ['reports/analysis.json#aspect-react'],
          tradeoffs: ['Larger surface'],
        },
        {
          id: 'option-2',
          label: 'Vue',
          summary: 'Smaller.',
          best_case_prompt: 'Bootstrap Vue.',
          evidence_refs: ['reports/analysis.json#aspect-vue'],
          tradeoffs: ['Thinner ecosystem'],
        },
      ],
    });
    // Missing required fields (no `verdict`, `recommended_option_id`, etc.) — Zod parse should fail.
    writeReport('reports/tournament-review.json', { verdict: 'recommend' });
    writeReport('reports/decision.json', {
      verdict: 'decided',
      decision_question: 'Which framework should we pick?',
      selected_option_id: 'option-2',
      selected_option_label: 'Vue',
      decision: 'Choose Vue.',
      rationale: 'Faster path.',
      rejected_options: [{ option_id: 'option-1', reason: 'Slower.' }],
      evidence_links: ['reports/decision-options.json'],
      assumptions: ['Team can learn Vue.'],
      residual_risks: ['Hiring familiarity may be thinner.'],
      next_action: 'Run a Build plan.',
      follow_up_workflow: 'Build',
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'pick framework': Choose Vue.",
      verdict_snapshot: {
        decision_verdict: 'decided',
        tournament_review_verdict: 'recommend',
        selected_option_id: 'option-2',
        objection_count: 0,
        missing_evidence_count: 0,
      },
      evidence_links: [
        {
          report_id: 'explore.decision-options',
          path: 'reports/decision-options.json',
          schema: 'explore.decision-options@v1',
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

    expect(written.htmlPath).toBeUndefined();
    expect(written.summary.report_paths.map((report) => report.label)).not.toContain(
      'Operator summary (HTML)',
    );
    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdown).not.toContain('Rich summary:');
    expect(existsSync(join(runFolder, 'reports', 'operator-summary.html'))).toBe(false);
  });

  it('skips HTML emission when verdict_snapshot.decision_verdict is not "decided"', () => {
    // Pre-decision state (e.g. a checkpoint_waiting close that set
    // selected_option_id but has not yet finalized the decision) must
    // NOT produce an HTML surface. Operator deserves a surface that
    // matches actual run state, not a partial one.
    writeReport('reports/decision-options.json', {
      decision_question: 'Which framework should we pick?',
      recommendation_basis: 'tournament-aggregate@v1 + tournament-review@v1',
      options: [
        {
          id: 'option-1',
          label: 'React',
          summary: 'Mature.',
          best_case_prompt: 'Bootstrap React.',
          evidence_refs: ['reports/analysis.json#aspect-react'],
          tradeoffs: ['Larger surface'],
        },
        {
          id: 'option-2',
          label: 'Vue',
          summary: 'Smaller.',
          best_case_prompt: 'Bootstrap Vue.',
          evidence_refs: ['reports/analysis.json#aspect-vue'],
          tradeoffs: ['Thinner ecosystem'],
        },
      ],
    });
    writeReport('reports/tournament-review.json', {
      verdict: 'recommend',
      recommended_option_id: 'option-2',
      comparison: 'Vue wins on iteration speed.',
      objections: [],
      missing_evidence: [],
      tradeoff_question: 'Speed vs hiring?',
      confidence: 'high',
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'pick framework': Vue is recommended.",
      // No decision_verdict — recommendation is in but operator has not decided.
      verdict_snapshot: {
        tournament_review_verdict: 'recommend',
        selected_option_id: 'option-2',
        objection_count: 0,
        missing_evidence_count: 0,
      },
      evidence_links: [
        {
          report_id: 'explore.decision-options',
          path: 'reports/decision-options.json',
          schema: 'explore.decision-options@v1',
        },
        {
          report_id: 'explore.tournament-review',
          path: 'reports/tournament-review.json',
          schema: 'explore.tournament-review@v1',
        },
      ],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    expect(written.htmlPath).toBeUndefined();
    expect(existsSync(join(runFolder, 'reports', 'operator-summary.html'))).toBe(false);
    expect(written.summary.report_paths.map((report) => report.label)).not.toContain(
      'Operator summary (HTML)',
    );
  });

  it('degrades to markdown-only when HTML write fails (does not promise a missing file)', () => {
    writeReport('reports/decision-options.json', {
      decision_question: 'Which framework should we pick?',
      recommendation_basis: 'tournament-aggregate@v1 + tournament-review@v1',
      options: [
        {
          id: 'option-1',
          label: 'React',
          summary: 'Mature.',
          best_case_prompt: 'Bootstrap React.',
          evidence_refs: ['reports/analysis.json#aspect-react'],
          tradeoffs: ['Larger surface'],
        },
        {
          id: 'option-2',
          label: 'Vue',
          summary: 'Smaller.',
          best_case_prompt: 'Bootstrap Vue.',
          evidence_refs: ['reports/analysis.json#aspect-vue'],
          tradeoffs: ['Thinner ecosystem'],
        },
      ],
    });
    writeReport('reports/tournament-review.json', {
      verdict: 'recommend',
      recommended_option_id: 'option-2',
      comparison: 'Vue wins.',
      objections: [],
      missing_evidence: [],
      tradeoff_question: 'Speed vs hiring?',
      confidence: 'high',
    });
    writeReport('reports/decision.json', {
      verdict: 'decided',
      decision_question: 'Which framework should we pick?',
      selected_option_id: 'option-2',
      selected_option_label: 'Vue',
      decision: 'Choose Vue.',
      rationale: 'Faster path.',
      rejected_options: [{ option_id: 'option-1', reason: 'Slower.' }],
      evidence_links: ['reports/decision-options.json'],
      assumptions: ['Team can learn Vue.'],
      residual_risks: ['Hiring familiarity may be thinner.'],
      next_action: 'Run a Build plan.',
      follow_up_workflow: 'Build',
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'pick framework': Vue.",
      verdict_snapshot: {
        decision_verdict: 'decided',
        tournament_review_verdict: 'recommend',
        selected_option_id: 'option-2',
        objection_count: 0,
        missing_evidence_count: 0,
      },
      evidence_links: [
        {
          report_id: 'explore.decision-options',
          path: 'reports/decision-options.json',
          schema: 'explore.decision-options@v1',
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
    // Force HTML write to fail by occupying the target path with a directory.
    mkdirSync(join(runFolder, 'reports', 'operator-summary.html'), { recursive: true });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    expect(written.htmlPath).toBeUndefined();
    expect(written.summary.report_paths.map((report) => report.label)).not.toContain(
      'Operator summary (HTML)',
    );
    expect(existsSync(written.jsonPath)).toBe(true);
    expect(existsSync(written.markdownPath)).toBe(true);
    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdown).not.toContain('Rich summary:');
    // Operator must see a signal that HTML was attempted and failed; otherwise
    // a transient disk problem looks indistinguishable from "this flow does
    // not produce HTML."
    expect(written.summary.evidence_warnings).toContainEqual(
      expect.objectContaining({ kind: 'html_write_failed' }),
    );
    expect(markdown).toContain('html_write_failed');
    // The pre-existing directory at the target path was cleaned up so the
    // envelope can never claim a path that does not point at a valid file.
    expect(existsSync(join(runFolder, 'reports', 'operator-summary.html'))).toBe(false);
  });

  it('removes a stale HTML file when a re-run no longer produces a typed payload', () => {
    // Simulate: an earlier successful tournament emitted operator-summary.html
    // in this run folder. A subsequent rewrite (e.g. resume into a non-decided
    // state) must NOT leave the prior HTML on disk — operators may have
    // bookmarked or scrolled to that path and would otherwise open stale data.
    const stalePath = join(runFolder, 'reports', 'operator-summary.html');
    writeFileSync(stalePath, '<!doctype html><body>stale tournament summary</body>');

    writeReport('reports/explore-result.json', {
      summary: "Explore 'compose path': recommendation ready.",
      verdict_snapshot: {
        compose_verdict: 'ready',
        review_verdict: 'accept',
        objection_count: 0,
        missed_angle_count: 0,
      },
      evidence_links: [],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    expect(written.htmlPath).toBeUndefined();
    expect(existsSync(stalePath)).toBe(false);
  });

  it('does not abort the close when an evidence_link path is malformed', () => {
    // Regression: evidence_links[].path is not Zod-validated. A malformed
    // path (traversal, absolute, symlinked) used to throw inside
    // resolveRunRelative and abort the entire run close after JSON+MD had
    // already been written elsewhere. The writer must degrade silently.
    writeReport('reports/decision-options.json', {
      decision_question: 'Pick one.',
      recommendation_basis: 'tournament-aggregate@v1 + tournament-review@v1',
      options: [
        {
          id: 'option-1',
          label: 'A',
          summary: 'a',
          best_case_prompt: 'a',
          evidence_refs: ['x'],
          tradeoffs: ['t'],
        },
        {
          id: 'option-2',
          label: 'B',
          summary: 'b',
          best_case_prompt: 'b',
          evidence_refs: ['y'],
          tradeoffs: ['t'],
        },
      ],
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'pick': decided.",
      verdict_snapshot: {
        decision_verdict: 'decided',
        tournament_review_verdict: 'recommend',
        selected_option_id: 'option-2',
        objection_count: 0,
        missing_evidence_count: 0,
      },
      evidence_links: [
        {
          report_id: 'explore.decision-options',
          path: '../../etc/passwd',
          schema: 'explore.decision-options@v1',
        },
      ],
    });

    expect(() =>
      writeOperatorSummary({
        runFolder,
        runResult: baseResult('explore'),
        route: { selectedFlow: 'explore' },
      }),
    ).not.toThrow();
  });

  it('strips bidi overrides and C0 controls from option labels in the rendered HTML', () => {
    // Adversarial input: a U+202E (RTL override) in an option label flips
    // the visible order of subsequent text in the operator's browser. The
    // operator could be deceived about which option they are picking.
    const rtlLabel = 'safe‮gnp.exe';
    writeReport('reports/decision-options.json', {
      decision_question: 'Pick one.',
      recommendation_basis: 'tournament-aggregate@v1 + tournament-review@v1',
      options: [
        {
          id: 'option-1',
          label: rtlLabel,
          summary: 'a',
          best_case_prompt: 'a',
          evidence_refs: ['x'],
          tradeoffs: ['t'],
        },
        {
          id: 'option-2',
          label: 'B',
          summary: 'b',
          best_case_prompt: 'b',
          evidence_refs: ['y'],
          tradeoffs: ['t'],
        },
      ],
    });
    writeReport('reports/tournament-review.json', {
      verdict: 'recommend',
      recommended_option_id: 'option-2',
      comparison: 'B wins.',
      objections: [],
      missing_evidence: [],
      tradeoff_question: '?',
      confidence: 'high',
    });
    writeReport('reports/decision.json', {
      verdict: 'decided',
      decision_question: 'Pick one.',
      selected_option_id: 'option-2',
      selected_option_label: 'B',
      decision: 'Choose B.',
      rationale: 'Better.',
      rejected_options: [{ option_id: 'option-1', reason: 'No.' }],
      evidence_links: ['reports/decision-options.json'],
      assumptions: [],
      residual_risks: [],
      next_action: 'Build B.',
      follow_up_workflow: 'Build',
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'pick': decided.",
      verdict_snapshot: {
        decision_verdict: 'decided',
        tournament_review_verdict: 'recommend',
        selected_option_id: 'option-2',
        objection_count: 0,
        missing_evidence_count: 0,
      },
      evidence_links: [
        {
          report_id: 'explore.decision-options',
          path: 'reports/decision-options.json',
          schema: 'explore.decision-options@v1',
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

    expect(written.htmlPath).toBeDefined();
    const html = readFileSync(written.htmlPath as string, 'utf8');
    expect(html).not.toContain('‮');
    // The label is rendered with the override stripped (visible ASCII intact).
    expect(html).toContain('safegnp.exe');
  });

  it('truncates oversized tradeoff bullets so a runaway model output does not produce multi-MB HTML', () => {
    const oversized = 'A'.repeat(8192);
    writeReport('reports/decision-options.json', {
      decision_question: 'Pick.',
      recommendation_basis: 'tournament-aggregate@v1 + tournament-review@v1',
      options: [
        {
          id: 'option-1',
          label: 'A',
          summary: 'a',
          best_case_prompt: 'a',
          evidence_refs: ['x'],
          tradeoffs: [oversized],
        },
        {
          id: 'option-2',
          label: 'B',
          summary: 'b',
          best_case_prompt: 'b',
          evidence_refs: ['y'],
          tradeoffs: ['t'],
        },
      ],
    });
    writeReport('reports/tournament-review.json', {
      verdict: 'recommend',
      recommended_option_id: 'option-2',
      comparison: 'B wins.',
      objections: [],
      missing_evidence: [],
      tradeoff_question: '?',
      confidence: 'high',
    });
    writeReport('reports/decision.json', {
      verdict: 'decided',
      decision_question: 'Pick.',
      selected_option_id: 'option-2',
      selected_option_label: 'B',
      decision: 'Choose B.',
      rationale: 'Better.',
      rejected_options: [{ option_id: 'option-1', reason: 'No.' }],
      evidence_links: ['reports/decision-options.json'],
      assumptions: [],
      residual_risks: [],
      next_action: 'Build B.',
      follow_up_workflow: 'Build',
    });
    writeReport('reports/explore-result.json', {
      summary: "Explore 'pick': decided.",
      verdict_snapshot: {
        decision_verdict: 'decided',
        tournament_review_verdict: 'recommend',
        selected_option_id: 'option-2',
        objection_count: 0,
        missing_evidence_count: 0,
      },
      evidence_links: [
        {
          report_id: 'explore.decision-options',
          path: 'reports/decision-options.json',
          schema: 'explore.decision-options@v1',
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

    expect(written.htmlPath).toBeDefined();
    const html = readFileSync(written.htmlPath as string, 'utf8');
    // Original tradeoff was 8192 chars; truncate caps at 4096 with ellipsis.
    expect(html).not.toContain(oversized);
    expect(html).toContain('A'.repeat(100));
    expect(html).toContain('…');
  });

  it('readPriorRoute recovers routedBy and routerReason from a previously-written summary', () => {
    writeReport('reports/explore-result.json', {
      summary: "Explore 'compose': ready.",
      verdict_snapshot: {
        compose_verdict: 'ready',
        review_verdict: 'accept',
        objection_count: 0,
        missed_angle_count: 0,
      },
      evidence_links: [],
    });
    writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: {
        selectedFlow: 'explore',
        routedBy: 'classifier',
        routerReason: 'matched explore goal',
      },
    });

    const recovered = readPriorRoute(runFolder);
    expect(recovered.routedBy).toBe('classifier');
    expect(recovered.routerReason).toBe('matched explore goal');
  });

  it('readPriorRoute returns empty when no prior summary exists', () => {
    const recovered = readPriorRoute(runFolder);
    expect(recovered.routedBy).toBeUndefined();
    expect(recovered.routerReason).toBeUndefined();
  });

  it('does not emit HTML for Explore default (compose) path', () => {
    writeReport('reports/explore-result.json', {
      summary: "Explore 'compose path': recommendation ready.",
      verdict_snapshot: {
        compose_verdict: 'ready',
        review_verdict: 'accept',
        objection_count: 0,
        missed_angle_count: 0,
      },
      evidence_links: [
        { report_id: 'explore.brief', path: 'reports/brief.json', schema: 'explore.brief@v1' },
      ],
    });

    const written = writeOperatorSummary({
      runFolder,
      runResult: baseResult('explore'),
      route: { selectedFlow: 'explore' },
    });

    expect(written.htmlPath).toBeUndefined();
    expect(written.summary.report_paths.map((report) => report.label)).not.toContain(
      'Operator summary (HTML)',
    );
    const markdown = readFileSync(written.markdownPath, 'utf8');
    expect(markdown).not.toContain('Rich summary:');
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

    expect(written.summary.headline).toBe('Circuit: Run aborted.');
    expect(written.summary.details).toContain(
      'Abort reason: relay result failed schema validation',
    );
    expect(readFileSync(written.markdownPath, 'utf8')).toContain(
      'relay result failed schema validation',
    );
  });
});
