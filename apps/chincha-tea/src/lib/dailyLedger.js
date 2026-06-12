import { STAFF_DAILY_WAGE } from './constants';
import { wageForUid } from './staffWage';
import { isRestockPurchased, restockPurchaseTotal, sumPurchasedRestocks } from './restockService';

/**
 * สรุปบัญชีรายวัน — สูตรเดียวกับ LINE (`teaDailySummary.aggregateDay`)
 * กำไรหลัก = ยอดขาย − ค่าใช้จ่าย − ซื้อของ (ไม่หักค่าแรง)
 * ค่าแรงพนักงานแต่ละคน (อัตราจาก users.dailyWage) แสดงแยก แล้วสรุปหลังหักอีกชั้น
 */

export function sumOrderRevenue(orders = []) {
  const cashOrders = orders.filter((o) => !o.payType || o.payType === 'cash');
  const transferOrders = orders.filter((o) => o.payType === 'transfer');
  const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
  const cashTotal = cashOrders.reduce((s, o) => s + (o.total || 0), 0);
  const transferTotal = transferOrders.reduce((s, o) => s + (o.total || 0), 0);
  const allItems = orders.flatMap((o) => o.items || []);
  const totalCups = allItems.reduce((s, i) => s + (i.qty || 1), 0);
  return {
    orderCount: orders.length,
    totalCups,
    totalSales,
    cashTotal,
    transferTotal,
  };
}

/** ค่าแรงรวมวันนี้ — แต่ละคนที่มาทำงาน × อัตราของตัวเอง */
export function staffWagesForDay(attendanceRows = [], wageMap = new Map()) {
  const byUid = new Map();
  for (const r of attendanceRows) {
    if (!r.present || !r.staffUid) continue;
    if (wageMap.size > 0 && !wageMap.has(r.staffUid)) continue;
    if (byUid.has(r.staffUid)) continue;
    const rate = wageForUid(wageMap, r.staffUid);
    byUid.set(r.staffUid, {
      staffUid: r.staffUid,
      staffName: r.staffName || 'พนักงาน',
      wage: rate,
      wageRate: rate,
    });
  }
  const staffWageRows = [...byUid.values()];
  const wageCost = staffWageRows.reduce((s, x) => s + x.wage, 0);
  return { staffWageRows, wageCost };
}

/** @deprecated ใช้ staffWagesForDay — คงไว้สำหรับ primary staff เดิม */
export function primaryStaffWageForDay(attendanceRows = [], staffUid, wageMap = new Map()) {
  if (!staffUid) return { present: false, wage: 0, wageRate: STAFF_DAILY_WAGE };
  const present = attendanceRows.some((r) => r.staffUid === staffUid && r.present === true);
  const wageRate = wageForUid(wageMap, staffUid);
  return { present, wage: present ? wageRate : 0, wageRate };
}

/**
 * @param {{ dailySummary?: object, orders?: object[], expenses?: object[], restocks?: object[], attendance?: object[], wageMap?: Map, primaryStaffUid?: string, primaryStaffName?: string }} input
 */
export function computeDayLedger({
  dailySummary = null,
  orders = [],
  expenses = [],
  restocks = [],
  attendance = [],
  wageMap = new Map(),
  primaryStaffUid,
  primaryStaffName,
}) {
  const revenue = dailySummary ? {
    orderCount: dailySummary.orderCount || 0,
    totalCups: dailySummary.cupsSold || dailySummary.totalCups || 0,
    totalSales: dailySummary.salesTotal || 0,
    cashTotal: dailySummary.cashTotal || 0,
    transferTotal: dailySummary.transferTotal || 0,
  } : sumOrderRevenue(orders);
  const expenseItems = dailySummary?.expenseItems || expenses;
  const totalExpenses = dailySummary ? (dailySummary.expenseTotal || 0) : expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalRestockPurchased = sumPurchasedRestocks(restocks);
  const purchasedRestocks = restocks.filter(isRestockPurchased);

  const operatingProfit = revenue.totalSales - totalExpenses - totalRestockPurchased;

  const { staffWageRows, wageCost } = staffWagesForDay(attendance, wageMap);
  const afterWage = operatingProfit - wageCost;

  const staffUid = primaryStaffUid || staffWageRows[0]?.staffUid || null;
  const primaryRow = staffWageRows.find((r) => r.staffUid === staffUid) || staffWageRows[0];
  const staffPresent = !!primaryRow;
  const staffName = primaryStaffName || primaryRow?.staffName || null;
  const wageRate = primaryRow?.wageRate ?? STAFF_DAILY_WAGE;

  return {
    ...revenue,
    totalExpenses,
    expenseItems,
    totalRestockPurchased,
    purchasedRestocks,
    operatingProfit,
    staffPresent,
    staffWageRows,
    wageCost,
    wageRate,
    staffName,
    afterWage,
  };
}
