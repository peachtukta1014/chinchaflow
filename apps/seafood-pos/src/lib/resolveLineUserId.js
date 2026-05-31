import { CUSTOMERS } from '../constants';
import { exactCustomerNameMatch } from './customerNameMatch';
import { fsGetDoc, fsListCollection } from './firestoreRest';
import { mergeCustomerLists } from '../services/customerService';
import { findLineUserIdForCustomerName } from '../services/lineOaCustomerService';
import { normalizeLineUserId, isValidLineUserId } from './lineUserId';
import { pickLineUidForBillPush } from './resolveLineUserIdPick';

/** UID ที่ฝังในบิล/พร็อพที่ส่งเข้ามา (อาจเก่ากว่ารายชื่อลูกค้า) */
export function lineUidFromBillProps(customer, bill) {
  const fromCustomer = normalizeLineUserId(customer?.lineUserId);
  if (isValidLineUserId(fromCustomer)) return fromCustomer;
  const fromBill = normalizeLineUserId(bill?.customerLineUserId);
  if (isValidLineUserId(fromBill)) return fromBill;
  const fromOrder = normalizeLineUserId(bill?.lineUserId);
  if (isValidLineUserId(fromOrder)) return fromOrder;
  return '';
}

/** @deprecated ใช้ resolveLineUserId — คงไว้เพื่อ backward compat */
export function resolveLineUserIdSync(customer, bill) {
  return lineUidFromBillProps(customer, bill);
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

function findProfileById(allCustomers, customerId) {
  if (!customerId) return null;
  return allCustomers.find((c) => c.id === customerId) || null;
}

/**
 * หา LINE UID สำหรับส่งบิล — ยึดรายชื่อลูกค้า (Firestore) ก่อน UID ในบิลเก่า
 * @returns {{ uid: string, profileUid: string, billUid: string, profileName: string, source: string }}
 */
export async function resolveLineUserIdDetails(customer, bill, options = {}) {
  const billUid = lineUidFromBillProps(customer, bill);
  const name = (bill?.customerName || customer?.name || '').trim();

  let allCustomers = options.allCustomers;
  if (!allCustomers?.length) {
    try {
      allCustomers = await loadMergedCustomers();
    } catch {
      allCustomers = CUSTOMERS;
    }
  }

  const profileRow = findProfileById(allCustomers, customer?.id);
  const profileUid = normalizeLineUserId(profileRow?.lineUserId);
  const nameMatchUid = findUidInCustomerList(allCustomers, name);

  let orderUid = '';
  if (bill?.lineOrderId) {
    try {
      const order = await fsGetDoc(`lineOrders/${bill.lineOrderId}`);
      const uid = normalizeLineUserId(order?.lineUserId);
      if (isValidLineUserId(uid) && !order?.lineGroupId) orderUid = uid;
    } catch {
      /* ignore */
    }
  }

  let historyUid = '';
  if (name) {
    try {
      historyUid = await findLineUserIdForCustomerName(name, { directOnly: true }) || '';
    } catch {
      /* ignore */
    }
  }

  const picked = pickLineUidForBillPush({
    profileUid,
    nameMatchUid,
    billUid,
    orderUid,
    historyUid,
  });

  let profileName = profileRow?.name || '';
  if (!profileName && picked.profileUid) {
    const row = allCustomers.find(
      (c) => normalizeLineUserId(c.lineUserId) === picked.profileUid,
    );
    profileName = row?.name || '';
  }

  return {
    uid: picked.uid,
    profileUid: picked.profileUid,
    billUid: picked.billUid || billUid,
    profileName,
    source: picked.source,
  };
}

/**
 * หา LINE UID สำหรับส่งบิล
 * @param {object} [options] — allCustomers ถ้ามีอยู่แล้วจะไม่โหลดซ้ำ
 */
export async function resolveLineUserId(customer, bill, options = {}) {
  const details = await resolveLineUserIdDetails(customer, bill, options);
  return details.uid;
}
