#!/usr/bin/env node
const assert = require('assert');
const { buildItemsFromPayload } = require('../src/shrimpLiffOrderSubmit');

const items = buildItemsFromPayload({ small: '2', dead: '1.5' });
assert.equal(items.length, 2);
assert.equal(items[0].product, 'กุ้งเล็ก');
assert.equal(items[0].qty, 2);

let threw = false;
try {
  buildItemsFromPayload({ small: '0' });
} catch (e) {
  threw = e.code === 'invalid_weight';
}
assert(threw, 'zero weight rejected');

const deadSized = buildItemsFromPayload({ dead_small: '3', dead_large: '1' });
assert.equal(deadSized.length, 2);
assert.equal(deadSized[0].product, 'กุ้งตาย ไซซ์เล็ก');
assert.equal(deadSized[1].product, 'กุ้งตาย ไซซ์ใหญ่');

console.log('test-liff-order-items: ok');
