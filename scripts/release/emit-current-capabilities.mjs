#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fileIsPresent,
  formatWithBiome,
  listMarkdownBasenames,
  loadConnectorSchemas,
  loadCurrentCatalog,
  loadReleaseSchemas,
  loadRouter,
  loadYamlWithSchema,
  projectRoot,
  readJson,
  stableJson,
  writeOrCheck,
} from './lib.mjs';

const check = process.argv.includes('--check');
const OUT_REL = 'generated/release/current-capabilities.json';
const EXECUTABLE_SCHEMATIC_ROUTES = new Set([
  'ask',
  'complete',
  'continue',
  'escalate',
  'handoff',
  'retry',
  'revise',
  'split',
  'stop',
]);
const CANONICAL_STAGE_ORDER = ['frame', 'analyze', 'plan', 'act', 'verify', 'review', 'close'];

function flowDir(id) {
  return resolve(projectRoot, 'generated/flows', id);
}

function readGeneratedFlowFiles(id) {
  const dir = flowDir(id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => ({
      rel: `generated/flows/${id}/${entry}`,
      json: readJson(`generated/flows/${id}/${entry}`),
    }));
}

function entryModesFor(id) {
  const modes = new Map();
  for (const file of readGeneratedFlowFiles(id)) {
    for (const mode of file.json.entry_modes ?? []) {
      modes.set(mode.name, mode);
    }
  }
  return [...modes.keys()].sort();
}

function stageAxisLabel(flowId, stage) {
  const canonical = stage.canonical ?? stage.id;
  if (canonical === 'plan' && /decision/i.test(stage.title ?? '')) return 'Plan or Decision';
  if (flowId === 'fix' && canonical === 'act') return 'Fix';
  if (flowId === 'sweep' && canonical === 'plan') return 'Queue/Triage';
  if (flowId === 'sweep' && canonical === 'act') return 'Batch Execute';
  if (flowId === 'sweep' && canonical === 'review') return 'Deferred Review';
  if (typeof stage.title === 'string' && stage.title.length > 0) return stage.title;
  return canonical;
}

function stagesFor(id) {
  const stages = new Map();
  for (const file of readGeneratedFlowFiles(id)) {
    for (const stage of file.json.stages ?? []) {
      const label = stageAxisLabel(id, stage);
      if (typeof label !== 'string') continue;
      const canonical = stage.canonical ?? stage.id;
      const order = CANONICAL_STAGE_ORDER.indexOf(canonical);
      stages.set(label, {
        label,
        order: order === -1 ? Number.MAX_SAFE_INTEGER : order,
      });
    }
  }
  return [...stages.values()]
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
    .map((stage) => stage.label);
}

function reportsFor(pkg) {
  const reports = new Set(pkg.relayReports.map((report) => report.schemaName));
  for (const file of readGeneratedFlowFiles(pkg.id)) {
    for (const step of file.json.steps ?? []) {
      const writes = step.writes ?? {};
      if (typeof writes.report?.schema === 'string') reports.add(writes.report.schema);
      if (typeof writes.aggregate?.schema === 'string') reports.add(writes.aggregate.schema);
    }
  }
  return [...reports].sort();
}

const SEMANTIC_OUTPUTS_BY_REPORT = new Map(
  Object.entries({
    'build.brief@v1': ['brief.md'],
    'build.plan@v1': ['plan.md'],
    'build.review@v1': ['review.md'],
    'build.result@v1': ['result.md'],
    'explore.brief@v1': ['brief.md'],
    'explore.analysis@v1': ['analysis.md'],
    'explore.compose@v1': ['plan.md'],
    'explore.decision-options@v1': ['decision.md'],
    'explore.decision@v1': ['decision.md'],
    'explore.result@v1': ['result.md'],
    'fix.brief@v1': ['brief.md'],
    'fix.context@v1': ['analysis.md'],
    'fix.diagnosis@v1': ['analysis.md'],
    'fix.review@v1': ['review.md'],
    'fix.result@v1': ['result.md'],
    'migrate.brief@v1': ['brief.md'],
    'migrate.inventory@v1': ['inventory.md'],
    'migrate.coexistence@v1': ['plan.md'],
    'migrate.review@v1': ['review.md'],
    'migrate.result@v1': ['result.md'],
    'review.result@v1': ['review.md'],
    'sweep.brief@v1': ['brief.md'],
    'sweep.analysis@v1': ['analysis.md'],
    'sweep.queue@v1': ['queue.md', 'deferred.md'],
    'sweep.review@v1': ['review.md'],
    'sweep.result@v1': ['result.md'],
  }),
);

