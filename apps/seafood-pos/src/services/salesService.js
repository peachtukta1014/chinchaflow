import { isFirebaseReady } from '../firebase';
import { dateKeyBangkok } from '../lib/date';
import { billAmount } from '../lib/salesAggregate';
import { debtCustomerKey } from '../lib/debtCustomerKey';
import { openSalesForCustomer, sortSalesFifoAsc } from '../lib/saleFifo';
import {
  fsDelete,
  fsGetDoc,
  fsPatch,
  fsPost,
  fsQueryOpenSales,
  fsQuerySalesByCustomer,
} from '../lib/firestoreRest';
import { normalizeBillItems } from '../lib/salesAggregate';
import { incrementCustomerDebt } from './debtService';
import {
  deductFifoFromBatches,
  deductStockForSale,
  getEffectiveStock,
  restoreStockForSale,
  sumStockFromBatches,
} from './stockService';

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
 * บันทึกบิล POS: ตรวจสต๊อก → ตัดสต๊อก FIFO → บันทึกขาย/หนี้
 * มี saga compensation: ถ้าเขียนบิลล้มเหลวหลังตัดสต๊อกแล้ว → คืนสต๊อกอัตโนมัติ
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

  // Step 1: ตัด FIFO batch (atomic commit) — ต้องเสร็จก่อนเขียนบิล
  let newLive, newDead;
  if (stockBatches.length > 0) {
    const patches = await deductFifoFromBatches(stockBatches, { liveKg, deadKg });
    const patchById = Object.fromEntries(patches.map((p) => [p.id, p]));
    const summed = sumStockFromBatches(
      stockBatches.map((b) => {
        const p = patchById[b.id];
        return p ? { ...b, remainingLiveKg: p.remainingLiveKg, remainingDeadKg: p.remainingDeadKg } : b;
      }),
    );
    newLive = summed.live;
    newDead = summed.dead;
  } else {
    newLive = Math.max(0, avail.live - liveKg);
    newDead = Math.max(0, avail.dead - deadKg);
  }

  // Step 2: อัป stock summary + เขียนบิล
  // Saga compensation: ถ้า write ล้มเหลว → คืนสต๊อกที่ตัดไป ป้องกัน "สต๊อกหาย แต่ไม่มีบิล"
  try {
    await Promise.all([
      updateMainStock(newLive, newDead),
      persistSaleBill({ billData, cartItems, remain, selectedCustomer, customer, billNo, dateKey }),
    ]);
  } catch (writeErr) {
    try {
      await restoreStockForSale(avail, liveKg, deadKg, updateMainStock, stockBatches);
    } catch (restoreErr) {
      console.error('Stock compensation failed', restoreErr);
      throw new Error(
        `บันทึกบิลไม่สำเร็จ — ยอดสต๊อกอาจคลาดเคลื่อน กรุณาแจ้งแอดมิน (${writeErr.message})`,
      );
    }
    throw new Error(`บันทึกบิลไม่สำเร็จ — คืนสต๊อกแล้ว กรุณาลองใหม่ (${writeErr.message})`);
  }

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

export function saleStockKg(sale) {
  let liveKg = 0;
  let deadKg = 0;
  for (const item of normalizeBillItems(sale)) {
    if (item.type === 'dead') deadKg += item.weightKg;
    else liveKg += item.weightKg;
  }
  return { liveKg, deadKg };
}

/**
 * ลบบิล (แอดมิน) — คืนหนี้ค้าง + คืนสต๊อก + เปิดออเดอร์ LINE กลับเป็นรอส่ง (ถ้ามี)
 */
export async function deleteSaleBill(sale, { stock, stockBatches = [], updateMainStock } = {}) {
  if (!sale?.id) throw new Error('ไม่พบบิล');
  if (!isFirebaseReady) throw new Error('Firebase ไม่พร้อม — ลบบิลไม่ได้');

  const remain = parseFloat(sale.remainingAmount) || 0;
  if (remain > 0) {
    await incrementCustomerDebt(sale.customerId, {
      customerId: sale.customerId,
      customerName: sale.customerName || '',
      zone: sale.zone || 'ทั่วไป',
      lastBillNo: sale.billNo || sale.id,
      lastUpdated: new Date().toISOString(),
    }, -remain);
  }

  const { liveKg, deadKg } = saleStockKg(sale);
  if ((liveKg > 0 || deadKg > 0) && typeof updateMainStock === 'function' && stock) {
    await restoreStockForSale(stock, liveKg, deadKg, updateMainStock, stockBatches);
  }

  if (sale.lineOrderId) {
    await fsPatch(`lineOrders/${sale.lineOrderId}`, {
      status: 'pending',
      salesId: '',
      billNo: '',
      completedAt: '',
    });
  }

  await withTimeout(fsDelete(`sales/${sale.id}`));
  const still = await fsGetDoc(`sales/${sale.id}`);
  if (still) throw new Error('ลบบิลไม่สำเร็จ — ลองอีกครั้ง');
  return { billNo: sale.billNo, liveKg, deadKg, debtReversed: remain };
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

/** โหลดเฉพาะบิลค้างของลูกค้า (ไม่ดึง sales ทั้งระบบ) */
export async function fetchCustomerOpenSales(customerId, customerName) {
  let sales = [];
  if (customerId) {
    sales = await fsQuerySalesByCustomer(customerId, 80);
  }
  const queue = openSalesForCustomer(sales, customerId, customerName);
  if (queue.length > 0) return queue;

  const open = await fsQueryOpenSales(120);
  return openSalesForCustomer(open, customerId, customerName);
}

/** รับชำระลูกค้าแบบ FIFO — หักบิลเก่าก่อน */
export async function applyFifoCustomerPayment(
  customerId,
  customerName,
  paymentAmount,
  prefetchedOpenSales = null,
) {
  const amount = parseFloat(paymentAmount) || 0;
  if (amount <= 0) throw new Error('ใส่ยอดที่รับชำระ');

  const sales = prefetchedOpenSales
    || await fetchCustomerOpenSales(customerId, customerName);
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

  const open = await fetchCustomerOpenSales(customerId, customerName);

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
