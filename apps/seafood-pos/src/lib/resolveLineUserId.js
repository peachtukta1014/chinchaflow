import { CUSTOMERS } from '../constants';
import { exactCustomerNameMatch } from './customerNameMatch';
import { fsGetDoc, fsListCollection } from './firestoreRest';
import { mergeCustomerLists } from '../services/customerService';
import { findLineUserIdForCustomerName } from '../services/lineOaCustomerService';
import { normalizeLineUserId, isValidLineUserId } from './lineUserId';

/** หา LINE UID จาก customer / bill ที่ส่งมาโดยตรง */
export function resolveLineUserIdSync(customer, bill) {
  const fromCustomer = normalizeLineUserId(customer?.lineUserId);
  if (isValidLineUserId(fromCustomer)) return fromCustomer;
  const fromBill = normalizeLineUserId(bill?.customerLineUserId);
  if (isValidLineUserId(fromBill)) return fromBill;
  const fromOrder = normalizeLineUserId(bill?.lineUserId);
  if (isValidLineUserId(fromOrder)) return fromOrder;
  return '';
}

async function loadMergedCustomers() {
  const docs = await fsListCollection('customers', 300);
  const map = {};
  for (const d of docs) {
    if (d.id) map[d.id] = d;
  }
  return mergeCustomerLists(map);
}

function findUidInCustomerList(allCustomers, name) {
  const n = (name || '').trim();
  if (!n) return '';
  const hit = allCustomers.find(
    (c) => isValidLineUserId(c.lineUserId) && exactCustomerNameMatch(c.name, n),
  );
  return hit ? normalizeLineUserId(hit.lineUserId) : '';
}

/**
 * หา LINE UID สำหรับส่งบิล — หลายชั้น (โปรไฟล์ → รายชื่อ → ออเดอร์ LINE แชทตรง)
 * @param {object} [options] — allCustomers ถ้ามีอยู่แล้วจะไม่โหลดซ้ำ
 */
export async function resolveLineUserId(customer, bill, options = {}) {
  const direct = resolveLineUserIdSync(customer, bill);
  if (direct) return direct;

  const name = (bill?.customerName || customer?.name || '').trim();

  if (bill?.lineOrderId) {
    try {
      const order = await fsGetDoc(`lineOrders/${bill.lineOrderId}`);
      const uid = normalizeLineUserId(order?.lineUserId);
      if (isValidLineUserId(uid) && !order?.lineGroupId) return uid;
    } catch {
      /* ignore */
    }
  }

  let allCustomers = options.allCustomers;
  if (!allCustomers?.length) {
    try {
      allCustomers = await loadMergedCustomers();
    } catch {
      allCustomers = CUSTOMERS;
    }
  }

  const fromList = findUidInCustomerList(allCustomers, name);
  if (fromList) return fromList;

  if (customer?.id) {
    const byId = allCustomers.find((c) => c.id === customer.id);
    const uid = normalizeLineUserId(byId?.lineUserId);
    if (isValidLineUserId(uid)) return uid;
  }

  if (name) {
    try {
      const fromLine = await findLineUserIdForCustomerName(name, { directOnly: true });
      if (fromLine) return fromLine;
    } catch {
      /* ignore */
    }
  }

  return '';
}
