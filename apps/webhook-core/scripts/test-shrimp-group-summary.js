#!/usr/bin/env node
const { classifyShrimpLineMessage } = require('../src/shrimpLineIntent');
const { isShrimpTodayOrdersCommand } = require('../src/shrimpTodayOrdersSummary');
const {
  isShrimpSummaryCommand,
  aggregateDailySales,
  buildShrimpSummaryMessage,
} = require('../src/shrimpDailySummary');
const { classifyShrimpGroupKeyboard } = require('../src/shrimpGroupKeyboard');
const { replyHelpCustomerThai } = require('../src/shrimpLineReply');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const activeSession = { pending: { customerName: 'ปุ้ย', qty: 2 } };
const groupId = 'C1234567890abcdefghijklmnopqrstuv';

assert(isShrimpTodayOrdersCommand('สรุปออเดอร์'), 'สรุปออเดอร์ is today orders');
assert(!isShrimpSummaryCommand('สรุปออเดอร์'), 'สรุปออเดอร์ not sales summary');
assert(!isShrimpSummaryCommand('สรุป ออเดอร์'), 'สรุป ออเดอร์ not sales summary');
assert(isShrimpSummaryCommand('สรุป'), 'สรุป is sales summary');
assert(isShrimpSummaryCommand('ยอดขายวันนี้'), 'ยอดขายวันนี้ is sales summary');

assert(
  classifyShrimpLineMessage('สรุปออเดอร์', activeSession, { groupId }) === 'today_orders',
  'สรุปออเดอร์ works with active session in group',
);
assert(
  classifyShrimpLineMessage('สรุป', activeSession, { groupId }) === 'summary',
  'สรุป works with active session in group',
);

assert(classifyShrimpGroupKeyboard('1') === 'today_orders', 'group key 1');
assert(classifyShrimpGroupKeyboard('3') === 'summary', 'group key 3');
assert(
  classifyShrimpLineMessage('1', activeSession, { groupId }) === 'today_orders',
  'group key 1 in group chat',
);
assert(
  classifyShrimpLineMessage('3', activeSession, { groupId }) === 'summary',
  'group key 3 in group chat',
);
assert(
  classifyShrimpLineMessage('1', null, { groupId: null }) === 'ignore',
  'group key 1 ignored in DM',
);
assert(
  classifyShrimpLineMessage('3', null, { groupId: null }) === 'ignore',
  'group key 3 ignored in DM',
);

assert(
  classifyShrimpLineMessage('ช่วยเหลือ', null, { groupId }) === 'ignore',
  'help silent in group',
);
assert(
  classifyShrimpLineMessage('help', null, { groupId }) === 'ignore',
  'help en keyword silent in group',
);
assert(
  classifyShrimpLineMessage('EN', null, { groupId }) === 'ignore',
  'EN silent in group',
);
assert(
  classifyShrimpLineMessage('ยกเลิก', null, { groupId }) === 'ignore',
  'cancel silent in group',
);
assert(
  classifyShrimpLineMessage('ฟอร์ม', null, { groupId }) === 'ignore',
  'liff silent in group',
);
assert(
  classifyShrimpLineMessage('สวัสดีครับ', null, { groupId }) === 'ignore',
  'general chat silent in group',
);
assert(
  classifyShrimpLineMessage('ช่วยเหลือ', null, { groupId: null }) === 'help',
  'help still works in OA DM',
);
assert(
  classifyShrimpLineMessage('ปุ้ย กุ้ง 2 กก', null, { groupId }) === 'order',
  'order still works in group',
);

const helpTh = replyHelpCustomerThai();
assert(!/สรุปออเดอร์/.test(helpTh), 'help th no order summary key');
assert(!/^1$|คีย์ 1|กด 1/m.test(helpTh), 'help th no group digit key 1');
assert(!/ยอดขายวันนี้/.test(helpTh), 'help th no sales summary key');

const sampleBills = [
  {
    total: 9290,
    paymentType: 'cash',
    items: [
      { productId: 'medium', type: 'live', weightKg: 3, lineTotal: 3000 },
      { productId: 'small', type: 'live', weightKg: 7.3, lineTotal: 6290 },
    ],
  },
];
const agg = aggregateDailySales(sampleBills);
const familyMsg = buildShrimpSummaryMessage(agg, '2026-06-05', { familyGroup: true });
assert(familyMsg.includes('A=0.0KG'), 'family summary A line');
assert(familyMsg.includes('B=3.0KG'), 'family summary B line');
assert(familyMsg.includes('C=7.3KG'), 'family summary C line');
assert(familyMsg.includes('รวม 10.3KG'), 'family summary total kg');
assert(familyMsg.includes('฿9,290'), 'family summary money unchanged');
assert(!familyMsg.includes('A ใหญ่'), 'family summary no inline size labels');

const oaMsg = buildShrimpSummaryMessage(agg, '2026-06-05', { familyGroup: false });
assert(oaMsg.includes('A ใหญ่ 0.0 · B กลาง 3.0'), 'non-group keeps inline grades');

console.log('\nall shrimp group summary tests passed\n');
