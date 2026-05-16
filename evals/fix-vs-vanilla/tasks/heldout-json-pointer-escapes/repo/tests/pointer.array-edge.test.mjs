import assert from 'node:assert/strict';
import { getByPointer } from '../src/pointer.mjs';

const document = {
  items: ['zero', 'one', 'two'],
};

assert.equal(getByPointer(document, '/items/0'), 'zero');
assert.equal(getByPointer(document, '/items/2'), 'two');
assert.equal(getByPointer(document, '/items/01'), undefined);
assert.equal(getByPointer(document, '/items/-'), undefined);
