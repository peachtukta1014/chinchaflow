import { STAFF_DAILY_WAGE } from './constants';
import {
  fsDelete,
  fsQueryStaffAttendanceByDate,
  fsQueryStaffAttendanceForMonth,
  fsQueryUsers,
  fsUpsertDoc,
} from './firestoreRest';

export { STAFF_DAILY_WAGE };

export function attendanceDocId(dateKey, staffUid) {
  return `${dateKey}_${staffUid}`;
}

export function yearMonthFromDateKey(dateKey) {
  return String(dateKey).slice(0, 7);
}

/** พนักงานที่อนุมัติแล้ว (ไม่รวมแอดมิน) */
export async function listAttendanceStaff() {
  const users = await fsQueryUsers();
  return users
    .filter((u) => u.approved === true && u.role === 'staff')
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
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
    return null;
  }
  const now = new Date().toISOString();
  return fsUpsertDoc('dailyStaffAttendance', docId, {
    dateKey,
    staffUid,
    staffName: staffName || 'พนักงาน',
    present: true,
    markedBy: markedBy || 'แอดมิน',
    markedByUid: markedByUid || '',
    updatedAt: now,
    createdAt: now,
  });
}

/** สรุปจำนวนวันทำงานต่อคนในเดือน YYYY-MM */
export async function getMonthlyAttendanceSummary(yearMonth) {
  const rows = await fsQueryStaffAttendanceForMonth(yearMonth);
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
