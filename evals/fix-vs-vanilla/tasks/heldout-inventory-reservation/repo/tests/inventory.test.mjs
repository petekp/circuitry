import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableStock } from '../src/inventory.mjs';

test('availableStock ignores expired reservations but keeps active ones', () => {
  assert.equal(
    availableStock({
      stock: 10,
      nowMs: 1_000,
      reservations: [
        { quantity: 3, expiresAtMs: 900 },
        { quantity: 4, expiresAtMs: 1_100 },
      ],
    }),
    6,
  );
  assert.equal(
    availableStock({
      stock: 2,
      nowMs: 1_000,
      reservations: [
        { quantity: 5, expiresAtMs: 1_001 },
        { quantity: 5, expiresAtMs: 500 },
      ],
    }),
    0,
  );
});
