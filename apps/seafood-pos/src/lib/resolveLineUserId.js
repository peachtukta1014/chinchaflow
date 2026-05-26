import { normalizeLineUserId, isValidLineUserId } from './lineUserId';

/** หา LINE UID จากโปรไฟล์ลูกค้าหรือบิลเท่านั้น (ไม่เดา UID จากชื่อคล้ายกัน) */
export function resolveLineUserIdSync(customer, bill) {
  const fromCustomer = normalizeLineUserId(customer?.lineUserId);
  if (isValidLineUserId(fromCustomer)) return fromCustomer;
  const fromBill = normalizeLineUserId(bill?.customerLineUserId);
  if (isValidLineUserId(fromBill)) return fromBill;
  return '';
}

export async function resolveLineUserId(customer, bill) {
  return resolveLineUserIdSync(customer, bill);
}
