#!/usr/bin/env node
const {
  collectNotifyTargets,
  resolveNotifyTargets,
  formatShrimpOrderMessage,
  notifyShrimpLineOrdersAfterSave,
} = require('../src/instantLineNotify');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const groupId = 'C1234567890abcdefghijklmnopqrstuv';
const userId = 'U1234567890abcdefghijklmnopqrstu';
const config = {
  notifyGroupId: groupId,
  notifyUserIds: userId,
};

const oaOrder = {
  status: 'pending',
  customerName: 'เจ๊เขียด',
  deliveryDate: '2026-06-06',
  lineGroupId: null,
  items: [{ customerName: 'เจ๊เขียด', product: 'กุ้งเล็ก', qty: 4, unit: 'กก' }],
  rawText: 'LIFF: เจ๊เขียด · กุ้งเล็ก 4 กก',
};

const groupOrder = {
  ...oaOrder,
  lineGroupId: groupId,
};

assert(collectNotifyTargets(config).size === 2, 'collect targets group + user');
assert(resolveNotifyTargets(config, oaOrder).size === 2, 'OA order keeps group + user targets');
assert(!resolveNotifyTargets(config, groupOrder).has(groupId), 'group order drops group target');
assert(resolveNotifyTargets(config, groupOrder).has(userId), 'group order keeps user target');

const compact = formatShrimpOrderMessage(oaOrder, new Date('2026-06-06T10:00:00+07:00'), {
  compact: true,
  zone: 'ป่าตอง',
});
assert(compact.startsWith('🦐 '), 'compact starts with shrimp emoji');
assert(compact.includes('[ป่าตอง]'), 'compact includes zone label');
assert(compact.includes('เจ๊เขียด เล็ก4'), 'compact customer + qty');
assert(compact.includes('ส่ง'), 'compact has ship label');
assert(!compact.includes('rawText'), 'compact no rawText');
assert(!compact.includes('เปิดแอป'), 'compact no footer');

const full = formatShrimpOrderMessage(oaOrder, new Date('2026-06-06T10:00:00+07:00'), { compact: false });
assert(full.includes('ออเดอร์ LINE ใหม่'), 'full header for user notify');
assert(full.includes('เปิดแอปโกอ้วน'), 'full footer for user notify');

(async () => {
  const skipped = await notifyShrimpLineOrdersAfterSave(null, [oaOrder], { groupId: 'Cgroup' });
  assert(skipped.skipped === 'group_order', 'after-save skips group orders');
  const empty = await notifyShrimpLineOrdersAfterSave(null, [], {});
  assert(empty.skipped === 'empty', 'after-save skips empty');
  console.log('\ncompact example:', compact);
  console.log('\nall shrimp instant notify tests passed\n');
})();
