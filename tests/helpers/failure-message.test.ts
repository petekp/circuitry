// Self-tests for the failure-message helper module. Pins:
//   - the formatter prefixes the rule and concatenates detail with em dash
//   - schema helpers pass on the correct outcome and fail with messages
//     that contain the rule string
//   - step-handler helpers narrow the result type on success and throw
//     with a rule-tagged message on the wrong kind
//   - the optional reason pattern matcher on expectStepAborted fires
//     when the reason does not match
//
// Each negative case asserts the failure message contains the rule
// substring — the whole point of these helpers is that the rule shows
// up in the failure output.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type StepHandlerResult,
  expectSchemaAccepts,
  expectSchemaRejects,
  expectStepAborted,
  expectStepAdvance,
  expectStepWaitingCheckpoint,
  invariantMessage,
} from './failure-message.js';

const RULE = 'TEST-I1: helper module behaves as documented';

function captureFailure(fn: () => void): { readonly message: string } {
  try {
    fn();
  } catch (err) {
    if (err instanceof Error) return { message: err.message };
    return { message: String(err) };
  }
  throw new Error('expected the captured function to throw');
}

describe('invariantMessage', () => {
  it('returns the rule unchanged when no detail is given', () => {
    expect(invariantMessage(RULE)).toBe(RULE);
  });

  it('joins rule and detail with an em dash', () => {
    expect(invariantMessage(RULE, 'value was wrong')).toBe(`${RULE} — value was wrong`);
  });
});

describe('expectSchemaRejects', () => {
  const schema = z.object({ name: z.string() }).strict();

  it('passes silently when the schema rejects', () => {
    expectSchemaRejects(schema, { name: 42 }, RULE);
  });

  it('fails with a rule-tagged message when the schema accepts', () => {
    const { message } = captureFailure(() => {
      expectSchemaRejects(schema, { name: 'ok' }, RULE);
    });
    expect(message).toContain(RULE);
    expect(message).toContain('expected schema parse to fail');
  });
});

describe('expectSchemaAccepts', () => {
  const schema = z.object({ name: z.string() }).strict();

  it('returns the parsed value when the schema accepts', () => {
    const out = expectSchemaAccepts(schema, { name: 'ok' }, RULE);
    expect(out.name).toBe('ok');
  });

  it('fails with a rule-tagged message and surfaces zod issues when the schema rejects', () => {
    const { message } = captureFailure(() => {
      expectSchemaAccepts(schema, { name: 42 }, RULE);
    });
    expect(message).toContain(RULE);
    expect(message).toContain('zod issues');
    expect(message).toContain('name');
  });
});

describe('expectStepAborted', () => {
  it('narrows and passes on { kind: aborted } without options', () => {
    const result: StepHandlerResult = { kind: 'aborted', reason: 'because' };
    expectStepAborted(result, RULE);
    expect(result.reason).toBe('because');
  });

  it('passes when the reason regex matches', () => {
    const result: StepHandlerResult = { kind: 'aborted', reason: 'parse failure: bad json' };
    expectStepAborted(result, RULE, { reason: /parse failure/ });
  });

  it('passes when the reason substring matches', () => {
    const result: StepHandlerResult = { kind: 'aborted', reason: 'parse failure: bad json' };
    expectStepAborted(result, RULE, { reason: 'parse failure' });
  });

  it('throws a rule-tagged error when the result is not aborted', () => {
    const result: StepHandlerResult = { kind: 'advance' };
    const { message } = captureFailure(() => {
      expectStepAborted(result, RULE);
    });
    expect(message).toContain(RULE);
    expect(message).toContain("got 'advance'");
  });

  it('fails with a rule-tagged message when the reason regex does not match', () => {
    const result: StepHandlerResult = { kind: 'aborted', reason: 'something else' };
    const { message } = captureFailure(() => {
      expectStepAborted(result, RULE, { reason: /parse failure/ });
    });
    expect(message).toContain(RULE);
    expect(message).toContain('aborted reason did not match expected pattern');
  });
});

describe('expectStepAdvance', () => {
  it('narrows and passes on { kind: advance }', () => {
    const result: StepHandlerResult = { kind: 'advance' };
    expectStepAdvance(result, RULE);
  });

  it('throws a rule-tagged error when the result is not advance', () => {
    const result: StepHandlerResult = { kind: 'aborted', reason: 'nope' };
    const { message } = captureFailure(() => {
      expectStepAdvance(result, RULE);
    });
    expect(message).toContain(RULE);
    expect(message).toContain("got 'aborted'");
  });
});

describe('expectStepWaitingCheckpoint', () => {
  const waiting: StepHandlerResult = {
    kind: 'waiting_checkpoint',
    checkpoint: {
      stepId: 'step-x',
      requestPath: 'reports/x.json',
      allowedChoices: ['continue'],
    },
  };

  it('narrows and passes on { kind: waiting_checkpoint }', () => {
    expectStepWaitingCheckpoint(waiting, RULE);
    expect(waiting.checkpoint.stepId).toBe('step-x');
  });

  it('throws a rule-tagged error when the result is not waiting_checkpoint', () => {
    const result: StepHandlerResult = { kind: 'advance' };
    const { message } = captureFailure(() => {
      expectStepWaitingCheckpoint(result, RULE);
    });
    expect(message).toContain(RULE);
    expect(message).toContain("got 'advance'");
  });
});
