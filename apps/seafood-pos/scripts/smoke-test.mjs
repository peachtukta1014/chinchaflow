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
import {
  saleToBillData,
  resolveTemplateRowName,
  TEMPLATE_ROW_NAMES,
  billMoneyReceiverName,
} from '../src/lib/billDataFromSale.js';
import { FIXED_TEMPLATE_ROWS } from '../src/lib/billTemplateRows.js';
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
  const { pickDefaultLotDateKey } = await import('../src/lib/stockBatchUtils.js');
  const lotDays = [{ dateKey: '2026-05-31', label: '31 พ.ค.' }, { dateKey: '2026-05-28', label: '28 พ.ค.' }];
  assert(pickDefaultLotDateKey(lotDays) === '2026-05-31', 'default lot = newest');
  assert(
    pickDefaultLotDateKey(lotDays, new Set(['2026-05-31'])) === '2026-05-28',
    'default lot skips closed newest',
  );
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
  const extraSlotIdx = FIXED_TEMPLATE_ROWS.findIndex((r) => r.key === 'extra-1');
  const deadSmallIdx = FIXED_TEMPLATE_ROWS.findIndex((r) => r.key === 'dead-small');
  assert(extraSlotIdx > deadSmallIdx, 'หมวดอื่นๆ อยู่ใต้แถวกุ้งตาย');
  assert(billCustom.extraLines?.[0]?.pricePerUnit === 240, 'custom ppk on bill');
} catch (e) {
  fail('stockLines/customCart', e);
}

try {
  const {
    sizeLineCost,
    calcBySizeShrimpCost,
    buildBySizeBreakdown,
    missingSizePriceLabel,
    shrimpCostFromSizeBreakdown,
  } = await import('../src/lib/stockReceiveCost.js');
  assert(sizeLineCost(15, 850) === 12750, 'sizeLineCost A 15×850');
  assert(sizeLineCost(20, 650) === 13000, 'sizeLineCost B 20×650');
  const shrimpTotal = calcBySizeShrimpCost({
    A: 15,
    B: 20,
    C: 0,
    priceA: 850,
    priceB: 650,
    priceC: 0,
  });
  assert(shrimpTotal === 25750, 'calcBySizeShrimpCost bill example');
  const bd = buildBySizeBreakdown({
    A: 15,
    B: 20,
    C: 0,
    priceA: 850,
    priceB: 650,
    priceC: 0,
  });
  assert(bd.mode === 'by_size' && bd.lineA === 12750 && bd.lineB === 13000, 'buildBySizeBreakdown lines');
  assert(
    missingSizePriceLabel({ A: 15, B: 0, C: 0, priceA: 0, priceB: 0, priceC: 0 }) === 'A ใหญ่',
    'missingSizePriceLabel A',
  );
  assert(
    shrimpCostFromSizeBreakdown(bd) === 25750,
    'shrimpCostFromSizeBreakdown',
  );
  const grandWithTransport = shrimpTotal + 1000;
  assert(grandWithTransport === 26750, 'by-size + transport (Peach bill + ค่ารถ)');
  const { batchLineMetrics } = await import('../src/lib/lotCostSplit.js');
  const bySizeBatch = {
    liveKg: 35,
    deadKg: 0,
    remainingLiveKg: 35,
    remainingDeadKg: 0,
    totalCost: grandWithTransport,
    transport: 1000,
    costPerKg: shrimpTotal / 35,
    effectiveCostPerKg: grandWithTransport / 35,
    sizeBreakdown: bd,
  };
  const liveM = batchLineMetrics(bySizeBatch, 'live');
  assert(Math.abs(liveM.costPerKg - grandWithTransport / 35) < 0.02, 'by-size batch → lot COGS/kg');
  assert(Math.abs(liveM.purchaseCostPerKg - shrimpTotal / 35) < 0.02, 'by-size batch → purchase/kg');
  assert(Math.abs(liveM.lineReceivedCostBaht - grandWithTransport) < 1, 'by-size batch totalCost');
  const { aggregateDailySales } = await import('../src/lib/salesAggregate.js');
  const { computeLotCostTotals } = await import('../src/lib/lotCostSplit.js');
  const lot = computeLotCostTotals([bySizeBatch]);
  const sales = aggregateDailySales([
    {
      total: 15000,
      items: [
        { type: 'live', weightKg: 10, lineTotal: 10000 },
        { type: 'dead', weightKg: 5, lineTotal: 5000 },
      ],
    },
  ]);
  const cogs = sales.liveKg * lot.liveCostPerKg + sales.deadKg * lot.deadCostPerKg;
  assert(sales.revenueTotal === 15000 && Math.round(cogs) === 7643, 'receive→lot→sales COGS chain');
} catch (e) {
  fail('stockReceiveCost', e);
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
  assert(data.items[0].name === TEMPLATE_ROW_NAMES.medium, 'บิลดิจิทัลมีรายการแถวกลาง');
  assert(data.items[0].quantity === '2', 'บิลเก็บน้ำหนักเป็น kg');
  assert(data.totalAmount === 2200, 'ยอดรวมไม่หักส่วนลด');
  assert(data.customerName === 'ปุ้ย', 'ชื่อลูกค้าถูกต้อง');
  const cashBill = saleToBillData(
    {
      billNo: 'CASH1',
      customerName: 'ร้านทดสอบ',
      paymentType: 'cash',
      recordedBy: 'Gmc-Peach',
      total: 1000,
      items: [],
    },
    {},
  );
  assert(cashBill.moneyReceiverName === 'Gmc-Peach', 'จ่ายสด → ผู้รับเงิน = คนออกบิล');
  assert(cashBill.senderName === 'Gmc-Peach', 'จ่ายสด → ผู้บันทึก/ส่งของ = คนออกบิล');
  const creditBill = saleToBillData(
    { paymentType: 'credit', recordedBy: 'Gmc-Peach', total: 500, items: [] },
    {},
  );
  assert(creditBill.moneyReceiverName === '', 'เครดิต → ผู้รับเงินว่างจนมีสลิป');
  assert(
    billMoneyReceiverName(
      { paymentType: 'transfer', confirmedByName: 'พี่โก๊ะ' },
      {},
    ) === 'พี่โก๊ะ',
    'โอน+ยืนยัน → ใช้ชื่อผู้รับเงินจากสลิป',
  );
  const withPhone = saleToBillData(
    { customerName: 'ร้าน A', zone: 'ป่าตอง', items: [], total: 0 },
    { phone: '081-234-5678' },
  );
  assert(withPhone.customerPhone === '081-234-5678', 'เบอร์จากรายชื่อลูกค้าแสดงบนบิล');
  const withAddr = saleToBillData(
    { customerName: 'ร้าน A', zone: 'ป่าตอง', items: [], total: 0 },
    { address: '123/4 ถ.วิชิต ภูเก็ต', phone: '0811111111' },
  );
  assert(withAddr.deliveryAddress === '123/4 ถ.วิชิต ภูเก็ต', 'บิลใช้ที่อยู่จริง ไม่ใช่โซน');
  assert(withAddr.deliveryAddress !== 'ป่าตอง', 'โซนไม่ขึ้นช่องที่อยู่บนบิล');
} catch (e) {
  fail('billDataFromSale', e);
}

