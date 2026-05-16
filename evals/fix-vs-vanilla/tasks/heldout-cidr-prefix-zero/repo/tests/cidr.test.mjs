import assert from 'node:assert/strict';
import { containsIp } from '../src/cidr.mjs';

assert.equal(containsIp('10.0.0.0/0', '203.0.113.5'), true);
assert.equal(containsIp('192.168.1.42/32', '192.168.1.42'), true);
assert.equal(containsIp('192.168.1.42/32', '192.168.1.43'), false);
