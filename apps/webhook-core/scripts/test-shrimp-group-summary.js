#!/usr/bin/env node
const { classifyShrimpLineMessage } = require('../src/shrimpLineIntent');
const { isShrimpTodayOrdersCommand } = require('../src/shrimpTodayOrdersSummary');
const { isShrimpSummaryCommand } = require('../src/shrimpDailySummary');
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

const helpTh = replyHelpCustomerThai();
assert(!/สรุปออเดอร์/.test(helpTh), 'help th no order summary key');
assert(!/^1$|คีย์ 1|กด 1/m.test(helpTh), 'help th no group digit key 1');
assert(!/ยอดขายวันนี้/.test(helpTh), 'help th no sales summary key');

console.log('\nall shrimp group summary tests passed\n');
