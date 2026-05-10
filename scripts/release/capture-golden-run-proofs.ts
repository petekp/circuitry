#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as CliCircuitModule from '../../src/cli/circuit.js';
import type * as ComposeModule from '../../src/runtime/executors/compose.js';

type CliMain = (typeof CliCircuitModule)['main'];
type CliMainOptions = Parameters<CliMain>[1];
type Relayer = NonNullable<NonNullable<CliMainOptions>['relayer']>;
type RelayInput = Parameters<Relayer['relay']>[0];
type RelayOutcome = Awaited<ReturnType<Relayer['relay']>>;
type RuntimeExecutorsOption = NonNullable<NonNullable<CliMainOptions>['runtimeExecutors']>;
type StepExecutor = NonNullable<RuntimeExecutorsOption[keyof RuntimeExecutorsOption]>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const proofRunsRootRel = 'docs/release/proofs/runs';
const scrubbedProjectRoot = '<repo>';
const homeDir = process.env.HOME;

const composeRuntime = (await import(
  resolve(projectRoot, 'dist/runtime/executors/compose.js')
)) as typeof ComposeModule;
const { executeCompose } = composeRuntime;

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

type StreamName = 'stdout' | 'stderr';

function captureStream(streamName: StreamName): { text: () => string; restore: () => void } {
  const stream = process[streamName];
  const originalWrite = stream.write.bind(stream);
  let captured = '';
  stream.write = ((
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    if (typeof encoding === 'function') encoding();
    if (typeof callback === 'function') callback();
    return true;
  }) as typeof stream.write;
  return {
    text: () => captured,
    restore: () => {
      stream.write = originalWrite;
    },
  };
}

async function runCli(
  argv: readonly string[],
  options: CliMainOptions,
): Promise<{ stdout: string; stderr: string }> {
  const stdout = captureStream('stdout');
  const stderr = captureStream('stderr');
  try {
    const cliModule = (await import(
      resolve(projectRoot, 'dist/cli/circuit.js')
    )) as typeof CliCircuitModule;
    const code = await cliModule.main(argv, options);
    if (code !== 0) throw new Error(`circuit CLI exited ${code}`);
    return { stdout: stdout.text(), stderr: stderr.text() };
  } finally {
    stdout.restore();
    stderr.restore();
  }
}

type PathAlias = { fromRel: string; toRel: string };

