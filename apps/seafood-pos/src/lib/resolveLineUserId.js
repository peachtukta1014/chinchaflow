import { CUSTOMERS } from '../constants/customers.js';
import { uidCustomerNameMatch } from './customerNameMatch';
import { fsGetDoc, fsListCollection } from './firestoreRest';
import { mergeCustomerLists } from '../services/customerService';
import { findLineUserIdForCustomerName } from '../services/lineOaCustomerService';
import {
  collectCustomerSearchNames,
  resolveLineCustomerByName,
  suggestCustomersForLineName,
} from './lineCustomerResolve';
import { normalizeLineUserId, isValidLineUserId } from './lineUserId';
import { getBillingLineUserId } from './lineCustomerContacts.js';
import { pickLineUidForBillPush } from './resolveLineUserIdPick';

function isMarketGeneralDisplayName(name) {
  const n = String(name || '').trim();
  if (!n) return true;
  return /ลูกค้าทั่วไป|ตลาดนัด|^ทั่วไป$/i.test(n);
}

/** UID ที่ฝังในบิล/พร็อพที่ส่งเข้ามา (อาจเก่ากว่ารายชื่อลูกค้า) */
export function lineUidFromBillProps(customer, bill) {
  const fromCustomer = getBillingLineUserId(customer);
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

let _customerCache = null;
let _customerCachedAt = 0;
let _customerInFlight = null;
const CUSTOMER_CACHE_TTL = 60_000;

/**
 * โหลด customers 300 รายการ พร้อม in-flight dedup + cache 1 นาที
 * (หลายส่วนในแอปเรียกพร้อมกัน — ป้องกัน Firestore 300-doc read ซ้ำ)
 */
async function loadMergedCustomers() {
  const now = Date.now();
  if (_customerCache && now - _customerCachedAt < CUSTOMER_CACHE_TTL) {
    return _customerCache;
  }
  if (_customerInFlight) return _customerInFlight;
  _customerInFlight = (async () => {
    try {
      const docs = await fsListCollection('customers', 300);
      const map = {};
      for (const d of docs) {
        if (d.id) map[d.id] = d;
      }
      _customerCache = mergeCustomerLists(map);
      _customerCachedAt = Date.now();
      return _customerCache;
    } finally {
      _customerInFlight = null;
    }
  })();
  return _customerInFlight;
}

function findUidInCustomerList(allCustomers, name) {
  const n = (name || '').trim();
  if (!n) return '';

  const suggestions = suggestCustomersForLineName(name, allCustomers);
  if (suggestions.length === 1) {
    const uid = getBillingLineUserId(suggestions[0].customer);
    if (isValidLineUserId(uid)) return uid;
  }
  if (suggestions.length > 0 && suggestions[0].score >= 3) {
    const uid = getBillingLineUserId(suggestions[0].customer);
    if (isValidLineUserId(uid)) return uid;
  }

  const hits = [];
  for (const c of allCustomers) {
    const billingUid = getBillingLineUserId(c);
    if (!c?.id || c.id === 'general' || !isValidLineUserId(billingUid)) continue;
    for (const label of collectCustomerSearchNames(c)) {
      if (uidCustomerNameMatch(label, n)) {
        hits.push(c);
        break;
      }
    }
  }
  if (hits.length === 1) return getBillingLineUserId(hits[0]);
  return '';
}

function findProfileById(allCustomers, customerId) {
  if (!customerId) return null;
  return allCustomers.find((c) => c.id === customerId) || null;
}

/**
 * บิลจาก LINE มักเป็น customerId=general แต่ชื่อบนบิลเป็นร้านจริง —
 * ห้ามใช้ UID ของ「ลูกค้าทั่วไป」เมื่อจับคู่ร้านจากชื่อได้
 */
export function resolveCustomerProfileForBill(customer, bill, allCustomers) {
  const billCustomerId = bill?.customerId || customer?.id;
  const name = (bill?.customerName || customer?.name || '').trim();

  if (billCustomerId && billCustomerId !== 'general') {
    const row = findProfileById(allCustomers, billCustomerId);
    if (row) return row;
  }

  if (name) {
    const suggestions = suggestCustomersForLineName(name, allCustomers);
    if (suggestions.length === 1) {
      const row = findProfileById(allCustomers, suggestions[0].customer.id);
      if (row?.id && row.id !== 'general') return row;
    }
    if (suggestions.length > 0 && suggestions[0].score >= 2) {
      const row = findProfileById(allCustomers, suggestions[0].customer.id);
      if (row?.id && row.id !== 'general') return row;
    }

    const resolved = resolveLineCustomerByName(name, allCustomers);
    if (resolved?.id && resolved.id !== 'general') {
      return findProfileById(allCustomers, resolved.id) || resolved;
    }
  }

  if (billCustomerId === 'general' && name && !isMarketGeneralDisplayName(name)) {
    return { id: 'general', name, zone: 'ทั่วไป', lineUserId: '' };
  }

  if (billCustomerId) {
    return findProfileById(allCustomers, billCustomerId) || customer || null;
  }
  return customer || null;
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

  const profileRow = resolveCustomerProfileForBill(customer, bill, allCustomers);
  const generalRow = allCustomers.find((c) => c.id === 'general');
  const generalUid = getBillingLineUserId(generalRow);
  const billIsNamedShop = Boolean(name && !isMarketGeneralDisplayName(name));
  const billUsesGeneralBucket = (bill?.customerId || customer?.id) === 'general';

  let profileUid = getBillingLineUserId(profileRow);
  let profileName = profileRow?.name || '';

  if (profileRow?.id === 'general' && billIsNamedShop) {
    profileUid = '';
    const shop = suggestCustomersForLineName(name, allCustomers)[0]?.customer;
    profileName = shop?.name || name;
  }

  const profileResolvedShop = Boolean(profileRow?.id && profileRow.id !== 'general')
    || (billIsNamedShop && isValidLineUserId(profileUid));
  const profileLinked = isValidLineUserId(profileUid);
  /** ลบ UID ในรายชื่อแล้ว — ไม่ดึงจากบิลเก่า/ออเดอร์ย้อนหลังมาแทน */
  const allowHistoricalUid = !profileResolvedShop || profileLinked;

  const nameMatchUid = billIsNamedShop || allowHistoricalUid
    ? findUidInCustomerList(allCustomers, name)
    : '';

  let effectiveBillUid = allowHistoricalUid ? billUid : '';
  if (billUsesGeneralBucket && billIsNamedShop && effectiveBillUid === generalUid) {
    effectiveBillUid = '';
  }

  let orderUid = '';
  if (allowHistoricalUid && bill?.lineOrderId) {
    try {
      const order = await fsGetDoc(`lineOrders/${bill.lineOrderId}`);
      const uid = normalizeLineUserId(order?.lineUserId);
      if (isValidLineUserId(uid) && !order?.lineGroupId) orderUid = uid;
    } catch {
      /* ignore */
    }
  }

  let historyUid = '';
  if (allowHistoricalUid && name) {
    try {
      historyUid = await findLineUserIdForCustomerName(name, { directOnly: true }) || '';
    } catch {
      /* ignore */
    }
  }

  const picked = pickLineUidForBillPush({
    profileUid,
    nameMatchUid,
    billUid: effectiveBillUid,
    orderUid: allowHistoricalUid ? orderUid : '',
    historyUid: allowHistoricalUid ? historyUid : '',
  });

  if (!profileName && picked.profileUid) {
    const row = allCustomers.find((c) => getBillingLineUserId(c) === picked.profileUid);
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
