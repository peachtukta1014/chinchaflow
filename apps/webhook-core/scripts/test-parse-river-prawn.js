#!/usr/bin/env node
const {
  parseOrderItems,
  parseRiverPrawnPendingLine,
  parseRiverPrawnWithSize,
  parseSimpleOrderLine,
  pendingToItems,
  sizeWordToProduct,
} = require('../src/seafood-oa/parseLineOrder');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const pending = parseRiverPrawnPendingLine('กุ้งแม่น้ำ 4 โลนะ');
assert(pending?.kind === 'pending_river' && pending.qty === 4, 'กุ้งแม่น้ำ 4 โล → pending');

const shorthand = parseRiverPrawnPendingLine('สั่งแม่น้ำ 4 กก');
assert(shorthand?.kind === 'pending_river' && shorthand.qty === 4, 'สั่งแม่น้ำ 4 กก → pending');

const glued = parseRiverPrawnPendingLine('กุ้งแม่น้ำ4โลนะ');
assert(glued?.kind === 'pending_river' && glued.qty === 4, 'กุ้งแม่น้ำ4โลนะ → pending');

const withName = parseRiverPrawnPendingLine('ไม้ขาวพลาซ่า กุ้งแม่น้ำ 4 โล');
assert(withName?.customerName && withName.qty === 4, 'ชื่อ + กุ้งแม่น้ำ → pending + customer');

const sized = parseRiverPrawnWithSize('กุ้งแม่น้ำใหญ่ 4 โล');
assert(sized.length === 1 && sized[0].product === 'กุ้งใหญ่', 'กุ้งแม่น้ำใหญ่ → กุ้งใหญ่');

const bareItems = parseOrderItems('กุ้งแม่น้ำ 4 โล');
assert(bareItems.length === 0, 'parseOrderItems ไม่บันทึกกุ้งแม่น้ำไร้ขนาด');

const sizedItems = parseOrderItems('กุ้งแม่น้ำ เล็ก 2 กก');
assert(sizedItems.length === 1 && sizedItems[0].product === 'กุ้งเล็ก', 'กุ้งแม่น้ำ เล็ก → กุ้งเล็ก');

const sizeOnly = parseSimpleOrderLine('เล็ก');
assert(sizeOnly?.kind === 'size_only', 'เล็ก → size_only');

const merged = pendingToItems({ qty: 4, unit: 'กก', customerName: 'ทดสอบ' }, sizeWordToProduct('เล็ก'));
assert(merged[0]?.product === 'กุ้งเล็ก', 'pending + เล็ก → กุ้งเล็ก');

console.log('all river prawn parse tests passed');
