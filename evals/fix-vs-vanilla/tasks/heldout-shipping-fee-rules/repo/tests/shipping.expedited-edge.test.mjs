import assert from 'node:assert/strict';
import { shippingFeeCents } from '../src/shipping.mjs';

assert.equal(shippingFeeCents({ subtotalCents: 6000, region: 'domestic', expedited: true }), 899);
assert.equal(
  shippingFeeCents({ subtotalCents: 10000, region: 'international', expedited: true }),
  2098,
);