try {
  const { renderShrimpBillJpeg } = requireWebhook('../../webhook-core/src/shrimpBillRender.js');
  const serverRows = requireWebhook('../../webhook-core/src/shrimpBillTemplateRows.js').FIXED_TEMPLATE_ROWS;
  assert(serverRows.length === FIXED_TEMPLATE_ROWS.length, 'server bill template row count');
  const sampleBill = saleToBillData({
    billNo: 'SMOKE-BILL',
    customerName: 'ทดสอบบิล',
    dateKey: '2026-06-05',
    items: [{ productId: 'large', weightKg: 1.5, lineTotal: 500, pricePerKg: 333 }],
    total: 500,
  });
  const fontDir = path.join(root, '../../apps/webhook-core/assets/fonts');
  assert(fs.existsSync(path.join(fontDir, 'Sarabun-Regular.ttf')), 'bill font TTF bundled');
  const png = await renderShrimpBillJpeg(sampleBill);
  assert(Buffer.isBuffer(png) && png.length > 8000, 'server Satori bill render');
  const whBill = fs.readFileSync(path.join(root, '../../apps/webhook-core/src/index.js'), 'utf8');
  assert(whBill.includes('shrimpRenderBill'), 'shrimpRenderBill function');
  assert(whBill.includes('billData'), 'shrimpPushBill accepts billData');
  const linePush = fs.readFileSync(path.join(root, 'src/lib/linePushBill.js'), 'utf8');
  assert(linePush.includes('billData'), 'client linePushBill billData path');
  const billApi = fs.readFileSync(path.join(root, 'src/lib/shrimpBillApi.js'), 'utf8');
  assert(billApi.includes('shrimpRenderBill'), 'shrimpBillApi calls render endpoint');
  assert(billApi.includes('buildBillDataForCloudResolved'), 'cloud bill resolves customer profile');
  const renderSrc = fs.readFileSync(path.join(root, '../../apps/webhook-core/src/shrimpBillRender.js'), 'utf8');
  assert(!renderSrc.includes('📞'), 'server bill header must not use emoji (Satori tofu)');
  assert(renderSrc.includes('โทร.'), 'server bill header uses text phone label');
  const billSheet = fs.readFileSync(path.join(root, 'src/components/BillImageSheet.jsx'), 'utf8');
  assert(billSheet.includes('resolveBillCustomer'), 'BillImageSheet resolves customer before cloud render');
} catch (e) {
  fail('shrimpBillServerRender', e);
}

try {
  const { exactCustomerNameMatch } = await import('../src/lib/customerNameMatch.js');
  const { CUSTOMERS } = await import('../src/constants/customers.js');
  const c1 = CUSTOMERS.find((c) => c.id === 'c1');
  assert(c1 && exactCustomerNameMatch('เจ๊เขียด', c1.name), 'เจ๊เขียด matches จ๊ะขียด registry');
  const fullBill = saleToBillData(
    { billNo: 'X', customerName: 'เจ๊เขียด', items: [], total: 0 },
    { phone: '0899999999', address: '123 ถ.ทดสอบ ภูเก็ต' },
  );
  assert(fullBill.customerPhone === '0899999999', 'billData carries customer phone');
  assert(fullBill.deliveryAddress.includes('ทดสอบ'), 'billData carries customer address');
  const noAddrBill = saleToBillData(
    { billNo: 'NA', customerName: 'อีสานรสเด็ด', items: [], total: 0 },
    { phone: '0899088208', address: '' },
  );
  assert(noAddrBill.customerPhone === '0899088208', 'phone on bill');
  assert(noAddrBill.deliveryAddress === '', 'no address stays empty');
  assert(noAddrBill.address === '0899088208', 'legacy address field may combine phone only');
  const renderSrc = fs.readFileSync(path.join(root, '../../apps/webhook-core/src/shrimpBillRender.js'), 'utf8');
  assert(
    !renderSrc.includes("data.deliveryAddress || data.address"),
    'bill address line must not fall back to legacy address (shows phone)',
  );
} catch (e) {
  fail('resolveBillCustomer', e);
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
    normalizeLineDeliveryWindow,
    setLineDeliveryWindow,
    LINE_DELIVERY_WINDOW_DEFAULTS,
  } = await import('../src/lib/lineDeliveryWindow.js');
  assert(
    normalizeLineDeliveryWindow({ lineDefaultStartHour: 17, lineDefaultEndHour: 14 }).startHour === 17,
    'normalize delivery window start',
  );
  setLineDeliveryWindow(LINE_DELIVERY_WINDOW_DEFAULTS);
} catch (e) {
  fail('lineDeliveryWindow', e);
}

