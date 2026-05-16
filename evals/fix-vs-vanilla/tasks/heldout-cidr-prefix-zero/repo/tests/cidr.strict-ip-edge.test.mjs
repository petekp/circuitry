import assert from 'node:assert/strict';
import { containsIp } from '../src/cidr.mjs';

assert.equal(containsIp('192.168.1.0/24', '192.168.1.5'), true);
assert.equal(containsIp('192.168.1.0/24', '192.168.001.5'), false);
assert.equal(containsIp('192.168.1.0/24', '192.168.1.300'), false);
assert.equal(containsIp('192.168.1.0/33', '192.168.1.5'), false);
assert.equal(containsIp('192.168.1/24', '192.168.1.5'), false);
