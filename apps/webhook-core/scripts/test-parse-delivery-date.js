#!/usr/bin/env node
const {
  coalesceSessionDeliveryDate,
  resolveLineOrderDeliveryDate,
  defaultDeliveryDateKeyBangkok,
  parseDeliveryDateFromText,
  deliveryDateKind,
} = require('../src/seafood-oa/parseDeliveryDate');
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const dec = parseDeliveryDateFromText('river prawn 2.5 kg');
assert(dec.dateKey === null && dec.textWithoutDate.includes('2.5'), '2.5 kg is not a date');

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

const at1530 = new Date('2026-05-28T15:30:00+07:00');
assert(
  defaultDeliveryDateKeyBangkok(at1530, { startHour: 18, endHour: 15 }) === '2026-05-29',
  '15:30 + end 15 → พรุ่งนี้',
);
assert(
  defaultDeliveryDateKeyBangkok(at1530, { startHour: 18, endHour: 16 }) === '2026-05-28',
  '15:30 + end 16 → วันนี้ (ตามค่าในแอปถ้าตั้ง 16)',
);
assert(
  deliveryDateKind('2026-05-28', new Date('2026-05-28T10:00:00+07:00')) === 'today',
  'deliveryDateKind today',
);
assert(
  deliveryDateKind('2026-05-29', new Date('2026-05-28T16:00:00+07:00')) === 'tomorrow',
  'deliveryDateKind tomorrow',
);

console.log('all parseDeliveryDate tests passed');
