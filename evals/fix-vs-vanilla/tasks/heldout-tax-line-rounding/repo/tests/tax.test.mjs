import assert from 'node:assert/strict';
import { totalTaxCents } from '../src/tax.mjs';

assert.equal(
  totalTaxCents(
    [
      { amountCents: 199 },
      { amountCents: 199 },
    ],
    825,
  ),
  32,
);
