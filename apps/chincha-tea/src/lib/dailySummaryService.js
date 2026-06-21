import { fsGetDoc, fsQueryExpenses, fsQueryOrders } from './firestoreRest';
import { sumBulkEntries } from './bulkEntryService';
import { sumOrderRevenue } from './dailyLedger';

export const EMPTY_DAILY_SUMMARY = {
  dateKey: '',
  orders: [],
  expenses: [],
  bulkEntries: [],
  manualExpenses: [],
  expenseItems: [],
  dailySummaryDoc: null,
  cupStock: null,
  orderCount: 0,
  posSalesTotal: 0,
  posCashTotal: 0,
  posTransferTotal: 0,
  posCupsSold: 0,
  bulkEntryCount: 0,
  manualBulkTotal: 0,
  bulkCupsSold: 0,
  salesTotal: 0,
  cashTotal: 0,
  transferTotal: 0,
  cupsSold: 0,
  autoCupsSold: 0,
  manualCupsSold: 0,
  expenseTotal: 0,
  storefrontExpense: 0,
  manualExpenseTotal: 0,
  cashChangeRemaining: 0,
  remainingCups: null,
  openingCups: 0,
  refillCups: 0,
  refillTodayTotal: 0,
};

export function moneyValue(v) {
  const n = Math.round(Number(v) || 0);
  return n > 0 ? n : 0;
}

export function intValue(v) {
  const n = Math.round(Number(v) || 0);
  return n > 0 ? n : 0;
}

function hasMoneyField(row, keys) {
function previousDateKey(dateKey) {
  if (!dateKey) return '';
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function hasMoneyField(row, keys) {
  return keys.some((key) => Number(row?.[key] || 0) > 0);
}

function firstMoney(row, keys) {
  for (const key of keys) {
    const value = moneyValue(row?.[key]);
    if (value > 0) return value;
  }
  return 0;
}

function firstInt(row, keys) {
  for (const key of keys) {
    const value = intValue(row?.[key]);
    if (value > 0) return value;
  }
  return 0;
}

function normalizeCupStock(cupStock, cupsSold) {
  const openingCups = intValue(cupStock?.openingCups);
  const refillCups = intValue(cupStock?.refillCups);
  const refillTodayTotal = intValue(cupStock?.refillTodayTotal) || openingCups + refillCups;
  const calculatedRemaining = refillTodayTotal > 0 ? Math.max(0, refillTodayTotal - cupsSold) : null;
  const remainingCups = cupStock && (cupStock.remainingCups || cupStock.remainingCups === 0)
    ? intValue(cupStock.remainingCups)
    : calculatedRemaining;
  return { openingCups, refillCups, refillTodayTotal, remainingCups };
}

export function buildTeaDailySummary({ dateKey, orders = [], expenses = [], cupStock = null }) {
  const dailySummaryDoc = expenses.find((e) => e.type === 'dailySummary') || null;
  const bulkEntries = expenses.filter((e) => e.type === 'bulkEntry');
  const manualExpenses = expenses.filter((e) => e.type !== 'dailySummary' && e.type !== 'bulkEntry');
  const orderRevenue = sumOrderRevenue(orders);
  const bulk = sumBulkEntries(bulkEntries);

  const savedCashTotal = firstMoney(dailySummaryDoc, ['cashAmount', 'cash_amount']);
  const savedTransferTotal = firstMoney(dailySummaryDoc, ['transferAmount', 'transfer_amount']);
  const savedManualBulkTotal = firstMoney(dailySummaryDoc, ['manualBulkTotal', 'manual_bulk_total']);
  const hasSavedMoney = hasMoneyField(dailySummaryDoc, ['cashAmount', 'cash_amount', 'transferAmount', 'transfer_amount', 'manualBulkTotal', 'manual_bulk_total']);

  const cashTotal = hasSavedMoney ? savedCashTotal : orderRevenue.cashTotal;
  const transferTotal = hasSavedMoney ? savedTransferTotal : orderRevenue.transferTotal;
  const manualBulkTotal = hasSavedMoney ? savedManualBulkTotal : bulk.manualBulkTotal;
  const salesTotal = hasSavedMoney ? cashTotal + transferTotal + manualBulkTotal : orderRevenue.totalSales + bulk.manualBulkTotal;

  const autoCupsSold = firstInt(dailySummaryDoc, ['autoCupsSold', 'auto_cups_sold']) || orderRevenue.totalCups + bulk.manualCupsSold;
  const manualCupsSold = firstInt(dailySummaryDoc, ['manualCupsSold', 'manual_cups_sold']);
  const savedFinalCupsSold = firstInt(dailySummaryDoc, ['finalCupsSold', 'final_cups_sold', 'cupsSold']);
  const cupsSold = manualCupsSold || savedFinalCupsSold || autoCupsSold;

  const storefrontExpense = firstMoney(dailySummaryDoc, ['storefrontExpense', 'expense_amount', 'amount']);
  const manualExpenseTotal = manualExpenses.reduce((s, e) => s + moneyValue(e.amount), 0);
  const expenseTotal = storefrontExpense + manualExpenseTotal;
  const expenseItems = [
    ...(storefrontExpense > 0 && dailySummaryDoc ? [{ ...dailySummaryDoc, amount: storefrontExpense }] : []),
    ...manualExpenses,
  ];
  const cashChangeRemaining = firstMoney(dailySummaryDoc, ['cashChangeRemaining', 'cash_change_remaining']);
  const cup = normalizeCupStock(cupStock, cupsSold);

  return {
    ...EMPTY_DAILY_SUMMARY,
    dateKey,
    orders,
    expenses,
    bulkEntries,
    manualExpenses,
    expenseItems,
    dailySummaryDoc,
    cupStock,
    orderCount: orderRevenue.orderCount,
    posSalesTotal: orderRevenue.totalSales,
    posCashTotal: orderRevenue.cashTotal,
    posTransferTotal: orderRevenue.transferTotal,
    posCupsSold: orderRevenue.totalCups,
    bulkEntryCount: bulk.count,
    manualBulkTotal,
    bulkCupsSold: bulk.manualCupsSold,
    salesTotal,
    cashTotal,
    transferTotal,
    cupsSold,
    totalCups: cupsSold,
    autoCupsSold,
    manualCupsSold,
    expenseTotal,
    totalExpenses: expenseTotal,
    storefrontExpense,
    manualExpenseTotal,
    cashChangeRemaining,
    ...cup,
  };
}

export async function fetchTeaDailySummary(dateKey) {
  const [orders, expenses, cupStock] = await Promise.all([
    fsQueryOrders(dateKey),
    fsQueryExpenses(dateKey),
    fsGetDoc(`dailyCupStocks/${dateKey}`),
  ]);
  return buildTeaDailySummary({ dateKey, orders, expenses, cupStock });
}
