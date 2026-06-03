import { CUSTOMERS } from '../constants/customers.js';
import { fsGetDoc } from './firestoreRest.js';

/**
 * รวมข้อมูลลูกค้าจากรายชื่อ + บิล (เบอร์/โซน) — โหลด Firestore เมื่อจำเป็น
 * @param {object} bill
 * @param {object} [customerHint]
 */
export async function resolveBillCustomer(bill, customerHint = {}) {
  const customerId = bill.customerId || customerHint.id;
  const builtin = customerId ? CUSTOMERS.find((c) => c.id === customerId) : null;
  let fromStore = null;
  if (customerId && !String(customerHint.phone || bill.phone || builtin?.phone || '').trim()) {
    try {
      fromStore = await fsGetDoc(`customers/${customerId}`);
    } catch {
      fromStore = null;
    }
  }
  const phone = String(
    customerHint.phone || bill.phone || fromStore?.phone || builtin?.phone || '',
  ).trim();
  const zone = String(
    customerHint.zone || bill.zone || fromStore?.zone || builtin?.zone || '',
  ).trim();
  return {
    ...(builtin || {}),
    ...(fromStore || {}),
    ...customerHint,
    id: customerId || customerHint.id,
    name: bill.customerName || customerHint.name || builtin?.name || fromStore?.name || '',
    phone,
    zone,
    lineUserId:
      customerHint.lineUserId || bill.customerLineUserId || fromStore?.lineUserId || builtin?.lineUserId || null,
  };
}
