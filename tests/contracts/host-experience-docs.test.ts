import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EnabledConnector } from '../../src/schemas/connector.js';

const REPO_ROOT = resolve(__dirname, '..', '..');

describe('host experience docs', () => {
  it('defines shared host capability slots for Codex and Claude Code', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'docs/contracts/host-capabilities.md'), 'utf8');

    for (const capability of [
      'progress',
      'task_list',
      'ask_user',
      'final_summary',
      'deep_links',
      'debug',
    ]) {
      expect(doc).toContain(`\`${capability}\``);
    }

    expect(doc).toContain('Codex');
    expect(doc).toContain('Claude Code');
    expect(doc).toContain('native');
    expect(doc).toContain('model-mediated');
    expect(doc).toContain('fallback');
    expect(doc).toContain('AskUserQuestion');
    expect(doc).toContain('TodoWrite');
    expect(doc).toContain('current roadmap');
    expect(doc).toContain('operator_summary_markdown_path');
  });

  it('keeps retired native bridge notes out of the current roadmap', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'docs/contracts/native-host-adapters.md'), 'utf8');

    expect(doc).toContain('contract: native-host-adapters');
    expect(doc).toContain('status: retired-draft');
    expect(doc).toContain('not current roadmap items');
    expect(doc).toContain('task_list.updated');
    expect(doc).toContain('user_input.requested');
    expect(doc).toContain('Claude Agent SDK');
    expect(doc).toContain('AskUserQuestion');
    expect(doc).toContain('TodoWrite');
    expect(doc).toContain('Codex App Server');
    expect(doc).toContain('tool/requestUserInput');
    expect(doc).toContain('Current Circuit host support');
  });

  it('documents the Claude presentation wrapper and Explore visible budget', () => {
    const doc = readFileSync(
      resolve(REPO_ROOT, 'docs/specs/narration-display-profiles.md'),
      'utf8',
    );

    expect(doc).toContain('Claude host commands must use a presentation wrapper');
    expect(doc).toContain('Flow profiles provide semantic atoms');
    expect(doc).toContain('structured slots');
    expect(doc).toContain('no raw JSONL');
    expect(doc).toContain('no final stdout JSON');
    expect(doc).toContain('no report section by default');
    expect(doc).toContain('max 4-6 visible final bullets');
    expect(doc).toContain('max 3 visible reviewer cautions');
    expect(doc).toContain('explicit `/circuit:explore`');
  });

  it('keeps a repeatable Codex and Claude Code host trial checklist', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'docs/host-trial-checklist.md'), 'utf8');

    expect(doc).toContain('@Circuit the checkout total is wrong when discounts and tax both apply');
    expect(doc).toContain('@Circuit please review my current diff');
    expect(doc).toContain('@Circuit add billing settings to the account page');
    expect(doc).toContain('Use Circuit to decide whether we should replace auth providers');
    expect(doc).toContain('/circuit:run <natural task>');
    expect(doc).toContain('Explicit Build');
    expect(doc).toContain('Checkpoint');
    expect(doc).toContain('Failure');
    expect(doc).toContain('Codex Scenarios');
    expect(doc).toContain('Claude Code Scenarios');
  });

  it('keeps /circuit:run host guidance aligned with model-mediated selection', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'plugins/claude/commands/run.md'), 'utf8');

    expect(doc).toContain('/circuit:run — flow selector');
    expect(doc).toContain('Select the flow before invoking the CLI');
    expect(doc).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run --goal');
    expect(doc).not.toContain('Do not classify the task yourself');
    expect(doc).toContain('Let the presentation wrapper render output');
  });

  it('teaches one natural-language front door per host in the README', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf8');
    const advancedIndex = doc.indexOf('**Advanced compatibility:**');

    expect(doc).toContain(
      '/circuit:run the checkout total is wrong when discounts and tax both apply',
    );
    expect(doc).toContain('@Circuit the checkout total is wrong when discounts and tax both apply');
    expect(doc).toMatch(/Codex can choose the best bundled Circuit flow\s+skill/);
    expect(doc).toContain('host/orchestrator behavior');
    expect(doc).toContain('worker connector behavior');
    expect(advancedIndex).toBeGreaterThan(0);

    for (const prefix of ['fix:', 'develop:', 'decide:']) {
      const firstIndex = doc.indexOf(prefix);
      expect(firstIndex).toBeGreaterThan(advancedIndex);
    }
  });

  it('keeps README connector names and custom protocol aligned with schemas and runtime', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf8');

    for (const connector of EnabledConnector.options) {
      expect(doc).toContain(`**\`${connector}\`**`);
    }
    expect(doc).not.toContain('**`agent`**');
    expect(doc).toContain('stdin is ignored');
    expect(doc).toContain('inherits the Circuit process environment');
    expect(doc).toContain('not an OS sandbox');
  });
});