function scrubText(text: string, pathAliases: PathAlias[] = []): string {
  let scrubbed = text
    .replaceAll(projectRoot, scrubbedProjectRoot)
    .replaceAll(homeDir === undefined || homeDir.length === 0 ? '\0' : homeDir, '<home>')
    .replace(/\/private\/var\/folders\/[^\s"')]+/g, '<tmp>')
    .replace(/\/var\/folders\/[^\s"')]+/g, '<tmp>')
    .replace(/\/tmp\/[^\s"')]+/g, '<tmp>');
  for (const alias of pathAliases) {
    scrubbed = scrubbed.replaceAll(
      `${scrubbedProjectRoot}/${alias.fromRel}`,
      `${scrubbedProjectRoot}/${alias.toRel}`,
    );
    scrubbed = scrubbed.replaceAll(alias.fromRel, alias.toRel);
  }
  return scrubbed;
}

function writeScrubbed(relPath: string, content: string, pathAliases: PathAlias[] = []): void {
  const abs = resolve(projectRoot, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, scrubText(content, pathAliases));
}

function filesUnder(absDir: string): string[] {
  return readdirSync(absDir).flatMap((entry) => {
    const abs = join(absDir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) return filesUnder(abs);
    return [abs];
  });
}

function scrubProofTree(proofDir: string, pathAliases: PathAlias[] = []): void {
  for (const abs of filesUnder(proofDir)) {
    const rel = relative(projectRoot, abs);
    if (!/\.(json|jsonl|md|ndjson|txt|yaml|yml)$/.test(rel)) continue;
    writeFileSync(abs, scrubText(readFileSync(abs, 'utf8'), pathAliases));
  }
}

function buildRelayer(): Relayer {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayOutcome> => {
      if (input.prompt.includes('Step: act-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-build-act',
          result_body: JSON.stringify({
            verdict: 'accept',
            summary: 'Implemented the requested synthetic change.',
            changed_files: ['src/example.ts'],
            evidence: ['Deterministic Build implementation proof.'],
          }),
          duration_ms: 10,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: review-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-build-review',
          result_body: JSON.stringify({
            verdict: 'accept',
            summary: 'No blocking issue found in the synthetic Build proof.',
            findings: [],
          }),
          duration_ms: 11,
          cli_version: 'proof-stub',
        };
      }
      throw new Error(`unexpected Build proof relay prompt:\n${input.prompt.slice(0, 500)}`);
    },
  };
}

function buildAbortRelayer(): Relayer {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayOutcome> => {
      if (input.prompt.includes('Step: act-step')) {
        throw new Error('proof connector failure while implementing the synthetic Build change');
      }
      return buildRelayer().relay(input);
    },
  };
}

function reviewRelayer(): Relayer {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayOutcome> => ({
      request_payload: input.prompt,
      receipt_id: 'proof-review',
      result_body: JSON.stringify({
        verdict: 'NO_ISSUES_FOUND',
        findings: [],
        assessment:
          'Reviewer inspected the relayed staged-diff and untracked-file evidence and found nothing actionable in scope.',
        verification: [
          'Inspected the relayed review-intake report.',
          'Cross-checked the staged diff against the untracked-file metadata.',
        ],
        confidence_limitations: [
          'Untracked file contents were omitted from the relay (metadata-only policy).',
          'Untracked file evidence was capped at 20 files.',
        ],
      }),
      duration_ms: 10,
      cli_version: 'proof-stub',
    }),
  };
}

function fixRelayer(): Relayer {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayOutcome> => {
      if (input.prompt.includes('Step: fix-gather-context')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-fix-context',
          result_body: JSON.stringify({
            verdict: 'accept',
            sources: [
              { kind: 'file', ref: 'src/login.ts:1', summary: 'Synthetic login test fixture.' },
            ],
            observations: ['The missing token path needs a guard.'],
            open_questions: [],
          }),
          duration_ms: 10,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: fix-diagnose')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-fix-diagnose',
          result_body: JSON.stringify({
            verdict: 'accept',
            reproduction_status: 'reproduced',
            cause_summary: 'The missing token path skipped the fallback guard.',
            confidence: 'high',
            evidence: ['Synthetic regression evidence.'],
            residual_uncertainty: [],
          }),
          duration_ms: 11,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: fix-act')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-fix-act',
          result_body: JSON.stringify({
            verdict: 'accept',
            summary: 'Added the fallback guard for the synthetic missing token path.',
            diagnosis_ref: 'fix.diagnosis@v1',
            changed_files: ['src/login.ts'],
            evidence: ['Synthetic regression proof remained green.'],
          }),
          duration_ms: 12,
          cli_version: 'proof-stub',
        };
      }
      throw new Error(`unexpected Fix proof relay prompt:\n${input.prompt.slice(0, 500)}`);
    },
  };
}

const fixProofComposeExecutor: StepExecutor = async (step, context) => {
  if (step.kind !== 'compose' || step.id !== 'fix-frame') {
    return await executeCompose(step as Parameters<typeof executeCompose>[0], context);
  }
  const report = step.writes?.report;
  if (report?.schema === undefined) {
    throw new Error("Fix proof compose executor expected 'fix-frame' to write a report");
  }
  const goal = context.goal;
  const brief = {
    problem_statement: goal,
    expected_behavior: `After fix: ${goal}`,
    observed_behavior: `Before fix: ${goal}`,
    scope: 'Synthetic Fix proof fixture.',
    regression_contract: {
      expected_behavior: `After fix: ${goal}`,
      actual_behavior: `Before fix: ${goal}`,
      repro: {
        kind: 'not-reproducible',
        deferred_reason: 'Synthetic proof fixture; no live bug reproduction is required.',
      },
      regression_test: {
        status: 'deferred',
        deferred_reason: 'Synthetic proof fixture uses a deterministic verification command.',
      },
    },
    success_criteria: ['Deterministic Fix proof verification exits 0.'],
    verification_command_candidates: [
      {
        id: 'proof-fix-verify',
        cwd: '.',
        argv: ['node', '-e', 'process.exit(0)'],
        timeout_ms: 30_000,
        max_output_bytes: 200_000,
        env: {},
      },
    ],
  };
  await context.files.writeJson(report, brief);
  await context.trace.append({
    run_id: context.runId,
    kind: 'step.report_written',
    step_id: step.id,
    attempt: context.activeStepAttempt ?? 1,
    report_path: report.path,
    report_schema: report.schema,
  });
  return { route: 'pass', details: { writer: step.writer, proof: 'release-fix-brief' } };
};

// Stub the runtime-owned verification steps that shell out to git
// (fix-baseline-snapshot and fix-change-set). The synthetic Fix proof never
// actually modifies files, so the live executors would observe an empty file
// list and the change-set writer would refuse the run with "missing declared:
// src/login.ts". This stub writes passing reports for both steps so the
// proof closes with outcome 'partial' (still gated by the deferred
// regression test) — exactly as it did before Slice 2 added these gates.
const fixProofVerificationExecutor: StepExecutor = async (step, context) => {
  if (step.kind !== 'verification') {
    throw new Error(
      `fix proof verification executor: expected verification step, got ${step.kind}`,
    );
  }
  const report = step.writes?.report;
  if (report?.schema === undefined) {
    throw new Error(`fix proof verification executor: step '${step.id}' missing writes.report`);
  }
  const attempt = context.activeStepAttempt ?? 1;
  const reportSchema = report.schema;
  if (reportSchema === undefined) {
    throw new Error(`fix proof verification executor: step '${step.id}' report missing schema`);
  }
  const writePassing = async (body: unknown): Promise<void> => {
    await context.files.writeJson(report, body);
    await context.trace.append({
      run_id: context.runId,
      kind: 'step.report_written',
      step_id: step.id,
      attempt,
      report_path: report.path,
      report_schema: reportSchema,
    });
  };
  if (step.id === 'fix-baseline-snapshot') {
    await writePassing({
      overall_status: 'passed',
      head_sha: '0000000000000000000000000000000000000000',
      entries: [],
      hidden_index_flags: [],
    });
    return { route: 'pass', details: { writer: 'fix-proof', proof: 'baseline-snapshot' } };
  }
  if (step.id === 'fix-change-set') {
    await writePassing({
      status: 'pass',
      overall_status: 'passed',
      baseline_head_sha: '0000000000000000000000000000000000000000',
      head_sha: '0000000000000000000000000000000000000000',
      declared: ['src/login.ts'],
      observed: ['src/login.ts'],
      undeclared_extras: [],
      missing_declared: [],
      baseline_dirty_mutated: [],
      hidden_index_flags: [],
    });
    return { route: 'pass', details: { writer: 'fix-proof', proof: 'change-set' } };
  }
  // Other verification steps (fix-regression-baseline, fix-verify,
  // fix-regression-rerun) keep the live executor — they already work against
  // the deterministic node command candidates baked into the synthetic brief
  // (the regression test is deferred, so both regression-baseline and
  // regression-rerun emit 'deferred' without spawning anything).
  const verificationRuntime = (await import(
    resolve(projectRoot, 'dist/runtime/executors/verification.js')
  )) as { executeVerification: StepExecutor };
  return await verificationRuntime.executeVerification(step, context);
};

function fixProofExecutors(): RuntimeExecutorsOption {
  return {
    compose: fixProofComposeExecutor,
    verification: fixProofVerificationExecutor,
  };
}

function migrateRelayer(): Relayer {
  const build = buildRelayer();
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayOutcome> => {
      if (input.prompt.includes('Step: inventory-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-migrate-inventory',
          result_body: JSON.stringify({
            verdict: 'accept',
            summary: 'One legacy API site found for the synthetic migration proof.',
            items: [
              {
                id: 'item-1',
                path: 'src/legacy-api.ts',
                category: 'import-site',
                description: 'Synthetic legacy API import site.',
              },
            ],
            batches: [
              {
                id: 'batch-1',
                title: 'Replace the legacy API import',
                item_ids: ['item-1'],
                rationale: 'Single safe batch for the proof.',
              },
            ],
          }),
          duration_ms: 10,
          cli_version: 'proof-stub',
        };
      }
      if (
        input.prompt.includes('Step: review-step') &&
        input.prompt.includes('Accepted verdicts: release-approved, release-with-followups')
      ) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-migrate-review',
          result_body: JSON.stringify({
            verdict: 'release-approved',
            summary: 'Release approved for the synthetic migration proof.',
            findings: [],
          }),
          duration_ms: 11,
          cli_version: 'proof-stub',
        };
      }
      return build.relay(input);
    },
  };
}

