export function getBillTemplateUrl(paymentType, remainingAmount = 0) {
  const paid =
    paymentType === 'cash' ||
    paymentType === 'transfer' ||
    (paymentType === 'installment' && (parseFloat(remainingAmount) || 0) <= 0);
  const file = paid ? 'template-cash.jpg' : 'template-credit.jpg';
  const base = import.meta.env.BASE_URL || '/';
  return `${base}bill-assets/${file}`;
}

export const BILL_QR_URL = `${import.meta.env.BASE_URL || '/'}bill-assets/line-oa-qr.png`;

export const MEMBER_DISCOUNT_RATE = 0.1;
