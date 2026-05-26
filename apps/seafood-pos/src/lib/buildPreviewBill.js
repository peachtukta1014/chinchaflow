import { dateKeyBangkok } from './date';
import { computePaymentAmounts } from '../services/salesService';

/** สร้าง payload บิลจากตะกร้า (ก่อนบันทึก) หรือจากบิลที่บันทึกแล้ว */
export function buildPreviewBill({
  cartItems,
  customer,
  selectedCustomer,
  paymentType,
  paidAmount,
  billNo,
  recordedBy,
  dateKey = dateKeyBangkok(),
}) {
  const total = cartItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const { paidAmount: paidA, remainingAmount: remain } = computePaymentAmounts(
    total,
    paymentType,
    paidAmount,
  );
  return {
    billNo,
    dateKey,
    customerName: customer?.name || 'ลูกค้า',
    customerId: selectedCustomer,
    customerLineUserId: customer?.lineUserId || null,
    zone: customer?.zone || '',
    items: cartItems,
    total,
    paymentType,
    paidAmount: paidA,
    remainingAmount: remain,
    timestamp: new Date().toLocaleTimeString('th-TH'),
    recordedBy,
  };
}
