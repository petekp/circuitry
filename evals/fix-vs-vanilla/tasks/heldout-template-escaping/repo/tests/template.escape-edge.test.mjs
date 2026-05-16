import assert from 'node:assert/strict';
import { render } from '../src/template.mjs';

assert.equal(
  render('Escaped \\{{ user.name }} and real {{ user.name }}', { user: { name: 'Ada' } }),
  'Escaped {{ user.name }} and real Ada',
);

assert.equal(render('Literal backslash \\\\{{ user.name }}', { user: { name: 'Ada' } }), 'Literal backslash \\Ada');
