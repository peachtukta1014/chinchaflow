#!/usr/bin/env node
const {
  coalesceSessionDeliveryDate,
  resolveLineOrderDeliveryDate,
  defaultDeliveryDateKeyBangkok,
} = require('../src/parseDeliveryDate');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

assert(coalesceSessionDeliveryDate('2026-05-26', '2026-05-28') === null, 'stale session');
assert(coalesceSessionDeliveryDate('2026-05-28', '2026-05-28') === '2026-05-28', 'today session');
const now = new Date('2026-05-28T10:00:00+07:00');
assert(
  resolveLineOrderDeliveryDate({ parsedDate: null, sessionDate: '2026-05-26', now })
    === defaultDeliveryDateKeyBangkok(now),
  'ignore old session',
);
const afterCutoff = new Date('2026-05-28T16:00:00+07:00');
assert(
  resolveLineOrderDeliveryDate({
    parsedDate: null,
    sessionDate: '2026-05-28',
    now: afterCutoff,
  }) === defaultDeliveryDateKeyBangkok(afterCutoff),
  'session วันนี้เช้าไม่บังคับส่งวันนี้หลังเลย 15:00',
);
assert(
  resolveLineOrderDeliveryDate({
    parsedDate: null,
    sessionDate: '2026-05-28',
    now: afterCutoff,
    lockSessionDate: true,
  }) === '2026-05-28',
  'pending ค้างข้าม cutoff ยังใช้วันส่งเดิม',
);
console.log('all parseDeliveryDate tests passed');
