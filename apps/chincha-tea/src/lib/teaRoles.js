/** ป้าย role สมาชิกแอปชา */
import { normalizeTeaRole } from './teaUserService.js';

export function getTeaRoleLabel(role, t) {
  if (role === 'admin') return t('roleAdmin');
  if (role === 'manager') return t('roleManager');
  if (role === 'staff') return t('roleStaff');
  return role || '';
}

export function isTeaAdmin(member) {
  return member?.role === 'admin';
}

export function isTeaManager(member) {
  return member?.role === 'manager';
}

export function isTeaStaff(member) {
  return normalizeTeaRole(member?.role) === 'staff';
}

/** แท็บที่พนักงานหน้าร้านใช้จริง — ซ่อนเมนูจัดการระบบทั้งหมด */
export const STAFF_TEA_TABS = ['order', 'ops', 'summary', 'my-profile'];

export const MEMBER_PROFILE_TAB = 'my-profile';

export function canAccessTeaTab(member, tabId) {
  if (!member) return false;
  if (tabId === MEMBER_PROFILE_TAB) return true;
  if (isTeaAdmin(member)) return true;
  if (isTeaManager(member)) return STAFF_TEA_TABS.includes(tabId);
  if (isTeaStaff(member)) return STAFF_TEA_TABS.includes(tabId);
  return tabId !== 'admin';
}

export function getDefaultTeaTabForMember(member) {
  if (isTeaAdmin(member)) return 'admin';
  return 'order';
}
