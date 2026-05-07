// Designer view-model layer.
//
// Turns the raw schematic + block catalog + selected entry mode into a
// consumer-grade view of the circuit: plain-English step rows, mode-aware
// route summaries, prompt-recipe metadata, and grouped advanced fields.
//
// This layer is presentation-only — it never invents new contracts or
// runtime behavior. The save path stays PUT /api/flows/:id/schematic.

import type { Block, BlockCatalog, Schematic, SchematicStep } from './types';

type ExecutionKind = 'compose' | 'relay' | 'verification' | 'checkpoint' | 'sub-run';

export type StepRunner =
  | 'circuit'
  | 'ai-researcher'
  | 'ai-implementer'
  | 'ai-reviewer'
  | 'human'
  | 'sub-circuit'
  | 'unknown';

export type DesignerEntryMode = {
  name: string;
  depth: string;
  description: string;
};

type DesignerStage = {
  canonical: string;
  id: string;
  title: string;
  steps: DesignerStep[];
};

// Plain-English description of a single route outcome on a single step,
// resolved against the active mode (so a `lite` override shows the lite
// target, not the default).
type DesignerRouteSummary = {
  name: string;
  authoredTarget: string;
  effectiveTarget: string;
  overriddenForMode: boolean;
  // `null` for terminals (@stop, @complete, @handoff, @escalate); otherwise
  // the title of the target step looked up from the schematic.
  effectiveTargetTitle: string | null;
  plainEnglish: string;
};

type DesignerRouteOverrideSummary = {
  routeName: string;
  modeName: string;
  target: string;
  targetTitle: string | null;
  plainEnglish: string;
};

type DesignerCheckpointChoice = {
  id: string;
  label: string;
  description: string | null;
};

type DesignerCheckpointSummary = {
  prompt: string;
  choices: DesignerCheckpointChoice[];
  safeDefaultChoice: string | null;
  safeAutonomousChoice: string | null;
};

// What the user sees for a step's prompt before any runtime templating
// happens. We label this "AI instructions" rather than "prompt" — exact
// run-time wording depends on context the designer does not have.
type DesignerPromptPreview = {
  kind: 'relay' | 'checkpoint' | 'compose-or-verify' | 'sub-run';
  // Short title shown in the inspector header, e.g. "AI instructions" or
  // "Question for you".
  label: string;
  // A short one-line summary safe to show in the row.
  oneLine: string;
  // Multi-paragraph body shown only in the Advanced view.
  body: string[];
  // Response-shape hint for relay steps (filled when known).
  responseShape: string | null;
};

type DesignerSelectionSummary = {
  source: 'authored' | 'inherited';
  // Plain-English summary line shown by default, e.g.
  // "No AI settings on this step."
  oneLine: string;
  // Detailed rows for the Advanced view, each describing a field the
  // schematic explicitly sets.
  fields: { label: string; value: string }[];
};

// Grouped raw fields surfaced inside the Advanced view. We group them so
// the inspector can render distinct cards (writes / check / protocol /
// inputs / outputs) without each tab knowing the schema.
type DesignerAdvancedField = { label: string; value: string };
type DesignerAdvancedGroup = {
  id: 'inputs-outputs' | 'writes' | 'check' | 'protocol-execution';
  title: string;
  fields: DesignerAdvancedField[];
};

export type DesignerStep = {
  id: string;
  title: string;
  // Author-visible block id, kept opaque on the row but exposed in the
  // inspector's Advanced view.
  blockId: string;
  blockTitle: string | null;
  blockPurpose: string | null;
  stage: string;
  executionKind: ExecutionKind;
  relayRole: string | null;
  runner: StepRunner;
  asksOperator: boolean;
  // Mode-aware single-line "what next" sentence. Always present, even when
  // a step's only outgoing route is `@stop`.
  nextStepSummary: string;
  // Step-purpose sentence the inspector shows in the Overview tab. Tries
  // the schematic title first, then the block purpose.
  whatHappens: string;
  // Plain-English line about who runs this step.
  runnerSummary: string;
  // Plain-English line for whether the operator is asked.
  humanInteractionSummary: string;
  // Plain-English line about how the active mode/depth changes things.
  modeBehaviorSummary: string;
  evidence: string[];
  routes: DesignerRouteSummary[];
  routeOverrides: DesignerRouteOverrideSummary[];
  checkpoint: DesignerCheckpointSummary | null;
  prompt: DesignerPromptPreview;
  selection: DesignerSelectionSummary;
  advanced: DesignerAdvancedGroup[];
};

