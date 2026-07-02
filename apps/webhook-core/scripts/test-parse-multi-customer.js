#!/usr/bin/env node
const {
  parseOrderItems,
  parseSimpleOrderLine,
  parseSimpleOrderItems,
  groupItemsByCustomer,
} = require('../src/seafood-oa/parseLineOrder');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const twoLineShorthand = 'ปุ้ย กลาง 2\nจะเขียด กลาง 3';
const simpleWhole = parseSimpleOrderLine(twoLineShorthand);
assert(simpleWhole === null, 'multi-line shorthand must not match whole-body simple');

const simpleItems = parseSimpleOrderItems(twoLineShorthand);
assert(simpleItems.length === 2, 'two lines → two simple items');
const groups = groupItemsByCustomer(simpleItems);
assert(groups.size === 2, 'two customers in two groups');
assert(groups.has('ปุ้ย') && groups.has('จะเขียด'), 'customer names preserved');

const oneLineTwo = parseSimpleOrderItems('ปุ้ย กลาง 2 จะเขียด กลาง 3');
assert(oneLineTwo.length === 2, 'single-line two-customer shorthand splits');
assert(
  groupItemsByCustomer(oneLineTwo).size === 2,
  'single-line shorthand → two customers',
);

const withShrimp = 'ตาจุ้ย กุ้งเล็ก 1 โล\nอีสาน กุ้งกลาง 2 กก';
const parsed = parseOrderItems(withShrimp);
assert(parsed.length === 2, 'กุ้ง format still parses two lines');
assert(groupItemsByCustomer(parsed).size === 2, 'กุ้ง format splits customers');

console.log('\nall multi-customer parse tests passed\n');
