import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugifyTitle } from '../src/slug.mjs';

test('slugifyTitle trims punctuation-generated hyphens', () => {
  assert.equal(slugifyTitle('Hello, world!!!'), 'hello-world');
  assert.equal(slugifyTitle('  Ops: retry / resume  '), 'ops-retry-resume');
});
