import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAmount } from '../src/money.mjs';

test('parseAmount preserves leading minus signs', () => {
  assert.equal(parseAmount('-12.50'), -12.5);
  assert.equal(parseAmount('3.25'), 3.25);
});
