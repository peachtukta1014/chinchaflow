#!/usr/bin/env node
/**
 * Smoke tests (ไม่ต้อง Firebase) — รัน: node scripts/smoke-test.mjs
 */
import { dateKeyBangkok, formatViewDateLabel, shiftDateKey, formatDateThaiShort } from '../src/lib/date.js';
function computePaymentAmounts(total, paymentType, paidAmountInput = 0) {
  const t = parseFloat(total) || 0;
  if (paymentType === 'cash' || paymentType === 'transfer') {
    return { paidAmount: t, remainingAmount: 0 };
  }
  if (paymentType === 'credit') {
    return { paidAmount: 0, remainingAmount: t };
  }
  const paid = parseFloat(paidAmountInput) || 0;
  return { paidAmount: paid, remainingAmount: Math.max(0, t - paid) };
}
import { billAmount } from '../src/lib/salesAggregate.js';
import { computeLotReport } from '../src/lib/lotReport.js';
import { saleToBillData, resolveTemplateRowName, TEMPLATE_ROW_NAMES } from '../src/lib/billDataFromSale.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, err) {
  console.error(`  ✗ ${label}:`, err?.message || err);
  failed += 1;
}

function assert(cond, label) {
  if (cond) ok(label);
  else fail(label, new Error('assertion failed'));
}

console.log('\n=== seafood-pos smoke tests ===\n');

try {
  const today = dateKeyBangkok();
  assert(formatViewDateLabel(today) === 'วันนี้', 'formatViewDateLabel วันนี้');
  assert(formatViewDateLabel(shiftDateKey(today, -1)) === 'เมื่อวาน', 'formatViewDateLabel เมื่อวาน');
  assert(/^\d+\/\d+\/\d+$/.test(formatDateThaiShort('2026-05-24')), 'formatDateThaiShort');
} catch (e) {
  fail('date helpers', e);
}

try {
  const cash = computePaymentAmounts(1000, 'cash');
  assert(cash.remainingAmount === 0 && cash.paidAmount === 1000, 'computePaymentAmounts cash');
  const credit = computePaymentAmounts(1000, 'credit');
  assert(credit.remainingAmount === 1000 && credit.paidAmount === 0, 'computePaymentAmounts credit');
} catch (e) {
  fail('computePaymentAmounts', e);
}

try {
  assert(resolveTemplateRowName({ productId: 'medium' }) === TEMPLATE_ROW_NAMES.medium, 'กุ้งกลาง → แถว B');
  const data = saleToBillData({
    billNo: 'B001',
    customerName: 'ปุ้ย',
    dateKey: '2026-05-26',
    items: [{ productId: 'medium', weightKg: 2, lineTotal: 2200, pricePerKg: 1100 }],
    total: 2200,
  });
  assert(data.date === '26/5/69', 'วันที่บิล = วันจัดส่ง (ตรง dateKey ไม่บวกวัน)');
  assert(data.items[0].name === 'กุ้งแม่น้ำ B', 'บิลดิจิทัลมีรายการแถว B');
  assert(data.totalAmount === 2200, 'ยอดรวมไม่หักส่วนลด');
  assert(data.customerName === 'ปุ้ย', 'ชื่อลูกค้าถูกต้อง');
} catch (e) {
  fail('billDataFromSale', e);
}

try {
  assert(billAmount({ total: 500 }) === 500, 'billAmount');
} catch (e) {
  fail('billAmount', e);
}

const assetsDir = path.join(root, 'public/bill-assets');
for (const f of ['line-oa-qr.png']) {
  const p = path.join(assetsDir, f);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) ok(`asset ${f}`);
  else fail(`asset ${f}`, new Error('missing or too small'));
}
console.log(failed ? `\nFAILED: ${failed}\n` : '\nAll smoke tests passed.\n');
process.exit(failed ? 1 : 0);
