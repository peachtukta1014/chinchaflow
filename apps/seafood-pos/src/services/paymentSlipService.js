import {
  fsGetDoc,
  fsPatch,
  fsPatchIf,
  fsQueryPendingPaymentSlips,
  fsQuerySaleByBillNo,
  fsQuerySalesByCustomer,
  isFirestoreFailedPreconditionError,
} from '../lib/firestoreRest';
import { pushBillToLineCustomer } from '../lib/linePushBill';
import { buildBillDataForCloud } from '../lib/shrimpBillApi';
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


const SLIP_CONFIRM_LOCK_MS = 5 * 60 * 1000;

function isSlipConfirmLockStale(slip) {
  if (!slip?.confirmingAt) return true;
  const t = new Date(slip.confirmingAt).getTime();
  return Number.isNaN(t) || Date.now() - t > SLIP_CONFIRM_LOCK_MS;
}

/** ล็อคสลิปก่อนปิดบิล — กันสองคนยืนยันพร้อมกัน */
async function claimPaymentSlipConfirmation(slip, staffMember) {
  const fresh = await fsGetDoc(`paymentSlipSubmissions/${slip.id}`);
  if (!fresh) throw new Error('ไม่พบรายการสลิป');

  const staffLabel = staffMember?.displayName || staffMember?.email || '';
  const status = fresh.status || 'pending';

  if (status === 'confirmed') {
    return { fresh, alreadyConfirmed: true };
  }
  if (status === 'rejected') {
    throw new Error('สลิปนี้ถูกปฏิเสธแล้ว');
  }
  if (status === 'confirming') {
    if (!isSlipConfirmLockStale(fresh) && fresh.confirmingByName && fresh.confirmingByName !== staffLabel) {
      throw new Error(`มี ${fresh.confirmingByName} กำลังยืนยันสลิปนี้อยู่ — รอสักครู่แล้วลองใหม่`);
    }
    return { fresh, alreadyConfirming: true };
  }
  if (status !== 'pending') {
    throw new Error('สถานะสลิปไม่รองรับการยืนยัน');
  }

  const confirmingAt = new Date().toISOString();
  try {
    await fsPatchIf(`paymentSlipSubmissions/${slip.id}`, {
      status: 'confirming',
      confirmingAt,
      confirmingByName: staffLabel,
    }, { updateTime: fresh._updateTime });
  } catch (err) {
    if (isFirestoreFailedPreconditionError(err.status, err.detail)) {
      const retry = await fsGetDoc(`paymentSlipSubmissions/${slip.id}`);
      if (retry?.status === 'confirmed') return { fresh: retry, alreadyConfirmed: true };
      if (retry?.status === 'confirming' && (isSlipConfirmLockStale(retry) || retry.confirmingByName === staffLabel)) {
        return { fresh: retry, alreadyConfirming: true };
      }
      throw new Error('มีคนกำลังยืนยันสลิปนี้อยู่ — รีเฟรชแล้วลองใหม่');
    }
    throw err;
  }

  return {
    fresh: { ...fresh, status: 'confirming', confirmingAt, confirmingByName: staffLabel },
    claimed: true,
  };
}

async function pushPaidBillToLine(sale, customer, moneyReceiverName = '') {
  const lineUserId = await resolveLineUserId(customer || {}, sale);
  if (!isValidLineUserId(lineUserId)) {
    return { pushed: false, reason: 'no_line_uid' };
  }
  const receiver =
    moneyReceiverName ||
    sale.moneyReceiverName ||
    sale.confirmedByName ||
    '';
  const paidSale = {
    ...sale,
    paymentType: 'transfer',
    remainingAmount: 0,
    paidAmount: parseFloat(sale.total) || 0,
    moneyReceiverName: receiver,
    confirmedByName: receiver,
  };
  await pushBillToLineCustomer({
    lineUserId,
    billData: buildBillDataForCloud(paidSale, customer || {}),
    billNo: paidSale.billNo,
    customerName: paidSale.customerName,
    paymentType: 'transfer',
    remainingAmount: 0,
    total: paidSale.total,
  });
  return { pushed: true, lineUserId };
}

/**
 * ส่งบิลจ่ายแล้วให้ลูกค้าใน LINE ในพื้นหลัง — ไม่บล็อก UI
 * อัปเดต paidBillPushedAt ใน slip เมื่อสำเร็จ
 */
function pushPaidBillToLineBackground(sale, customer, staffMember, slipId, receiverName) {
  pushPaidBillToLine(sale, customer, receiverName)
    .then((result) => {
      if (result.pushed && slipId) {
        fsPatch(`paymentSlipSubmissions/${slipId}`, {
          paidBillPushedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    })
    .catch((e) => {
      console.warn('pushPaidBillToLine background', e);
    });
}

/**
 * ยืนยันสลิป — ปิดบิลเป็นโอน · ส่งบิลจ่ายแล้วให้ลูกค้า (ถ้ามี LINE)
 *
 * LINE push ทำงานพื้นหลัง (ไม่บล็อก UI) — ฟังก์ชันนี้คืนหลัง slip = confirmed
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

  const staffLabel = staffMember?.displayName || staffMember?.email || '';
  const claim = await claimPaymentSlipConfirmation(slip, staffMember);
  if (claim.alreadyConfirmed) {
    const refreshed = await fsGetDoc(`sales/${sale.id}`);
    return {
      sale: refreshed || sale,
      pushResult: { pushed: false, reason: 'already_confirmed' },
    };
  }

  const priorStatus = claim.fresh?.status || slip.status || 'pending';
  let refreshed = sale;
  try {
    // โหลด customer พร้อมกับ update sale — ไม่รอกันเอง
    const [, customer] = await Promise.all([
      sale.paymentType === 'installment' && remain > 0
        ? applyPaymentToSale(sale, remain)
        : updateSalePayment(sale, 'transfer'),
      sale.customerId
        ? fsGetDoc(`customers/${sale.customerId}`).catch(() => null)
        : Promise.resolve(null),
    ]);

    refreshed = await fsGetDoc(`sales/${sale.id}`);

    await fsPatch(`paymentSlipSubmissions/${slip.id}`, {
      status: 'confirmed',
      billNo: refreshed?.billNo || sale.billNo,
      saleId: sale.id,
      remainingAmount: 0,
      confirmedAt: new Date().toISOString(),
      confirmedByUid: staffMember?.uid || '',
      confirmedByName: staffLabel,
    });

    // ส่งบิล LINE ในพื้นหลัง — ไม่ block ผู้ใช้รอ
    if (pushPaidBill) {
      const receiverName = staffMember?.displayName || staffMember?.email || '';
      pushPaidBillToLineBackground(refreshed || sale, customer, staffMember, slip.id, receiverName);
    }

    return { sale: refreshed || sale, pushResult: { pushed: false, reason: 'async' } };
  } catch (err) {
    if (priorStatus !== 'confirmed') {
      await fsPatch(`paymentSlipSubmissions/${slip.id}`, {
        status: priorStatus === 'confirming' ? 'pending' : priorStatus,
        confirmingAt: null,
        confirmingByName: null,
        confirmError: String(err?.message || err).slice(0, 200),
      }).catch(() => {});
    }
    throw err;
  }
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
