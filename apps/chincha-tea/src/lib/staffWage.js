import { STAFF_DAILY_WAGE } from './constants';

/** ค่าแรงรายวันต่อคน — แอดมินตั้งใน users/{uid}.dailyWage */
export function getStaffDailyWage(user) {
  const n = Number(user?.dailyWage);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return STAFF_DAILY_WAGE;
}

/** Map staffUid → อัตราค่าแรง */
export function wageMapFromStaffList(staffList = []) {
  return new Map(staffList.map((s) => [s.id, getStaffDailyWage(s)]));
}

export function wageForUid(wageMap, staffUid) {
  if (!staffUid) return STAFF_DAILY_WAGE;
  return wageMap.get(staffUid) ?? STAFF_DAILY_WAGE;
}
