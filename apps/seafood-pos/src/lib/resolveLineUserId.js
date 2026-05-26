import { normalizeLineUserId, isValidLineUserId } from './lineUserId';
import { suggestLineUserIdFromOrders } from '../services/customerService';

/** หา LINE UID จาก customer object หรือข้อมูลบิล */
export function resolveLineUserIdSync(customer, bill) {
  const fromCustomer = normalizeLineUserId(customer?.lineUserId);
  if (isValidLineUserId(fromCustomer)) return fromCustomer;
  const fromBill = normalizeLineUserId(bill?.customerLineUserId);
  if (isValidLineUserId(fromBill)) return fromBill;
  return '';
}

/** ถ้ายังไม่มีในโปรไฟล์ — ลองดึงจากออเดอร์ LINE ล่าสุดที่ชื่อตรง */
export async function resolveLineUserId(customer, bill) {
  const direct = resolveLineUserIdSync(customer, bill);
  if (direct) return direct;
  const name = bill?.customerName || customer?.name;
  if (!name) return '';
  try {
    return (await suggestLineUserIdFromOrders(name)) || '';
  } catch {
    return '';
  }
}
