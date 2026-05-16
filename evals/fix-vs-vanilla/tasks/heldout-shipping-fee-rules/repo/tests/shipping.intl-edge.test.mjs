import assert from 'node:assert/strict';
import { shippingFeeCents } from '../src/shipping.mjs';

assert.equal(shippingFeeCents({ subtotalCents: 9999, region: 'international' }), 1599);
assert.equal(shippingFeeCents({ subtotalCents: 10000, region: 'international' }), 799);
