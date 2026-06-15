/** ป้าย role สมาชิกแอปชา */
import { normalizeTeaRole } from './teaUserService.js';

export const MEMBER_PROFILE_TAB = 'my-profile';

/** แท็บหลัก 4 แท็บ — พนักงานใช้ทุกวัน */
export const MAIN_TEA_TABS = ['order', 'cups', 'restock', 'history'];

/** แท็บแอดมิน/เมเนเจอร์ — เปิดจากปุ่มลัดด้านบน ไม่ซ้ำแท็บล่าง */
export const ADMIN_OVERLAY_TABS = ['dashboard', 'catalog', 'profit', 'payroll', 'admin'];

/** เมนูแอดมินเห็นครบทุกงานในแอปชา */
export const ADMIN_TEA_TABS = [
  ...MAIN_TEA_TABS,
  ...ADMIN_OVERLAY_TABS,
  MEMBER_PROFILE_TAB,
];

/** ผู้จัดการเห็นงานประจำวัน + ภาพรวม แต่ไม่เห็นเมนูจัดการระบบ/เงินเดือน/กำไร */
export const MANAGER_TEA_TABS = [
  ...MAIN_TEA_TABS,
  'dashboard',
  MEMBER_PROFILE_TAB,
];

/** พนักงานหน้าร้านเห็นเฉพาะงานขาย/แก้ว/สั่งของ/ประวัติ และโปรไฟล์ตัวเอง */
export const STAFF_TEA_TABS = [
  ...MAIN_TEA_TABS,
  MEMBER_PROFILE_TAB,
];

/** @deprecated ใช้ MAIN_TEA_TABS แทน — คง alias เพื่อ migration localStorage */
export const LEGACY_TAB_ALIASES = {
  ops: 'restock',
  summary: 'order',
};

export function isMainTeaTab(tabId) {
  return MAIN_TEA_TABS.includes(tabId);
}

export function isTeaOverlayTab(tabId) {
  return ADMIN_OVERLAY_TABS.includes(tabId) || tabId === MEMBER_PROFILE_TAB;
}

export function canSendTeaLineSummary(member) {
  if (!member || member.approved !== true) return false;
  const role = normalizeTeaRole(member.role);
  return role === 'admin' || role === 'manager' || role === 'staff';
}

export function resolveLegacyTeaTab(tabId) {
  return LEGACY_TAB_ALIASES[tabId] || tabId;
}

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
  const resolved = resolveLegacyTeaTab(tabId);
  return getTeaTabsForMember(member).includes(resolved);
}

export function getDefaultTeaTabForMember(member) {
  if (isTeaAdmin(member)) return 'dashboard';
  return 'order';
}
