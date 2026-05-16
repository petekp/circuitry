import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQuery } from '../src/query.mjs';

test('parseQuery decodes plus signs as spaces', () => {
  assert.deepEqual(parseQuery('?q=hello+world&sort=most+recent'), {
    q: 'hello world',
    sort: 'most recent',
  });
  assert.deepEqual(parseQuery('first+name=Ada+Lovelace'), {
    'first name': 'Ada Lovelace',
  });
});
