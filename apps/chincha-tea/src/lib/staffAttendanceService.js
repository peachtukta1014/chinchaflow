import { isPrimaryStaffEmail, STAFF_DAILY_WAGE } from './constants';
import { listDateKeysInRange } from './payrollPeriod';
import { cachedFetch, invalidateCache } from './fetchCache';
import {
  fsDelete,
  fsQueryStaffAttendanceByDate,
  fsQueryStaffAttendanceForMonth,
  fsQueryUsers,
  fsUpsertDoc,
} from './firestoreRest';

const STAFF_LIST_CACHE_KEY = 'attendance:staff-list';
const STAFF_LIST_TTL_MS = 10 * 60 * 1000;
const MONTH_CACHE_PREFIX = 'attendance:month:';
const MONTH_TTL_MS = 2 * 60 * 1000;

export { STAFF_DAILY_WAGE };

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
  return staff.sort((a, b) => {
    const aPrimary = isPrimaryStaffEmail(a.email) ? 0 : 1;
    const bPrimary = isPrimaryStaffEmail(b.email) ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return (a.name || '').localeCompare(b.name || '', 'th');
  });
}

/** พนักงานหลักร้าน (2004@chincha.pos) หรือคนแรกในรายการเวร */
export async function getPrimaryAttendanceStaff(options) {
  const list = await listAttendanceStaff(options);
  const fromList = list.find((u) => isPrimaryStaffEmail(u.email)) || list[0];
  if (fromList) return { staff: fromList, issue: null };
  return resolvePrimaryStaffIssue();
}

/** บัญชีมีในระบบแต่ยังลงเวรไม่ได้ (role / อนุมัติ) */
export async function resolvePrimaryStaffIssue() {
  const users = await cachedFetch(STAFF_LIST_CACHE_KEY, fsQueryUsers, STAFF_LIST_TTL_MS);
  const u = users.find((x) => isPrimaryStaffEmail(x.email));
  if (!u) return { staff: null, issue: 'not_registered' };
  if (u.approved !== true) return { staff: null, issue: 'not_approved', profile: u };
  if (u.role !== 'staff') return { staff: null, issue: 'wrong_role', profile: u };
  return { staff: null, issue: 'unknown', profile: u };
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
}) {
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
    updatedAt: now,
    createdAt: now,
  });
  invalidateCache(MONTH_CACHE_PREFIX);
  return saved;
}

/** สรุปเวรในรอบ 15 วัน — รวมรายการวันที่มาทำงานต่อคน */
export async function getPeriodAttendanceSummary(startKey, endKey, { force = false } = {}) {
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
  for (const r of inRange) {
    const cur = byStaff.get(r.staffUid) || {
      staffUid: r.staffUid,
      staffName: r.staffName || 'พนักงาน',
      workDays: [],
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
      return {
        staffUid: s.staffUid,
        staffName: s.staffName,
        workDays,
        days,
        wage: days * STAFF_DAILY_WAGE,
      };
    })
    .sort((a, b) => a.staffName.localeCompare(b.staffName, 'th'))
    .map((s) => ({ ...s, periodDays }));
}

/** สรุปจำนวนวันทำงานต่อคนในเดือน YYYY-MM */
export async function getMonthlyAttendanceSummary(yearMonth, { force = false } = {}) {
  const cacheKey = `${MONTH_CACHE_PREFIX}${yearMonth}`;
  if (force) invalidateCache(cacheKey);
  const rows = await cachedFetch(
    cacheKey,
    () => fsQueryStaffAttendanceForMonth(yearMonth),
    MONTH_TTL_MS,
  );
  const byStaff = new Map();
  for (const r of rows) {
    if (!r.present || !r.staffUid) continue;
    const cur = byStaff.get(r.staffUid) || {
      staffUid: r.staffUid,
      staffName: r.staffName || 'พนักงาน',
      days: 0,
    };
    cur.days += 1;
    if (r.staffName) cur.staffName = r.staffName;
    byStaff.set(r.staffUid, cur);
  }
  return [...byStaff.values()]
    .map((s) => ({
      ...s,
      wage: s.days * STAFF_DAILY_WAGE,
    }))
    .sort((a, b) => a.staffName.localeCompare(b.staffName, 'th'));
}
