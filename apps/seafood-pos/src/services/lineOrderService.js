import { DEFAULT_PAYMENT_TYPE } from '../constants/payments';
import { dateKeyBangkok, shiftDateKey } from '../lib/date';
import { fsListCollection, fsPatch, fsPost, fsQueryLineOrders } from '../lib/firestoreRest';
import { actualQtyOf } from '../lib/lineOrderToSale';
import { incrementCustomerDebt } from './debtService';

function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * โหลดออเดอร์รอส่งบนบอร์ด — รวมค้างส่ง (วันส่งผ่านมา) และวันนี้/ข้างหน้า
 * กันออเดอร์เมื่อคืนที่ deliveryDate คลาดไม่หายจากรายการ
 */
export async function fetchLineOrdersForBoard() {
  const today = dateKeyBangkok();
  const minDate = shiftDateKey(today, -7);
  const maxDate = shiftDateKey(today, 14);

  let rows = [];
  try {
    rows = await fsQueryLineOrders({ pendingOnly: true, minDeliveryDate: minDate });
  } catch (e) {
    console.warn('fsQueryLineOrders', e);
  }

  if (rows.length === 0) {
    try {
      rows = await fsListCollection('lineOrders', 200);
    } catch (e) {
      console.warn('fsListCollection lineOrders', e);
      return [];
    }
  }

  return rows
    .filter((o) => {
      if (o.status === 'cancelled' || o.status === 'done') return false;
      if (o.status !== 'pending') return false;
      const dk = String(o.deliveryDate || '');
      if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return true;
      return dk >= minDate && dk <= maxDate;
    })
    .sort((a, b) => {
      const da = a.deliveryDate || '';
      const db = b.deliveryDate || '';
      if (da !== db) return da.localeCompare(db);
      const ta = a.createdAt || '';
      const tb = b.createdAt || '';
      return String(tb).localeCompare(String(ta));
    });
}

/** @deprecated */
export async function fetchLineOrdersFromToday() {
  return fetchLineOrdersForBoard();
}

export async function fetchPendingLineOrderCount() {
  const today = dateKeyBangkok();
  const rows = await fetchLineOrdersForBoard();
  return rows.filter((o) => (o.deliveryDate || '') <= today).length;
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

export async function saveLineOrderDelivery({
  order,
  cartItems,
  customer,
  total,
  recordedBy,
}) {
  const billNo = `LINE-${Date.now().toString().slice(-8)}`;
  const dateKey = order.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(order.deliveryDate)
    ? order.deliveryDate
    : dateKeyBangkok();
  const now = new Date().toISOString();
  const fulfilledItems = cartItems.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    orderedQty: i.orderedQty,
    orderedUnit: i.orderedUnit,
    actualQty: actualQtyOf(i),
    lineTotal: i.total,
  }));

  const lineUid = order.lineUserId || customer.lineUserId || null;

  const salesId = await withTimeout(fsPost('sales', {
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
  }));

  if (total > 0) {
    await withTimeout(incrementCustomerDebt(customer.id, {
      customerId: customer.id,
      customerName: customer.name,
      zone: customer.zone || 'ทั่วไป',
      lastBillNo: billNo,
      lastUpdated: now,
    }, total));
  }

  await withTimeout(fsPatch(`lineOrders/${order.id}`, {
    status: 'done',
    salesId: salesId || null,
    billNo,
    completedAt: now,
    fulfilledItems,
  }));

  return { salesId, billNo, now, fulfilledItems };
}
