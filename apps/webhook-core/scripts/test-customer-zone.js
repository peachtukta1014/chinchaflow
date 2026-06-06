#!/usr/bin/env node
const {
  resolveZoneForOrder,
  groupOrdersByZone,
  findZoneInCatalog,
} = require('../src/customerZone');
const { BUILTIN_CUSTOMERS } = require('../src/shrimpBuiltinCustomers');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const catalog = BUILTIN_CUSTOMERS.map((c) => ({ ...c, zone: c.zone || 'อื่นๆ' }));

assert(findZoneInCatalog('เจ๊เขียด', catalog) === 'ป่าตอง', 'alias เจ๊เขียด -> ป่าตอง');
assert(findZoneInCatalog('โอเล่', catalog) === 'ราไวย์', 'short โอเล่ -> ราไวย์');
assert(findZoneInCatalog('มุกอันดา', catalog) === 'ราไวย์', 'short มุกอันดา -> ราไวย์');
assert(findZoneInCatalog('ปุ้ย', catalog) === 'ป่าตอง', 'ปุ้ย -> ป่าตอง');

const orders = [
  { customerName: 'เจ๊เขียด', items: [{ product: 'กุ้งเล็ก', qty: 4 }] },
  { customerName: 'โอเล่', items: [{ product: 'กุ้งเล็ก', qty: 2 }] },
  { customerName: 'มุกอันดา', items: [{ product: 'กุ้งเล็ก', qty: 2 }] },
];
const grouped = groupOrdersByZone(orders, catalog);
assert(grouped.length === 2, 'two zones');
assert(grouped[0][0] === 'ป่าตอง', 'patong first');
assert(grouped[1][0] === 'ราไวย์', 'rawai second');
assert(grouped[0][1].length === 1, 'one patong order');
assert(grouped[1][1].length === 2, 'two rawai orders');

assert(resolveZoneForOrder({ zone: 'กะทู้', customerName: 'x' }, catalog) === 'กะทู้', 'stored zone wins');

console.log('\nall customer zone tests passed\n');