export type DesignerHealth = {
  status: 'ok' | 'warn' | 'error';
  // Short label for the status pill ("Looks good", "Problems found").
  label: string;
  // Plain-English explanation, one sentence.
  detail: string;
};

export type DesignerCircuit = {
  id: string;
  title: string;
  purpose: string;
  status: string;
  startsAt: string;
  entryModes: DesignerEntryMode[];
  // The mode the rest of the view-model is computed against.
  activeMode: DesignerEntryMode;
  stages: DesignerStage[];
  steps: DesignerStep[];
  health: DesignerHealth;
};

export type DesignerModelInputs = {
  schematic: Schematic;
  catalog: BlockCatalog;
  // If omitted, the first entry mode is used. Names are matched
  // case-sensitively against `entry_modes[].name`.
  modeName?: string;
};

const TERMINAL_TARGETS = new Set(['@complete', '@stop', '@handoff', '@escalate']);

// Friendly label for the four terminal targets — used in route summaries
// and the next-step sentence so we never show `@stop` raw.
const TERMINAL_LABELS: Record<string, string> = {
  '@complete': 'finishes here',
  '@stop': 'stops here',
  '@handoff': 'hands off for help',
  '@escalate': 'asks for help',
};

// Phrase describing each route outcome. The schematic uses outcome names
// from FlowRoute (continue, retry, revise, ask, split, stop, handoff,
// escalate, complete). Anything else gets a fallback phrasing.
const ROUTE_PHRASES: Record<string, string> = {
  continue: 'On success',
  retry: 'If it tries again',
  revise: 'If revisions are needed',
  ask: 'If it pauses to ask',
  split: 'If work splits into batches',
  stop: 'If it stops early',
  handoff: 'If handed off',
  escalate: 'If it asks for help',
  complete: 'When done',
};

function routePhrase(routeName: string): string {
  return ROUTE_PHRASES[routeName] ?? `On ${routeName}`;
}

export function deriveDesignerModel(inputs: DesignerModelInputs): DesignerCircuit {
  const { schematic, catalog } = inputs;
  const entryModes: DesignerEntryMode[] = readEntryModes(schematic);
  const activeMode = pickActiveMode(entryModes, inputs.modeName);
  const blockById = new Map(catalog.blocks.map((b) => [b.id, b]));
  const stepById = new Map(schematic.items.map((s) => [s.id, s]));

  const steps: DesignerStep[] = schematic.items.map((step) =>
    deriveStep(step, { activeMode, blockById, stepById }),
  );

  const stages = groupStages(schematic, steps);
  const health = deriveHealth(schematic, steps);

  return {
    id: schematic.id,
    title: schematic.title,
    purpose: schematic.purpose,
    status: schematic.status,
    startsAt: schematic.starts_at,
    entryModes,
    activeMode,
    stages,
    steps,
    health,
  };
}

function readEntryModes(schematic: Schematic): DesignerEntryMode[] {
  const raw = (schematic as unknown as { entry_modes?: unknown }).entry_modes;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ name: 'default', depth: 'standard', description: 'Default entry mode.' }];
  }
  return raw.map((mode) => {
    const m = mode as { name?: unknown; depth?: unknown; description?: unknown };
    return {
      name: typeof m.name === 'string' ? m.name : 'default',
      depth: typeof m.depth === 'string' ? m.depth : 'standard',
      description: typeof m.description === 'string' ? m.description : 'No description provided.',
    };
  });
}

function pickActiveMode(
  modes: DesignerEntryMode[],
  requested: string | undefined,
): DesignerEntryMode {
  if (requested !== undefined) {
    const hit = modes.find((mode) => mode.name === requested);
    if (hit) return hit;
  }
  const first = modes[0];
  return first ?? { name: 'default', depth: 'standard', description: 'Default entry mode.' };
}

type DeriveContext = {
  activeMode: DesignerEntryMode;
  blockById: Map<string, Block>;
  stepById: Map<string, SchematicStep>;
};

