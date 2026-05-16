import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsvLine } from '../src/csv.mjs';

test('parseCsvLine decodes escaped quotes in quoted fields', () => {
  assert.deepEqual(parseCsvLine('"Ada","She said ""ship it""","notes"'), [
    'Ada',
    'She said "ship it"',
    'notes',
  ]);
  assert.deepEqual(parseCsvLine('"a,b","c""d",e'), ['a,b', 'c"d', 'e']);
});
