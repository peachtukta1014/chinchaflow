import { CUSTOMERS } from '../constants/customers.js';
import { customerHasLineUserId } from './lineCustomerContacts.js';

/** ชุดร้านที่ UID เดียวผูกได้หลายแถว (เช่น ลูกน้องสั่งแทนตาจุ้ยทั้งสองร้าน) */
export const LINE_OA_MULTI_LINK_GROUPS = [
  {
    id: 'tajuoy-both',
    label: 'ตาจุ้ยหนึ่ง + ตาจุ้ยสอง',
    customerIds: ['c2', 'c3'],
    hint: 'คนเดียวสั่งแทนทั้งสองร้านในระบบ',
  },
];

/**
 * กลุ่มที่ยังผูก UID นี้ไม่ครบ
 * @param {string} lineUserId
 * @param {(id: string) => object|undefined} resolveCustomer
 */
export function multiLinkGroupsPending(lineUserId, resolveCustomer) {
  const out = [];
  for (const group of LINE_OA_MULTI_LINK_GROUPS) {
    const shops = group.customerIds
      .map((id) => resolveCustomer(id))
      .filter(Boolean);
    if (shops.length !== group.customerIds.length) continue;
    const missing = shops.filter((s) => !customerHasLineUserId(s, lineUserId));
    if (missing.length === 0) continue;
    out.push({ ...group, shops, missing });
  }
  return out;
}

export function catalogNameById(customerId) {
  const c = CUSTOMERS.find((x) => x.id === customerId);
  return c?.name || customerId;
}
