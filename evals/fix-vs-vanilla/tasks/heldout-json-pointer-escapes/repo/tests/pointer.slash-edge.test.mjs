import assert from 'node:assert/strict';
import { getByPointer } from '../src/pointer.mjs';

const document = {
  'a/b': {
    '~key': 'escaped-value',
  },
};

assert.equal(getByPointer(document, '/a~1b/~0key'), 'escaped-value');
assert.equal(getByPointer(document, '/a~1b/missing'), undefined);