function semanticOutputsFor(record) {
  const outputs = new Set();
  for (const report of record.reports) {
    for (const output of SEMANTIC_OUTPUTS_BY_REPORT.get(report) ?? []) {
      outputs.add(output);
    }
  }
  return [...outputs].sort();
}

function readSchematic(pkg) {
  return JSON.parse(readFileSync(resolve(projectRoot, pkg.paths.schematic), 'utf8'));
}

function routeOutcomesFor(pkg) {
  const schematic = readSchematic(pkg);
  const outcomes = new Set();
  const unsupported = new Set();
  for (const item of schematic.items ?? []) {
    for (const outcome of Object.keys(item.routes ?? {})) {
      outcomes.add(outcome);
      if (!EXECUTABLE_SCHEMATIC_ROUTES.has(outcome)) unsupported.add(outcome);
    }
    for (const outcome of Object.keys(item.route_overrides ?? {})) {
      outcomes.add(outcome);
      if (!EXECUTABLE_SCHEMATIC_ROUTES.has(outcome)) unsupported.add(outcome);
    }
  }
  return {
    route_outcomes: [...outcomes].sort(),
    unsupported_route_outcomes: [...unsupported].sort(),
  };
}

function generatedStepsFor(id) {
  return readGeneratedFlowFiles(id).flatMap((file) => file.json.steps ?? []);
}

function flowBehaviorAxes(pkg) {
  const steps = generatedStepsFor(pkg.id);
  const axes = {};
  if (steps.some((step) => step.kind === 'checkpoint')) {
    axes.checkpoint =
      'Compiled checkpoints can pause, auto-resolve safe defaults, or resume from operator input.';
  }
  if (
    steps.some((step) => step.role === 'reviewer') ||
    readGeneratedFlowFiles(pkg.id).some((file) =>
      (file.json.stages ?? []).some((stage) => stage.canonical === 'review'),
    )
  ) {
    axes.review = 'Compiled review stages or reviewer relays are present.';
  }
  if (steps.some((step) => step.kind === 'verification')) {
    axes.verification = 'Compiled verification steps write command-result reports before close.';
  } else if (pkg.id === 'explore') {
    axes.verification =
      'Explore deep mode records seam proof through analysis and embedded critique rather than command verification.';
  }
  if (steps.some((step) => ['relay', 'sub-run', 'fanout'].includes(step.kind))) {
    axes.worker_handoff =
      'Compiled worker handoffs write request, receipt, result, and report evidence where applicable.';
  }
  if (steps.length > 0) {
    axes.continuity =
      'Runs persist manifest, trace, state, result, and checkpoint resume data in the run folder.';
  }
  return axes;
}

function flowRecord(pkg) {
  const routing = pkg.routing;
  const routeOutcomes = routeOutcomesFor(pkg);
  return {
    id: pkg.id,
    source: pkg.paths.schematic,
    ...(pkg.paths.command === undefined ? {} : { command_path: pkg.paths.command }),
    ...(pkg.paths.contract === undefined ? {} : { contract_path: pkg.paths.contract }),
    routing: {
      routable: routing !== undefined,
      is_default: routing?.isDefault === true,
      ...(routing?.order === undefined ? {} : { order: routing.order }),
      signal_labels: routing?.signals.map((signal) => signal.label).sort() ?? [],
      ...(routing?.defaultReason === undefined ? {} : { default_reason: routing.defaultReason }),
    },
    entry_modes: entryModesFor(pkg.id),
    stages: stagesFor(pkg.id),
    reports: reportsFor(pkg),
    writers: {
      compose: pkg.writers.compose.length,
      close: pkg.writers.close.length,
      verification: pkg.writers.verification.length,
      checkpoint: pkg.writers.checkpoint.length,
    },
    ...routeOutcomes,
  };
}

