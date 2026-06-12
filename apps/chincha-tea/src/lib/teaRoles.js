/** ป้าย role สมาชิกแอปชา */
import { normalizeTeaRole } from './teaUserService.js';

export const MEMBER_PROFILE_TAB = 'my-profile';

/** เมนูแอดมินเห็นครบทุกงานในแอปชา */
export const ADMIN_TEA_TABS = [
  'order',
  'ops',
  'summary',
  'dashboard',
  'catalog',
  'profit',
  'payroll',
  'history',
  'admin',
  MEMBER_PROFILE_TAB,
];

/** ผู้จัดการเห็นงานประจำวัน + ภาพรวม/ประวัติ แต่ไม่เห็นเมนูจัดการระบบ/เงินเดือน/กำไร */
export const MANAGER_TEA_TABS = [
  'order',
  'ops',
  'summary',
  'dashboard',
  'history',
  MEMBER_PROFILE_TAB,
];

/** พนักงานหน้าร้านเห็นเฉพาะขาย, สั่งของ/สต๊อกแก้ว, ปิดกะ และโปรไฟล์ตัวเอง */
export const STAFF_TEA_TABS = [
  'order',
  'ops',
  'summary',
  MEMBER_PROFILE_TAB,
];

export function getTeaRoleLabel(role, t) {
  if (role === 'admin') return t('roleAdmin');
  if (role === 'manager') return t('roleManager');
  if (role === 'staff') return t('roleStaff');
  return role || '';
}

export function isTeaAdmin(member) {
  return normalizeTeaRole(member?.role) === 'admin';
}

export function isTeaManager(member) {
  return normalizeTeaRole(member?.role) === 'manager';
}

export function isTeaStaff(member) {
  return normalizeTeaRole(member?.role) === 'staff';
}

export function getTeaTabsForMember(member) {
  if (!member) return [];
  if (isTeaAdmin(member)) return ADMIN_TEA_TABS;
  if (isTeaManager(member)) return MANAGER_TEA_TABS;
  return STAFF_TEA_TABS;
}

export function canAccessTeaTab(member, tabId) {
  return getTeaTabsForMember(member).includes(tabId);
}

export function getDefaultTeaTabForMember(member) {
  if (isTeaAdmin(member)) return 'dashboard';
  return 'order';
}
