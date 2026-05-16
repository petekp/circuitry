import assert from 'node:assert/strict';
import { getByPointer } from '../src/pointer.mjs';

const document = {
  'a~1b': 'literal-tilde-one',
  'a/b': 'slash-key',
  nested: { value: 12 },
};

assert.equal(getByPointer(document, ''), document);
assert.equal(getByPointer(document, '/nested/value'), 12);
assert.equal(getByPointer(document, '/a~01b'), 'literal-tilde-one');