function commandCapability(id, host, present) {
  return {
    id: host === 'root' ? `command:${id}` : `command:${host}:${id}`,
    kind: 'flow',
    title: `${host} command ${id}`,
    status: present ? 'implemented' : 'missing',
    summary: present
      ? `Command ${id} is present for ${host}.`
      : `Command ${id} is absent for ${host}.`,
    evidence: present ? [`commands/${id}.md`] : [],
    readiness_refs: present ? [] : ['REL-004'],
  };
}

function implementedIntentHintsByFlow(routerIntents) {
  const byFlow = new Map();
  for (const intent of routerIntents) {
    if (intent.status !== 'implemented') continue;
    if (intent.id === 'plan-execution') continue;
    const hints = byFlow.get(intent.actual_flow) ?? [];
    hints.push(`${intent.id}:`);
    byFlow.set(intent.actual_flow, hints);
  }
  return byFlow;
}

const PROOF_AXIS_BY_SCENARIO = new Map([
  [
    'proof:routed-build',
    {
      capability: 'flow:build',
      proof: 'Routed Build golden run.',
    },
  ],
  [
    'proof:explicit-build',
    {
      capability: 'flow:build',
      proof: 'Explicit Build checkpoint golden run.',
    },
  ],
  [
    'proof:review',
    {
      capability: 'utility:review',
      proof: 'Standalone Review golden run.',
    },
  ],
  [
    'proof:checkpoint-resume',
    {
      capability: 'feature:checkpoints',
      proof: 'Checkpoint/resume golden run.',
    },
  ],
  [
    'proof:fix',
    {
      capability: 'flow:fix',
      proof: 'Fix golden run with regression evidence.',
    },
  ],
  [
    'proof:migrate',
    {
      capability: 'flow:migrate',
      proof: 'Migration plan and batch proof run.',
    },
  ],
  [
    'proof:sweep',
    {
      capability: 'flow:sweep',
      proof: 'Sweep golden run covering queue/deferred output.',
    },
  ],
  [
    'proof:explore-decision',
    {
      capability: 'flow:explore',
      proof: 'Golden decision or tournament run.',
    },
  ],
  [
    'proof:plan-execution',
    {
      capability: 'feature:plan-execution',
      proof: 'Plan-execution campaign-start proof.',
    },
  ],
  [
    'proof:handoff',
    {
      capability: ['utility:handoff', 'feature:continuity'],
      proof: 'Handoff/resume golden run.',
    },
  ],
  [
    'proof:customization',
    {
      capability: 'utility:create',
      proof: 'Create or custom-connector proof scenario.',
    },
  ],
]);

function verifiedProofAxesByCapability(proofs) {
  const byCapability = new Map();
  for (const scenario of proofs.scenarios) {
    if (scenario.status !== 'verified_current') continue;
    const proofAxis = PROOF_AXIS_BY_SCENARIO.get(scenario.id);
    if (proofAxis === undefined) continue;
    const capabilities = Array.isArray(proofAxis.capability)
      ? proofAxis.capability
      : [proofAxis.capability];
    for (const capability of capabilities) {
      const proofsForCapability = byCapability.get(capability) ?? [];
      proofsForCapability.push(proofAxis.proof);
      byCapability.set(capability, proofsForCapability);
    }
  }
  return new Map(
    [...byCapability.entries()].map(([capability, proofsForCapability]) => [
      capability,
      { proof: proofsForCapability.join(' ') },
    ]),
  );
}

