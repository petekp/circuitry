import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExpired } from '../src/tokens.mjs';

test('isExpired treats expiresAt as epoch seconds', () => {
  assert.equal(isExpired({ expiresAt: 1_700_000_000 }, 1_700_000_001_000), true);
  assert.equal(isExpired({ expiresAt: 1_700_000_060 }, 1_700_000_001_000), false);
});
