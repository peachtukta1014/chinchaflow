export {
  lineBillPaymentNote,
  billUnpaidAmount,
  billCreditTransferBlock,
} from './billPaymentDisplay.js';

export function isBillFullyPaid(paymentType, remainingAmount) {
  if (paymentType === 'cash' || paymentType === 'transfer') return true;
  const remain = parseFloat(remainingAmount);
  return paymentType === 'installment' && Number.isFinite(remain) && remain <= 0;
}
