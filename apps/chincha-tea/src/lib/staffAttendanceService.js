import { listDateKeysInRange } from './payrollPeriod';
import { cachedFetch, invalidateCache } from './fetchCache';
import {
  fsDelete,
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

/** บันทึกเวรพนักงานหลักอัตโนมัติเมื่อมีการขายวันนั้น (ครั้งแรกของวัน) */
export async function ensurePrimaryStaffPresentOnSale({ dateKey }) {
  if (!dateKey) return { ok: false, reason: 'no_date' };
  const { staff } = await getPrimaryAttendanceStaff();
  if (!staff?.id) return { ok: false, reason: 'no_staff' };

  const dayRows = await getAttendanceForDate(dateKey);
  if (isStaffPresentOnDate(staff.id, dayRows)) {
    return { ok: true, skipped: true, reason: 'already_present' };
  }

  await setStaffPresent({
    dateKey,
    staffUid: staff.id,
    staffName: staff.name || 'พนักงาน',
    present: true,
    markedBy: 'ระบบ (ยอดขายแรกของวัน)',
    markedByUid: '',
    markedSource: 'sale',
  });
  return { ok: true, skipped: false };
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
    const cur = byStaff.get(r.staffUid) || {
      staffUid: r.staffUid,
      staffName: r.staffName || 'พนักงาน',
      workDays: [],
      dailyWage: wageForUid(wageMap, r.staffUid),
    };
    if (!cur.workDays.includes(r.dateKey)) cur.workDays.push(r.dateKey);
    if (r.staffName) cur.staffName = r.staffName;
    byStaff.set(r.staffUid, cur);
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
    const cur = byStaff.get(r.staffUid) || {
      staffUid: r.staffUid,
      staffName: r.staffName || 'พนักงาน',
      days: 0,
      dailyWage: wageForUid(wageMap, r.staffUid),
    };
    cur.days += 1;
    if (r.staffName) cur.staffName = r.staffName;
    byStaff.set(r.staffUid, cur);
  }
  return [...byStaff.values()]
    .map((s) => ({
      ...s,
      wage: s.days * (s.dailyWage ?? wageForUid(wageMap, s.staffUid)),
    }))
    .filter((s) => s.days > 0)
    .sort((a, b) => a.staffName.localeCompare(b.staffName, 'th'));
}