function capabilityFromFlow(record, intentHintsByFlow, proofAxesByCapability) {
  const isRuntimeOnly = record.id === 'runtime-proof';
  const intentHints = intentHintsByFlow.get(record.id)?.sort() ?? [];
  const proofAxes = proofAxesByCapability.get(`flow:${record.id}`) ?? {};
  const behaviorAxes = flowBehaviorAxes(record);
  const semanticOutputs = semanticOutputsFor(record);
  return {
    id: `flow:${record.id}`,
    kind: 'flow',
    title: `${record.id} flow`,
    status: 'implemented',
    summary: isRuntimeOnly
      ? 'Runtime proof flow is present as an internal test surface.'
      : `Flow ${record.id} is registered in the catalog.`,
    evidence: [record.source, `generated/flows/${record.id}/circuit.json`],
    axes: {
      intent_hints: intentHints,
      modes: record.entry_modes,
      stage_path: record.stages,
      outputs: semanticOutputs.length > 0 ? semanticOutputs : record.reports,
      ...behaviorAxes,
      ...proofAxes,
    },
  };
}

function modeCapabilities(record) {
  return record.entry_modes.map((mode) => ({
    id: `mode:${record.id}:${mode}`,
    kind: 'mode',
    title: `${record.id} ${mode}`,
    status: 'implemented',
    summary: `${record.id} declares entry mode ${mode}.`,
    evidence: [`generated/flows/${record.id}`],
  }));
}

function routeCapabilities(record) {
  return record.route_outcomes.map((outcome) => {
    const supported = !record.unsupported_route_outcomes.includes(outcome);
    return {
      id: `route-outcome:${record.id}:${outcome}`,
      kind: 'route_outcome',
      title: `${record.id} route ${outcome}`,
      status: supported ? 'implemented' : 'partial',
      summary: supported
        ? `${outcome} maps to an executable compiled route.`
        : `${outcome} is declared in the schematic but not executable in compiled routes.`,
      evidence: [record.source],
      readiness_refs: supported ? [] : ['REL-003'],
    };
  });
}

function routerIntentCases(classifyCompiledFlowTask) {
  const cases = [
    {
      id: 'fix',
      input: 'fix: handle the missing token edge case',
      expected_flow: 'fix',
      readiness_refs: [],
    },
    {
      id: 'develop',
      input: 'develop: add SSO flow',
      expected_flow: 'build',
      expected_entry_mode: 'default',
      readiness_refs: [],
    },
    {
      id: 'decide',
      input: 'decide: choose the queue architecture',
      expected_flow: 'explore',
      expected_entry_mode: 'tournament',
      readiness_refs: [],
    },
    {
      id: 'migrate',
      input: 'migrate: replace the legacy SDK',
      expected_flow: 'migrate',
      expected_entry_mode: 'deep',
      readiness_refs: [],
    },
    {
      id: 'cleanup',
      input: 'cleanup: remove safe dead code',
      expected_flow: 'sweep',
      expected_entry_mode: 'default',
      readiness_refs: [],
    },
    {
      id: 'overnight',
      input: 'overnight: improve repo quality',
      expected_flow: 'sweep',
      expected_entry_mode: 'autonomous',
      readiness_refs: [],
    },
    {
      id: 'plan-execution',
      input: 'Execute this plan: ./docs/specs/headless-engine-host-api-v1.md',
      expected_flow: 'build',
      expected_entry_mode: 'default',
      readiness_refs: [],
    },
  ];
  return cases.map((item) => {
    const decision = classifyCompiledFlowTask(item.input);
    const flowOk = decision.flowName === item.expected_flow;
    const entryModeOk =
      item.expected_entry_mode === undefined ||
      decision.inferredEntryModeName === item.expected_entry_mode;
    return {
      id: item.id,
      input: item.input,
      expected_flow: item.expected_flow,
      actual_flow: decision.flowName,
      ...(item.expected_entry_mode === undefined
        ? {}
        : { expected_entry_mode: item.expected_entry_mode }),
      ...(decision.inferredEntryModeName === undefined
        ? {}
        : { actual_entry_mode: decision.inferredEntryModeName }),
      status: flowOk && entryModeOk && item.readiness_refs.length === 0 ? 'implemented' : 'partial',
      readiness_refs: item.readiness_refs,
    };
  });
}

