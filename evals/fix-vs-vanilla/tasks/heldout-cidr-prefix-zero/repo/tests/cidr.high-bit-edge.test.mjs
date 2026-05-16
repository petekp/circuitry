import assert from 'node:assert/strict';
import { containsIp } from '../src/cidr.mjs';

assert.equal(containsIp('255.255.255.0/24', '255.255.255.255'), true);
assert.equal(containsIp('255.255.255.0/24', '255.255.254.255'), false);
assert.equal(containsIp('128.0.0.0/1', '255.1.2.3'), true);
assert.equal(containsIp('128.0.0.0/1', '127.255.255.255'), false);
