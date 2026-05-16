import assert from 'node:assert/strict';
import { finalPriceCents } from '../src/discount.mjs';

assert.equal(finalPriceCents({ subtotalCents: 10000, couponPercent: 10 }), 8100);
assert.equal(finalPriceCents({ subtotalCents: 20000, couponPercent: 20 }), 13600);
