import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/cli/circuit.js';
import { CompiledFlowId, SkillId } from '../../src/schemas/ids.js';
import type { ResolvedSelection } from '../../src/schemas/selection-policy.js';
import {
  discoverConfigLayers,
  projectConfigPath,
  userGlobalConfigPath,
} from '../../src/shared/config-loader.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn, RelayInput } from '../../src/shared/relay-runtime-types.js';

let root: string;
let homeDir: string;
let cwdDir: string;

const REVIEW_RELAY_BODY = JSON.stringify({
  verdict: 'NO_ISSUES_FOUND',
  findings: [],
  assessment: 'Stub reviewer: nothing actionable in the relayed evidence.',
  verification: ['Inspected the relayed intake report.'],
  confidence_limitations: [],
});

function writeUserConfig(text: string): void {
  const path = userGlobalConfigPath(homeDir);
  mkdirSync(join(homeDir, '.config', 'circuit'), { recursive: true });
  writeFileSync(path, text);
}

function writeProjectConfig(text: string): void {
  const path = projectConfigPath(cwdDir);
  mkdirSync(join(cwdDir, '.circuit'), { recursive: true });
  writeFileSync(path, text);
}

function writeSkill(id: string): void {
  const dir = join(homeDir, '.agents', 'skills', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `Skill ${id}`);
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function captureStdout(): { restore: () => void; text: () => string } {
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  return {
    restore: () => {
      process.stdout.write = origWrite;
    },
    text: () => captured,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'circuit-config-loader-'));
  homeDir = join(root, 'home');
  cwdDir = join(root, 'cwd');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('config loader', () => {
  it('loads canonical user-global and project YAML files as LayeredConfig records', () => {
    writeUserConfig(`
schema_version: 1
defaults:
  selection:
    effort: low
    skills:
      mode: replace
      skills: [tdd]
`);
    writeProjectConfig(`
schema_version: 1
circuits:
  explore:
    selection:
      model:
        provider: openai
        model: gpt-5.4
`);

    const layers = discoverConfigLayers({ homeDir, cwd: cwdDir });

    expect(layers.map((layer) => layer.layer)).toEqual(['user-global', 'project']);
    expect(layers[0]?.source_path).toBe(userGlobalConfigPath(homeDir));
    expect(layers[1]?.source_path).toBe(projectConfigPath(cwdDir));
    expect(layers[0]?.config.defaults.selection?.effort).toBe('low');
    const exploreId = CompiledFlowId.parse('explore');
    expect(layers[1]?.config.circuits[exploreId]?.selection?.model).toEqual({
      provider: 'openai',
      model: 'gpt-5.4',
    });
  });

  it('skips missing config files and fails loudly on invalid config payloads', () => {
    expect(discoverConfigLayers({ homeDir, cwd: cwdDir })).toEqual([]);

    writeProjectConfig(`
schema_version: 1
defuults: {}
`);
    expect(() => discoverConfigLayers({ homeDir, cwd: cwdDir })).toThrow(
      /config validation failed for project/i,
    );
  });

  it('fails loudly on malformed YAML before schema validation', () => {
    writeProjectConfig('schema_version: 1\nbad: [unterminated\n');

    expect(() => discoverConfigLayers({ homeDir, cwd: cwdDir })).toThrow(
      /config YAML parse failed/i,
    );
  });
});

describe('CLI config discovery', () => {
  it('passes loaded user-global and project config layers into relay selection evidence', async () => {
    writeUserConfig(`
schema_version: 1
defaults:
  selection:
    model:
      provider: anthropic
      model: claude-opus-4-7
    effort: low
    skills:
      mode: replace
      skills: [tdd]
    invocation_options:
      shared: user
      userOnly: true
`);
    writeProjectConfig(`
schema_version: 1
defaults:
  selection:
    effort: high
    skills:
      mode: append
      skills: [api-design-patterns]
    invocation_options:
      shared: project-default
      projectDefault: true
circuits:
  review:
    selection:
      model:
        provider: anthropic
        model: claude-opus-4-7-project
      skills:
        mode: append
        skills: [react-doctor]
      invocation_options:
        shared: project-circuit
        projectCircuit: true
`);

    const relayInputs: RelayInput[] = [];
    const relayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async (input: RelayInput): Promise<RelayResult> => {
        relayInputs.push(input);
        return {
          request_payload: input.prompt,
          receipt_id: 'config-loader-receipt',
          result_body: REVIEW_RELAY_BODY,
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      },
    };
    const runFolder = join(root, 'run');
    const stdout = captureStdout();
    const originalHome = process.env.HOME;
    const originalStrictRuntime = process.env.CIRCUIT_SHOW_RUNTIME_DECISION;
    const originalShowRuntimeDecision = process.env.CIRCUIT_SHOW_RUNTIME_DECISION;
    const originalCandidateRuntime = process.env.CIRCUIT_SHOW_RUNTIME_DECISION;
    const originalDisableRuntime = process.env.CIRCUIT_SHOW_RUNTIME_DECISION;
    const originalGeneratedMirrorRoot = process.env.CIRCUIT_GENERATED_FLOW_MIRROR_ROOT;
    process.env.HOME = homeDir;
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = undefined;
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = undefined;
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = undefined;
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = undefined;
    process.env.CIRCUIT_GENERATED_FLOW_MIRROR_ROOT = undefined;
    for (const skill of ['tdd', 'api-design-patterns', 'react-doctor']) {
      writeSkill(skill);
    }
    try {
      const exit = await main(
        [
          'run',
          'review',
          '--goal',
          'prove config reaches selection evidence',
          '--run-folder',
          runFolder,
        ],
        {
          relayer,
          now: deterministicNow(Date.UTC(2026, 3, 24, 23, 0, 0)),
          runId: '86868686-8686-4686-8686-868686868686',
          configHomeDir: homeDir,
          configCwd: cwdDir,
        },
      );
      expect(exit).toBe(0);
    } finally {
      stdout.restore();
      if (originalHome === undefined) {
        Reflect.deleteProperty(process.env, 'HOME');
      } else {
        process.env.HOME = originalHome;
      }
      process.env.CIRCUIT_SHOW_RUNTIME_DECISION = originalStrictRuntime;
      process.env.CIRCUIT_SHOW_RUNTIME_DECISION = originalShowRuntimeDecision;
      process.env.CIRCUIT_SHOW_RUNTIME_DECISION = originalCandidateRuntime;
      process.env.CIRCUIT_SHOW_RUNTIME_DECISION = originalDisableRuntime;
      process.env.CIRCUIT_GENERATED_FLOW_MIRROR_ROOT = originalGeneratedMirrorRoot;
    }

    const expected: ResolvedSelection = {
      model: { provider: 'anthropic', model: 'claude-opus-4-7-project' },
      effort: 'high',
      skills: [
        SkillId.parse('tdd'),
        SkillId.parse('api-design-patterns'),
        SkillId.parse('react-doctor'),
      ],
      invocation_options: {
        shared: 'project-circuit',
        userOnly: true,
        projectDefault: true,
        projectCircuit: true,
      },
    };
    const relaySelection = relayInputs.find((input) => input.resolvedSelection !== undefined);
    expect(relaySelection?.resolvedSelection).toEqual(expected);

    const trace_entries = readFileSync(join(runFolder, 'trace.ndjson'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const started = trace_entries.find((trace_entry) => trace_entry.kind === 'relay.started');
    expect(started?.resolved_selection).toEqual(expected);

    const output = JSON.parse(stdout.text()) as Record<string, unknown>;
    expect(output.flow_id).toBe('review');
    expect(output.outcome).toBe('complete');
  });

  it('rejects invalid discovered config before relay', async () => {
    writeProjectConfig('schema_version: 1\nbad: [unterminated\n');

    let relayCalls = 0;
    const relayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async (input: RelayInput): Promise<RelayResult> => {
        relayCalls += 1;
        return {
          request_payload: input.prompt,
          receipt_id: 'should-not-relay',
          result_body: '{"verdict":"accept"}',
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      },
    };

    await expect(
      main(['run', 'explore', '--goal', 'invalid config must stop before relay'], {
        relayer,
        now: deterministicNow(Date.UTC(2026, 3, 24, 23, 30, 0)),
        runId: '86868686-8686-4686-8686-868686868687',
        configHomeDir: homeDir,
        configCwd: cwdDir,
      }),
    ).rejects.toThrow(/config YAML parse failed/i);
    expect(relayCalls).toBe(0);
  });
});