function sweepRelayer(): Relayer {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayOutcome> => {
      if (input.prompt.includes('Step: survey-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-sweep-survey',
          result_body: JSON.stringify({
            verdict: 'accept',
            summary: 'Two cleanup candidates surfaced.',
            candidates: [
              {
                id: 'cand-1',
                category: 'dead-code',
                path: 'src/example.ts',
                description: 'Unused helper function.',
                confidence: 'high',
                risk: 'low',
              },
              {
                id: 'cand-2',
                category: 'stale-docs',
                path: 'docs/old.md',
                description: 'Outdated documentation paragraph.',
                confidence: 'low',
                risk: 'high',
              },
            ],
          }),
          duration_ms: 10,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: execute-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-sweep-execute',
          result_body: JSON.stringify({
            verdict: 'accept',
            summary: 'Acted on the safe cleanup candidate and deferred the risky one.',
            changed_files: ['src/example.ts'],
            items: [
              {
                candidate_id: 'cand-1',
                status: 'acted',
                evidence: 'Removed the unused helper function in the synthetic proof.',
              },
            ],
          }),
          duration_ms: 11,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: review-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-sweep-review',
          result_body: JSON.stringify({
            verdict: 'clean',
            summary: 'No cleanup regression found.',
            findings: [],
          }),
          duration_ms: 12,
          cli_version: 'proof-stub',
        };
      }
      throw new Error(`unexpected Sweep proof relay prompt:\n${input.prompt.slice(0, 500)}`);
    },
  };
}

