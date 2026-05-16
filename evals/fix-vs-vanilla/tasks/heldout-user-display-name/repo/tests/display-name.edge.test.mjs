import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayName } from '../src/display-name.mjs';

test('displayName prefers explicit names and falls back to email local parts', () => {
  assert.equal(displayName({ preferredName: 'Max', firstName: 'Maxine', lastName: 'Stone' }), 'Max');
  assert.equal(displayName({ email: 'sam@example.test' }), 'sam');
});