function deriveStep(step: SchematicStep, ctx: DeriveContext): DesignerStep {
  const block = ctx.blockById.get(step.block) ?? null;
  const executionKind = ((step.execution as { kind?: string } | undefined)?.kind ??
    'compose') as ExecutionKind;
  const relayRole = (step.execution as { role?: string } | undefined)?.role ?? null;
  const runner = pickRunner(executionKind, relayRole, block);
  const asksOperator = executionKind === 'checkpoint';

  const routes = deriveRoutes(step, ctx);
  const routeOverrides = deriveRouteOverrides(step, ctx);
  const checkpoint = deriveCheckpoint(step);
  const prompt = derivePrompt(step, executionKind, block);
  const selection = deriveSelection(step);
  const advanced = deriveAdvanced(step);

  return {
    id: step.id,
    title: step.title,
    blockId: step.block,
    blockTitle: block?.title ?? null,
    blockPurpose: block?.purpose ?? null,
    stage: step.stage,
    executionKind,
    relayRole,
    runner,
    asksOperator,
    nextStepSummary: deriveNextStepSummary(routes, routeOverrides, ctx.activeMode),
    whatHappens: step.title || (block?.purpose ?? 'No description.'),
    runnerSummary: deriveRunnerSummary(runner, relayRole),
    humanInteractionSummary: deriveHumanInteractionSummary(executionKind, block, checkpoint),
    modeBehaviorSummary: deriveModeBehaviorSummary(routeOverrides, ctx.activeMode),
    evidence: [...(step.evidence_requirements ?? [])],
    routes,
    routeOverrides,
    checkpoint,
    prompt,
    selection,
    advanced,
  };
}

function pickRunner(
  kind: ExecutionKind,
  relayRole: string | null,
  _block: Block | null,
): StepRunner {
  if (kind === 'compose' || kind === 'verification') return 'circuit';
  if (kind === 'checkpoint') return 'human';
  if (kind === 'sub-run') return 'sub-circuit';
  if (kind === 'relay') {
    if (relayRole === 'researcher') return 'ai-researcher';
    if (relayRole === 'implementer') return 'ai-implementer';
    if (relayRole === 'reviewer') return 'ai-reviewer';
    return 'unknown';
  }
  return 'unknown';
}

function deriveRunnerSummary(runner: StepRunner, relayRole: string | null): string {
  switch (runner) {
    case 'circuit':
      return 'Circuit takes care of this for you.';
    case 'ai-researcher':
      return 'An AI does the research.';
    case 'ai-implementer':
      return 'An AI writes the change.';
    case 'ai-reviewer':
      return 'An AI reviews the work.';
    case 'human':
      return 'Pauses to ask you.';
    case 'sub-circuit':
      return 'Runs a nested circuit.';
    case 'unknown':
      return relayRole ? `An AI ${relayRole} runs this.` : 'An AI runs this.';
  }
}

function deriveHumanInteractionSummary(
  kind: ExecutionKind,
  block: Block | null,
  checkpoint: DesignerCheckpointSummary | null,
): string {
  if (kind === 'checkpoint') {
    if (checkpoint && checkpoint.choices.length > 0) {
      const choices = checkpoint.choices.map((c) => c.label || c.id).join(', ');
      return `Pauses to ask: ${choices}.`;
    }
    return 'Pauses to ask you before continuing.';
  }
  if (block?.human_interaction === 'optional') {
    return 'No questions, by default.';
  }
  return 'No questions.';
}

function deriveModeBehaviorSummary(
  overrides: DesignerRouteOverrideSummary[],
  activeMode: DesignerEntryMode,
): string {
  const matching = overrides.filter((override) => override.modeName === activeMode.depth);
  if (matching.length === 0) {
    return `${capitalize(activeMode.name)} mode (${activeMode.depth}).`;
  }
  const phrases = matching.map((m) => m.plainEnglish).join(' ');
  return `${capitalize(activeMode.name)} mode (${activeMode.depth}). ${phrases}`;
}

function capitalize(text: string): string {
  const first = text[0];
  if (first === undefined) return text;
  return first.toUpperCase() + text.slice(1);
}

function targetTitle(target: string, ctx: DeriveContext): string | null {
  if (TERMINAL_TARGETS.has(target)) return null;
  return ctx.stepById.get(target)?.title ?? null;
}