function exploreDecisionRelayer(): Relayer {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayOutcome> => {
      if (input.prompt.includes('Step: proposal-fanout-step-option-1')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-proposal-option-1',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-1',
            option_label: 'React',
            case_summary: 'Choose React for the broad ecosystem and hiring pool.',
            assumptions: ['The operator values ecosystem maturity.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['The larger ecosystem may add dependency sprawl.'],
            next_action: 'Run a Build plan for a React prototype.',
          }),
          duration_ms: 10,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-2')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-proposal-option-2',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-2',
            option_label: 'Vue',
            case_summary: 'Choose Vue for a smaller surface and faster product iteration.',
            assumptions: ['The operator values implementation speed.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['Team familiarity may be thinner.'],
            next_action: 'Run a Build plan for a Vue prototype.',
          }),
          duration_ms: 11,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-3')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-proposal-option-3',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-3',
            option_label: 'Hybrid path',
            case_summary: 'Prototype the shared requirements before locking the framework.',
            assumptions: ['A brief comparison prototype is affordable.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['The decision takes longer.'],
            next_action: 'Run a short Explore follow-up with prototype criteria.',
          }),
          duration_ms: 12,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-4')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-proposal-option-4',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-4',
            option_label: 'Defer pending evidence',
            case_summary: 'Gather missing team and product constraints before choosing.',
            assumptions: ['The decision is reversible enough to pause briefly.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['The project loses momentum.'],
            next_action: 'Collect the missing constraints and rerun the decision.',
          }),
          duration_ms: 13,
          cli_version: 'proof-stub',
        };
      }
      if (input.prompt.includes('Step: stress-proposals-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proof-tournament-review',
          result_body: JSON.stringify({
            verdict: 'recommend',
            recommended_option_id: 'option-1',
            comparison: 'React is safer on ecosystem depth, while Vue is faster to shape.',
            objections: ['Vue depends more on team-specific familiarity.'],
            missing_evidence: ['No implementation spike was gathered.'],
            tradeoff_question: 'Choose React ecosystem depth or Vue iteration speed.',
            confidence: 'medium',
          }),
          duration_ms: 14,
          cli_version: 'proof-stub',
        };
      }
      throw new Error(`unexpected Explore proof relay prompt:\n${input.prompt.slice(0, 500)}`);
    },
  };
}

