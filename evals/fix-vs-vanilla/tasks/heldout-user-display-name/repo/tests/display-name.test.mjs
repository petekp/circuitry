import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayName } from '../src/display-name.mjs';

test('displayName joins only present first and last names', () => {
  assert.equal(displayName({ firstName: 'Ada', lastName: null }), 'Ada');
  assert.equal(displayName({ firstName: undefined, lastName: 'Ng' }), 'Ng');
});
