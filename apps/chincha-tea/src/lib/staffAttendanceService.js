import { listDateKeysInRange } from './payrollPeriod';
import { cachedFetch, invalidateCache } from './fetchCache';
import {
  fsDelete,
  fsListCollection,
  fsQueryStaffAttendanceByDate,
  fsQueryStaffAttendanceForMonth,
  fsQueryUsers,
  fsUpsertDoc,
} from './firestoreRest';
import { getStaffDailyWage, wageForUid, wageMapFromStaffList } from './staffWage';

const STAFF_LIST_CACHE_KEY = 'attendance:staff-list';
const STAFF_LIST_TTL_MS = 10 * 60 * 1000;
const MONTH_CACHE_PREFIX = 'attendance:month:';
const MONTH_TTL_MS = 2 * 60 * 1000;

export function attendanceDocId(dateKey, staffUid) {
  return `${dateKey}_${staffUid}`;
}

export function yearMonthFromDateKey(dateKey) {
  return String(dateKey).slice(0, 7);
}

/** พนักงานที่อนุมัติแล้ว (ไม่รวมแอดมิน) */
export async function listAttendanceStaff({ force = false } = {}) {
  if (force) invalidateCache(STAFF_LIST_CACHE_KEY);
  const users = await cachedFetch(
    STAFF_LIST_CACHE_KEY,
    fsQueryUsers,
    STAFF_LIST_TTL_MS,
  );
  const staff = users.filter((u) => u.approved === true && u.role === 'staff');
  return staff.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
}

/** พนักงานคนแรกในรายการที่อนุมัติแล้ว (ร้านมีพนักงานหลักคนเดียวต่อครั้ง) */
export async function getPrimaryAttendanceStaff(options) {
  const list = await listAttendanceStaff(options);
  if (list[0]) return { staff: list[0], issue: null };
  return { staff: null, issue: 'no_staff' };
}

export function invalidateAttendanceStaffCache() {
  invalidateCache(STAFF_LIST_CACHE_KEY);
}

export async function listAllStaffAttendance() {
  return fsListCollection('dailyStaffAttendance', 500);
}

/** ลบเวรทั้งหมดของพนักงานคนนี้ (ตอนลบสมาชิก) */
export async function deleteStaffAttendanceForUid(staffUid) {
  if (!staffUid) return { deleted: 0 };
  const rows = await listAllStaffAttendance();
  const mine = rows.filter((r) => r.staffUid === staffUid);
  for (const r of mine) {
    await fsDelete(`dailyStaffAttendance/${r.id}`);
  }
  invalidateCache(MONTH_CACHE_PREFIX);
  return { deleted: mine.length };
}

/** เวรที่ staffUid ไม่มีใน users ที่อนุมัติแล้ว role พนักงาน */
export async function previewOrphanedAttendance() {
  const [users, rows] = await Promise.all([fsQueryUsers(), listAllStaffAttendance()]);
  const validUids = new Set(
    users.filter((u) => u.approved === true && u.role === 'staff').map((u) => u.id),
  );
  const orphans = rows.filter((r) => r.present && r.staffUid && !validUids.has(r.staffUid));
  return { orphans, validStaffCount: validUids.size };
}

export async function pruneOrphanedAttendance() {
  const { orphans } = await previewOrphanedAttendance();
  let deleted = 0;
  let errors = 0;
  for (const r of orphans) {
    try {
      await fsDelete(`dailyStaffAttendance/${r.id}`);
      deleted += 1;
    } catch (e) {
      console.error('prune attendance failed', r.id, e);
      errors += 1;
    }
  }
  if (deleted > 0) invalidateCache(MONTH_CACHE_PREFIX);
  return { deleted, errors, orphans };
}

export async function getAttendanceForDate(dateKey) {
  return fsQueryStaffAttendanceByDate(dateKey);
}

export function isStaffPresentOnDate(staffUid, rows) {
  return rows.some((r) => r.staffUid === staffUid && r.present === true);
}

export async function setStaffPresent({
  dateKey,
  staffUid,
  staffName,
  present,
  markedBy,
  markedByUid,
  markedSource,
  actingMember,
}) {
  const autoFromSale = markedSource === 'sale';
  if (!autoFromSale && actingMember?.role !== 'admin') {
    throw new Error('attendanceAdminOnly');
  }

  const docId = attendanceDocId(dateKey, staffUid);
  if (!present) {
    await fsDelete(`dailyStaffAttendance/${docId}`);
    invalidateCache(MONTH_CACHE_PREFIX);
    return null;
  }
  const now = new Date().toISOString();
  const saved = await fsUpsertDoc('dailyStaffAttendance', docId, {
    dateKey,
    staffUid,
    staffName: staffName || 'พนักงาน',
    present: true,
    markedBy: markedBy || 'แอดมิน',
    markedByUid: markedByUid || '',
    ...(markedSource ? { markedSource } : {}),
    updatedAt: now,
    createdAt: now,
  });
  invalidateCache(MONTH_CACHE_PREFIX);
  return saved;
}

