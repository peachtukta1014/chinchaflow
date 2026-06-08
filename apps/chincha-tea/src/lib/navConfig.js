/**
 * โครงแท็บหลัก — จัดตามความสำคัญการใช้งาน
 *
 * พนักงาน: ขาย · ร้าน · สินค้า
 * แอดมิน: ภาพรวม (dashboard) · ขาย · ร้าน · บัญชี/ตัดวัน/จัดการ
 */

/** @typedef {'order'|'history'|'summary'|'restock'|'admin'|'catalog'|'payroll'|'profit'|'dashboard'} AppTabId */

/** @type {Record<string, { d: string }>} */
export const TAB_ICONS = {
  dashboard: {
    d: 'M4 4h7v9H4V4zm9 0h7v5h-7V4zM4 15h7v5H4v-5zm9 3h7v2h-7v-2',
  },
  order: {
    d: 'M8 2h8l1 4h3v2h-1l-1.5 14H6.5L5 8H4V6h3l1-4zm2 6v8m4-8v8',
  },
  history: {
    d: 'M12 8v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  summary: {
    d: 'M4 19V9m6 10V5m6 14v-8m6 8V11',
  },
  restock: {
    d: 'M3 7h18l-2 12H5L3 7zm4-4h10l1 4H6l1-4z',
  },
  admin: {
    d: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm8.5-3.5a8.5 8.5 0 01-.17 1.69l2.12 1.65-2 3.46-2.53-1a8.6 8.6 0 01-2.93 1.7l-.39 2.7H9.4l-.39-2.7a8.6 8.6 0 01-2.93-1.7l-2.53 1-2-3.46 2.12-1.65A8.5 8.5 0 013.5 12c0-.58.06-1.15.17-1.69L1.55 8.66l2-3.46 2.53 1a8.6 8.6 0 012.93-1.7L7.4 1.8h9.2l.39 2.7a8.6 8.6 0 012.93 1.7l2.53-1 2 3.46-2.12 1.65c.11.54.17 1.11.17 1.69z',
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

/**
 * @param {boolean} isAdmin
 * @param {(key: string) => string} t
 */
export function getAppNavGroups(isAdmin, t) {
  const salesTabs = [
    { id: 'order', label: t('orderTabShort'), icon: 'order' },
    { id: 'history', label: t('historyTabShort'), icon: 'history' },
  ];

  const shopTabs = [
    { id: 'summary', label: t('summaryTabShort'), icon: 'summary' },
    { id: 'restock', label: t('restockTabShort'), icon: 'restock' },
  ];

  if (isAdmin) {
    return [
      {
        id: 'overview',
        label: t('navGroupOverview'),
        tabs: [{ id: 'dashboard', label: t('dashboardTabShort'), icon: 'dashboard' }],
        layout: 'primary',
      },
      { id: 'sales', label: t('navGroupSales'), tabs: salesTabs, layout: 'primary' },
      { id: 'shop', label: t('navGroupDaily'), tabs: shopTabs, layout: 'compact' },
      {
        id: 'admin',
        label: t('navGroupAdmin'),
        tabs: [
          { id: 'profit', label: t('profitTabShort'), icon: 'profit' },
          { id: 'payroll', label: t('payrollTabShort'), icon: 'payroll' },
          { id: 'admin', label: t('adminTabShort'), icon: 'admin' },
        ],
        layout: 'compact',
      },
    ];
  }

  return [
    { id: 'sales', label: t('navGroupSales'), tabs: salesTabs, layout: 'primary' },
    { id: 'shop', label: t('navGroupDaily'), tabs: shopTabs, layout: 'compact' },
    {
      id: 'system',
      label: t('navGroupSystem'),
      tabs: [{ id: 'catalog', label: t('catalogTabShort'), icon: 'catalog' }],
      layout: 'compact',
    },
  ];
}

/** @param {typeof getAppNavGroups extends (...args: any) => infer R ? R : never} groups */
export function flattenNavTabIds(groups) {
  return groups.flatMap((g) => g.tabs.map((tab) => tab.id));
}