type Scenario = {
  slug: string;
  argv: readonly string[];
  relayer: Relayer;
  runId: string;
  startMs: number;
  resumeChoice?: string;
  runtimeExecutors?: RuntimeExecutorsOption;
};

async function captureCliScenario(scenario: Scenario): Promise<void> {
  const proofDirRel = `${proofRunsRootRel}/${scenario.slug}`;
  const proofDir = resolve(projectRoot, proofDirRel);
  const stagingProofDirRel = `${proofRunsRootRel}/.capture-${scenario.slug}`;
  const stagingProofDir = resolve(projectRoot, stagingProofDirRel);
  const runFolderRel = `${stagingProofDirRel}/run`;
  const runFolder = resolve(projectRoot, runFolderRel);
  const pathAliases = [{ fromRel: stagingProofDirRel, toRel: proofDirRel }];
  rmSync(stagingProofDir, { recursive: true, force: true });
  mkdirSync(stagingProofDir, { recursive: true });

  try {
    const now = deterministicNow(scenario.startMs);
    const run = await runCli([...scenario.argv, '--run-folder', runFolder, '--progress', 'jsonl'], {
      relayer: scenario.relayer,
      ...(scenario.runtimeExecutors === undefined
        ? {}
        : { runtimeExecutors: scenario.runtimeExecutors }),
      runId: scenario.runId,
      now,
      configCwd: projectRoot,
    });

    let finalStdout = run.stdout;
    let progress = run.stderr;
    if (scenario.resumeChoice !== undefined) {
      writeScrubbed(`${stagingProofDirRel}/checkpoint-result.json`, run.stdout, pathAliases);
      const resume = await runCli(
        [
          'resume',
          '--run-folder',
          runFolder,
          '--checkpoint-choice',
          scenario.resumeChoice,
          '--progress',
          'jsonl',
        ],
        {
          relayer: scenario.relayer,
          now,
          configCwd: projectRoot,
        },
      );
      finalStdout = resume.stdout;
      progress += resume.stderr;
    }

    writeScrubbed(`${stagingProofDirRel}/progress.jsonl`, progress, pathAliases);
    writeScrubbed(`${stagingProofDirRel}/result.json`, finalStdout, pathAliases);
    writeScrubbed(
      `${stagingProofDirRel}/operator-summary.md`,
      readFileSync(join(runFolder, 'reports', 'operator-summary.md'), 'utf8'),
      pathAliases,
    );
    scrubProofTree(stagingProofDir, pathAliases);
    rmSync(proofDir, { recursive: true, force: true });
    renameSync(stagingProofDir, proofDir);
    console.log(`captured ${proofDirRel}`);
  } catch (err) {
    rmSync(stagingProofDir, { recursive: true, force: true });
    throw err;
  }
}

function captureDoctor(): void {
  const proofDirRel = `${proofRunsRootRel}/doctor`;
  const proofDir = resolve(projectRoot, proofDirRel);
  rmSync(proofDir, { recursive: true, force: true });
  mkdirSync(proofDir, { recursive: true });
  const result = spawnSync(
    process.execPath,
    ['plugins/circuit/scripts/circuit-next.mjs', 'doctor'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 180_000,
    },
  );
  writeScrubbed(
    `${proofDirRel}/output.txt`,
    [
      '$ node plugins/circuit/scripts/circuit-next.mjs doctor',
      `exit: ${result.status ?? 1}`,
      '',
      'stdout:',
      result.stdout,
      '',
      'stderr:',
      result.stderr,
    ].join('\n'),
  );
  scrubProofTree(proofDir);
  console.log(`captured ${proofDirRel}`);
}

