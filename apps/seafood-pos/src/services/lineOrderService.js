import { DEFAULT_PAYMENT_TYPE } from '../constants/payments';
import { dateKeyBangkok, shiftDateKey } from '../lib/date';
import {
  filterPendingLineOrdersForBoard,
  LINE_ORDER_BOARD_FUTURE_DAYS,
  sortLineOrdersForBoard,
} from '../lib/lineOrderBoard';
import { countPendingLineOrdersForBadge } from '../lib/lineOrderBadge';
import {
  fsGetDoc,
  fsListCollection,
  fsPatch,
  fsPost,
  fsQueryAllPendingLineOrders,
  fsQuerySaleByLineOrderId,
} from '../lib/firestoreRest';
import { actualQtyOf } from '../lib/lineOrderToSale';
import { incrementCustomerDebt } from './debtService';

function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * โหลดออเดอร์รอส่งบนบอร์ด — รวมค้างส่งทุกอายุ (ไม่ตัดที่ 7 วัน) + query แบ่งหน้า
 */
export async function fetchLineOrdersForBoard() {
  const today = dateKeyBangkok();
  const maxDate = shiftDateKey(today, LINE_ORDER_BOARD_FUTURE_DAYS);

  let rows = [];
  try {
    rows = await fsQueryAllPendingLineOrders();
  } catch (e) {
    console.warn('fsQueryAllPendingLineOrders', e);
  }

  if (rows.length === 0) {
    try {
      rows = await fsListCollection('lineOrders', 500);
    } catch (e) {
      console.warn('fsListCollection lineOrders', e);
      return [];
    }
  }

  return filterPendingLineOrdersForBoard(rows, { maxDate })
    .sort(sortLineOrdersForBoard);
}

/** @deprecated */
export async function fetchLineOrdersFromToday() {
  return fetchLineOrdersForBoard();
}

export async function fetchPendingLineOrderCount() {
  const rows = await fetchLineOrdersForBoard();
  return countPendingLineOrdersForBadge(rows);
}

export async function cancelLineOrder(orderId, cancelledBy) {
  await fsPatch(`lineOrders/${orderId}`, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelledBy,
  });
}

export async function markLineOrderDoneOnly(orderId) {
  await fsPatch(`lineOrders/${orderId}`, { status: 'done' });
}

function buildFulfilledItems(cartItems) {
  return cartItems.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    orderedQty: i.orderedQty,
    orderedUnit: i.orderedUnit,
    actualQty: actualQtyOf(i),
    lineTotal: i.total,
  }));
}

function buildSalePayload({
  billNo,
  dateKey,
  now,
  customer,
  cartItems,
  total,
  recordedBy,
  order,
  lineUid,
  fulfilledItems,
}) {
  return {
    billNo,
    dateKey,
    customerName: customer.name,
    customerId: customer.id,
    customerLineUserId: lineUid,
    zone: customer.zone || 'ทั่วไป',
    items: cartItems.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      type: i.type,
      weightKg: i.weight,
      pricePerKg: i.pricePerKg,
      lineTotal: i.total,
      note: i.note || '',
    })),
    total,
    paymentType: DEFAULT_PAYMENT_TYPE,
    paidAmount: 0,
    remainingAmount: total,
    photoUrl: null,
    timestamp: new Date().toLocaleTimeString('th-TH'),
    recordedBy,
    createdAt: now,
    source: 'line-order',
    lineOrderId: order.id,
    lineUserId: lineUid,
    lineRawText: order.rawText || '',
    fulfilledItems,
  };
}

async function completeLineOrderPatch(orderId, {
  salesId,
  billNo,
  now,
  fulfilledItems,
}) {
  await withTimeout(fsPatch(`lineOrders/${orderId}`, {
    status: 'done',
    salesId: salesId || null,
    billNo,
    completedAt: now,
    fulfilledItems,
  }));
}

/**
 * บันทึกส่งของจากออเดอร์ LINE — idempotent (กดซ้ำ / timeout ไม่สร้างบิลซ้ำ)
 */
export async function saveLineOrderDelivery({
  order,
  cartItems,
  customer,
  total,
  recordedBy,
}) {
  const fresh = await fsGetDoc(`lineOrders/${order.id}`);
  if (!fresh) {
    throw new Error('ไม่พบออเดอร์ LINE นี้แล้ว');
  }
  if (fresh.status === 'cancelled') {
    throw new Error('ออเดอร์นี้ถูกยกเลิกแล้ว');
  }

  const fulfilledItems = buildFulfilledItems(cartItems);
  const lineUid = fresh.lineUserId || order.lineUserId || customer.lineUserId || null;

  if (fresh.status === 'done' && fresh.salesId) {
    return {
      salesId: fresh.salesId,
      billNo: fresh.billNo,
      fulfilledItems: fresh.fulfilledItems || fulfilledItems,
      idempotent: true,
    };
  }

  const dateKey = fresh.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(fresh.deliveryDate)
    ? fresh.deliveryDate
    : dateKeyBangkok();
  const now = fresh.completedAt || new Date().toISOString();

  let salesId = fresh.salesId || null;
  let billNo = fresh.billNo || null;

  const existingSale = salesId
    ? { id: salesId, billNo }
    : await fsQuerySaleByLineOrderId(order.id);

  if (existingSale?.id) {
    salesId = existingSale.id;
    billNo = billNo || existingSale.billNo || `LINE-${String(salesId).slice(-8)}`;
    await completeLineOrderPatch(order.id, { salesId, billNo, now, fulfilledItems });
    return { salesId, billNo, fulfilledItems, recovered: true };
  }

  billNo = `LINE-${Date.now().toString().slice(-8)}`;

  salesId = await withTimeout(fsPost('sales', buildSalePayload({
    billNo,
    dateKey,
    now,
    customer,
    cartItems,
    total,
    recordedBy,
    order: fresh,
    lineUid,
    fulfilledItems,
  })));

  if (total > 0) {
    await withTimeout(incrementCustomerDebt(customer.id, {
      customerId: customer.id,
      customerName: customer.name,
      zone: customer.zone || 'ทั่วไป',
      lastBillNo: billNo,
      lastUpdated: now,
    }, total));
  }

  await completeLineOrderPatch(order.id, { salesId, billNo, now, fulfilledItems });

  return { salesId, billNo, fulfilledItems };
}
