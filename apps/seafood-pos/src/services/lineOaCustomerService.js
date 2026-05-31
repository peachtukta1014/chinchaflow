import { CUSTOMERS } from '../constants/customers.js';
import { fsListCollection } from '../lib/firestoreRest';
import { normalizeLineUserId, isValidLineUserId } from '../lib/lineUserId';
import { customerMatchesLabel } from '../lib/customerAliases';
import { compactNameMatch } from '../lib/customerNameMatch';

function orderTime(o) {
  return String(o.createdAt || o.deliveryDate || '');
}

/** แชทตรงกับ OA (ไม่ใช่ข้อความในกลุ่ม LINE) */
export function isDirectOaChatOrder(o) {
  const g = o?.lineGroupId;
  return !g || String(g).trim() === '';
}

function collectOrderNames(o) {
  const names = new Set();
  if (o.customerName) names.add(String(o.customerName).trim());
  for (const it of o.items || []) {
    if (it.customerName) names.add(String(it.customerName).trim());
  }
  return names;
}

/**
 * รวมลูกค้า LINE OA — เฉพาะแชทตรง (ไม่รวมคนในกลุ่มภายใน)
 */
export async function fetchLineOaContacts({ directOnly = true } = {}) {
  const orders = await fsListCollection('lineOrders', 300);
  const byUid = new Map();

  for (const o of orders) {
    if (directOnly && !isDirectOaChatOrder(o)) continue;
    const uid = normalizeLineUserId(o.lineUserId);
    if (!isValidLineUserId(uid)) continue;

    let row = byUid.get(uid);
    if (!row) {
      row = {
        lineUserId: uid,
        displayNames: new Set(),
        orderCount: 0,
        lastOrderAt: '',
        lastDeliveryDate: '',
        fromGroup: false,
      };
      byUid.set(uid, row);
    }

    if (o.lineGroupId) row.fromGroup = true;
    row.orderCount += 1;
    const t = orderTime(o);
    if (t > row.lastOrderAt) {
      row.lastOrderAt = t;
      row.lastDeliveryDate = o.deliveryDate || '';
    }
    collectOrderNames(o).forEach((n) => { if (n) row.displayNames.add(n); });
  }

  return [...byUid.values()]
    .map((r) => ({
      lineUserId: r.lineUserId,
      displayNames: [...r.displayNames],
      orderCount: r.orderCount,
      lastOrderAt: r.lastOrderAt,
      lastDeliveryDate: r.lastDeliveryDate,
      suggestedName: [...r.displayNames][0] || 'ลูกค้า LINE',
      fromGroup: r.fromGroup,
    }))
    .sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}

/** UID จากออเดอร์ LINE แชทตรง — ชื่อต้องตรงทุกตัวอักษร */
export async function findLineUserIdForCustomerName(name, { directOnly = true } = {}) {
  const n = (name || '').trim();
  if (!n) return '';

  const orders = await fsListCollection('lineOrders', 300);
  const sorted = [...orders].sort((a, b) => orderTime(b).localeCompare(orderTime(a)));

  for (const o of sorted) {
    if (directOnly && !isDirectOaChatOrder(o)) continue;
    const uid = normalizeLineUserId(o.lineUserId);
    if (!isValidLineUserId(uid)) continue;

    if (exactCustomerNameMatch(o.customerName, n)) return uid;
    for (const item of o.items || []) {
      if (exactCustomerNameMatch(item.customerName, n)) return uid;
    }
    for (const dn of collectOrderNames(o)) {
      if (exactCustomerNameMatch(dn, n)) return uid;
    }
  }
  return '';
}

export function findCustomerByLineUserId(allCustomers, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return null;
  return allCustomers.find((c) => normalizeLineUserId(c.lineUserId) === uid) || null;
}

export function findCustomerByExactName(allCustomers, name) {
  const n = (name || '').trim();
  if (!n) return null;
  return allCustomers.find((c) => exactCustomerNameMatch(c.name, n)) || null;
}

/** แยกราย LINE OA ตามว่าผูกรายชื่อหลักแล้วหรือยัง */
export function partitionLineOaContacts(contacts, allCustomers) {
  const pending = [];
  const linked = [];
  for (const contact of contacts) {
    const match = findCustomerByLineUserId(allCustomers, contact.lineUserId);
    if (match) linked.push({ contact, customer: match });
    else pending.push(contact);
  }
  return { pending, linked };
}

/** แนะนำร้านในรายชื่อหลัก (27+ทั่วไป) จากชื่อในออเดอร์ LINE */
export function suggestMainCatalogLinks(contact, fsCustomers = {}) {
  const catalog = CUSTOMERS.map((c) => {
    const overlay = fsCustomers[c.id] || {};
    if (overlay.hidden === true) return null;
    return { ...c, ...overlay };
  }).filter(Boolean);

  const names = [...(contact.displayNames || []), contact.suggestedName].filter(Boolean);
  const hits = new Map();

  for (const orderName of names) {
    for (const c of catalog) {
      if (customerMatchesLabel(c, orderName)) {
        hits.set(c.id, { customer: c, reason: 'ชื่อตรง', score: 3 });
      } else if (compactNameMatch(c.name, orderName)) {
        const prev = hits.get(c.id);
        if (!prev || prev.score < 2) {
          hits.set(c.id, { customer: c, reason: 'ชื่อใกล้เคียง', score: 2 });
        }
      }
    }
  }

  return [...hits.values()]
    .sort((a, b) => b.score - a.score)
    .map((h) => h.customer);
}
