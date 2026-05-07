import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../../src/cli/circuit.js';
import { CUSTOM_FLOW_ROOT_RUNTIME_POLICY } from '../../src/cli/runtime-compatibility-policy.js';
import { CompiledFlow, ContinuityIndex, ContinuityRecord } from '../../src/index.js';
import { RETIRED_RUNTIME_RUN_FOLDER_MESSAGE } from '../../src/shared/retired-runtime-policy.js';

const tempRoots: string[] = [];

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

async function captureMain(
  argv: readonly string[],
  options: Parameters<typeof main>[1] = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const code = await main(argv, options);
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('utility CLI commands', () => {
  it('creates, validates, and publishes a custom flow package', async () => {
    const home = tempRoot('circuit-create-');
    const result = await captureMain(
      [
        'create',
        '--name',
        'release-note-flow',
        '--description',
        'Draft release notes from a change summary',
        '--home',
        home,
        '--template-flow-root',
        resolve('generated/flows'),
        '--publish',
        '--yes',
        '--created-at',
        '2026-04-29T23:00:00.000Z',
      ],
      { now: () => new Date('2026-04-29T23:00:00.000Z') },
    );

    expect(result.code, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as {
      status: string;
      slug: string;
      flow_path: string;
      manifest_path: string;
      operator_summary_markdown_path: string;
    };
    expect(output).toMatchObject({ status: 'published', slug: 'release-note-flow' });
    expect(existsSync(output.operator_summary_markdown_path)).toBe(true);
    const summary = readFileSync(output.operator_summary_markdown_path, 'utf8');
    expect(summary).toContain(CUSTOM_FLOW_ROOT_RUNTIME_POLICY);
    expect(existsSync(join(home, 'skills/release-note-flow/SKILL.md'))).toBe(true);
    expect(existsSync(join(home, 'skills/release-note-flow/circuit.yaml'))).toBe(true);
    expect(existsSync(join(home, 'commands/release-note-flow.md'))).toBe(true);
    expect(CompiledFlow.parse(JSON.parse(readFileSync(output.flow_path, 'utf8'))).id).toBe(
      'release-note-flow',
    );
    const manifest = JSON.parse(readFileSync(output.manifest_path, 'utf8')) as {
      custom_flows: Array<{ id: string }>;
    };
    expect(manifest.custom_flows.map((flow) => flow.id)).toEqual(['release-note-flow']);
  });

  it('publishes reviewed draft contents without regenerating the draft', async () => {
    const home = tempRoot('circuit-create-reviewed-draft-');
    const draft = await captureMain([
      'create',
      '--name',
      'release-note-flow',
      '--description',
      'Draft release notes from a change summary',
      '--home',
      home,
      '--template-flow-root',
      resolve('generated/flows'),
    ]);

    expect(draft.code, draft.stderr).toBe(0);
    const drafted = JSON.parse(draft.stdout) as { draft_path: string };
    const draftFlowPath = join(drafted.draft_path, 'circuit.json');
    const draftFlow = JSON.parse(readFileSync(draftFlowPath, 'utf8'));
    draftFlow.purpose = 'Operator-reviewed release note flow';
    writeFileSync(draftFlowPath, `${JSON.stringify(draftFlow, null, 2)}\n`);
    writeFileSync(
      join(drafted.draft_path, 'command.md'),
      '# Reviewed command\n\ncustom draft command\n',
    );

    const publish = await captureMain([
      'create',
      '--name',
      'release-note-flow',
      '--description',
      'Publish-time description that should not override the reviewed draft',
      '--home',
      home,
      '--publish',
      '--yes',
      '--created-at',
      '2026-04-29T23:00:00.000Z',
    ]);

    expect(publish.code, publish.stderr).toBe(0);
    const published = JSON.parse(publish.stdout) as {
      flow_path: string;
      command_path: string;
      manifest_path: string;
      operator_summary_markdown_path: string;
    };
    expect(CompiledFlow.parse(JSON.parse(readFileSync(published.flow_path, 'utf8'))).purpose).toBe(
      'Operator-reviewed release note flow',
    );
    expect(readFileSync(published.command_path, 'utf8')).toContain('custom draft command');
    expect(
      (
        JSON.parse(readFileSync(published.manifest_path, 'utf8')) as {
          custom_flows: Array<{ id: string; description: string }>;
        }
      ).custom_flows[0],
    ).toMatchObject({
      id: 'release-note-flow',
      description: 'Operator-reviewed release note flow',
    });
    expect(readFileSync(published.operator_summary_markdown_path, 'utf8')).toContain(
      'Operator-reviewed release note flow',
    );
    expect(readFileSync(published.operator_summary_markdown_path, 'utf8')).not.toContain(
      'Publish-time description',
    );
    expect(
      JSON.parse(readFileSync(join(drafted.draft_path, 'validation-result.json'), 'utf8')),
    ).toMatchObject({ source: 'draft' });
  });

  it('requires explicit confirmation before publishing a custom flow', async () => {
    const home = tempRoot('circuit-create-no-yes-');
    const result = await captureMain([
      'create',
      '--name',
      'release-note-flow',
      '--description',
      'Draft release notes',
      '--home',
      home,
      '--template-flow-root',
      resolve('generated/flows'),
      '--publish',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--publish requires --yes');
  });

  it('saves, resumes, and clears standalone continuity', async () => {
    const controlPlane = tempRoot('circuit-handoff-');
    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume release work',
      '--next',
      'DO: continue the parity matrix',
      '--state-markdown',
      '- release truth is current',
      '--debt-markdown',
      '- CONSTRAINT: keep claims generated',
      '--control-plane',
      controlPlane,
      '--record-id',
      'continuity-11111111-1111-4111-8111-111111111111',
      '--created-at',
      '2026-04-29T23:10:00.000Z',
    ]);

    expect(save.code, save.stderr).toBe(0);
    const saved = JSON.parse(save.stdout) as { continuity_path: string; index_path: string };
    expect(
      ContinuityRecord.parse(JSON.parse(readFileSync(saved.continuity_path, 'utf8'))),
    ).toMatchObject({
      continuity_kind: 'standalone',
      narrative: { next: 'DO: continue the parity matrix' },
    });
    expect(
      ContinuityIndex.parse(JSON.parse(readFileSync(saved.index_path, 'utf8'))).pending_record
        ?.record_id,
    ).toBe('continuity-11111111-1111-4111-8111-111111111111');

    const resume = await captureMain(['handoff', 'resume', '--control-plane', controlPlane]);
    expect(resume.code, resume.stderr).toBe(0);
    expect(JSON.parse(resume.stdout)).toMatchObject({
      status: 'resumed',
      source: 'pending_record',
    });

    const done = await captureMain(['handoff', 'done', '--control-plane', controlPlane]);
    expect(done.code, done.stderr).toBe(0);
    expect(
      ContinuityIndex.parse(JSON.parse(readFileSync(saved.index_path, 'utf8'))).pending_record,
    ).toBeNull();
  });

  it('renders a read-only handoff brief for host injection', async () => {
    const projectRoot = tempRoot('circuit-handoff-brief-project-');
    const controlPlane = join(projectRoot, '.circuit-next');
    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume release work',
      '--next',
      'continue the parity matrix',
      '--state-markdown',
      '- release truth is current',
      '--debt-markdown',
      '- keep claims generated',
      '--project-root',
      projectRoot,
      '--record-id',
      'continuity-33333333-3333-4333-8333-333333333333',
      '--created-at',
      '2026-04-29T23:12:00.000Z',
    ]);
    expect(save.code, save.stderr).toBe(0);
    const saved = JSON.parse(save.stdout) as { continuity_path: string; index_path: string };
    const indexBefore = readFileSync(saved.index_path, 'utf8');
    const recordBefore = readFileSync(saved.continuity_path, 'utf8');

    const brief = await captureMain(['handoff', 'brief', '--json', '--project-root', projectRoot]);

    expect(brief.code, brief.stderr).toBe(0);
    const output = JSON.parse(brief.stdout) as {
      api_version: string;
      status: string;
      record_id: string;
      additional_context: string;
    };
    expect(output).toMatchObject({
      api_version: 'handoff-brief-v1',
      status: 'available',
      record_id: 'continuity-33333333-3333-4333-8333-333333333333',
    });
    expect(output.additional_context).toContain('Circuit handoff is present for this repo.');
    expect(output.additional_context).toContain('Goal: Resume release work');
    expect(output.additional_context).toContain('Next: continue the parity matrix');
    expect(output.additional_context).toContain(
      'Boundary: Use this as context only. Do not continue unless the user asks.',
    );
    expect(output.additional_context.length).toBeLessThanOrEqual(3000);
    expect(readFileSync(saved.index_path, 'utf8')).toBe(indexBefore);
    expect(readFileSync(saved.continuity_path, 'utf8')).toBe(recordBefore);
    expect(existsSync(join(controlPlane, 'continuity/reports/brief-result.json'))).toBe(false);
  });

  it('keeps required handoff brief framing when narrative details are truncated', async () => {
    const projectRoot = tempRoot('circuit-handoff-brief-truncated-');
    const longState = `- ${'state '.repeat(700)}`;
    const longDebt = `- ${'debt '.repeat(700)}`;
    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume release work',
      '--next',
      'continue the parity matrix',
      '--state-markdown',
      longState,
      '--debt-markdown',
      longDebt,
      '--project-root',
      projectRoot,
      '--record-id',
      'continuity-44444444-4444-4444-8444-444444444444',
      '--created-at',
      '2026-04-29T23:13:00.000Z',
    ]);
    expect(save.code, save.stderr).toBe(0);

    const brief = await captureMain(['handoff', 'brief', '--json', '--project-root', projectRoot]);

    expect(brief.code, brief.stderr).toBe(0);
    const output = JSON.parse(brief.stdout) as {
      status: string;
      additional_context: string;
    };
    expect(output.status).toBe('available');
    expect(output.additional_context.length).toBeLessThanOrEqual(3000);
    expect(output.additional_context).toContain('Goal: Resume release work');
    expect(output.additional_context).toContain('Next: continue the parity matrix');
    expect(output.additional_context).toContain('[truncated]');
    expect(output.additional_context).toContain(
      'Boundary: Use this as context only. Do not continue unless the user asks.',
    );
  });

  it('returns invalid instead of dropping required handoff brief framing', async () => {
    const projectRoot = tempRoot('circuit-handoff-brief-too-large-');
    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume release work',
      '--next',
      'N'.repeat(4000),
      '--state-markdown',
      '- release truth is current',
      '--debt-markdown',
      '- keep claims generated',
      '--project-root',
      projectRoot,
      '--record-id',
      'continuity-55555555-5555-4555-8555-555555555555',
      '--created-at',
      '2026-04-29T23:14:00.000Z',
    ]);
    expect(save.code, save.stderr).toBe(0);

    const brief = await captureMain(['handoff', 'brief', '--json', '--project-root', projectRoot]);

    expect(brief.code, brief.stderr).toBe(0);
    expect(JSON.parse(brief.stdout)).toMatchObject({
      api_version: 'handoff-brief-v1',
      status: 'invalid',
      record_id: 'continuity-55555555-5555-4555-8555-555555555555',
      error: { code: 'brief_too_large' },
    });
  });

  it('returns empty for missing or cleared handoff state without writing files', async () => {
    const projectRoot = tempRoot('circuit-handoff-brief-empty-');

    const missing = await captureMain([
      'handoff',
      'brief',
      '--json',
      '--project-root',
      projectRoot,
    ]);
    expect(missing.code, missing.stderr).toBe(0);
    expect(JSON.parse(missing.stdout)).toMatchObject({
      api_version: 'handoff-brief-v1',
      status: 'empty',
      reason: 'no_index',
    });
    expect(existsSync(join(projectRoot, '.circuit-next'))).toBe(false);

    const done = await captureMain(['handoff', 'done', '--project-root', projectRoot]);
    expect(done.code, done.stderr).toBe(0);

    const cleared = await captureMain([
      'handoff',
      'brief',
      '--json',
      '--project-root',
      projectRoot,
    ]);
    expect(cleared.code, cleared.stderr).toBe(0);
    expect(JSON.parse(cleared.stdout)).toMatchObject({
      status: 'empty',
      reason: 'no_pending_record',
    });
  });

  it('returns invalid for corrupt or dangling handoff state', async () => {
    const projectRoot = tempRoot('circuit-handoff-brief-invalid-');
    const controlPlane = join(projectRoot, '.circuit-next');
    const continuityRoot = join(controlPlane, 'continuity');
    mkdirSync(continuityRoot, { recursive: true });
    writeFileSync(join(continuityRoot, 'index.json'), '{not-json');

    const corruptIndex = await captureMain([
      'handoff',
      'brief',
      '--json',
      '--project-root',
      projectRoot,
    ]);
    expect(corruptIndex.code, corruptIndex.stderr).toBe(0);
    expect(JSON.parse(corruptIndex.stdout)).toMatchObject({
      status: 'invalid',
      error: { code: 'index_invalid' },
    });

    writeFileSync(
      join(continuityRoot, 'index.json'),
      `${JSON.stringify(
        {
          schema_version: 1,
          project_root: projectRoot,
          pending_record: {
            record_id: 'continuity-missing',
            continuity_kind: 'standalone',
            created_at: '2026-04-29T23:12:00.000Z',
          },
          current_run: null,
        },
        null,
        2,
      )}\n`,
    );

    const missingRecord = await captureMain([
      'handoff',
      'brief',
      '--json',
      '--project-root',
      projectRoot,
    ]);
    expect(missingRecord.code, missingRecord.stderr).toBe(0);
    expect(JSON.parse(missingRecord.stdout)).toMatchObject({
      status: 'invalid',
      record_id: 'continuity-missing',
      error: { code: 'record_missing' },
    });

    mkdirSync(join(continuityRoot, 'records'), { recursive: true });
    writeFileSync(join(continuityRoot, 'records/continuity-missing.json'), '{not-json');
    const corruptRecord = await captureMain([
      'handoff',
      'brief',
      '--json',
      '--project-root',
      projectRoot,
    ]);
    expect(corruptRecord.code, corruptRecord.stderr).toBe(0);
    expect(JSON.parse(corruptRecord.stdout)).toMatchObject({
      status: 'invalid',
      record_id: 'continuity-missing',
      error: { code: 'record_invalid' },
    });
  });

  it('requires --json for handoff brief', async () => {
    const result = await captureMain(['handoff', 'brief']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('handoff brief requires --json');
  });

  it('installs and removes the Codex user-level handoff hook without clobbering existing hooks', async () => {
    const root = tempRoot('circuit-handoff-hooks-');
    const hooksFile = join(root, 'codex/hooks.json');
    const launcher = join(root, 'bin/circuit-next');
    mkdirSync(join(root, 'codex'), { recursive: true });
    mkdirSync(join(root, 'bin'), { recursive: true });
    writeFileSync(launcher, '#!/usr/bin/env node\n');
    writeFileSync(
      hooksFile,
      `${JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: 'startup',
                hooks: [{ type: 'command', command: 'echo existing-hook' }],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
    );

    const install = await captureMain([
      'handoff',
      'hooks',
      'install',
      '--host',
      'codex',
      '--hooks-file',
      hooksFile,
      '--launcher',
      launcher,
    ]);

    expect(install.code, install.stderr).toBe(0);
    const installed = JSON.parse(install.stdout) as {
      status: string;
      backup_path: string;
      command: string;
    };
    expect(installed.status).toBe('installed');
    expect(installed.command).toContain('handoff hook --host codex');
    expect(existsSync(installed.backup_path)).toBe(true);
    const configAfterInstall = JSON.parse(readFileSync(hooksFile, 'utf8')) as {
      hooks: { SessionStart: Array<{ matcher: string; hooks: Array<{ command: string }> }> };
    };
    expect(configAfterInstall.hooks.SessionStart).toHaveLength(2);
    expect(configAfterInstall.hooks.SessionStart[1]?.matcher).toBe('startup|resume|clear');
    expect(JSON.stringify(configAfterInstall)).toContain('echo existing-hook');
    expect(JSON.stringify(configAfterInstall)).toContain('handoff hook --host codex');

    const secondInstall = await captureMain([
      'handoff',
      'hooks',
      'install',
      '--host',
      'codex',
      '--hooks-file',
      hooksFile,
      '--launcher',
      launcher,
    ]);
    expect(secondInstall.code, secondInstall.stderr).toBe(0);
    expect(JSON.parse(secondInstall.stdout)).toMatchObject({ status: 'already_installed' });
    const configAfterSecondInstall = JSON.parse(readFileSync(hooksFile, 'utf8')) as {
      hooks: { SessionStart: unknown[] };
    };
    expect(
      configAfterSecondInstall.hooks.SessionStart.filter((entry) =>
        JSON.stringify(entry).includes('handoff hook --host codex'),
      ),
    ).toHaveLength(1);

    const doctor = await captureMain([
      'handoff',
      'hooks',
      'doctor',
      '--host',
      'codex',
      '--hooks-file',
      hooksFile,
    ]);
    expect(doctor.code, doctor.stderr).toBe(0);
    expect(JSON.parse(doctor.stdout)).toMatchObject({ status: 'ok' });

    const uninstall = await captureMain([
      'handoff',
      'hooks',
      'uninstall',
      '--host',
      'codex',
      '--hooks-file',
      hooksFile,
    ]);
    expect(uninstall.code, uninstall.stderr).toBe(0);
    expect(JSON.parse(uninstall.stdout)).toMatchObject({ status: 'uninstalled' });
    const configAfterUninstall = JSON.parse(readFileSync(hooksFile, 'utf8')) as {
      hooks: { SessionStart: unknown[] };
    };
    expect(JSON.stringify(configAfterUninstall)).toContain('echo existing-hook');
    expect(JSON.stringify(configAfterUninstall)).not.toContain('handoff hook --host codex');
  });

  it('marks an installed Codex handoff hook invalid when the launcher is missing', async () => {
    const root = tempRoot('circuit-handoff-hooks-stale-launcher-');
    const hooksFile = join(root, 'codex/hooks.json');
    const launcher = join(root, 'bin/circuit-next');
    mkdirSync(join(root, 'bin'), { recursive: true });
    writeFileSync(launcher, '#!/usr/bin/env node\n');

    const install = await captureMain([
      'handoff',
      'hooks',
      'install',
      '--host',
      'codex',
      '--hooks-file',
      hooksFile,
      '--launcher',
      launcher,
    ]);
    expect(install.code, install.stderr).toBe(0);
    rmSync(launcher, { force: true });

    const doctor = await captureMain([
      'handoff',
      'hooks',
      'doctor',
      '--host',
      'codex',
      '--hooks-file',
      hooksFile,
    ]);

    expect(doctor.code, doctor.stderr).toBe(0);
    expect(JSON.parse(doctor.stdout)).toMatchObject({
      status: 'invalid',
      checks: expect.arrayContaining([
        expect.objectContaining({
          name: 'circuit_handoff_hook_launcher_exists',
          ok: false,
        }),
      ]),
    });
  });

  it('renders Codex SessionStart JSON from the CLI hook entrypoint', async () => {
    const projectRoot = tempRoot('circuit-handoff-hook-entry-project-');
    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume release work',
      '--next',
      'continue the parity matrix',
      '--state-markdown',
      '- release truth is current',
      '--debt-markdown',
      '- keep claims generated',
      '--project-root',
      projectRoot,
      '--record-id',
      'continuity-66666666-6666-4666-8666-666666666666',
      '--created-at',
      '2026-04-29T23:15:00.000Z',
    ]);
    expect(save.code, save.stderr).toBe(0);

    const hook = await captureMain([
      'handoff',
      'hook',
      '--host',
      'codex',
      '--project-root',
      projectRoot,
    ]);

    expect(hook.code, hook.stderr).toBe(0);
    const output = JSON.parse(hook.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain(
      'Circuit handoff is present for this repo.',
    );
    expect(output.hookSpecificOutput.additionalContext).toContain(
      'Boundary: Use this as context only. Do not continue unless the user asks.',
    );

    const emptyProjectRoot = tempRoot('circuit-handoff-hook-entry-empty-');
    const empty = await captureMain([
      'handoff',
      'hook',
      '--host',
      'codex',
      '--project-root',
      emptyProjectRoot,
    ]);
    expect(empty.code, empty.stderr).toBe(0);
    expect(empty.stdout).toBe('');
  });

  it('can bind handoff continuity to a core-v2 waiting run and write active-run output', async () => {
    const root = tempRoot('circuit-handoff-run-');
    const runFolder = join(root, 'run');
    const controlPlane = join(root, 'control-plane');
    const run = await captureMain(
      [
        'run',
        'build',
        '--goal',
        'deep change that asks for scope',
        '--entry-mode',
        'deep',
        '--run-folder',
        runFolder,
      ],
      {
        runId: '55555555-5555-4555-8555-555555555555',
        now: () => new Date('2026-04-29T23:20:00.000Z'),
      },
    );
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ outcome: 'checkpoint_waiting' });

    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume waiting Build run',
      '--next',
      'DO: resolve the Build checkpoint',
      '--state-markdown',
      '- checkpoint is waiting',
      '--debt-markdown',
      '- BLOCKED: needs checkpoint choice',
      '--run-folder',
      runFolder,
      '--control-plane',
      controlPlane,
      '--record-id',
      'continuity-22222222-2222-4222-8222-222222222222',
      '--created-at',
      '2026-04-29T23:21:00.000Z',
    ]);

    expect(save.code, save.stderr).toBe(0);
    const output = JSON.parse(save.stdout) as { continuity_path: string; active_run_path: string };
    const record = ContinuityRecord.parse(JSON.parse(readFileSync(output.continuity_path, 'utf8')));
    expect(record).toMatchObject({
      continuity_kind: 'run-backed',
      run_ref: { runtime_status: 'in_progress', current_step: 'frame-step' },
    });
    expect(readFileSync(output.active_run_path, 'utf8')).toContain(
      'DO: resolve the Build checkpoint',
    );
  });

  it('fails closed when binding handoff continuity to a retained waiting run', async () => {
    const root = tempRoot('circuit-handoff-retained-run-');
    const runFolder = join(root, 'run');
    const controlPlane = join(root, 'control-plane');
    const oldDisabled = process.env.CIRCUIT_DISABLE_V2_RUNTIME;
    process.env.CIRCUIT_DISABLE_V2_RUNTIME = '1';
    let run: Awaited<ReturnType<typeof captureMain>> | undefined;
    try {
      run = await captureMain(
        [
          'run',
          'build',
          '--goal',
          'retained deep change that asks for scope',
          '--entry-mode',
          'deep',
          '--run-folder',
          runFolder,
        ],
        {
          runId: '55555555-5555-4555-8555-555555555556',
          now: () => new Date('2026-04-29T23:25:00.000Z'),
        },
      );
    } finally {
      if (oldDisabled === undefined) {
        process.env.CIRCUIT_DISABLE_V2_RUNTIME = undefined;
      } else {
        process.env.CIRCUIT_DISABLE_V2_RUNTIME = oldDisabled;
      }
    }
    if (run === undefined) throw new Error('retained Build run did not execute');
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      outcome: 'checkpoint_waiting',
      runtime: 'retained',
    });

    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume retained waiting Build run',
      '--next',
      'DO: resolve the retained Build checkpoint',
      '--run-folder',
      runFolder,
      '--control-plane',
      controlPlane,
      '--record-id',
      'continuity-33333333-3333-4333-8333-333333333333',
      '--created-at',
      '2026-04-29T23:26:00.000Z',
    ]);

    expect(save.code).toBe(1);
    expect(save.stdout).toBe('');
    expect(save.stderr.trim()).toBe(`error: ${RETIRED_RUNTIME_RUN_FOLDER_MESSAGE}`);
  });

  it('fails closed for corrupted unmarked retained folders before any adapter path', async () => {
    const root = tempRoot('circuit-handoff-retained-corrupt-');
    const runFolder = join(root, 'run');
    const controlPlane = join(root, 'control-plane');
    const oldDisabled = process.env.CIRCUIT_DISABLE_V2_RUNTIME;
    process.env.CIRCUIT_DISABLE_V2_RUNTIME = '1';
    let run: Awaited<ReturnType<typeof captureMain>> | undefined;
    try {
      run = await captureMain(
        [
          'run',
          'build',
          '--goal',
          'retained deep change that will be corrupted',
          '--entry-mode',
          'deep',
          '--run-folder',
          runFolder,
        ],
        {
          runId: '55555555-5555-4555-8555-555555555557',
          now: () => new Date('2026-04-29T23:30:00.000Z'),
        },
      );
    } finally {
      if (oldDisabled === undefined) {
        process.env.CIRCUIT_DISABLE_V2_RUNTIME = undefined;
      } else {
        process.env.CIRCUIT_DISABLE_V2_RUNTIME = oldDisabled;
      }
    }
    if (run === undefined) throw new Error('retained Build run did not execute');
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ outcome: 'checkpoint_waiting' });

    writeFileSync(join(runFolder, 'trace.ndjson'), '{not-json}\n');

    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Do not project corrupted retained folder as v2',
      '--next',
      'DO: inspect the retained trace corruption',
      '--run-folder',
      runFolder,
      '--control-plane',
      controlPlane,
      '--record-id',
      'continuity-44444444-4444-4444-8444-444444444444',
      '--created-at',
      '2026-04-29T23:31:00.000Z',
    ]);

    expect(save.code).toBe(1);
    expect(save.stdout).toBe('');
    expect(save.stderr.trim()).toBe(`error: ${RETIRED_RUNTIME_RUN_FOLDER_MESSAGE}`);
  });
});
