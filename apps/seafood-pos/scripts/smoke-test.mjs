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
function getBillTemplateUrl() {
  return 'template-empty.jpg';
}

function normalizeLineItem(item) {
  return {
    productName: item.productName || '',
    weight: parseFloat(item.weightKg ?? item.weight ?? 0) || 0,
    total: parseFloat(item.lineTotal ?? item.total ?? 0) || 0,
  };
}
import { billAmount } from '../src/lib/salesAggregate.js';
import {
  resolveBillRowIndex,
  groupBillItemsByRow,
  BILL_PRINTED_ROWS,
} from '../src/lib/billRowMap.js';
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
  assert(getBillTemplateUrl() === 'template-empty.jpg', 'template empty only');
  const fromFs = normalizeLineItem({ productName: 'กุ้งใหญ่', weightKg: 2, lineTotal: 500, pricePerKg: 250 });
  assert(fromFs.weight === 2 && fromFs.total === 500, 'normalizeLineItem Firestore shape');
} catch (e) {
  fail('billTemplateConfig', e);
}

try {
  assert(billAmount({ total: 500 }) === 500, 'billAmount');
} catch (e) {
  fail('billAmount', e);
}

try {
  assert(resolveBillRowIndex({ productId: 'large' }) === BILL_PRINTED_ROWS.large, 'แถว A = กุ้งใหญ่');
  assert(resolveBillRowIndex({ productId: 'medium' }) === BILL_PRINTED_ROWS.medium, 'แถว B = กุ้งกลาง');
  assert(resolveBillRowIndex({ productId: 'small' }) === BILL_PRINTED_ROWS.small, 'แถว C = กุ้งเล็ก');
  const grouped = groupBillItemsByRow([
    { productId: 'medium', weightKg: 2, lineTotal: 2200, pricePerKg: 1100 },
    { productId: 'small', weightKg: 1, lineTotal: 850, pricePerKg: 850 },
  ]);
  assert(grouped.byRow.get(BILL_PRINTED_ROWS.medium)?.productId === 'medium', 'จัดกลุ่มแถว B');
  assert(grouped.overflow.length === 0, 'ไม่มี overflow สำหรับ A/B/C');
} catch (e) {
  fail('billRowMap', e);
}

const assetsDir = path.join(root, 'public/bill-assets');
for (const f of ['template-empty.jpg', 'template-cash.jpg', 'template-credit.jpg', 'line-oa-qr.png']) {
  const p = path.join(assetsDir, f);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) ok(`asset ${f}`);
  else fail(`asset ${f}`, new Error('missing or too small'));
}
try {
  const empty = path.join(assetsDir, 'template-empty.jpg');
  const credit = path.join(assetsDir, 'template-credit.jpg');
  const cash = path.join(assetsDir, 'template-cash.jpg');
  assert(
    fs.readFileSync(empty).compare(fs.readFileSync(credit)) !== 0,
    'template-empty ≠ template-credit (ไม่ใช่ไฟล์ซ้ำ)',
  );
} catch (e) {
  fail('template assets distinct', e);
}

console.log(failed ? `\nFAILED: ${failed}\n` : '\nAll smoke tests passed.\n');
process.exit(failed ? 1 : 0);