function routerCapabilities(routerIntents) {
  return routerIntents.map((intent) => ({
    id: `router:intent:${intent.id}`,
    kind: intent.id === 'plan-execution' ? 'plan_execution' : 'router_intent',
    title: `${intent.id} routing`,
    status: intent.status,
    summary:
      intent.actual_entry_mode === undefined
        ? `${intent.input} routed to ${intent.actual_flow}; expected ${intent.expected_flow}.`
        : `${intent.input} routed to ${intent.actual_flow} with ${intent.actual_entry_mode} mode; expected ${intent.expected_flow}.`,
    evidence: ['src/flows/router.ts'],
    readiness_refs: intent.readiness_refs,
    axes: {
      intent_hints: [`${intent.id}:`],
      modes: intent.actual_entry_mode === undefined ? [] : [intent.actual_entry_mode],
    },
  }));
}

function connectorRecords(connectorSchemas) {
  const records = connectorSchemas.EnabledConnector.options.map((name) => {
    const caps = connectorSchemas.BUILTIN_CONNECTOR_CAPABILITIES[name];
    const implemented = name !== 'codex-isolated';
    return {
      id: name,
      status: implemented ? 'implemented' : 'missing',
      filesystem: caps.filesystem,
      structured_output: caps.structured_output,
      protocol: 'builtin-json',
      summary: implemented
        ? `${name} is a built-in connector.`
        : `${name} is declared but not implemented by relay selection.`,
      readiness_refs: implemented ? [] : ['REL-002'],
    };
  });
  records.push({
    id: 'custom',
    status: 'implemented',
    filesystem: 'read-only',
    structured_output: 'json',
    protocol: connectorSchemas.PromptTransport.options.join(', '),
    summary:
      'Custom connectors receive prompt and output file paths and return a JSON response through the output file.',
    readiness_refs: [],
  });
  return records;
}

function connectorCapabilities(records) {
  return records.map((record) => ({
    id: `connector:${record.id}`,
    kind: 'connector',
    title: `${record.id} connector`,
    status: record.status,
    summary: record.summary,
    evidence: [
      'src/schemas/connector.ts',
      'src/core-v2/executors/relay.ts',
      'src/shared/relay-selection.ts',
    ],
    readiness_refs: record.readiness_refs,
    axes: {
      worker_handoff:
        record.id === 'custom'
          ? 'Wrapper receives a prompt and returns structured output.'
          : record.protocol,
      ...(record.id === 'custom' ? { proof: 'Working custom connector example.' } : {}),
    },
  }));
}

function hostRecords() {
  return [
    {
      id: 'claude-code-command',
      status: fileIsPresent('commands/run.md') ? 'partial' : 'missing',
      summary: 'Claude Code command surface exists but remains model-mediated.',
      evidence: ['commands/run.md'],
      readiness_refs: ['REL-014'],
    },
    {
      id: 'codex-plugin',
      status: fileIsPresent('plugins/circuit/.codex-plugin/plugin.json') ? 'partial' : 'missing',
      summary: 'Codex plugin files exist and are model-mediated until native support lands.',
      evidence: [
        'plugins/circuit/.codex-plugin/plugin.json',
        'plugins/circuit/scripts/circuit-next.mjs',
      ],
      readiness_refs: ['REL-014'],
    },
    {
      id: 'generic-shell',
      status: 'partial',
      summary:
        'Generic shell can consume JSONL/final JSON, but human text progress is still pending.',
      evidence: ['src/cli/circuit.ts'],
      readiness_refs: ['REL-019'],
    },
    {
      id: 'native-codex-app-server',
      status: 'planned',
      summary: 'Native Codex App Server adapter is a planned host expansion.',
      evidence: ['docs/contracts/native-host-adapters.md'],
      readiness_refs: ['REL-026'],
    },
    {
      id: 'native-claude-agent-sdk',
      status: 'planned',
      summary: 'Claude Agent SDK bridge is a planned host expansion.',
      evidence: ['docs/contracts/native-host-adapters.md'],
      readiness_refs: ['REL-026'],
    },
  ];
}