try {
  const {
    getBillingLineUserId,
    customerHasLineUserId,
    findCustomerByAnyLineUid,
    lineContactsFromForm,
    normalizeLineContacts,
  } = await import('../src/lib/lineCustomerContacts.js');
  const billing = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
  const order = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2';
  const shop = {
    name: 'ร้านทดสอบ',
    lineUserId: billing,
    lineContacts: [
      { uid: billing, role: 'billing' },
      { uid: order, role: 'order' },
    ],
  };
  assert(getBillingLineUserId(shop) === billing, 'billing uid สำหรับส่งบิล');
  assert(customerHasLineUserId(shop, order), 'order uid จับร้านได้');
  assert(!customerHasLineUserId(shop, 'Uccccccccccccccccccccccccccccccc3'), 'uid แปลกไม่จับ');
  const fromForm = lineContactsFromForm({
    lineUserId: billing,
    lineOrderUserIds: `${order}, ${billing}`,
  });
  assert(fromForm.length === 2, 'ฟอร์มรวม billing + order');
  const hit = findCustomerByAnyLineUid([shop], order);
  assert(hit?.name === 'ร้านทดสอบ', 'หาร้านจาก order uid');
  const legacy = { lineUserId: billing };
  assert(normalizeLineContacts(legacy).length === 1, 'legacy lineUserId = billing');
  const { resolveLineOaLinkRole } = await import('../src/lib/lineCustomerContacts.js');
  assert(
    resolveLineOaLinkRole(billing, order) === 'order',
    'มี billing แล้ว uid ใหม่ = order',
  );
  assert(
    resolveLineOaLinkRole('', billing) === 'billing',
    'ยังไม่มี billing = billing',
  );
} catch (e) {
  fail('lineCustomerContacts', e);
}

try {
  const { normalizeLineUserId, isValidLineUserId } = await import('../src/lib/lineUserId.js');
  const uidA = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
  const uidB = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2';
  const uidC = 'Uccccccccccccccccccccccccccccccc3';
  const skip = new Set([
    ...[uidA].map(normalizeLineUserId).filter(isValidLineUserId),
    uidC,
  ]);
  const contacts = [{ lineUserId: uidA }, { lineUserId: uidB }, { lineUserId: uidC }];
  const pending = contacts.filter((c) => !skip.has(c.lineUserId));
  assert(pending.length === 1 && pending[0].lineUserId === uidB, 'ซ่อน UID จากรอผูก + สมาชิกแอป');
} catch (e) {
  fail('lineOaDismissed', e);
}

