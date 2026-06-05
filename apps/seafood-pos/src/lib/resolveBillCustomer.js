import { CUSTOMERS } from '../constants/customers.js';
import { exactCustomerNameMatch } from './customerNameMatch.js';
import { fsGetDoc } from './firestoreRest.js';

function findBuiltinCustomer(bill, customerHint = {}) {
  const byId = bill.customerId || customerHint.id;
  if (byId) {
    return CUSTOMERS.find((c) => c.id === byId) || null;
  }
  const want = String(bill.customerName || customerHint.name || '').trim();
  if (!want) return null;
  for (const c of CUSTOMERS) {
    if (exactCustomerNameMatch(c.name, want)) return c;
    for (const alias of c.aliases || []) {
      if (exactCustomerNameMatch(alias, want)) return c;
    }
  }
  return null;
}

/**
 * รวมข้อมูลลูกค้าจากรายชื่อ + บิล (เบอร์/ที่อยู่) — โหลด Firestore เมื่อจำเป็น
 * @param {object} bill
 * @param {object} [customerHint]
 */
export async function resolveBillCustomer(bill, customerHint = {}) {
  const builtin = findBuiltinCustomer(bill, customerHint);
  const customerId = bill.customerId || customerHint.id || builtin?.id || null;

  const mergedPhone = String(
    customerHint.phone || bill.phone || builtin?.phone || '',
  ).trim();
  const mergedAddress = String(
    customerHint.address || bill.address || bill.deliveryAddress || builtin?.address || '',
  ).trim();

  let fromStore = null;
  const needsStore = Boolean(
    customerId && (!mergedPhone || !mergedAddress),
  );
  if (needsStore) {
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
  const address = String(
    customerHint.address
    || bill.address
    || bill.deliveryAddress
    || fromStore?.address
    || builtin?.address
    || '',
  ).trim();

  return {
    ...(builtin || {}),
    ...(fromStore || {}),
    ...customerHint,
    id: customerId || customerHint.id,
    name: bill.customerName || customerHint.name || builtin?.name || fromStore?.name || '',
    phone,
    zone,
    address,
    lineUserId:
      customerHint.lineUserId
      || bill.customerLineUserId
      || fromStore?.lineUserId
      || builtin?.lineUserId
      || null,
    lineContacts: customerHint.lineContacts || fromStore?.lineContacts,
  };
}
