import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAmount } from '../src/money.mjs';

test('parseAmount preserves accounting-style negative amounts', () => {
  assert.equal(parseAmount('($12.50)'), -12.5);
  assert.equal(parseAmount('($0.99)'), -0.99);
});
