import { OPERATIONAL_STAFF_EMAIL } from '../constants/config.js';

export { OPERATIONAL_STAFF_EMAIL };

export function normalizeShrimpEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function isOperationalStaffEmail(email) {
  return normalizeShrimpEmail(email) === OPERATIONAL_STAFF_EMAIL.toLowerCase();
}

/** ป้ายใน UI / หน้าสมาชิกแอป */
export function getShrimpRoleLabel(role, email) {
  if (role === 'admin') return 'แอดมิน';
  if (role === 'manager') return 'แมนเนเจอร์';
  if (role === 'staff' && isOperationalStaffEmail(email)) return 'สตาฟ (ลูกมือ)';
  if (role === 'staff') return 'สตาฟ';
  return '—';
}

export function isShrimpAdmin(member) {
  return member?.role === 'admin';
}

export function isShrimpManager(member) {
  return member?.role === 'manager';
}

export function isShrimpStaff(member) {
  return member?.role === 'staff';
}

/** แท็บหลักที่สตาฟ (ลูกมือ/ส่งของ) เห็น */
export const STAFF_MAIN_TABS = ['pos', 'orders'];

/** หน้าทับที่สตาฟเข้าได้ (ดูที่อยู่/เบอร์ลูกค้า) */
export const STAFF_OVERLAY_TABS = ['members'];

export function canAccessShrimpMainTab(member, tabId) {
  if (!member) return false;
  if (isShrimpStaff(member)) return STAFF_MAIN_TABS.includes(tabId);
  return true;
}

export function canAccessShrimpOverlay(member, tabId) {
  if (!member) return false;
  if (isShrimpAdmin(member)) return true;
  if (isShrimpStaff(member)) return STAFF_OVERLAY_TABS.includes(tabId);
  return tabId !== 'admin-users' && tabId !== 'admin-products' && tabId !== 'lot-close';
}

export function getDefaultMainTabForMember(member) {
  if (isShrimpStaff(member)) return 'orders';
  return 'pos';
}

/** ลำดับเปลี่ยน role ในหน้าจัดการสมาชิก (แอดมินเท่านั้น) */
export function getNextShrimpRole(currentRole) {
  if (currentRole === 'admin') return 'manager';
  if (currentRole === 'manager') return 'staff';
  return 'admin';
}
