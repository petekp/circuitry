import assert from 'node:assert/strict';
import { isAllowed } from '../src/permissions.mjs';

assert.equal(
  isAllowed(
    [
      { effect: 'allow', action: 'delete', resource: '/files/123' },
      { effect: 'deny', action: '*', resource: '/files/*' },
    ],
    { action: 'delete', resource: '/files/123' },
  ),
  false,
);
