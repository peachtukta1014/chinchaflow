#!/usr/bin/env node
const { riverDefaultToProduct } = require('../src/seafood-oa/customerRiverDefault');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

assert(riverDefaultToProduct('เล็ก') === 'กุ้งเล็ก', 'เล็ก → กุ้งเล็ก');
assert(riverDefaultToProduct('small') === 'กุ้งเล็ก', 'small → กุ้งเล็ก');
assert(riverDefaultToProduct('ask') === null, 'ask → null');
assert(riverDefaultToProduct('') === null, 'empty → null');

console.log('\nall river default tests passed\n');
