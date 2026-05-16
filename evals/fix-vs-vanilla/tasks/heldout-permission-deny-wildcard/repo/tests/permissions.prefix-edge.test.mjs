import assert from 'node:assert/strict';
import { isAllowed } from '../src/permissions.mjs';

const rules = [
  { effect: 'deny', action: 'read', resource: '/admin/*' },
  { effect: 'allow', action: 'read', resource: '/administrator' },
];

assert.equal(isAllowed(rules, { action: 'read', resource: '/admin/users' }), false);
assert.equal(isAllowed(rules, { action: 'read', resource: '/admin/reports/1' }), false);
assert.equal(isAllowed(rules, { action: 'read', resource: '/administrator' }), true);