function describeRoute(routeName: string, effectiveTarget: string, ctx: DeriveContext): string {
  const phrase = routePhrase(routeName);
  if (TERMINAL_TARGETS.has(effectiveTarget)) {
    return `${phrase}, ${TERMINAL_LABELS[effectiveTarget] ?? effectiveTarget}.`;
  }
  const title = ctx.stepById.get(effectiveTarget)?.title;
  if (title) return `${phrase}, goes to "${title}".`;
  return `${phrase}, goes to ${effectiveTarget}.`;
}

function deriveRoutes(step: SchematicStep, ctx: DeriveContext): DesignerRouteSummary[] {
  const overrides =
    (step.route_overrides as Record<string, Record<string, string>> | undefined) ?? {};
  const activeDepth = ctx.activeMode.depth;
  return Object.entries(step.routes).map(([routeName, authoredTarget]) => {
    const overrideForMode = overrides[routeName]?.[activeDepth];
    const effectiveTarget = overrideForMode ?? authoredTarget;
    return {
      name: routeName,
      authoredTarget,
      effectiveTarget,
      overriddenForMode: overrideForMode !== undefined,
      effectiveTargetTitle: targetTitle(effectiveTarget, ctx),
      plainEnglish: describeRoute(routeName, effectiveTarget, ctx),
    };
  });
}

function deriveRouteOverrides(
  step: SchematicStep,
  ctx: DeriveContext,
): DesignerRouteOverrideSummary[] {
  const overrides =
    (step.route_overrides as Record<string, Record<string, string>> | undefined) ?? {};
  const out: DesignerRouteOverrideSummary[] = [];
  for (const [routeName, perDepth] of Object.entries(overrides)) {
    for (const [depth, target] of Object.entries(perDepth)) {
      const phrase = routePhrase(routeName).toLowerCase();
      const title = ctx.stepById.get(target)?.title;
      const targetText = TERMINAL_TARGETS.has(target)
        ? (TERMINAL_LABELS[target] ?? target)
        : title
          ? `"${title}"`
          : target;
      out.push({
        routeName,
        modeName: depth,
        target,
        targetTitle: targetTitle(target, ctx),
        plainEnglish: `In ${depth} mode, ${phrase} goes to ${targetText}.`,
      });
    }
  }
  return out;
}

function deriveNextStepSummary(
  routes: DesignerRouteSummary[],
  _overrides: DesignerRouteOverrideSummary[],
  _activeMode: DesignerEntryMode,
): string {
  // Show the "continue" route first when present — that's the happy path.
  const happyPath = routes.find((r) => r.name === 'continue' || r.name === 'complete');
  if (happyPath) return happyPath.plainEnglish;
  const first = routes[0];
  if (first) return first.plainEnglish;
  return 'No next step set.';
}

function deriveCheckpoint(step: SchematicStep): DesignerCheckpointSummary | null {
  const policy = (step as { checkpoint_policy?: unknown }).checkpoint_policy as
    | {
        prompt?: unknown;
        choices?: unknown;
        safe_default_choice?: unknown;
        safe_autonomous_choice?: unknown;
      }
    | undefined;
  if (!policy || typeof policy !== 'object') return null;
  const prompt = typeof policy.prompt === 'string' ? policy.prompt : '';
  const rawChoices = Array.isArray(policy.choices) ? policy.choices : [];
  const choices: DesignerCheckpointChoice[] = rawChoices.map((c) => {
    const choice = c as { id?: unknown; label?: unknown; description?: unknown };
    const id = typeof choice.id === 'string' ? choice.id : 'unknown';
    return {
      id,
      label: typeof choice.label === 'string' ? choice.label : id,
      description: typeof choice.description === 'string' ? choice.description : null,
    };
  });
  return {
    prompt,
    choices,
    safeDefaultChoice:
      typeof policy.safe_default_choice === 'string' ? policy.safe_default_choice : null,
    safeAutonomousChoice:
      typeof policy.safe_autonomous_choice === 'string' ? policy.safe_autonomous_choice : null,
  };
}