async function captureHandoff(): Promise<void> {
  const proofDirRel = `${proofRunsRootRel}/handoff`;
  const proofDir = resolve(projectRoot, proofDirRel);
  const stagingProofDirRel = `${proofRunsRootRel}/.capture-handoff`;
  const stagingProofDir = resolve(projectRoot, stagingProofDirRel);
  const runFolder = resolve(projectRoot, `${stagingProofDirRel}/run`);
  const controlPlane = resolve(projectRoot, `${stagingProofDirRel}/control-plane`);
  const pathAliases = [{ fromRel: stagingProofDirRel, toRel: proofDirRel }];
  rmSync(stagingProofDir, { recursive: true, force: true });
  mkdirSync(stagingProofDir, { recursive: true });

  try {
    const now = deterministicNow(Date.UTC(2026, 3, 29, 22, 30, 0));
    const run = await runCli(
      [
        'run',
        'build',
        '--goal',
        'deep change that asks for handoff continuity',
        '--entry-mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        runId: '44444444-4444-4444-4444-444444444411',
        now,
        configCwd: projectRoot,
      },
    );
    const save = await runCli(
      [
        'handoff',
        'save',
        '--goal',
        'Resume the waiting Build proof run.',
        '--next',
        'DO: resolve the Build checkpoint and continue.',
        '--state-markdown',
        '- checkpoint is waiting on the framed Build proof',
        '--debt-markdown',
        '- BLOCKED: checkpoint needs an operator choice',
        '--run-folder',
        runFolder,
        '--control-plane',
        controlPlane,
        '--record-id',
        'continuity-44444444-4444-4444-8444-444444444411',
        '--created-at',
        '2026-04-29T22:31:00.000Z',
        '--progress',
        'jsonl',
      ],
      { now, configCwd: projectRoot },
    );
    const resume = await runCli(
      ['handoff', 'resume', '--control-plane', controlPlane, '--progress', 'jsonl'],
      { now, configCwd: projectRoot },
    );
    const saveResult = JSON.parse(save.stdout);
    const resumeResult = JSON.parse(resume.stdout);

    writeScrubbed(
      `${stagingProofDirRel}/progress.jsonl`,
      run.stderr + save.stderr + resume.stderr,
      pathAliases,
    );
    writeScrubbed(`${stagingProofDirRel}/checkpoint-result.json`, run.stdout, pathAliases);
    writeScrubbed(`${stagingProofDirRel}/result.json`, resume.stdout, pathAliases);
    writeScrubbed(
      `${stagingProofDirRel}/operator-summary.md`,
      readFileSync(resumeResult.operator_summary_markdown_path, 'utf8'),
      pathAliases,
    );
    writeScrubbed(
      `${stagingProofDirRel}/continuity.json`,
      readFileSync(saveResult.continuity_path, 'utf8'),
      pathAliases,
    );
    scrubProofTree(stagingProofDir, pathAliases);
    rmSync(proofDir, { recursive: true, force: true });
    renameSync(stagingProofDir, proofDir);
    console.log(`captured ${proofDirRel}`);
  } catch (err) {
    rmSync(stagingProofDir, { recursive: true, force: true });
    throw err;
  }
}

async function captureCustomization(): Promise<void> {
  const proofDirRel = `${proofRunsRootRel}/customization`;
  const proofDir = resolve(projectRoot, proofDirRel);
  const stagingProofDirRel = `${proofRunsRootRel}/.capture-customization`;
  const stagingProofDir = resolve(projectRoot, stagingProofDirRel);
  const home = resolve(projectRoot, `${stagingProofDirRel}/custom-home`);
  const pathAliases = [{ fromRel: stagingProofDirRel, toRel: proofDirRel }];
  rmSync(stagingProofDir, { recursive: true, force: true });
  mkdirSync(stagingProofDir, { recursive: true });

  try {
    const now = deterministicNow(Date.UTC(2026, 3, 29, 23, 0, 0));
    const create = await runCli(
      [
        'create',
        '--name',
        'release-note-flow',
        '--description',
        'Draft release notes from a change summary.',
        '--home',
        home,
        '--template-flow-root',
        resolve(projectRoot, 'generated/flows'),
        '--publish',
        '--yes',
        '--created-at',
        '2026-04-29T23:00:00.000Z',
        '--progress',
        'jsonl',
      ],
      { now, configCwd: projectRoot },
    );
    const createResult = JSON.parse(create.stdout);
    writeScrubbed(`${stagingProofDirRel}/progress.jsonl`, create.stderr, pathAliases);
    writeScrubbed(`${stagingProofDirRel}/result.json`, create.stdout, pathAliases);
    writeScrubbed(
      `${stagingProofDirRel}/operator-summary.md`,
      readFileSync(createResult.operator_summary_markdown_path, 'utf8'),
      pathAliases,
    );
    scrubProofTree(stagingProofDir, pathAliases);
    rmSync(proofDir, { recursive: true, force: true });
    renameSync(stagingProofDir, proofDir);
    console.log(`captured ${proofDirRel}`);
  } catch (err) {
    rmSync(stagingProofDir, { recursive: true, force: true });
    throw err;
  }
}

