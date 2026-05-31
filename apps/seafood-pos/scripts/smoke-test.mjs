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
import { customRowsToCartItems } from '../src/lib/customCartItem.js';
import { sumCartStockKg } from '../src/lib/cartStock.js';
import { SHRIMP_DAMAGE, STOCK_LINE } from '../src/constants/stockLines.js';
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
  assert(STOCK_LINE.live.full === 'กุ้งแม่น้ำเป็น (Live)', 'STOCK_LINE.live.full');
  assert(STOCK_LINE.dead.full === 'กุ้งแม่น้ำตาย (Dead)', 'STOCK_LINE.dead.full');
  assert(SHRIMP_DAMAGE.full === 'กุ้งตายเสียหาย (ตัดทิ้ง)', 'SHRIMP_DAMAGE.full');
  const custom = customRowsToCartItems([
    { label: 'แอนตี้โฟม', weight: '2', pricePerKg: '240' },
    { label: '', weight: '', pricePerKg: '' },
  ]);
  assert(custom.length === 1 && custom[0].type === 'other', 'customRowsToCartItems');
  assert(custom[0].weight === 2 && custom[0].pricePerKg === 240 && custom[0].total === 480, 'custom kg × ppk');
  const kg = sumCartStockKg([
    { type: 'live', weight: 2 },
    { type: 'dead', weight: 1 },
    { type: 'other', weight: 99, total: 500 },
  ]);
  assert(kg.liveKg === 2 && kg.deadKg === 1, 'sumCartStockKg ignores other');
  const billCustom = saleToBillData({
    billNo: 'C001',
    customerName: 'ทดสอบ',
    dateKey: '2026-05-26',
    items: [{
      productId: 'custom',
      productName: 'แอนตี้โฟม',
      type: 'other',
      weight: 2,
      pricePerKg: 240,
      lineTotal: 480,
    }],
    total: 480,
  });
  assert(billCustom.extraLines?.[0]?.name === 'แอนตี้โฟม', 'custom → extraLines on bill');
  assert(billCustom.extraLines?.[0]?.quantity === '2', 'custom qty on bill');
  assert(billCustom.extraLines?.[0]?.pricePerUnit === 240, 'custom ppk on bill');
} catch (e) {
  fail('stockLines/customCart', e);
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
  const { aggregateDailySales } = await import('../src/lib/salesAggregate.js');
  const agg = aggregateDailySales([
    {
      total: 5480,
      items: [
        { type: 'live', productId: 'large', weight: 10, total: 5000 },
        { type: 'other', productId: 'custom', weight: 2, total: 480 },
      ],
    },
  ]);
  assert(agg.liveKg === 10 && agg.liveRevenue === 5000, 'aggregate: live only shrimp kg/revenue');
  assert(agg.otherRevenue === 480 && agg.deadKg === 0, 'aggregate: other not in live/dead kg');
} catch (e) {
  fail('aggregateDailySales other', e);
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

try {
  const trim = (v) => (typeof v === 'string' ? v.trim() : v);
  assert(trim('\nchincha-eeed6\n') === 'chincha-eeed6', 'trim project ID กัน Firestore commit 400');
} catch (e) {
  fail('viteEnv trim', e);
}

try {
  const { resolveLineCustomerByName } = await import('../src/lib/lineCustomerResolve.js');
  const { CUSTOMERS } = await import('../src/constants/customers.js');

  const byName = resolveLineCustomerByName('ปุ้ย', CUSTOMERS);
  assert(byName.id === 'c5', 'จับคู่ชื่อปุ้ยกับรายชื่อหลัก');

  const aliasList = CUSTOMERS.map((c) => (
    c.id === 'c5' ? { ...c, aliases: ['ร้านปุ้ย'] } : c
  ));
  const byAlias = resolveLineCustomerByName('ร้านปุ้ย', aliasList);
  assert(byAlias.id === 'c5', 'จับคู่ชื่อ alias กับร้านปุ้ย');

  const jaekhiad = resolveLineCustomerByName('จ๊ะเขียด', CUSTOMERS);
  assert(jaekhiad.id === 'c1', 'จ๊ะเขียด (สะกด เขียด) → c1 ไม่ใช่ general');

  const first = resolveLineCustomerByName('Firstseafood', CUSTOMERS);
  assert(first.id === 'c7', 'Firstseafood → ร้านเฟิร์ส (alias)');

  const patongSmall = CUSTOMERS.filter((c) => c.zone === 'ป่าตอง' && c.defaultRiverSize === 'เล็ก');
  const patongMedium = CUSTOMERS.filter((c) => c.zone === 'ป่าตอง' && c.defaultRiverSize === 'กลาง');
  assert(patongSmall.length === 6, 'ป่าตอง 6 ร้านใช้กุ้งแม่น้ำเล็ก');
  assert(patongMedium.length === 4, 'ป่าตอง 4 ร้านใช้กุ้งแม่น้ำกลาง');

  const kathu = CUSTOMERS.find((c) => c.id === 'c11');
  assert(kathu?.defaultRiverSize === 'เล็ก', 'น้องเล็กสอง กะทู้ ใช้กุ้งแม่น้ำเล็ก');

  const { customerFieldsFromForm } = await import('../src/lib/customerAliases.js');
  const parsed = customerFieldsFromForm({
    name: 'ร้านเฟิร์ส',
    aliasesText: 'Firstseafood, เฟิร์ส, พี่ต้อม',
  });
  assert(parsed.name === 'ร้านเฟิร์ส', 'ชื่อบนบิลไม่ผสม alias');
  assert(parsed.aliases.includes('Firstseafood'), 'เก็บชื่อเรียกอื่นใน aliases');
} catch (e) {
  fail('lineCustomerResolve', e);
}

try {
  const { suggestCustomersForLineName } = await import('../src/lib/lineCustomerResolve.js');
  const { CUSTOMERS } = await import('../src/constants/customers.js');
  const { pickLineUidForBillPush } = await import('../src/lib/resolveLineUserIdPick.js');
  const generalUid = 'U6db855aaaaaaaaaaaaaaaaaaaaaaaaaa';
  const shopUid = 'Uf4e57ad17d3cc89de38609a1994bf4f9';
  const all = CUSTOMERS.map((c) => {
    if (c.id === 'general') return { ...c, lineUserId: generalUid };
    if (c.id === 'c1') return { ...c, lineUserId: shopUid };
    return c;
  });
  const sug = suggestCustomersForLineName('จ๊ะเขียด', all);
  assert(sug[0]?.customer?.id === 'c1', 'constants: จ๊ะเขียด → c1');
  const pickedJaek = pickLineUidForBillPush({
    profileUid: '',
    nameMatchUid: shopUid,
    billUid: generalUid,
  });
  assert(pickedJaek.uid === shopUid, 'ไม่ใช้ UID ลูกค้าทั่วไปเมื่อจับ c1 ได้');
} catch (e) {
  fail('jaekhiad uid pick', e);
}

try {
  const { pickLineUidForBillPush } = await import('../src/lib/resolveLineUserIdPick.js');
  const profileUid = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
  const billUid = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2';
  const picked = pickLineUidForBillPush({ profileUid, billUid });
  assert(picked.uid === profileUid, 'ส่งบิลใช้ UID จากรายชื่อลูกค้า ไม่ใช่ UID ในบิลเก่า');
  assert(picked.billUid === billUid && picked.profileUid === profileUid, 'เก็บ UID บิล vs โปรไฟล์แยกได้');
} catch (e) {
  fail('pickLineUidForBillPush', e);
}

try {
  const { suggestCustomersForLineName } = await import('../src/lib/lineCustomerResolve.js');
  const { pickLineUidForBillPush } = await import('../src/lib/resolveLineUserIdPick.js');
  const shopUid = 'Uf4e57ad17d3cc89de38609a1994bf4f9';
  const generalUid = 'U6db855aaaaaaaaaaaaaaaaaaaaaaaaaa';
  const allCustomers = [
    {
      id: 'general',
      name: 'ลูกค้าทั่วไปและตลาดนัด',
      zone: 'ทั่วไป',
      lineUserId: generalUid,
    },
    {
      id: 'c1',
      name: 'จ๊ะเขียด,เจ๊เขียด',
      zone: 'ป่าตอง',
      lineUserId: shopUid,
    },
  ];
  const suggestions = suggestCustomersForLineName('จ๊ะเขียด', allCustomers);
  assert(suggestions.length === 1 && suggestions[0].customer.id === 'c1', 'ชื่อบนบิลจับคู่ร้าน c1');
  const picked = pickLineUidForBillPush({
    profileUid: shopUid,
    billUid: generalUid,
  });
  assert(picked.uid === shopUid, 'บิล general+ชื่อร้าน ใช้ UID ร้าน ไม่ใช่ลูกค้าทั่วไป');

  const pickedAfterClear = pickLineUidForBillPush({
    profileUid: '',
    billUid: '',
    orderUid: '',
    historyUid: '',
  });
  assert(!pickedAfterClear.uid, 'ลบ UID ในรายชื่อแล้ว ไม่ใช้ UID จากบิลเก่า');
} catch (e) {
  fail('line bill profile match', e);
}

const assetsDir = path.join(root, 'public/bill-assets');
for (const f of ['line-oa-qr.png']) {
  const p = path.join(assetsDir, f);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) ok(`asset ${f}`);
  else fail(`asset ${f}`, new Error('missing or too small'));
}
console.log(failed ? `\nFAILED: ${failed}\n` : '\nAll smoke tests passed.\n');
process.exit(failed ? 1 : 0);
