import { isFirebaseReady } from '../firebase';
import { dateKeyBangkok } from '../lib/date';
import { billAmount } from '../lib/salesAggregate';
import { debtCustomerKey } from '../lib/debtCustomerKey';
import { openSalesForCustomer, sortSalesFifoAsc } from '../lib/saleFifo';
import { fsGetDoc, fsListCollection, fsPatch, fsPost } from '../lib/firestoreRest';
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

export function computePaymentAmounts(total, paymentType, paidAmountInput = 0) {
  const t = parseFloat(total) || 0;
  if (paymentType === 'cash' || paymentType === 'transfer') {
    return { paidAmount: t, remainingAmount: 0 };
  }
  if (paymentType === 'credit') {
    return { paidAmount: 0, remainingAmount: t };
  }
  const paid = parseFloat(paidAmountInput) || 0;
  return { paidAmount: paid, remainingAmount: Math.max(0, t - paid) };
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
  const { paidAmount: paidA, remainingAmount: remain } = computePaymentAmounts(
    total,
    paymentType,
    paidAmount,
  );
  const dateKey = dateKeyBangkok();
  return {
    billData: {
      billNo,
      dateKey,
      customerName: customer.name,
      customerId: selectedCustomer,
      customerLineUserId: customer.lineUserId || null,
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

/** แก้สถานะชำระบิลในภาพรวม — ปรับลูกหนี้ตามผลต่างค้างจ่าย */
export async function updateSalePayment(sale, newPaymentType, paidAmountInput = 0) {
  if (!sale?.id) throw new Error('ไม่พบบิล');
  const total = billAmount(sale);
  const oldRemain = parseFloat(sale.remainingAmount) || 0;
  const { paidAmount, remainingAmount } = computePaymentAmounts(
    total,
    newPaymentType,
    paidAmountInput,
  );
  await fsPatch(`sales/${sale.id}`, {
    paymentType: newPaymentType,
    paidAmount,
    remainingAmount,
  });
  const delta = remainingAmount - oldRemain;
  if (delta !== 0) {
    await incrementCustomerDebt(sale.customerId, {
      customerId: sale.customerId,
      customerName: sale.customerName || '',
      zone: sale.zone || 'ทั่วไป',
      lastBillNo: sale.billNo || sale.id,
      lastUpdated: new Date().toISOString(),
    }, delta);
  }
  return { paymentType: newPaymentType, paidAmount, remainingAmount };
}

/** ใส่ยอดชำระเข้าบิลเดียว (ผ่อนจนกว่าครบ → โอน) */
export async function applyPaymentToSale(sale, paymentAmount) {
  if (!sale?.id) throw new Error('ไม่พบบิล');
  const total = billAmount(sale);
  const add = Math.min(parseFloat(paymentAmount) || 0, parseFloat(sale.remainingAmount) || 0);
  if (add <= 0) return { applied: 0, paymentType: sale.paymentType, paidAmount: sale.paidAmount, remainingAmount: sale.remainingAmount };

  const oldPaid = parseFloat(sale.paidAmount) || 0;
  const oldRemain = parseFloat(sale.remainingAmount) || 0;
  const newPaid = Math.min(total, oldPaid + add);
  const newRemain = Math.max(0, total - newPaid);
  const paymentType = newRemain <= 0 ? 'transfer' : 'installment';
  const paidAmount = newRemain <= 0 ? total : newPaid;

  await fsPatch(`sales/${sale.id}`, {
    paymentType,
    paidAmount,
    remainingAmount: newRemain,
  });

  const delta = newRemain - oldRemain;
  if (delta !== 0) {
    await incrementCustomerDebt(sale.customerId, {
      customerId: sale.customerId,
      customerName: sale.customerName || '',
      zone: sale.zone || 'ทั่วไป',
      lastBillNo: sale.billNo || sale.id,
      lastUpdated: new Date().toISOString(),
    }, delta);
  }

  return { applied: add, paymentType, paidAmount, remainingAmount: newRemain };
}

/** รับชำระลูกค้าแบบ FIFO — หักบิลเก่าก่อน */
export async function applyFifoCustomerPayment(customerId, customerName, paymentAmount, allSales = null) {
  const amount = parseFloat(paymentAmount) || 0;
  if (amount <= 0) throw new Error('ใส่ยอดที่รับชำระ');

  const sales = allSales || await fsListCollection('sales', 300);
  const queue = openSalesForCustomer(sales, customerId, customerName);
  if (queue.length === 0) throw new Error('ไม่มีบิลค้าง');

  let left = amount;
  const allocations = [];

  for (const sale of queue) {
    if (left <= 0) break;
    const remain = parseFloat(sale.remainingAmount) || 0;
    if (remain <= 0) continue;
    const slice = Math.min(left, remain);
    const result = await applyPaymentToSale(sale, slice);
    allocations.push({
      billNo: sale.billNo || sale.id,
      dateKey: sale.dateKey,
      applied: result.applied,
      closed: (result.remainingAmount || 0) <= 0,
    });
    left -= result.applied;
    Object.assign(sale, {
      paidAmount: result.paidAmount,
      remainingAmount: result.remainingAmount,
      paymentType: result.paymentType,
    });
  }

  return {
    requested: amount,
    applied: amount - left,
    unallocated: left,
    allocations,
    billsTouched: allocations.length,
  };
}

/** ปิดยอดลูกค้า — ตั้งบิลค้างทั้งหมดเป็นชำระแล้ว + ปรับลูกหนี้ */
export async function clearCustomerDebtAll(customerId, customerName, paymentType = 'transfer') {
  const key = debtCustomerKey(customerId, customerName);
  if (!key) throw new Error('ไม่พบลูกค้า');

  const sales = await fsListCollection('sales', 300);
  const open = sortSalesFifoAsc(sales.filter((s) => {
    if ((parseFloat(s.remainingAmount) || 0) <= 0) return false;
    return debtCustomerKey(s.customerId, s.customerName) === key;
  }));

  for (const sale of open) {
    if (!sale.id) continue;
    await updateSalePayment(sale, paymentType);
  }

  const debtDoc = await fsGetDoc(`customerDebts/${key}`).catch(() => null);
  const remain = parseFloat(debtDoc?.totalDebt) || 0;
  if (remain > 0) {
    await incrementCustomerDebt(key, {
      customerName: customerName || debtDoc?.customerName || '',
      zone: debtDoc?.zone || 'ทั่วไป',
      lastBillNo: debtDoc?.lastBillNo || '',
      lastUpdated: new Date().toISOString(),
    }, -remain);
  }

  return { clearedBills: open.length, paymentType };
}
