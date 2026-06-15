/**
 * โครงแท็บหลัก Smart POS — 4 แท็บล่าง + ปุ่มลัดแอดมินด้านบน
 */
import { canAccessTeaTab } from './teaRoles.js';

/** @typedef {'order'|'cups'|'restock'|'history'|'dashboard'|'catalog'|'profit'|'payroll'|'admin'|'my-profile'} AppTabId */

/** @type {Record<string, { d: string }>} */
export const TAB_ICONS = {
  order: {
    d: 'M8 2h8l1 4h3v2h-1l-1.5 14H6.5L5 8H4V6h3l1-4zm2 6v8m4-8v8',
  },
  cups: {
    d: 'M7 3h10v3H7V3zm-2 5h14l-1.5 11H6.5L5 8zm5 3v5m4-5v5',
  },
  restock: {
    d: 'M3 7h18l-2 12H5L3 7zm4-4h10l1 4H6l1-4zM8 12h8M8 16h5',
  },
  history: {
    d: 'M12 8v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  admin: {
    d: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm8.5-3.5a8.5 8.5 0 01-.17 1.69l2.12 1.65-2 3.46-2.53-1a8.6 8.6 0 01-2.93 1.7l-.39 2.7H9.4l-.39-2.7a8.6 8.6 0 01-2.93-1.7l-2.53 1-2-3.46 2.12-1.65A8.5 8.5 0 013.5 12c0-.58.06-1.15.17-1.69L1.55 8.66l2-3.46 2.53 1a8.6 8.6 0 012.93-1.7L7.4 1.8h9.2l.39 2.7a8.6 8.6 0 012.93 1.7l2.53-1 2 3.46-2.12 1.65c.11.54.17 1.11.17 1.69z',
  },
  dashboard: {
    d: 'M4 4h7v9H4V4zm9 0h7v5h-7V4zM4 15h7v5H4v-5zm9 3h7v2h-7v-2',
  },
  catalog: {
    d: 'M4 6h16v4H4V6zm0 6h10v4H4v-4zm12 0h4v4h-4v-4z',
  },
  payroll: {
    d: 'M12 3v18M7 8h10M7 12h7M7 16h10',
  },
  profit: {
    d: 'M4 20V10m6 10V4m6 16v-6m4 6V8',
  },
};

const PRIMARY_NAV_GROUP = {
  id: 'daily',
  labelKey: 'navGroupDaily',
  tabs: [
    { id: 'order', labelKey: 'orderTabShort', icon: 'order' },
    { id: 'cups', labelKey: 'cupsTabShort', icon: 'cups' },
    { id: 'restock', labelKey: 'restockTabShort', icon: 'restock' },
    { id: 'history', labelKey: 'historyTabShort', icon: 'history' },
  ],
  layout: 'primary',
};

const ADMIN_SHORTCUT_DEFS = [
  { id: 'dashboard', labelKey: 'dashboardTabShort', icon: 'dashboard' },
  { id: 'catalog', labelKey: 'catalogTabShort', icon: 'catalog' },
  { id: 'profit', labelKey: 'profitTabShort', icon: 'profit' },
  { id: 'payroll', labelKey: 'payrollTabShort', icon: 'payroll' },
  { id: 'admin', labelKey: 'adminTabShort', icon: 'admin' },
];

/**
 * แท็บล่าง 4 แท็บ — กรองตาม role
 * @param {{ role?: string } | boolean | null | undefined} memberOrIsAdmin
 * @param {(key: string) => string} t
 */
export function getAppNavGroups(memberOrIsAdmin, t) {
  const member = typeof memberOrIsAdmin === 'boolean'
    ? { role: memberOrIsAdmin ? 'admin' : 'staff' }
    : memberOrIsAdmin;

  const tabs = PRIMARY_NAV_GROUP.tabs
    .filter((tab) => canAccessTeaTab(member, tab.id))
    .map((tab) => ({
      id: tab.id,
      label: t(tab.labelKey),
      icon: tab.icon,
    }));

  if (!tabs.length) return [];

  return [{
    id: PRIMARY_NAV_GROUP.id,
    label: t(PRIMARY_NAV_GROUP.labelKey),
    layout: PRIMARY_NAV_GROUP.layout,
    tabs,
  }];
}

/**
 * ปุ่มลัดแอดมิน/เมเนเจอร์ — แสดงเหนือเนื้อหา ไม่ใช่แท็บล่าง
 * @param {{ role?: string } | null | undefined} member
 * @param {(key: string) => string} t
 */
export function getAdminShortcutTabs(member, t) {
  if (!member) return [];
  return ADMIN_SHORTCUT_DEFS
    .filter((tab) => canAccessTeaTab(member, tab.id))
    .map((tab) => ({
      id: tab.id,
      label: t(tab.labelKey),
      icon: tab.icon,
    }));
}

/** @param {ReturnType<typeof getAppNavGroups>} groups */
export function flattenNavTabIds(groups) {
  return groups.flatMap((g) => g.tabs.map((tab) => tab.id));
}

/** ชื่อหน้า overlay แอดมิน */
export const TEA_OVERLAY_TITLES = {
  dashboard: 'dashboardTabShort',
  catalog: 'catalogTabShort',
  profit: 'profitTabShort',
  payroll: 'payrollTabShort',
  admin: 'adminTabShort',
};
