import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageItems } from '../src/pagination.mjs';

test('pageItems uses zero-based page indexes', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(pageItems(items, 0, 3), ['a', 'b', 'c']);
  assert.deepEqual(pageItems(items, 1, 3), ['d', 'e', 'f']);
});
