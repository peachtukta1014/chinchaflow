import { BILL_TRANSFER_ACCOUNTS } from './billTemplateConfig.js';

/** ข้อความบนบิลเมื่อชำระแล้ว (สด/โอน) */
export function lineBillPaymentNote(paymentType) {
  if (paymentType === 'cash') return 'จ่ายแล้ว · เงินสด';
  if (paymentType === 'transfer') return 'จ่ายแล้ว · โอน';
  return '';
}

/** ยอดค้างที่ต้องแสดงบนบิล */
export function billUnpaidAmount(bill) {
  const total = parseFloat(bill?.total) || 0;
  const remain = parseFloat(bill?.remainingAmount);
  if (Number.isFinite(remain) && remain > 0) return remain;
  if (bill?.paymentType === 'credit') return total;
  return 0;
}

/** บล็อกโอนชำระเมื่อบิลค้าง — null ถ้าจ่ายครบแล้ว */
export function billCreditTransferBlock(bill) {
  const unpaid = billUnpaidAmount(bill);
  if (unpaid <= 0) return null;
  return {
    unpaidAmount: unpaid,
    accounts: BILL_TRANSFER_ACCOUNTS,
  };
}
