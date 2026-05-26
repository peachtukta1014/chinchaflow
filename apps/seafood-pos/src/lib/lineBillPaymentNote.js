/** ข้อความแนบบิล LINE เมื่อชำระครบแล้ว (สด/โอน) */
export function lineBillPaymentNote(paymentType) {
  if (paymentType === 'cash') return 'จ่ายแล้ว · เงินสด';
  if (paymentType === 'transfer') return 'จ่ายแล้ว · โอน';
  return '';
}

export function isBillFullyPaid(paymentType, remainingAmount) {
  if (paymentType === 'cash' || paymentType === 'transfer') return true;
  const remain = parseFloat(remainingAmount);
  return paymentType === 'installment' && Number.isFinite(remain) && remain <= 0;
}
