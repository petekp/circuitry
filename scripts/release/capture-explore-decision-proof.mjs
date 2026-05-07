#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const proofRunsRootRel = 'docs/release/proofs/runs';
const proofDirRel = `${proofRunsRootRel}/explore-decision`;
const proofDir = resolve(projectRoot, proofDirRel);
const runFolderRel = `${proofDirRel}/run`;
const runFolder = resolve(projectRoot, runFolderRel);
const scrubbedProjectRoot = '<repo>';
const goal = 'decide: React vs Vue';

function deterministicNow(startMs) {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function tournamentRelayer() {
  return {
    connectorName: 'claude-code',
    relay: async (input) => {
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

      if (!input.prompt.includes('Step: stress-proposals-step')) {
        throw new Error(`unexpected Explore proof relay prompt:\n${input.prompt.slice(0, 500)}`);
      }
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
    },
  };
}

function captureStream(streamName) {
  const stream = process[streamName];
  const originalWrite = stream.write.bind(stream);
  let captured = '';
  stream.write = (chunk, encoding, callback) => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    if (typeof encoding === 'function') encoding();
    if (typeof callback === 'function') callback();
    return true;
  };
  return {
    text: () => captured,
    restore: () => {
      stream.write = originalWrite;
    },
  };
}

async function runCli(argv, options) {
  const stdout = captureStream('stdout');
  const stderr = captureStream('stderr');
  try {
    const { main } = await import(resolve(projectRoot, 'dist/cli/circuit.js'));
    const code = await main(argv, options);
    if (code !== 0) throw new Error(`circuit CLI exited ${code}`);
    return { stdout: stdout.text(), stderr: stderr.text() };
  } finally {
    stdout.restore();
    stderr.restore();
  }
}

function scrubText(text) {
  return text
    .replaceAll(projectRoot, scrubbedProjectRoot)
    .replaceAll(resolve(projectRoot, proofDirRel), `${scrubbedProjectRoot}/${proofDirRel}`)
    .replaceAll(resolve(projectRoot, runFolderRel), `${scrubbedProjectRoot}/${runFolderRel}`);
}

function writeScrubbed(relPath, content) {
  const abs = resolve(projectRoot, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, scrubText(content));
}

function filesUnder(absDir) {
  return readdirSync(absDir).flatMap((entry) => {
    const abs = join(absDir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) return filesUnder(abs);
    return [abs];
  });
}

function scrubProofTree() {
  for (const abs of filesUnder(proofDir)) {
    const rel = relative(projectRoot, abs);
    if (!/\.(json|jsonl|md|ndjson|txt)$/.test(rel)) continue;
    writeFileSync(abs, scrubText(readFileSync(abs, 'utf8')));
  }
}

async function main() {
  rmSync(proofDir, { recursive: true, force: true });
  mkdirSync(proofDir, { recursive: true });

  const now = deterministicNow(Date.UTC(2026, 3, 29, 17, 0, 0));
  const relayer = tournamentRelayer();
  const run = await runCli(
    ['run', '--goal', goal, '--run-folder', runFolder, '--progress', 'jsonl'],
    {
      relayer,
      runId: '44444444-4444-4444-4444-444444444441',
      now,
      configCwd: projectRoot,
    },
  );

  const resume = await runCli(
    ['resume', '--run-folder', runFolder, '--checkpoint-choice', 'option-2', '--progress', 'jsonl'],
    {
      relayer,
      now,
      configCwd: projectRoot,
    },
  );

  writeScrubbed(`${proofDirRel}/progress.jsonl`, `${run.stderr}${resume.stderr}`);
  writeScrubbed(`${proofDirRel}/checkpoint-result.json`, run.stdout);
  writeScrubbed(`${proofDirRel}/result.json`, resume.stdout);
  writeScrubbed(
    `${proofDirRel}/operator-summary.md`,
    readFileSync(join(runFolder, 'reports', 'operator-summary.md'), 'utf8'),
  );
  scrubProofTree();
  console.log(`captured ${proofDirRel}`);
}

await main();