function derivePrompt(
  step: SchematicStep,
  kind: ExecutionKind,
  block: Block | null,
): DesignerPromptPreview {
  if (kind === 'relay') {
    const role = (step.execution as { role?: string }).role ?? 'worker';
    const oneLine = `What the AI ${role} is asked to do.`;
    const body = [
      `Sends a request to an AI ${role}.`,
      `Goal: ${step.title}.`,
      block?.purpose ? `Step type: ${block.purpose}` : null,
      'The exact wording is built when the circuit runs, from the brief, plan, and any earlier results listed as inputs.',
    ].filter((line): line is string => typeof line === 'string');
    const protocol = (step as { protocol?: string }).protocol ?? null;
    const responseShape = protocol
      ? `The AI's reply has to fit the ${step.output} shape (${protocol}).`
      : `The AI's reply has to fit the ${step.output} shape.`;
    return { kind: 'relay', label: 'AI instructions', oneLine, body, responseShape };
  }
  if (kind === 'checkpoint') {
    const policy = deriveCheckpoint(step);
    const oneLine = policy?.prompt ?? 'A question for you to answer.';
    const body: string[] = [];
    if (policy?.prompt) body.push(policy.prompt);
    if (policy && policy.choices.length > 0) {
      body.push(`Choices: ${policy.choices.map((c) => c.label || c.id).join(', ')}.`);
    }
    if (policy?.safeDefaultChoice) {
      body.push(`If you skip the question: ${policy.safeDefaultChoice}.`);
    }
    if (policy?.safeAutonomousChoice) {
      body.push(`If running unattended: ${policy.safeAutonomousChoice}.`);
    }
    return {
      kind: 'checkpoint',
      label: 'Question for you',
      oneLine,
      body: body.length > 0 ? body : ['No question written yet.'],
      responseShape: null,
    };
  }
  if (kind === 'sub-run') {
    const goal = (step.execution as { goal?: string }).goal ?? null;
    const flowRef = (step.execution as { flow_ref?: { flow_id?: string; entry_mode?: string } })
      .flow_ref;
    const oneLine = goal
      ? `Goal for the nested circuit: ${goal}.`
      : 'Runs a nested circuit before continuing.';
    const body = [
      goal ? `Goal for the nested circuit: ${goal}` : 'Runs a nested circuit before continuing.',
      flowRef?.flow_id
        ? `Nested circuit: ${flowRef.flow_id} (${flowRef.entry_mode ?? 'default'}).`
        : null,
    ].filter((line): line is string => typeof line === 'string');
    return { kind: 'sub-run', label: 'Nested circuit', oneLine, body, responseShape: null };
  }
  const oneLine = 'Circuit takes care of this for you.';
  const body = [
    block?.purpose ?? 'Circuit takes care of this for you.',
    'No AI is involved here. Circuit assembles this step from the steps before it.',
  ];
  return {
    kind: 'compose-or-verify',
    label: 'How this step works',
    oneLine,
    body,
    responseShape: null,
  };
}

function deriveSelection(step: SchematicStep): DesignerSelectionSummary {
  const sel = (step as { selection?: unknown }).selection as
    | {
        model?: { provider?: string; model?: string };
        effort?: string;
        depth?: string;
        skills?: { mode?: string; skills?: string[] };
        invocation_options?: Record<string, unknown>;
      }
    | undefined;
  if (!sel || typeof sel !== 'object' || Object.keys(sel).length === 0) {
    return {
      source: 'inherited',
      oneLine: 'No AI settings on this step.',
      fields: [],
    };
  }
  const fields: DesignerAdvancedField[] = [];
  if (sel.model) {
    fields.push({
      label: 'Model',
      value: `${sel.model.provider ?? '?'} · ${sel.model.model ?? '?'}`,
    });
  }
  if (typeof sel.effort === 'string') {
    fields.push({ label: 'Effort', value: sel.effort });
  }
  if (typeof sel.depth === 'string') {
    fields.push({ label: 'Depth override', value: sel.depth });
  }
  if (sel.skills) {
    const mode = sel.skills.mode ?? 'inherit';
    if (mode === 'inherit') {
      fields.push({ label: 'Skills', value: 'inherit' });
    } else {
      const list = (sel.skills.skills ?? []).join(', ');
      fields.push({
        label: 'Skills',
        value: list.length > 0 ? `${mode} ${list}` : `${mode} (none)`,
      });
    }
  }
  if (sel.invocation_options && Object.keys(sel.invocation_options).length > 0) {
    fields.push({
      label: 'Extra options',
      value: Object.keys(sel.invocation_options).join(', '),
    });
  }
  const oneLine =
    fields.length === 0
      ? 'AI settings on this step (no fields).'
      : `Set on this step: ${fields.map((f) => f.label.toLowerCase()).join(', ')}.`;
  return { source: 'authored', oneLine, fields };
}