const scenarios: Scenario[] = [
  {
    slug: 'routed-build',
    argv: ['run', '--goal', 'develop: add a small safe change'],
    relayer: buildRelayer(),
    runId: '44444444-4444-4444-4444-444444444402',
    startMs: Date.UTC(2026, 3, 29, 18, 0, 0),
  },
  {
    slug: 'explicit-build',
    argv: ['run', 'build', '--goal', 'add a focused change', '--entry-mode', 'deep'],
    relayer: buildRelayer(),
    runId: '44444444-4444-4444-4444-444444444403',
    startMs: Date.UTC(2026, 3, 29, 18, 30, 0),
  },
  {
    slug: 'review',
    argv: ['run', 'review', '--goal', 'review this change'],
    relayer: reviewRelayer(),
    runId: '44444444-4444-4444-4444-444444444404',
    startMs: Date.UTC(2026, 3, 29, 19, 0, 0),
  },
  {
    slug: 'checkpoint',
    argv: ['run', 'build', '--goal', 'deep change that asks for scope', '--entry-mode', 'deep'],
    relayer: buildRelayer(),
    resumeChoice: 'continue',
    runId: '44444444-4444-4444-4444-444444444405',
    startMs: Date.UTC(2026, 3, 29, 19, 30, 0),
  },
  {
    slug: 'abort',
    argv: ['run', 'build', '--goal', 'simulate connector failure'],
    relayer: buildAbortRelayer(),
    runId: '44444444-4444-4444-4444-444444444406',
    startMs: Date.UTC(2026, 3, 29, 20, 0, 0),
  },
  {
    slug: 'fix',
    argv: ['run', '--goal', 'quick fix: restore the failing login test'],
    relayer: fixRelayer(),
    runtimeExecutors: fixProofExecutors(),
    runId: '44444444-4444-4444-4444-444444444407',
    startMs: Date.UTC(2026, 3, 29, 20, 30, 0),
  },
  {
    slug: 'migrate',
    argv: [
      'run',
      'migrate',
      '--goal',
      'migrate: replace a small legacy API',
      '--entry-mode',
      'default',
    ],
    relayer: migrateRelayer(),
    runId: '44444444-4444-4444-4444-444444444408',
    startMs: Date.UTC(2026, 3, 29, 21, 0, 0),
  },
  {
    slug: 'sweep',
    argv: ['run', '--goal', 'cleanup: remove safe dead code'],
    relayer: sweepRelayer(),
    runId: '44444444-4444-4444-4444-444444444409',
    startMs: Date.UTC(2026, 3, 29, 21, 30, 0),
  },
  {
    slug: 'explore-decision',
    argv: ['run', '--goal', 'decide: React vs Vue'],
    relayer: exploreDecisionRelayer(),
    resumeChoice: 'option-2',
    runId: '44444444-4444-4444-4444-444444444441',
    startMs: Date.UTC(2026, 3, 29, 17, 0, 0),
  },
  {
    slug: 'plan-execution',
    argv: ['run', '--goal', 'Execute this plan: ./docs/specs/headless-engine-host-api-v1.md'],
    relayer: buildRelayer(),
    runId: '44444444-4444-4444-4444-444444444410',
    startMs: Date.UTC(2026, 3, 29, 22, 0, 0),
  },
];

for (const scenario of scenarios) {
  await captureCliScenario(scenario);
}
await captureHandoff();
await captureCustomization();
captureDoctor();
