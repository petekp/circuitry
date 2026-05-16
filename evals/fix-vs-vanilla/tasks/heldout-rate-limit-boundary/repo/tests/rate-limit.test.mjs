import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAcceptRequest } from '../src/rate-limit.mjs';

test('canAcceptRequest expires events at the rolling window boundary', () => {
  assert.equal(canAcceptRequest([0, 100, 200], 1000, 1000, 3), true);
  assert.equal(canAcceptRequest([1, 100, 200], 1000, 1000, 3), false);
});
