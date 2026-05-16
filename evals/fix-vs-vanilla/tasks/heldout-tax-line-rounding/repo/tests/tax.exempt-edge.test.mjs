import assert from 'node:assert/strict';
import { totalTaxCents } from '../src/tax.mjs';

assert.equal(
  totalTaxCents(
    [
      { amountCents: 5000, taxExempt: true },
      { amountCents: 1000 },
    ],
    700,
  ),
  70,
);
