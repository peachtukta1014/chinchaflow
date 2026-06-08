import { STAFF_DAILY_WAGE } from './constants';
import { isRestockPurchased, restockPurchaseTotal, sumPurchasedRestocks } from './restockService';

/**
 * สรุปบัญชีรายวัน — สูตรเดียวกับ LINE (`teaDailySummary.aggregateDay`)
 * กำไรหลัก = ยอดขาย − ค่าใช้จ่าย − ซื้อของ (ไม่หักค่าแรง)
 * ค่าแรงลูกน้อง (คนเดียว) แสดงแยก แล้วสรุปหลังหักอีกชั้น
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

/** ค่าแรงพนักงานหลักร้าน — มาทำงานวันนั้น = 1 × อัตรา */
export function primaryStaffWageForDay(attendanceRows = [], staffUid) {
  if (!staffUid) return { present: false, wage: 0 };
  const present = attendanceRows.some((r) => r.staffUid === staffUid && r.present === true);
  return { present, wage: present ? STAFF_DAILY_WAGE : 0 };
}

/**
 * @param {{ orders?: object[], expenses?: object[], restocks?: object[], attendance?: object[], primaryStaffUid?: string, primaryStaffName?: string }} input
 */
export function computeDayLedger({
  orders = [],
  expenses = [],
  restocks = [],
  attendance = [],
  primaryStaffUid,
  primaryStaffName,
}) {
  const revenue = sumOrderRevenue(orders);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalRestockPurchased = sumPurchasedRestocks(restocks);
  const purchasedRestocks = restocks.filter(isRestockPurchased);

  const operatingProfit = revenue.totalSales - totalExpenses - totalRestockPurchased;

  const staffUid = primaryStaffUid || null;
  const { present: staffPresent, wage: wageCost } = primaryStaffWageForDay(attendance, staffUid);
  const afterWage = operatingProfit - wageCost;
  const attendanceName = attendance.find((r) => r.staffUid === staffUid && r.present)?.staffName;
  const staffName = primaryStaffName || attendanceName || null;

  return {
    ...revenue,
    totalExpenses,
    expenseItems: expenses,
    totalRestockPurchased,
    purchasedRestocks,
    operatingProfit,
    staffPresent,
    wageCost,
    wageRate: STAFF_DAILY_WAGE,
    staffName,
    afterWage,
  };
}
