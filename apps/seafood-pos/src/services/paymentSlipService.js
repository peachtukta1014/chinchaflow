import { generateBillImage, revokeBillImageUrl } from '../lib/generateBillImage';
import {
  fsGetDoc,
  fsPatch,
  fsQueryPendingPaymentSlips,
  fsQuerySaleByBillNo,
  fsQuerySalesByCustomer,
} from '../lib/firestoreRest';
import { pushBillToLineCustomer } from '../lib/linePushBill';
import { isValidLineUserId } from '../lib/lineUserId';
import { saleRemainingAmount } from '../lib/paymentSlipOpenSale';
import { resolveLineUserId } from '../lib/resolveLineUserId';
import {
  applyPaymentToSale,
  updateSalePayment,
} from './salesService';

export async function fetchPendingPaymentSlips() {
  return fsQueryPendingPaymentSlips(50);
}

export async function loadSaleForSlip(slip) {
  if (slip?.saleId) {
    const sale = await fsGetDoc(`sales/${slip.saleId}`);
    if (sale) return sale;
  }
  const billNo = String(slip?.billNo || slip?.suggestedBillNo || '').trim();
  if (billNo) return fsQuerySaleByBillNo(billNo);
  return null;
}

export async function loadOpenBillsForSlip(slip, sale) {
  const customerId = sale?.customerId;
  const customerName = sale?.customerName || slip?.customerName;
  if (!customerId && !customerName) return sale ? [sale] : [];
  const sales = await fsQuerySalesByCustomer(customerId, 40);
  const open = sales.filter((s) => saleRemainingAmount(s) > 0);
  if (sale?.id && !open.some((s) => s.id === sale.id)) {
    if (saleRemainingAmount(sale) > 0) open.unshift(sale);
  }
  return open.length ? open : (sale ? [sale] : []);
}

async function pushPaidBillToLine(sale, customer) {
  const lineUserId = await resolveLineUserId(customer || {}, sale);
  if (!isValidLineUserId(lineUserId)) {
    return { pushed: false, reason: 'no_line_uid' };
  }
  const paidSale = {
    ...sale,
    paymentType: 'transfer',
    remainingAmount: 0,
    paidAmount: parseFloat(sale.total) || 0,
  };
  let objectUrl = null;
  try {
    const { blob, objectUrl: url } = await generateBillImage(paidSale, customer || {});
    objectUrl = url;
    await pushBillToLineCustomer({
      lineUserId,
      blob,
      billNo: paidSale.billNo,
      customerName: paidSale.customerName,
      paymentType: 'transfer',
      remainingAmount: 0,
      total: paidSale.total,
    });
    return { pushed: true, lineUserId };
  } finally {
    revokeBillImageUrl(objectUrl);
  }
}

/**
 * ยืนยันสลิป — ปิดบิลเป็นโอน · ส่งบิลจ่ายแล้วให้ลูกค้า (ถ้ามี LINE)
 */
export async function confirmPaymentSlip({
  slip,
  sale,
  staffMember,
  pushPaidBill = true,
}) {
  if (!slip?.id || !sale?.id) throw new Error('ข้อมูลไม่ครบ');
  const remain = saleRemainingAmount(sale);
  if (remain <= 0 && sale.paymentType === 'transfer') {
    throw new Error('บิลนี้ปิดแล้ว');
  }

  if (sale.paymentType === 'installment' && remain > 0) {
    await applyPaymentToSale(sale, remain);
  } else {
    await updateSalePayment(sale, 'transfer');
  }

  const refreshed = await fsGetDoc(`sales/${sale.id}`);
  const customer = sale.customerId
    ? await fsGetDoc(`customers/${sale.customerId}`).catch(() => null)
    : null;

  let pushResult = { pushed: false };
  if (pushPaidBill) {
    try {
      pushResult = await pushPaidBillToLine(refreshed || sale, customer);
    } catch (e) {
      console.error('pushPaidBillToLine', e);
      pushResult = { pushed: false, reason: e.message || 'push_failed' };
    }
  }

  await fsPatch(`paymentSlipSubmissions/${slip.id}`, {
    status: 'confirmed',
    billNo: refreshed?.billNo || sale.billNo,
    saleId: sale.id,
    remainingAmount: 0,
    confirmedAt: new Date().toISOString(),
    confirmedByUid: staffMember?.uid || '',
    confirmedByName: staffMember?.displayName || staffMember?.email || '',
    ...(pushResult.pushed ? { paidBillPushedAt: new Date().toISOString() } : {}),
  });

  return { sale: refreshed || sale, pushResult };
}

export async function rejectPaymentSlip(slip, staffMember, reason = '') {
  if (!slip?.id) throw new Error('ไม่พบรายการสลิป');
  await fsPatch(`paymentSlipSubmissions/${slip.id}`, {
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectedByUid: staffMember?.uid || '',
    rejectedByName: staffMember?.displayName || staffMember?.email || '',
    rejectReason: reason || 'ไม่ตรงบิล',
  });
}
