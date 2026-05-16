import assert from 'node:assert/strict';
import { render } from '../src/template.mjs';

assert.equal(render('{{ value }}', { value: '{{ user.name }}', user: { name: 'Ada' } }), '{{ user.name }}');
assert.equal(render('{{ user.name }} {{ missing }}', { user: { name: 'Ada' } }), 'Ada {{ missing }}');
