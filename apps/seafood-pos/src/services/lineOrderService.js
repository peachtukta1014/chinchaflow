import { DEFAULT_PAYMENT_TYPE } from '../constants/payments';
import { dateKeyBangkok } from '../lib/date';
import { fsPatch, fsPost, fsQueryLineOrders } from '../lib/firestoreRest';
import { actualQtyOf } from '../lib/lineOrderToSale';
import { incrementCustomerDebt } from './debtService';

function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export async function fetchLineOrdersFromToday() {
  const today = dateKeyBangkok();
  return fsQueryLineOrders({ minDeliveryDate: today });
}

export async function fetchPendingLineOrderCount() {
  const today = dateKeyBangkok();
  const rows = await fsQueryLineOrders({ pendingOnly: true, minDeliveryDate: today });
  return rows.length;
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
  const dateKey = dateKeyBangkok();
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
