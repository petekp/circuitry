import assert from 'node:assert/strict';
import { finalPriceCents } from '../src/discount.mjs';

assert.equal(finalPriceCents({ subtotalCents: 10000 }), 9000);
assert.equal(finalPriceCents({ subtotalCents: 10001 }), 9001);