function hostCapabilities(records) {
  return records.map((record) => ({
    id: `host:${record.id}`,
    kind: 'host',
    title: `${record.id} host`,
    status: record.status,
    summary: record.summary,
    evidence: record.evidence,
    readiness_refs: record.readiness_refs,
  }));
}

function proofCompletionSummary(proofs) {
  const captured = proofs.scenarios.filter((scenario) => scenario.status === 'verified_current');
  const remaining = proofs.scenarios.filter((scenario) => scenario.status !== 'verified_current');
  return {
    captured_count: captured.length,
    remaining_count: remaining.length,
    remaining_ids: remaining.map((scenario) => scenario.id).sort(),
  };
}

function supportCapabilities(rootCommands, proofAxesByCapability, proofs, routerIntents) {
  const commandSet = new Set(rootCommands);
  const proofCompletion = proofCompletionSummary(proofs);
  const planExecutionRouterImplemented = routerIntents.some(
    (intent) => intent.id === 'plan-execution' && intent.status === 'implemented',
  );
  const planExecutionProofAxes = proofAxesByCapability.get('feature:plan-execution') ?? {};
  const planExecutionImplemented =
    planExecutionRouterImplemented && typeof planExecutionProofAxes.proof === 'string';
  const createProofAxes = proofAxesByCapability.get('utility:create') ?? {};
  const createImplemented = commandSet.has('create') && typeof createProofAxes.proof === 'string';
  const handoffProofAxes = proofAxesByCapability.get('utility:handoff') ?? {};
  const handoffImplemented =
    commandSet.has('handoff') && typeof handoffProofAxes.proof === 'string';
  const continuityProofAxes = proofAxesByCapability.get('feature:continuity') ?? {};
  const continuityImplemented = handoffImplemented && typeof continuityProofAxes.proof === 'string';
  return [
    {
      id: 'utility:review',
      kind: 'utility',
      title: 'Review utility',
      status: commandSet.has('review') ? 'implemented' : 'missing',
      summary: 'Standalone Review is present as a flow command.',
      evidence: ['commands/review.md', 'src/flows/review/schematic.json'],
      axes: {
        outputs: ['review.md'],
        review:
          'Standalone Review runs a fresh reviewer relay and writes a severity-ordered review result.',
        ...(proofAxesByCapability.get('utility:review') ?? {}),
      },
    },
    {
      id: 'utility:create',
      kind: 'customization',
      title: 'Create utility',
      status: createImplemented ? 'implemented' : commandSet.has('create') ? 'partial' : 'missing',
      summary: createImplemented
        ? 'Create drafts, validates, and publishes a user-global custom flow package after explicit confirmation.'
        : 'Create utility command is not fully proven in the current command surface.',
      evidence: createImplemented
        ? ['commands/create.md', 'src/cli/create.ts', 'tests/runner/utility-cli.test.ts']
        : [],
      readiness_refs: createImplemented ? [] : ['REL-013'],
      axes: {
        outputs: ['SKILL.md', 'circuit.yaml', 'publish summary'],
        checkpoint: 'Publishing requires an explicit --yes confirmation after draft validation.',
        verification: 'The generated compiled flow parses and passes flow-kind policy validation.',
        continuity: 'Published custom flows are written to the user-global custom flow root.',
        ...createProofAxes,
      },
    },
    {
      id: 'utility:handoff',
      kind: 'continuity',
      title: 'Handoff utility',
      status: handoffImplemented
        ? 'implemented'
        : commandSet.has('handoff')
          ? 'partial'
          : 'missing',
      summary: handoffImplemented
        ? 'Handoff saves, resumes, and clears explicit continuity records through the CLI.'
        : 'Handoff utility command is not fully proven in the current command surface.',
      evidence: handoffImplemented
        ? ['commands/handoff.md', 'src/cli/handoff.ts', 'tests/runner/utility-cli.test.ts']
        : [],
      readiness_refs: handoffImplemented ? [] : ['REL-014'],
      axes: {
        outputs: ['active-run.md', 'continuity record'],
        continuity:
          'Fresh sessions resume from an explicit continuity record or get a clear not-found result.',
        ...handoffProofAxes,
      },
    },
    {
      id: 'feature:checkpoints',
      kind: 'checkpoint',
      title: 'Checkpoints',
      status: 'implemented',
      summary: 'Checkpoint waiting and resume paths exist in core-v2 and the CLI.',
      evidence: [
        'src/core-v2/executors/checkpoint.ts',
        'src/core-v2/run/checkpoint-resume.ts',
        'src/cli/circuit.ts',
      ],
      axes: {
        checkpoint:
          'Compiled checkpoints can pause, auto-resolve safe defaults, or resume from operator input.',
        ...(proofAxesByCapability.get('feature:checkpoints') ?? {}),
      },
    },
    {
      id: 'feature:continuity',
      kind: 'continuity',
      title: 'Continuity',
      status: continuityImplemented ? 'implemented' : 'partial',
      summary: continuityImplemented
        ? 'Core-v2 run records, checkpoint resume, and explicit handoff continuity records are proven.'
        : 'Core-v2 run records and checkpoint resume exist; explicit handoff continuity proof is still pending.',
      evidence: [
        'src/core-v2/run/checkpoint-resume.ts',
        'src/core-v2/run/manifest-snapshot.ts',
        'src/cli/handoff.ts',
      ],
      readiness_refs: continuityImplemented ? [] : ['REL-014'],
      axes: {
        outputs: ['active-run.md', 'continuity record'],
        continuity: 'Resume is explicit and auditable through continuity record and index files.',
        ...continuityProofAxes,
      },
    },
    {
      id: 'feature:plan-execution',
      kind: 'plan_execution',
      title: 'Plan execution',
      status: planExecutionImplemented ? 'implemented' : 'partial',
      summary: planExecutionImplemented
        ? 'Plan-execution requests start the first executable flow slice instead of ending as analysis-only Explore.'
        : 'Plan-execution requests can still finish as analysis-only Explore runs.',
      evidence: ['src/flows/router.ts', 'tests/contracts/flow-router.test.ts'],
      readiness_refs: planExecutionImplemented ? [] : ['REL-016'],
      axes: {
        worker_handoff:
          'Plan-execution requests route into the first executable flow slice instead of ending as analysis-only Explore.',
        ...planExecutionProofAxes,
      },
    },
    {
      id: 'safety:review-untracked-evidence',
      kind: 'safety',
      title: 'Review untracked evidence policy',
      status: 'implemented',
      summary:
        'Review sends untracked paths and sizes by default; file contents require explicit opt-in and still skip binary, unreadable, and oversized samples safely.',
      evidence: [
        'src/flows/review/writers/intake.ts',
        'tests/runner/review-runtime-wiring.test.ts',
        'tests/runner/cli-router.test.ts',
      ],
      readiness_refs: [],
    },
    {
      id: 'safety:accept-with-fixes',
      kind: 'safety',
      title: 'Accept with fixes semantics',
      status: 'implemented',
      summary:
        'Build reports needs_attention and Fix reports partial when review accepts with required follow-up fixes.',
      evidence: ['src/flows/build/writers/close.ts', 'src/flows/fix/writers/close.ts'],
      readiness_refs: [],
    },
    {
      id: 'safety:write-capable-worker',
      kind: 'safety',
      title: 'Write-capable worker disclosure',
      status: 'implemented',
      summary:
        'Write-capable Claude Code worker behavior is disclosed in docs, progress, and final summaries for Build/Fix/Migrate/Sweep.',
      evidence: [
        'README.md',
        'docs/first-run.md',
        'docs/contracts/host-capabilities.md',
        'src/core-v2/run/graph-runner.ts',
        'src/shared/operator-summary-writer.ts',
        'src/shared/write-capable-worker-disclosure.ts',
      ],
      readiness_refs: [],
    },
    {
      id: 'matrix:flow-mode-parity',
      kind: 'docs',
      title: 'Flow and mode parity matrix',
      status: 'implemented',
      summary:
        'Generated matrix exists; approved behavioral exceptions are tracked in the exception ledger.',
      evidence: ['docs/release/parity-matrix.generated.md'],
      readiness_refs: [],
    },
    {
      id: 'route-outcomes:rich',
      kind: 'route_outcome',
      title: 'Rich route outcomes',
      status: 'implemented',
      summary:
        'Rich route outcomes are emitted into compiled routes and checkpoint selections can execute them.',
      evidence: ['src/flows/compile-schematic-to-flow.ts'],
      readiness_refs: [],
    },
    {
      id: 'proof:golden-runs',
      kind: 'proof',
      title: 'Golden release runs',
      status: proofCompletion.remaining_count === 0 ? 'implemented' : 'partial',
      summary:
        proofCompletion.remaining_count === 0
          ? 'All defined golden example runs are captured.'
          : `${proofCompletion.captured_count} golden example runs are captured; remaining blockers: ${proofCompletion.remaining_ids.join(', ')}.`,
      evidence: ['docs/release/proofs/index.yaml'],
      readiness_refs: proofCompletion.remaining_count === 0 ? [] : ['REL-011'],
    },
  ];
}