/** บันทึกเวรอัตโนมัติเมื่อมีการขายวันนั้น (ครั้งแรกของวัน) — ติ๊กคนขายถ้าเป็นพนักงาน */
export async function ensureStaffPresentOnSale({ dateKey, member }) {
  if (!dateKey) return { ok: false, reason: 'no_date' };

  let staffUid = '';
  let staffName = 'พนักงาน';

  if (member?.uid && member?.approved === true && member?.role === 'staff') {
    staffUid = member.uid;
    staffName = member.name || staffName;
  } else {
    const { staff } = await getPrimaryAttendanceStaff();
    if (!staff?.id) return { ok: false, reason: 'no_staff' };
    staffUid = staff.id;
    staffName = staff.name || staffName;
  }

  const dayRows = await getAttendanceForDate(dateKey);
  if (isStaffPresentOnDate(staffUid, dayRows)) {
    return { ok: true, skipped: true, reason: 'already_present' };
  }

  await setStaffPresent({
    dateKey,
    staffUid,
    staffName,
    present: true,
    markedBy: 'ระบบ (ยอดขายแรกของวัน)',
    markedByUid: member?.uid || '',
    markedSource: 'sale',
  });
  return { ok: true, skipped: false };
}

/** @deprecated ใช้ ensureStaffPresentOnSale */
export async function ensurePrimaryStaffPresentOnSale({ dateKey }) {
  return ensureStaffPresentOnSale({ dateKey, member: null });
}

/** สรุปเวรในรอบ 15 วัน — รวมรายการวันที่มาทำงานต่อคน (อัตราค่าแรงต่อคน) */
export async function getPeriodAttendanceSummary(startKey, endKey, { force = false } = {}) {
  const staffList = await listAttendanceStaff({ force });
  const wageMap = wageMapFromStaffList(staffList);
  const yearMonth = startKey.slice(0, 7);
  const cacheKey = `${MONTH_CACHE_PREFIX}${yearMonth}`;
  if (force) invalidateCache(cacheKey);
  const rows = await cachedFetch(
    cacheKey,
    () => fsQueryStaffAttendanceForMonth(yearMonth),
    MONTH_TTL_MS,
  );
  const inRange = rows.filter(
    (r) => r.present && r.staffUid && r.dateKey >= startKey && r.dateKey <= endKey,
  );
  const byStaff = new Map();
  for (const s of staffList) {
    byStaff.set(s.id, {
      staffUid: s.id,
      staffName: s.name || 'พนักงาน',
      workDays: [],
      dailyWage: getStaffDailyWage(s),
    });
  }
  for (const r of inRange) {
    const cur = byStaff.get(r.staffUid);
    if (!cur) continue;
    if (!cur.workDays.includes(r.dateKey)) cur.workDays.push(r.dateKey);
    if (r.staffName) cur.staffName = r.staffName;
  }
  const periodDays = listDateKeysInRange(startKey, endKey).length;
  return [...byStaff.values()]
    .map((s) => {
      const workDays = [...s.workDays].sort();
      const days = workDays.length;
      const rate = s.dailyWage ?? wageForUid(wageMap, s.staffUid);
      return {
        staffUid: s.staffUid,
        staffName: s.staffName,
        workDays,
        days,
        dailyWage: rate,
        wage: days * rate,
      };
    })
    .sort((a, b) => a.staffName.localeCompare(b.staffName, 'th'))
    .map((s) => ({ ...s, periodDays }));
}

/** สรุปจำนวนวันทำงานต่อคนในเดือน YYYY-MM */
export async function getMonthlyAttendanceSummary(yearMonth, { force = false } = {}) {
  const staffList = await listAttendanceStaff({ force });
  const wageMap = wageMapFromStaffList(staffList);
  const cacheKey = `${MONTH_CACHE_PREFIX}${yearMonth}`;
  if (force) invalidateCache(cacheKey);
  const rows = await cachedFetch(
    cacheKey,
    () => fsQueryStaffAttendanceForMonth(yearMonth),
    MONTH_TTL_MS,
  );
  const byStaff = new Map();
  for (const s of staffList) {
    byStaff.set(s.id, {
      staffUid: s.id,
      staffName: s.name || 'พนักงาน',
      days: 0,
      dailyWage: getStaffDailyWage(s),
    });
  }
  for (const r of rows) {
    if (!r.present || !r.staffUid) continue;
    const cur = byStaff.get(r.staffUid);
    if (!cur) continue;
    cur.days += 1;
    if (r.staffName) cur.staffName = r.staffName;
  }
  return [...byStaff.values()]
    .map((s) => ({
      ...s,
      wage: s.days * (s.dailyWage ?? wageForUid(wageMap, s.staffUid)),
    }))
    .filter((s) => s.days > 0)
    .sort((a, b) => a.staffName.localeCompare(b.staffName, 'th'));
}
