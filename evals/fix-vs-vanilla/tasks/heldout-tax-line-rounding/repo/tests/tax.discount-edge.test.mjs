import assert from 'node:assert/strict';
import { totalTaxCents } from '../src/tax.mjs';

assert.equal(
  totalTaxCents(
    [
      { amountCents: 1000, discountCents: 100 },
      { amountCents: 50, discountCents: 200 },
    ],
    1000,
  ),
  90,
);
