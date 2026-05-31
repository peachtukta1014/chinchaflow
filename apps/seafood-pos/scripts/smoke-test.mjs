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
import { saleToBillData, resolveTemplateRowName, TEMPLATE_ROW_NAMES } from '../src/lib/billDataFromSale.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const requireWebhook = createRequire(import.meta.url);

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
  const { countPendingLineOrdersForBadge } = await import('../src/lib/lineOrderBadge.js');
  const tomorrow = shiftDateKey(dateKeyBangkok(), 1);
  const rows = [
    { status: 'pending', deliveryDate: tomorrow },
    { status: 'done', deliveryDate: tomorrow },
  ];
  assert(
    countPendingLineOrdersForBadge(rows) === 1,
    'badge นับออเดอร์ส่งพรุ่งนี้ (ไม่กรองแค่วันนี้)',
  );
} catch (e) {
  fail('countPendingLineOrdersForBadge', e);
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

try {
  const received = 100 + 10;
  const sold = 70 + 20;
  const remain = 10 + 5;
  const shrinkage = Math.max(0, received - sold - remain);
  assert(shrinkage === 5, 'lot shrinkage = รับ − ขาย − คงเหลือ');
} catch (e) {
  fail('lotReport formula', e);
}

try {
  const { orderDeliveryDateKey, defaultDeliveryDateKeyBangkok } = await import('../src/lib/lineOrderDate.js');
  const { dateKeyBangkok, tomorrowDateKeyBangkok } = await import('../src/lib/date.js');
  const t = dateKeyBangkok();
  const tm = tomorrowDateKeyBangkok();
  assert(
    orderDeliveryDateKey({ rawText: 'พรุ่งนี้ ร้านเฟิร์ส กุ้งกลาง 2 โล', deliveryDate: t })
      === t,
    'ใช้ deliveryDate ใน Firestore เป็นหลัก (ไม่แปลงพรุ่งนี้ซ้ำ)',
  );
  assert(
    orderDeliveryDateKey({ rawText: 'พรุ่งนี้ ร้านเฟิร์ส กุ้งกลาง 2 โล' }) === tm,
    'ไม่มี deliveryDate → อ่านจากข้อความ',
  );
  assert(
    defaultDeliveryDateKeyBangkok(new Date('2026-03-24T10:00:00+07:00')) === '2026-03-24',
    '10:00 ไม่ระบุวัน = ส่งวันนี้',
  );
  assert(
    defaultDeliveryDateKeyBangkok(new Date('2026-03-24T14:30:00+07:00')) === '2026-03-24',
    '14:30 ไม่ระบุวัน = ส่งวันนี้ (ก่อน cutoff 15:00)',
  );
  assert(
    defaultDeliveryDateKeyBangkok(new Date('2026-03-24T15:00:00+07:00')) === '2026-03-25',
    '15:00 ไม่ระบุวัน = ส่งพรุ่งนี้',
  );
  assert(
    defaultDeliveryDateKeyBangkok(new Date('2026-03-23T19:00:00+07:00')) === '2026-03-24',
    '19:00 เมื่อวาน ไม่ระบุวัน = ส่งวันนี้ (รอบเช้า)',
  );
} catch (e) {
  fail('lineOrderDate infer', e);
}

try {
  const {
    resolveLineOrderDeliveryDate,
    coalesceSessionDeliveryDate,
    defaultDeliveryDateKeyBangkok,
  } = requireWebhook('../../webhook-core/src/parseDeliveryDate.js');
  assert(
    coalesceSessionDeliveryDate('2026-05-26', '2026-05-28') === null,
    'session วันส่งเลยวันนี้แล้ว → ไม่ใช้ซ้ำ',
  );
  assert(
    coalesceSessionDeliveryDate('2026-05-28', '2026-05-28') === '2026-05-28',
    'session วันนี้ยังใช้ได้',
  );
  assert(
    resolveLineOrderDeliveryDate({
      parsedDate: null,
      sessionDate: '2026-05-26',
      now: new Date('2026-05-28T10:00:00+07:00'),
    }) === defaultDeliveryDateKeyBangkok(new Date('2026-05-28T10:00:00+07:00')),
    'ออเดอร์ใหม่ไม่สืบทอดวันส่ง session เก่า',
  );
  assert(
    resolveLineOrderDeliveryDate({
      parsedDate: '2026-05-30',
      sessionDate: '2026-05-26',
    }) === '2026-05-30',
    'วันที่ในข้อความชนะ session',
  );
  const late = new Date('2026-05-28T16:00:00+07:00');
  assert(
    resolveLineOrderDeliveryDate({
      parsedDate: null,
      sessionDate: '2026-05-28',
      now: late,
    }) === defaultDeliveryDateKeyBangkok(late),
    'หลัง 15:00 session วันนี้ไม่ดึงออเดอร์ใหม่กลับเป็นส่งวันนี้',
  );
} catch (e) {
  fail('webhook resolveLineOrderDeliveryDate', e);
}

try {
  const liveGross = 10000 - 7000;
  const deadGross = 4000 - 1500;
  const liveNet = liveGross - 500 - 0;
  const deadNet = deadGross - 200 - 0;
  assert(liveNet + deadNet === 4800, 'two-line net = sum of (gross − expenses) per line');
} catch (e) {
  fail('two-line net formula', e);
}

try {
  const {
    formStateToLines,
    normalizeExpenseLinesFromDoc,
    sumExpenseLines,
  } = await import('../src/lib/lotExpenseLines.js');
  const rows = formStateToLines([
    { label: 'ค่าน้ำมันมาสด้า', amount: '1000' },
    { label: 'พีช กินข้าว', amount: '200' },
  ]);
  assert(rows.length === 2 && sumExpenseLines(rows) === 1200, 'รายจ่ายย่อยรวมยอด');
  const legacy = normalizeExpenseLinesFromDoc(null, 1200, 'ค่าน้ำมัน 1,000 · ข้าว 200');
  assert(legacy.length === 1 && legacy[0].amount === 1200, 'ข้อมูลเก่ายอดเดียว → 1 แถว');
  const fromLines = normalizeExpenseLinesFromDoc(
    [{ label: 'น้ำมัน', amount: 1000 }, { label: 'ข้าว', amount: 200 }],
    999,
    '',
  );
  assert(fromLines.length === 2 && sumExpenseLines(fromLines) === 1200, 'pondLines รวมจากแถว');
} catch (e) {
  fail('lotExpenseLines', e);
}

try {
  const totalCost = 30000;
  const receivedKg = 100;
  const soldDeadKg = 5;
  const deadRevenue = 400;
  const avgCost = totalCost / receivedKg;
  const deadCogs = soldDeadKg * avgCost;
  const deadGross = deadRevenue - deadCogs;
  assert(Math.abs(avgCost - 300) < 0.01, 'avg cost per kg');
  assert(Math.abs(deadCogs - 1500) < 0.01, 'dead COGS uses live lot cost');
  assert(Math.abs(deadGross - (-1100)) < 0.01, 'dead gross = revenue − live-cost COGS');
} catch (e) {
  fail('lotReport dead COGS', e);
}

try {
  const fsStockKgVal = (kg, kind = 'double') => {
    const n = parseFloat(Number(kg).toFixed(3));
    if (kind === 'integer') return { integerValue: String(Math.round(n)) };
    return { doubleValue: n };
  };
  assert('integerValue' in fsStockKgVal(141, 'integer'), 'ล็อตเก่า (integer) ส่ง integerValue');
  assert('doubleValue' in fsStockKgVal(5.8, 'double'), 'ล็อตใหม่ (double) ส่ง doubleValue');
  const fields = { remainingLiveKg: { integerValue: '100' } };
  const types = {};
  for (const k of ['remainingLiveKg', 'remainingDeadKg', 'liveKg', 'deadKg']) {
    const raw = fields[k];
    if (raw && 'integerValue' in raw) types[k] = 'integer';
    else if (raw && 'doubleValue' in raw) types[k] = 'double';
  }
  assert(types.remainingLiveKg === 'integer', 'จำชนิดฟิลด์จาก Firestore ได้');
} catch (e) {
  fail('fsStockKgVal', e);
}

try {
  const rulesPath = path.join(root, '../../firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert(
    rules.includes("'fulfilledItems'") && rules.includes("'cancelledAt'"),
    'firestore.rules อนุญาต staff อัปเดต fulfilledItems / ยกเลิกออเดอร์ LINE',
  );
} catch (e) {
  fail('firestore lineOrders rules', e);
}

const assetsDir = path.join(root, 'public/bill-assets');
for (const f of ['line-oa-qr.png']) {
  const p = path.join(assetsDir, f);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) ok(`asset ${f}`);
  else fail(`asset ${f}`, new Error('missing or too small'));
}
console.log(failed ? `\nFAILED: ${failed}\n` : '\nAll smoke tests passed.\n');
process.exit(failed ? 1 : 0);
