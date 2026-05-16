import assert from 'node:assert/strict';
import { test } from 'node:test';
import { movingAverage } from '../src/moving-average.mjs';

test('movingAverage includes every complete window', () => {
  assert.deepEqual(movingAverage([2, 4, 6, 8], 2), [3, 5, 7]);
  assert.deepEqual(movingAverage([3, 6, 9], 3), [6]);
});
