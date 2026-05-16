import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExpired } from '../src/tokens.mjs';

test('isExpired also accepts explicit millisecond expiry fields', () => {
  assert.equal(isExpired({ expiresAtMs: 1_700_000_000_000 }, 1_700_000_001_000), true);
  assert.equal(isExpired({ expiresAtMs: 1_700_000_060_000 }, 1_700_000_001_000), false);
});
