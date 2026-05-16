import assert from 'node:assert/strict';
import { shippingFeeCents } from '../src/shipping.mjs';

assert.equal(shippingFeeCents({ subtotalCents: 4999, region: 'domestic' }), 599);
assert.equal(shippingFeeCents({ subtotalCents: 5000, region: 'domestic' }), 0);
