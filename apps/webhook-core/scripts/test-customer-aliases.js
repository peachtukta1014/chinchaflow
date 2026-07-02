#!/usr/bin/env node
const { customerMatchesName } = require('../src/seafood-oa/customerNameAliases');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const c7 = {
  name: 'ร้านเฟิร์ส',
  aliases: ['Firstseafood', 'เฟิร์ส', 'พี่ต้อม', 'First seafood'],
};

assert(customerMatchesName(c7, 'Firstseafood'), 'bot matches Firstseafood');
assert(customerMatchesName(c7, 'เฟิร์ส'), 'bot matches เฟิร์ส');
assert(!customerMatchesName(c7, 'ปุ้ย'), 'no false match');

console.log('\nall customer alias tests passed\n');
