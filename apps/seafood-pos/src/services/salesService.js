import { isFirebaseReady } from '../firebase';
import { dateKeyBangkok } from '../lib/date';
import { fsPost } from '../lib/firestoreRest';
import { incrementCustomerDebt } from './debtService';
import { deductStockForSale, getEffectiveStock } from './stockService';

function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export function sumCartStockKg(cartItems) {
  const liveKg = cartItems.reduce((s, i) => (i.type !== 'dead' ? s + i.weight : s), 0);
  const deadKg = cartItems.reduce((s, i) => (i.type === 'dead' ? s + i.weight : s), 0);
  return { liveKg, deadKg };
}

export function validateStockForSale(cartItems, stock, stockBatches = []) {
  const avail = getEffectiveStock(stock, stockBatches);
  const { liveKg, deadKg } = sumCartStockKg(cartItems);
  if (liveKg > avail.live) {
    return {
      ok: false,
      message: `⚠️ กุ้งเป็นในสต๊อกมีแค่ ${avail.live} กก.\nขายเกินสต๊อกไม่ได้ครับ`,
    };
  }
  if (deadKg > avail.dead) {
    return {
      ok: false,
      message: `⚠️ กุ้งตายในสต๊อกมีแค่ ${avail.dead} กก.\nขายเกินสต๊อกไม่ได้ครับ`,
    };
  }
  return { ok: true, liveKg, deadKg };
}

export function buildBillData({
  cartItems,
  customer,
  selectedCustomer,
  paymentType,
  paidAmount,
  billNo,
  recordedBy,
  photoUrl,
}) {
  const total = cartItems.reduce((s, i) => s + i.total, 0);
  const paidA = paymentType === 'cash' || paymentType === 'transfer'
    ? total
    : paymentType === 'credit'
      ? 0
      : (parseFloat(paidAmount) || 0);
  const remain = total - paidA;
  const dateKey = dateKeyBangkok();
  return {
    billData: {
      billNo,
      dateKey,
      customerName: customer.name,
      customerId: selectedCustomer,
      zone: customer.zone,
      items: cartItems,
      total,
      paymentType,
      paidAmount: paidA,
      remainingAmount: remain,
      photoUrl: photoUrl || null,
      timestamp: new Date().toLocaleTimeString('th-TH'),
      recordedBy,
    },
    total,
    paidA,
    remain,
    dateKey,
  };
}

/**
 * บันทึกบิล POS: ตรวจสต๊อก → บันทึกขาย/หนี้ → ตัดสต๊อก
 * คืน { ok: false, message } หรือ { ok: true, billData, total, remain, liveKg, deadKg }
 */
export async function saveBillWithCart({
  cartItems,
  stock,
  stockBatches = [],
  customer,
  selectedCustomer,
  paymentType,
  paidAmount,
  billNo,
  recordedBy,
  photoUrl,
  updateMainStock,
}) {
  const avail = getEffectiveStock(stock, stockBatches);
  const stockCheck = validateStockForSale(cartItems, stock, stockBatches);
  if (!stockCheck.ok) return { ok: false, message: stockCheck.message };
  const { liveKg, deadKg } = stockCheck;
  const { billData, total, remain, dateKey } = buildBillData({
    cartItems,
    customer,
    selectedCustomer,
    paymentType,
    paidAmount,
    billNo,
    recordedBy,
    photoUrl,
  });
  await deductStockForSale(avail, liveKg, deadKg, updateMainStock, stockBatches);
  await persistSaleBill({
    billData,
    cartItems,
    remain,
    selectedCustomer,
    customer,
    billNo,
    dateKey,
  });
  return { ok: true, billData, total, remain, liveKg, deadKg };
}

/** บันทึกบิลขาย + ลูกหนี้ (ไม่ตัดสต๊อก — เรียก updateMainStock จากนอก) */
export async function persistSaleBill({
  billData,
  cartItems,
  remain,
  selectedCustomer,
  customer,
  billNo,
  dateKey,
}) {
  if (!isFirebaseReady) throw new Error('Firebase config ไม่ครบ — บันทึกบิลไม่ได้');
  const now = new Date().toISOString();
  await withTimeout(fsPost('sales', {
    ...billData,
    dateKey,
    items: cartItems.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      type: i.type,
      weightKg: i.weight,
      pricePerKg: i.pricePerKg,
      lineTotal: i.total,
      note: i.note || '',
    })),
    createdAt: now,
    source: 'koseafood-pos',
  }));
  if (remain > 0) {
    await withTimeout(incrementCustomerDebt(selectedCustomer, {
      customerId: selectedCustomer,
      customerName: customer.name,
      zone: customer.zone,
      lastBillNo: billNo,
      lastUpdated: now,
    }, remain));
  }
}
