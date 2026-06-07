#!/usr/bin/env node
const assert = require('assert');
const { billRenderCacheKey } = require('../src/shrimpBillPreRender');

const k1 = billRenderCacheKey({
  paymentType: 'credit',
  totalAmount: 4000,
  creditTransfer: { unpaidAmount: 4000 },
});
const k2 = billRenderCacheKey({
  paymentType: 'transfer',
  totalAmount: 4000,
  remainingAmount: 0,
  moneyReceiverName: 'พีช',
});
assert.notStrictEqual(k1, k2, 'payment change invalidates cache key');

const k3 = billRenderCacheKey({
  paymentType: 'credit',
  totalAmount: 4000,
  creditTransfer: { unpaidAmount: 4000 },
});
assert.strictEqual(k1, k3, 'same bill state → same key');

console.log('\nall shrimp bill prerender tests passed\n');