async function main() {
  const [
    { CurrentCapabilitySnapshot, ProofScenarioIndex },
    { flowPackages },
    router,
    connectorSchemas,
  ] = await Promise.all([
    loadReleaseSchemas(),
    loadCurrentCatalog(),
    loadRouter(),
    loadConnectorSchemas(),
  ]);

  const publicFlowPackages = flowPackages.filter((pkg) => pkg.visibility !== 'internal');
  const flows = publicFlowPackages.map(flowRecord);
  const routerIntents = routerIntentCases(router.classifyCompiledFlowTask);
  const intentHintsByFlow = implementedIntentHintsByFlow(routerIntents);
  const proofs = loadYamlWithSchema('docs/release/proofs/index.yaml', ProofScenarioIndex);
  const proofAxesByCapability = verifiedProofAxesByCapability(proofs);
  const rootCommands = listMarkdownBasenames('commands');
  const codexCommands = listMarkdownBasenames('plugins/circuit/commands');
  const claudeSkills = existsSync(resolve(projectRoot, '.claude-plugin/skills'))
    ? readdirSync(resolve(projectRoot, '.claude-plugin/skills')).filter((entry) =>
        statSync(resolve(projectRoot, '.claude-plugin/skills', entry)).isDirectory(),
      )
    : [];
  const connectors = connectorRecords(connectorSchemas);
  const hosts = hostRecords();

  const capabilities = [
    ...flows.map((record) => capabilityFromFlow(record, intentHintsByFlow, proofAxesByCapability)),
    ...flows.flatMap(modeCapabilities),
    ...flows.flatMap(routeCapabilities),
    ...routerCapabilities(routerIntents),
    ...rootCommands.map((id) => commandCapability(id, 'root', true)),
    ...['create', 'handoff', 'migrate', 'sweep']
      .filter((id) => !rootCommands.includes(id))
      .map((id) => commandCapability(id, 'root', false)),
    ...connectorCapabilities(connectors),
    ...hostCapabilities(hosts),
    ...supportCapabilities(rootCommands, proofAxesByCapability, proofs, routerIntents),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const snapshot = CurrentCapabilitySnapshot.parse({
    schema_version: 1,
    generated_by: 'scripts/release/emit-current-capabilities.mjs',
    flows,
    router_intents: routerIntents,
    commands: {
      root: rootCommands,
      codex_plugin: codexCommands,
      claude_plugin_skills: claudeSkills.sort(),
    },
    connectors,
    hosts,
    capabilities,
  });

  writeOrCheck(OUT_REL, formatWithBiome(OUT_REL, stableJson(snapshot)), check);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
