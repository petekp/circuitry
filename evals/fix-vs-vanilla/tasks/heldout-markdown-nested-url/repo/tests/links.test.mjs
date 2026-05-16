import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractLinks } from '../src/links.mjs';

test('extractLinks preserves balanced parentheses inside URLs', () => {
  assert.deepEqual(extractLinks('Read [the guide](/docs/foo(bar)) today.'), [
    { text: 'the guide', href: '/docs/foo(bar)' },
  ]);
  assert.deepEqual(extractLinks('[api](https://example.test/a(b)c) and [home](/)'), [
    { text: 'api', href: 'https://example.test/a(b)c' },
    { text: 'home', href: '/' },
  ]);
});
