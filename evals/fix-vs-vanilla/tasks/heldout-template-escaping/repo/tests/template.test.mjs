import assert from 'node:assert/strict';
import { render } from '../src/template.mjs';

const data = {
  user: { name: 'Ada' },
  count: 0,
  enabled: false,
};

assert.equal(render('Hello {{ user.name }}', data), 'Hello Ada');
assert.equal(render('Count {{ count }}, enabled {{ enabled }}', data), 'Count 0, enabled false');
assert.equal(render('Missing {{ user.email }}', data), 'Missing {{ user.email }}');