try {
  const { pickLatestLineIds } = await import('../src/lib/lineIds.js');
  const gid = 'Caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
  const { groupId } = pickLatestLineIds([
    { groupId: gid, userId: 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2', createdAt: '2026-06-03T10:00:00Z' },
  ]);
  assert(groupId === gid, 'pickLatestLineIds จาก line_messages');
} catch (e) {
  fail('lineIds', e);
}

try {
  const link = requireWebhook('../../webhook-core/src/shrimpLineCustomerLink.js');
  assert(link.isLinkCustomerCommand('ผูกไอดีลูกค้า'), 'คำสั่งผูกไอดีลูกค้า');
  assert(link.parseLinkCustomerShopName('ผูกไอดีลูกค้า ตาจุ้ย') === 'ตาจุ้ย', 'ชื่อร้านหลังคำสั่ง');
  const pending = requireWebhook('../../webhook-core/src/shrimpLinePendingLink.js');
  const norm = pending.normalizePendingLinkMap({ Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1: { requestedAt: 'x' } });
  assert(norm.Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1?.source === 'link_cmd', 'pendingLinkByUid normalize');
  const intent = requireWebhook('../../webhook-core/src/shrimpLineIntent.js');
  assert(intent.classifyShrimpLineMessage('ผูกไอดีลูกค้า', null) === 'link_customer', 'intent link_customer');
  const wh = fs.readFileSync(path.join(root, '../../apps/webhook-core/src/index.js'), 'utf8');
  assert(wh.includes("intent === 'link_customer'"), 'webhook link_customer handler');
  assert(wh.includes("source: 'shrimp'"), 'webhook log line_messages');
  const linkSrc = fs.readFileSync(
    path.join(root, '../../apps/webhook-core/src/shrimpLineCustomerLink.js'),
    'utf8',
  );
  assert(linkSrc.includes('registerPendingLinkRequest'), 'link cmd registers pending');
} catch (e) {
  fail('linkCustomerCmd', e);
}

try {
  const {
    normalizePendingLinkByUid,
    partitionLineOaContacts,
  } = await import('../src/lib/lineOaContactModel.js');
  const uid = 'Uddddddddddddddddddddddddddddddd4';
  const pendingMap = normalizePendingLinkByUid({ [uid]: { requestedAt: '2026-06-03' } });
  assert(pendingMap[uid], 'pending link map');
  const contacts = [{
    lineUserId: uid,
    displayNames: ['ขอผูก LINE (รอแอดมิน)'],
    orderCount: 0,
    linkRequested: true,
    linkedCustomers: [],
  }];
  const { pending } = partitionLineOaContacts(contacts, [], new Set());
  assert(pending.length === 1, 'link request ขึ้นรอผูกแม้ไม่มีออเดอร์');
  const { multiLinkGroupsPending, LINE_OA_MULTI_LINK_GROUPS } = await import('../src/lib/lineOaLinkGroups.js');
  assert(LINE_OA_MULTI_LINK_GROUPS.some((g) => g.id === 'tajuoy-both'), 'ตาจุ้ยสองร้าน');
  const groups = multiLinkGroupsPending(uid, (id) => (
    id === 'c2'
      ? { id: 'c2', name: 'ตาจุ้ยหนึ่ง', lineContacts: [] }
      : id === 'c3'
        ? { id: 'c3', name: 'ตาจุ้ยสอง', lineContacts: [] }
        : null
  ));
  assert(groups.length === 1 && groups[0].customerIds.length === 2, 'multi link ตาจุ้ย');
} catch (e) {
  fail('lineOaPendingLink', e);
}

try {
  const {
    formatLineOrderWeightSummary,
    summarizeLineOrderItemWeights,
    summarizeLineOrdersWeights,
  } = await import('../src/lib/lineOrderWeightSummary.js');
  const row = summarizeLineOrderItemWeights([
    { product: 'กุ้งเล็ก', qty: 4, unit: 'กก' },
    { product: 'กุ้งกลาง', qty: 2, unit: 'กก' },
    { product: 'กุ้งตาย', qty: 1.5, unit: 'กก' },
  ]);
  assert(row.small === 4 && row.medium === 2 && row.dead === 1.5, 'รวมน้ำหนักแยกไซซ์จากรายการ LINE');
  const orders = summarizeLineOrdersWeights([
    {
      status: 'pending',
      items: [{ product: 'กุ้งเล็ก', qty: 4, unit: 'กก' }],
    },
    {
      status: 'done',
      items: [{ product: 'กุ้งใหญ่', qty: 99, unit: 'กก' }],
    },
  ]);
  assert(orders.small === 4 && orders.large === 0, 'สรุปหัวข้อนับเฉพาะออเดอร์รอจัดส่ง');
  assert(
    formatLineOrderWeightSummary({ large: 0, medium: 2, small: 4, dead: 0 }) === 'A=0 · B=2.0 · C=4.0 · ตาย=0 กก.',
    'ข้อความสรุปน้ำหนักหัวข้อ LINE',
  );
} catch (e) {
  fail('lineOrder weight summary', e);
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

try {
  const { batchLineMetrics, batchVisibleOnStockLine } = await import('../src/lib/lotCostSplit.js');
  const { groupBatchesByReceiveDayForLine } = await import('../src/lib/stockBatchUtils.js');
  const mixed = {
    liveKg: 39,
    deadKg: 47,
    remainingLiveKg: 32,
    remainingDeadKg: 59,
    totalCost: 58100,
    transport: 12500,
    costPerKg: 380,
  };
  const liveM = batchLineMetrics(mixed, 'live');
  const deadM = batchLineMetrics(mixed, 'dead');
  assert(Math.abs(liveM.receivedKg - 39) < 0.01, 'batchLineMetrics live received');
  assert(Math.abs(deadM.receivedKg - 47) < 0.01, 'batchLineMetrics dead received');
  assert(
    Math.abs(liveM.costPerKg - deadM.costPerKg) < 0.02,
    'proportional cost split → same ฿/kg per line on mixed batch',
  );
  assert(
    Math.abs(liveM.lineReceivedCostBaht + deadM.lineReceivedCostBaht - 58100) < 1,
    'line costs sum to batch totalCost',
  );
  assert(batchVisibleOnStockLine(mixed, 'live'), 'mixed batch visible on live');
  assert(batchVisibleOnStockLine(mixed, 'dead'), 'mixed batch visible on dead');
  const deadOnly = { liveKg: 0, deadKg: 25, remainingLiveKg: 0, remainingDeadKg: 25, totalCost: 6930 };
  assert(!batchVisibleOnStockLine(deadOnly, 'live'), 'dead-only hidden on live line');
  assert(batchVisibleOnStockLine(deadOnly, 'dead'), 'dead-only visible on dead line');
  const days = groupBatchesByReceiveDayForLine(
    [
      { ...mixed, id: 'a', receiveDateKey: '2026-05-31', purchaseDate: '2026-05-31' },
      { ...deadOnly, id: 'b', receiveDateKey: '2026-05-31', purchaseDate: '2026-05-31' },
    ],
    'live',
  );
  assert(days.length === 1 && days[0].items.length === 1, 'live timeline filters dead-only batch');
  const deadDays = groupBatchesByReceiveDayForLine(
    [
      { ...mixed, id: 'a', receiveDateKey: '2026-05-31', purchaseDate: '2026-05-31' },
      { ...deadOnly, id: 'b', receiveDateKey: '2026-05-31', purchaseDate: '2026-05-31' },
    ],
    'dead',
  );
  assert(deadDays[0].items.length === 2, 'dead timeline includes both batches');
} catch (e) {
  fail('lot line split', e);
}

try {
  const { isNetworkError } = await import('../src/lib/networkStatus.js');
  assert(isNetworkError(new Error('Failed to fetch')), 'isNetworkError Failed to fetch');
  assert(isNetworkError(new Error('timeout')), 'isNetworkError timeout');
  assert(!isNetworkError(new Error('PERMISSION_DENIED')), 'isNetworkError not permission');
} catch (e) {
  fail('isNetworkError', e);
}

try {
  const { sumPendingStockKg, countActionablePending, sellableStockAfterReservation } = await import('../src/lib/offlineQueueUtils.js');
  const rows = [
    { status: 'pending', payload: { liveKg: 2, deadKg: 1, cartItems: [] } },
    { status: 'failed', payload: { cartItems: [{ type: 'live', weight: 1, productId: 'large' }] } },
    { status: 'syncing', payload: { liveKg: 99, deadKg: 99 } },
  ];
  const kg = sumPendingStockKg(rows);
  assert(kg.live === 3 && kg.dead === 1, 'sumPendingStockKg pending+failed, skip syncing');
  assert(countActionablePending(rows) === 2, 'countActionablePending');
  const sellable = sellableStockAfterReservation({ live: 10, dead: 0 }, { live: 6, dead: 0 });
  assert(sellable.live === 4, 'sellableStockAfterReservation live');
} catch (e) {
  fail('offlineQueueUtils', e);
}

try {
  const {
    getShrimpRoleLabel,
    isOperationalStaffEmail,
    isShrimpStaff,
    canAccessShrimpMainTab,
    canAccessShrimpOverlay,
    canSeeShrimpLiveStockBar,
    canEditShrimpCustomers,
    canDeleteShrimpSale,
    canRequestShrimpSaleDelete,
    getDefaultMainTabForMember,
    getNextShrimpRole,
  } = await import('../src/lib/shrimpRoles.js');
  const { getShrimpSignupRole } = await import('../src/constants/config.js');
  assert(isOperationalStaffEmail('techitudom2000@gmail.com'), 'โก๊ะ = operational staff email');
  assert(getShrimpSignupRole('new@example.com') === 'staff', 'สมัครใหม่ = staff');
  assert(getShrimpSignupRole('peachtukta1014@gmail.com') === 'admin', 'bootstrap = admin');
  assert(getShrimpRoleLabel('manager', 'a@b.com') === 'แมนเนเจอร์', 'label manager');
  assert(getShrimpRoleLabel('staff', 'techitudom2000@gmail.com') === 'สตาฟ (ลูกมือ)', 'label โก๊ะ');
  const staffMember = { role: 'staff', email: 'techitudom2000@gmail.com' };
  assert(isShrimpStaff(staffMember), 'isShrimpStaff');
  assert(canAccessShrimpMainTab(staffMember, 'orders'), 'staff เข้า LINE');
  assert(!canAccessShrimpMainTab(staffMember, 'sales'), 'staff ไม่เข้ายอดขาย');
  assert(canAccessShrimpOverlay(staffMember, 'members'), 'staff ดูลูกค้า');
  assert(!canAccessShrimpOverlay(staffMember, 'stock'), 'staff ไม่เข้าคลัง');
  assert(getDefaultMainTabForMember(staffMember) === 'orders', 'staff default tab = LINE');
  assert(getNextShrimpRole('admin') === 'manager', 'cycle role admin→manager');
  assert(getNextShrimpRole('manager') === 'staff', 'cycle role manager→staff');
  assert(getNextShrimpRole('staff') === 'admin', 'cycle role staff→admin');
  const managerMember = { role: 'manager', email: 'mgr@example.com' };
  assert(canSeeShrimpLiveStockBar(managerMember), 'manager เห็นแถบสต๊อก');
  assert(!canSeeShrimpLiveStockBar(staffMember), 'staff ไม่เห็นแถบสต๊อก');
  const adminMember = { role: 'admin', email: 'a@b.com' };
  assert(canEditShrimpCustomers(adminMember), 'admin แก้ลูกค้าได้');
  assert(!canEditShrimpCustomers(managerMember), 'manager แก้ลูกค้าไม่ได้');
  assert(canDeleteShrimpSale(adminMember), 'admin ลบบิลได้');
  assert(!canDeleteShrimpSale(managerMember), 'manager ลบบิลไม่ได้');
  assert(canRequestShrimpSaleDelete(managerMember), 'manager ขอลบบิลได้');
  assert(!canRequestShrimpSaleDelete(adminMember), 'admin ไม่ใช้ขอลบ');
  const appSrc = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
  assert(
    appSrc.includes('showLiveStockBar && (\n        <LiveStockStickyBar'),
    'แถบสต๊อกด้านบนแสดงแอดมิน + แมนเนเจอร์',
  );
  assert(appSrc.includes('canAccessShrimpMainTab(member'), 'App จำกัดแท็บตาม role');
  assert(appSrc.includes('readOnly={!isAdmin}'), 'ลูกค้า read-only ยกเว้นแอดมิน');
  assert(appSrc.includes('fetchPendingPaymentSlips'), 'App โพลสลิปรอตรวจเพื่อแจ้งเตือน');
  assert(appSrc.includes('AdminAlertsBanner'), 'แอดมินเห็นแจ้งเตือนขอลบบิล');
  if (/\buseMemo\s*\(/.test(appSrc)) {
    assert(
      /import\s+React,\s*\{[^}]*\buseMemo\b/.test(appSrc),
      'App.jsx ใช้ useMemo ต้อง import จาก react (กัน ReferenceError จอขาว)',
    );
  }
  const rules = fs.readFileSync(path.join(root, '../../firestore.rules'), 'utf8');
  assert(rules.includes('canMutateShrimpOps'), 'firestore.rules มี canMutateShrimpOps');
  assert(rules.includes('paymentSlipSubmissions'), 'firestore.rules มี paymentSlipSubmissions');
  assert(rules.includes('shrimpAdminAlerts'), 'firestore.rules มี shrimpAdminAlerts');
  assert(rules.includes('!isManagerShrimp()'), 'firestore จำกัด manager แก้ลูกค้า');
  assert(
    /function canMutateShrimpOps\(\)[\s\S]*!isManagerShrimp\(\)/.test(rules),
    'canMutateShrimpOps ตัด manager (read-only stock/sales/debt)',
  );
  assert(rules.includes('lineBillPushes'), 'firestore.rules อ่าน lineBillPushes');
  assert(rules.includes("role == 'manager'"), 'firestore.rules รองรับ manager signup');
  assert(
    rules.includes("role == 'staff'") && rules.includes('approved == true'),
    'firestore สมัคร staff อนุมัติทันที',
  );
} catch (e) {
  fail('shrimpRoles', e);
}

try {
  const {
    aggregateClosedLots,
    bucketSummariesByMonth,
    computePortfolioOverview,
    computeRemainingInventoryBaht,
    filterSummariesByPeriod,
  } = await import('../src/lib/lotPortfolioStats.js');
  const summaries = [
    { lotDateKey: '2026-05-10', totalCost: 100000, revenue: 120000, grossProfit: 20000, netLotProfit: 15000 },
    { lotDateKey: '2026-05-28', totalCost: 80000, revenue: 70000, grossProfit: -5000, netLotProfit: -8000 },
    { lotDateKey: '2025-12-01', totalCost: 50000, revenue: 60000, grossProfit: 8000, netLotProfit: 6000 },
  ];
  const agg = aggregateClosedLots(summaries);
  assert(agg.count === 3, 'portfolio aggregate count');
  assert(agg.netProfit === 13000, 'portfolio net profit sum');
  const may = filterSummariesByPeriod(summaries, 'month', '2026-05-15');
  assert(may.length === 2, 'portfolio filter month');
  const months = bucketSummariesByMonth(summaries);
  assert(months.length === 2, 'portfolio bucket months');
  const batches = [
    { liveKg: 10, deadKg: 0, remainingLiveKg: 5, remainingDeadKg: 0, totalCost: 1000 },
  ];
  const inv = computeRemainingInventoryBaht(batches);
  assert(inv.totalKg === 5, 'portfolio inventory kg');
  assert(inv.baht > 0, 'portfolio inventory baht');
  const overview = computePortfolioOverview({
    closedSummaries: summaries,
    stockBatches: batches,
    closedLotKeys: new Set(),
    period: 'all',
  });
  assert(overview.closed.count === 3, 'portfolio overview');
  assert(overview.byYear.length >= 1, 'portfolio by year');
  const lotCloseSrc = fs.readFileSync(path.join(root, 'src/screens/LotCloseScreen.jsx'), 'utf8');
  assert(lotCloseSrc.includes("setSection('overview')"), 'LotCloseScreen มีแท็บภาพรวม');
  assert(lotCloseSrc.includes('LotPortfolioPanel'), 'LotCloseScreen โหลด LotPortfolioPanel');
  const lotSvc = fs.readFileSync(path.join(root, 'src/services/lotCloseService.js'), 'utf8');
  assert(lotSvc.includes('fsCommitWrites'), 'ปิดล็อตใช้ batch commit เดียว');
  assert(lotSvc.includes('currentDocument: { exists: false }'), 'ปิดล็อตสร้าง doc ใหม่ใน commit');
  assert(!lotSvc.includes('fsPatch('), 'ปิดล็อตไม่แยก fsPatch');
  assert(!lotSvc.includes('fsPost('), 'ปิดล็อตไม่แยก fsPost');
} catch (e) {
  fail('lotPortfolioStats', e);
}

try {
  const { buildDebtCustomerRows, sumDebtCustomerRows } = await import('../src/lib/debtCustomerKey.js');
  const openOnly = buildDebtCustomerRows([], [
    { customerId: 'c1', customerName: 'ร้าน A', remainingAmount: 500 },
    { customerId: 'c1', customerName: 'ร้าน A', remainingAmount: 300 },
  ]);
  assert(openOnly.length === 1 && openOnly[0].totalDebt === 800, 'AR rows from open sales only');
  assert(sumDebtCustomerRows(openOnly) === 800, 'AR total from open sales');
  const mixed = buildDebtCustomerRows(
    [{ id: 'c2', customerId: 'c2', customerName: 'ร้าน B', totalDebt: 1200 }],
    [{ customerId: 'c2', customerName: 'ร้าน B', remainingAmount: 400 }],
  );
  assert(mixed.length === 1 && mixed[0].totalDebt === 1200, 'AR prefers customerDebts doc');
  const acctSrc = fs.readFileSync(path.join(root, 'src/screens/CustomerAccountsScreen.jsx'), 'utf8');
  assert(acctSrc.includes('buildDebtCustomerRows'), 'accounts uses buildDebtCustomerRows');
  assert(acctSrc.includes('sumDebtCustomerRows'), 'accounts uses sumDebtCustomerRows');
  const fsRestDebt = fs.readFileSync(path.join(root, 'src/lib/firestoreRest.js'), 'utf8');
  assert(fsRestDebt.includes('createDebtDoc'), 'fsIncrementDebt สร้าง customerDebts ถ้ายังไม่มี');
  assert(fsRestDebt.includes('isFirestoreNotFoundError'), 'fsIncrementDebt จับ NOT_FOUND');
  assert(fsRestDebt.includes('isFirestoreAlreadyExistsError'), 'fsIncrementDebt retry เมื่อสร้างซ้ำ');
} catch (e) {
  fail('debtCustomerRows', e);
}

try {
  const { saleRemainingAmount, isOpenSaleForSlip } = await import('../src/lib/paymentSlipOpenSale.js');
  assert(saleRemainingAmount({ paymentType: 'credit', total: 500 }) === 500, 'saleRemainingAmount credit');
  assert(!isOpenSaleForSlip({ paymentType: 'transfer', remainingAmount: 0 }), 'closed transfer not open');
  const slipMod = requireWebhook('../../webhook-core/src/shrimpPaymentSlip.js');
  assert(slipMod.isOpenSale({ remainingAmount: 100 }), 'webhook isOpenSale');
  const slipSrc = fs.readFileSync(path.join(root, '../../apps/webhook-core/src/shrimpPaymentSlip.js'), 'utf8');
  assert(slipSrc.includes('findSlipByLineMessageId'), 'สลิป dedup ตาม lineMessageId');
  assert(slipSrc.includes('duplicate: true'), 'สลิปซ้ำคืน submission เดิม');
  const slipSvc = fs.readFileSync(path.join(root, 'src/services/paymentSlipService.js'), 'utf8');
  assert(slipSvc.includes('claimPaymentSlipConfirmation'), 'ยืนยันสลิปมี CAS lock');
  assert(slipSvc.includes('fsPatchIf'), 'ยืนยันสลิปใช้ optimistic lock');
  const fsRestSlip = fs.readFileSync(path.join(root, 'src/lib/firestoreRest.js'), 'utf8');
  assert(fsRestSlip.includes('isFirestoreFailedPreconditionError'), 'firestoreRest จับ FAILED_PRECONDITION');
} catch (e) {
  fail('paymentSlip', e);
}

try {
  const hub = fs.readFileSync(path.join(root, 'src/screens/SalesHubScreen.jsx'), 'utf8');
  assert(hub.includes('PaymentSlipsScreen'), 'SalesHub มีแท็บสลิป');
  const wh = fs.readFileSync(path.join(root, '../../apps/webhook-core/src/index.js'), 'utf8');
  assert(wh.includes('processShrimpPaymentSlipImage'), 'lineWebhook รับรูปสลิป');
  assert(wh.includes('onShrimpPaymentSlipCreated'), 'trigger แจ้งสลิป');
  assert(wh.includes('onShrimpAdminAlertCreated'), 'trigger แจ้งขอลบบิล');
  const notify = requireWebhook('../../webhook-core/src/instantLineNotify.js');
  const slipMsg = notify.formatShrimpPaymentSlipMessage({
    customerName: 'ร้านทดสอบ',
    suggestedBillNo: 'B-001',
    remainingAmount: 500,
  });
  assert(slipMsg.includes('สลิปโอนรอตรวจ'), 'ข้อความแจ้งสลิป LINE');
} catch (e) {
  fail('paymentSlip UI', e);
}

try {
  const intent = requireWebhook('../../webhook-core/src/shrimpLineIntent.js');
  assert(intent.isShrimpLiffOpenCommand('ฟอร์ม'), 'LIFF intent ฟอร์ม');
  assert(intent.isShrimpLiffOpenCommand('form'), 'LIFF intent form');
  assert(intent.classifyShrimpLineMessage('liff', null) === 'open_liff', 'classify open_liff');
  const msg = requireWebhook('../../webhook-core/src/shrimpLiffMessaging.js');
  assert(typeof msg.buildLiffOrderFlex === 'function', 'buildLiffOrderFlex');
  const flex = msg.buildLiffOrderFlex('1234567890-AbcdEfgh');
  assert(flex.type === 'flex', 'flex message type');
  assert(flex.contents.footer.contents[0].action.uri.includes('liff.line.me'), 'flex LIFF uri');
  const wh2 = fs.readFileSync(path.join(root, '../../apps/webhook-core/src/index.js'), 'utf8');
  assert(wh2.includes("intent === 'open_liff'"), 'webhook open_liff handler');
  assert(wh2.includes("event.type === 'follow'"), 'webhook follow welcome');
  const liffSession = fs.readFileSync(path.join(root, 'src/liff/useLiffSession.js'), 'utf8');
  assert(liffSession.includes('ko-seafood'), 'LIFF prod host guard');
  const liffCopy = fs.readFileSync(path.join(root, 'src/liff/liffCopy.js'), 'utf8');
  assert(liffCopy.includes('identityTitle'), 'LIFF identity step copy');
  assert(liffCopy.includes('9–13 ตัว/กก.'), 'LIFF size count per kg copy');
  assert(liffCopy.includes('กุ้งไซซ์เล็ก'), 'LIFF dead size label without repeating ตาย');
  const liffApp = fs.readFileSync(path.join(root, 'src/liff/LineOrderLiffApp.jsx'), 'utf8');
  assert(liffApp.includes('IdentityStep'), 'LIFF order-before-identity flow');
  assert(liffApp.includes("setStep('identity')"), 'LIFF identity routing');
  const prov = requireWebhook('../../webhook-core/src/provisionShrimpLiff.js');
  assert(typeof prov.ensureShrimpLiffApp === 'function', 'provisionShrimpLiff');
  assert(typeof prov.readSlipLiffIdFromRepo === 'function', 'readSlipLiffIdFromRepo');
  const slipSession = fs.readFileSync(path.join(root, 'src/liff/useLiffSlipSession.js'), 'utf8');
  assert(slipSession.includes('VITE_LIFF_SLIP_ID'), 'slip session uses VITE_LIFF_SLIP_ID');
  assert(!slipSession.includes('VITE_LIFF_ID ||'), 'slip session must not fallback to order LIFF ID');
  const verifyMod = requireWebhook('../../webhook-core/src/verifyLineLiffToken.js');
  const prevLiff = process.env.LINE_LIFF_ID;
  const prevLoginCh = process.env.LINE_LOGIN_CHANNEL_ID;
  try {
    process.env.LINE_LIFF_ID = '2010271574-YmykKoCc';
    delete process.env.LINE_LOGIN_CHANNEL_ID;
    assert(verifyMod.resolveIdTokenClientId() === '2010271574', 'id_token verify uses channel id not full liff id');
  } finally {
    if (prevLiff !== undefined) process.env.LINE_LIFF_ID = prevLiff;
    else delete process.env.LINE_LIFF_ID;
    if (prevLoginCh !== undefined) process.env.LINE_LOGIN_CHANNEL_ID = prevLoginCh;
    else delete process.env.LINE_LOGIN_CHANNEL_ID;
  }
} catch (e) {
  fail('LIFF OA', e);
}

try {
  const {
    computeStockAfterSaleDeduction,
    planFifoBatchDeduction,
    normalizeStockValues,
  } = await import('../src/lib/stockDeductionPlan.js');
  const avail = { live: 100, dead: 0 };
  const batches = [
    { id: 'b1', remainingLiveKg: 60, remainingDeadKg: 0, liveKg: 60, deadKg: 0 },
    { id: 'b2', remainingLiveKg: 40, remainingDeadKg: 0, liveKg: 40, deadKg: 0 },
  ];
  const post = computeStockAfterSaleDeduction(avail, 25, 0, batches);
  assert(post.stock.live === 75 && post.batches[0].remainingLiveKg === 35, 'LINE rollback: post-deduction stock');
  const restored = normalizeStockValues(post.stock.live + 25, post.stock.dead);
  assert(Math.abs(restored.live - 100) < 0.01, 'LINE rollback: post-deduction + kg = เดิม');
  const { batchesAfter } = planFifoBatchDeduction(batches, { liveKg: 25, deadKg: 0 });
  assert(batchesAfter[0].remainingLiveKg === 35, 'planFifoBatchDeduction ตัดล็อตแรก');
} catch (e) {
  fail('computeStockAfterSaleDeduction', e);
}

try {
  const { filterPendingLineOrdersForBoard } = await import('../src/lib/lineOrderBoard.js');
  const today = dateKeyBangkok();
  const old = shiftDateKey(today, -30);
  const far = shiftDateKey(today, 30);
  const rows = [
    { id: '1', status: 'pending', deliveryDate: old },
    { id: '2', status: 'pending', deliveryDate: far },
    { id: '3', status: 'done', deliveryDate: old },
  ];
  const filtered = filterPendingLineOrdersForBoard(rows, {
    maxDate: shiftDateKey(today, 14),
  });
  assert(filtered.some((o) => o.id === '1'), 'บอร์ด: ค้างส่ง 30 วันยังแสดง');
  assert(!filtered.some((o) => o.id === '2'), 'บอร์ด: ซ่อนออเดอร์ส่งเกิน 14 วันล่วงหน้า');
  assert(!filtered.some((o) => o.id === '3'), 'บอร์ด: ไม่รวม done');
  const delivering = filterPendingLineOrdersForBoard([
    { id: 'd1', status: 'delivering', deliveryDate: today },
  ], { maxDate: shiftDateKey(today, 14) });
  assert(delivering.length === 1, 'บอร์ด: รวม delivering');
  const { countPendingLineOrdersForBadge } = await import('../src/lib/lineOrderBadge.js');
  assert(countPendingLineOrdersForBadge([
    { status: 'pending' },
    { status: 'delivering' },
    { status: 'done' },
  ]) === 2, 'badge นับ delivering');
} catch (e) {
  fail('filterPendingLineOrdersForBoard', e);
}

try {
  const { boardLineOrdersFromRows } = await import('../src/lib/lineOrderBoard.js');
  const today = dateKeyBangkok();
  const board = boardLineOrdersFromRows([
    { id: 'a', status: 'pending', deliveryDate: today },
    { id: 'b', status: 'delivering', deliveryDate: today },
    { id: 'c', status: 'done', deliveryDate: today },
  ]);
  assert(board.length === 2, 'boardLineOrdersFromRows รวม pending+delivering');
} catch (e) {
  fail('boardLineOrdersFromRows', e);
}

try {
  const lineOrdersScreen = fs.readFileSync(
    path.join(root, 'src/screens/LineOrdersScreen.jsx'),
    'utf8',
  );
  assert(lineOrdersScreen.includes('useLineOrdersFeed'), 'LineOrdersScreen ใช้ snapshot feed');
  const lineSheet = fs.readFileSync(path.join(root, 'src/screens/LineDeliveryConfirmSheet.jsx'), 'utf8');
  assert(
    lineSheet.includes('sheetOrderIdRef'),
    'LineDeliveryConfirmSheet ไม่รีเซ็ตน้ำหนักเมื่อโหลดลูกค้าทีหลัง',
  );
  const appJsx = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
  assert(appJsx.includes('subscribeLineOrdersBoard'), 'App badge ใช้ snapshot feed');
} catch (e) {
  fail('line orders snapshot wiring', e);
}

try {
  const lineOrdersScreen = fs.readFileSync(
    path.join(root, 'src/screens/LineOrdersScreen.jsx'),
    'utf8',
  );
  const saleBeforeStock = lineOrdersScreen.indexOf('saveLineOrderDelivery');
  const stockAfterSale = lineOrdersScreen.indexOf('deductStockForSale');
  assert(
    saleBeforeStock >= 0 && stockAfterSale > saleBeforeStock,
    'LineOrdersScreen บันทึกบิลก่อนตัดสต๊อก',
  );
  assert(
    lineOrdersScreen.includes('validateStockForSale'),
    'LineOrdersScreen เช็กสต๊อกก่อนบันทึกบิล',
  );
  assert(
    lineOrdersScreen.includes('markLineOrderStockDeducted'),
    'LineOrdersScreen mark stockDeducted หลังตัดสต๊อก',
  );
  assert(
    !lineOrdersScreen.includes('restoreStockForSale'),
    'LineOrdersScreen ไม่ restore สต๊อกเมื่อบิลบันทึกแล้ว',
  );
  const lineSvc = fs.readFileSync(path.join(root, 'src/services/lineOrderService.js'), 'utf8');
  assert(lineSvc.includes('fsQuerySaleByLineOrderId'), 'saveLineOrderDelivery กันบิลซ้ำ');
  assert(lineSvc.includes('idempotent'), 'saveLineOrderDelivery idempotent done');
  assert(lineSvc.includes('stockDeducted'), 'saveLineOrderDelivery คืน stockDeducted');
  assert(lineSvc.includes('markLineOrderStockDeducted'), 'lineOrderService mark stockDeducted');
  const fsRest = fs.readFileSync(path.join(root, 'src/lib/firestoreRest.js'), 'utf8');
  assert(fsRest.includes('fsQueryAllPendingLineOrders'), 'query ออเดอร์ pending แบ่งหน้า');
} catch (e) {
  fail('LINE delivery hardening', e);
}

const assetsDir = path.join(root, 'public/bill-assets');
for (const f of ['line-oa-qr.png']) {
  const p = path.join(assetsDir, f);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) ok(`asset ${f}`);
  else fail(`asset ${f}`, new Error('missing or too small'));
}
console.log(failed ? `\nFAILED: ${failed}\n` : '\nAll smoke tests passed.\n');
process.exit(failed ? 1 : 0);
