import { describe, expect, it } from 'vitest';

import { ROUTABLE_WORKFLOWS, classifyCompiledFlowTask } from '../../src/flows/router.js';

describe('flow router classifier', () => {
  it('declares the current routable flow set explicitly', () => {
    // Order is incidental — the router's evaluation order comes from
    // each package's routing.order, not from this array. Asserting set
    // membership keeps the test stable across catalog reordering.
    expect([...ROUTABLE_WORKFLOWS].sort()).toEqual(['build', 'explore', 'fix', 'review'].sort());
  });

  it('routes review/audit-style tasks to the review flow', () => {
    const cases = [
      'review this patch for safety regressions',
      'review the current uncommitted Circuit Codex host surface changes and report any correctness issues',
      'review the current changes for correctness issues',
      'please audit the command wiring',
      'critique this transition plan',
      'inspect this diff',
      'check this PR before merge',
      'look for bugs in the runner change',
      'find an issue in this codebase',
      'surface any issues or opportunities',
      'identify bugs in this repo',
      'look for regressions in the runner',
    ];

    for (const task of cases) {
      const decision = classifyCompiledFlowTask(task);
      expect(decision.flowName, task).toBe('review');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeDefined();
    }
  });

  it('routes fix-like tasks to the fix flow', () => {
    const cases = [
      'fix the foo bug',
      'fix: handle the missing token edge case',
      'please fix the auth regression',
      'patch the leaking handler',
      'debug the flaky integration test',
      'diagnose the failing build',
      'reproduce the missing-token crash',
      'buggyAdd subtracts instead of adds, fix it',
    ];

    for (const task of cases) {
      const decision = classifyCompiledFlowTask(task);
      expect(decision.flowName, task).toBe('fix');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeDefined();
    }
  });

  it('infers Fix thoroughness from bug-fix intent when the user did not provide a mode', () => {
    const bare = classifyCompiledFlowTask('fix: handle the missing token edge case');
    expect(bare.flowName).toBe('fix');
    expect(bare.inferredEntryModeName).toBeUndefined();
    expect(bare.inferredEntryModeReason).toBeUndefined();

    const quick = classifyCompiledFlowTask('quick fix: handle the missing token edge case');
    expect(quick.flowName).toBe('fix');
    expect(quick.inferredEntryModeName).toBe('lite');
    expect(quick.inferredEntryModeReason).toMatch(/quick/i);

    const regression = classifyCompiledFlowTask('fix: please fix the auth regression');
    expect(regression.flowName).toBe('fix');
    expect(regression.inferredEntryModeName).toBe('deep');
    expect(regression.inferredEntryModeReason).toMatch(/regression/i);

    const seriousQuick = classifyCompiledFlowTask('quick fix: diagnose the crash on launch');
    expect(seriousQuick.flowName).toBe('fix');
    expect(seriousQuick.inferredEntryModeName).toBe('deep');
    expect(seriousQuick.inferredEntryModeReason).toMatch(/diagnose|crash/i);

    const flaky = classifyCompiledFlowTask('debug the flaky integration test');
    expect(flaky.flowName).toBe('fix');
    expect(flaky.inferredEntryModeName).toBe('deep');
    expect(flaky.inferredEntryModeReason).toMatch(/flaky/i);
  });

  it('keeps review-style fix-mention goals on review, not fix', () => {
    const cases = [
      'audit this bug fix before merge',
      'find any regressions in the patch',
      'critique the regression repro plan',
    ];

    for (const task of cases) {
      const decision = classifyCompiledFlowTask(task);
      expect(decision.flowName, task).toBe('review');
    }
  });

  it('keeps build-style fix-mention goals on build, not fix', () => {
    const cases = ['build a fix for the auth bug', 'implement the fix for the regression'];

    for (const task of cases) {
      const decision = classifyCompiledFlowTask(task);
      expect(decision.flowName, task).toBe('build');
    }
  });

  it('keeps fix-prefixed planning goals on explore via planning-report suppression', () => {
    const cases = ['fix: write a postmortem report', 'diagnose the outage and produce an analysis'];

    for (const task of cases) {
      const decision = classifyCompiledFlowTask(task);
      expect(decision.flowName, task).toBe('explore');
    }
  });

  it('routes build-like tasks to the build flow', () => {
    const cases = [
      'develop: add a focused feature',
      'build a feature for the plugin command surface',
      'implement the command wiring',
      'create a new endpoint',
      'make the focused change',
      'please build a tool for plugin checks',
      'Add the missing titleCase helper in strings.js so npm run check passes.',
      'implement the missing isEven export so tests pass',
      'create the missing parser function and get verification green',
    ];

    for (const task of cases) {
      const decision = classifyCompiledFlowTask(task);
      expect(decision.flowName, task).toBe('build');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeDefined();
    }
  });

  it('infers parity entry modes for routed intent prefixes', () => {
    const develop = classifyCompiledFlowTask('develop: add SSO flow');
    expect(develop.flowName).toBe('build');
    expect(develop.inferredEntryModeName).toBe('default');
    expect(develop.inferredEntryModeReason).toMatch(/develop/i);

    const decide = classifyCompiledFlowTask('decide: choose the rollout strategy');
    expect(decide.flowName).toBe('explore');
    expect(decide.reason).toMatch(/decide/i);
    expect(decide.inferredEntryModeName).toBe('tournament');
    expect(decide.inferredEntryModeReason).toMatch(/decide/i);
  });

  it('routes plan-execution requests into executable work instead of analysis-only Explore', () => {
    const general = classifyCompiledFlowTask(
      'Execute this plan: ./docs/specs/headless-engine-host-api-v1.md',
    );
    expect(general.flowName).toBe('build');
    expect(general.matched_signal).toBe('plan-execution');
    expect(general.inferredEntryModeName).toBe('default');
    expect(general.reason).toMatch(/first executable slice/i);

    const fix = classifyCompiledFlowTask('Execute this bug fix plan: diagnose the flaky test');
    expect(fix.flowName).toBe('fix');
    expect(fix.inferredEntryModeName).toBe('deep');

    const decision = classifyCompiledFlowTask('Execute this decision plan: choose React vs Vue');
    expect(decision.flowName).toBe('explore');
    expect(decision.inferredEntryModeName).toBe('tournament');
  });

  it('falls back to explore when no routed flow signal is present', () => {
    const cases = [
      'figure out how the connector pipeline fits together',
      'investigate options for a build flow',
      'map the current project state',
      'review possible approaches for the next flow',
      'inspect the project structure',
      'find options for a build flow',
      'find issue #123 in the tracker',
      'evaluate our Codex integration and grade it on a scale of 100',
      'investigate whether to create a new endpoint',
      'explore whether we should implement the command wiring',
      'map options before we add a new integration',
      'build a tool evaluation matrix for parser libraries',
      'create a new endpoint proposal for the auth API',
      'implement the command wiring design doc',
      'implement the command wiring specification',
      'create a new endpoint RFC',
      'build a tool selection memo',
      'develop: create a new endpoint RFC',
      'develop: build a tool selection memo',
    ];

    for (const task of cases) {
      const decision = classifyCompiledFlowTask(task);
      expect(decision.flowName, task).toBe('explore');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeUndefined();
    }
  });
});
