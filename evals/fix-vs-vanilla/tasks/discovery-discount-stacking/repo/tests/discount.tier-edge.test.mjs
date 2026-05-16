import assert from 'node:assert/strict';
import { finalPriceCents } from '../src/discount.mjs';

assert.equal(finalPriceCents({ subtotalCents: 20000 }), 17000);
assert.equal(finalPriceCents({ subtotalCents: 25000 }), 21250);
