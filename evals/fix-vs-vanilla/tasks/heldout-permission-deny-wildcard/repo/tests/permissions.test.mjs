import assert from 'node:assert/strict';
import { isAllowed } from '../src/permissions.mjs';

assert.equal(
  isAllowed(
    [
      { effect: 'allow', action: 'read', resource: '/reports/*' },
      { effect: 'deny', action: 'read', resource: '/reports/private' },
    ],
    { action: 'read', resource: '/reports/private' },
  ),
  false,
);