function deriveAdvanced(step: SchematicStep): DesignerAdvancedGroup[] {
  const out: DesignerAdvancedGroup[] = [];

  // Inputs and output contracts.
  const inputs: DesignerAdvancedField[] = Object.entries(step.input ?? {}).map(
    ([name, contract]) => ({
      label: name,
      value: contract,
    }),
  );
  out.push({
    id: 'inputs-outputs',
    title: 'What it takes and gives back',
    fields: [...inputs, { label: 'Gives back', value: step.output }],
  });

  // Writes.
  const writes = (step as { writes?: Record<string, string> }).writes ?? {};
  const writesFields: DesignerAdvancedField[] = Object.entries(writes).map(([k, v]) => ({
    label: k,
    value: v,
  }));
  if (writesFields.length > 0) {
    out.push({ id: 'writes', title: 'Files it writes', fields: writesFields });
  }

  // Check.
  const check = (step as { check?: Record<string, unknown> }).check ?? {};
  const checkFields: DesignerAdvancedField[] = Object.entries(check).map(([k, v]) => ({
    label: k,
    value: Array.isArray(v) ? v.join(', ') : String(v),
  }));
  if (checkFields.length > 0) {
    out.push({ id: 'check', title: 'Result rules', fields: checkFields });
  }

  // Protocol + execution kind.
  const protocol = (step as { protocol?: string }).protocol;
  const protocolFields: DesignerAdvancedField[] = [
    { label: 'Step type', value: step.block },
    { label: 'Runs as', value: step.execution?.kind ?? 'compose' },
  ];
  if (step.execution?.role) {
    protocolFields.push({ label: 'Role', value: step.execution.role });
  }
  if (typeof protocol === 'string') {
    protocolFields.push({ label: 'Protocol', value: protocol });
  }
  out.push({ id: 'protocol-execution', title: 'How it runs', fields: protocolFields });

  return out;
}

function groupStages(schematic: Schematic, steps: DesignerStep[]): DesignerStage[] {
  const stages = (
    schematic as unknown as { stages?: { canonical: string; id: string; title: string }[] }
  ).stages;
  const stageOrder = ['frame', 'analyze', 'plan', 'act', 'verify', 'review', 'close'] as const;
  const ordered: DesignerStage[] = [];
  const seen = new Set<string>();
  for (const canonical of stageOrder) {
    const stageMeta = stages?.find((s) => s.canonical === canonical);
    const stageSteps = steps.filter((s) => s.stage === canonical);
    if (stageSteps.length === 0 && !stageMeta) continue;
    seen.add(canonical);
    ordered.push({
      canonical,
      id: stageMeta?.id ?? canonical,
      title: stageMeta?.title ?? capitalize(canonical),
      steps: stageSteps,
    });
  }
  // Any custom canonical we did not anticipate.
  const customCanonicals = [...new Set(steps.map((s) => s.stage))].filter((s) => !seen.has(s));
  for (const canonical of customCanonicals) {
    const stageMeta = stages?.find((s) => s.canonical === canonical);
    ordered.push({
      canonical,
      id: stageMeta?.id ?? canonical,
      title: stageMeta?.title ?? capitalize(canonical),
      steps: steps.filter((s) => s.stage === canonical),
    });
  }
  return ordered;
}

function deriveHealth(_schematic: Schematic, steps: DesignerStep[]): DesignerHealth {
  const dangling = steps.flatMap((step) =>
    step.routes.filter(
      (route) =>
        !TERMINAL_TARGETS.has(route.effectiveTarget) &&
        !steps.some((s) => s.id === route.effectiveTarget),
    ),
  );
  if (dangling.length > 0) {
    return {
      status: 'error',
      label: 'Problems found',
      detail: `${dangling.length} next-step target${dangling.length === 1 ? '' : 's'} don't point to a known step.`,
    };
  }
  return {
    status: 'ok',
    label: 'Looks good',
    detail: 'Every step connects to another step.',
  };
}
