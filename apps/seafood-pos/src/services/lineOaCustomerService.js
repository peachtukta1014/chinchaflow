import { CUSTOMERS } from '../constants/customers.js';
import { customerMatchesLabel } from '../lib/customerAliases.js';
import { compactNameMatch, exactCustomerNameMatch } from '../lib/customerNameMatch.js';
import {
  normalizeDismissedLineOaSet,
  normalizePendingLinkByUid,
  partitionLineOaContacts,
  findAllCustomersByLineUserId,
} from '../lib/lineOaContactModel.js';
import { customerHasLineUserId } from '../lib/lineCustomerContacts.js';
import { fsGetDoc, fsListCollection, fsSetDoc } from '../lib/firestoreRest.js';
import { normalizeLineUserId, isValidLineUserId } from '../lib/lineUserId.js';

const SHRIMP_LINE_CONFIG = 'config/shrimpLine';

export {
  normalizeDismissedLineOaSet,
  normalizePendingLinkByUid,
  partitionLineOaContacts,
  findAllCustomersByLineUserId,
};

export async function fetchPendingLinkByUid() {
  try {
    const doc = await fsGetDoc(SHRIMP_LINE_CONFIG);
    return normalizePendingLinkByUid(doc?.pendingLinkByUid);
  } catch {
    return {};
  }
}

/** ลบคำขอผูกจาก「ผูกไอดีลูกค้า」หลังแอดมินจับคู่หรือซ่อนรายการ */
export async function clearPendingLinkRequest(lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!isValidLineUserId(uid)) return;

  const doc = (await fsGetDoc(SHRIMP_LINE_CONFIG)) || {};
  const prev = normalizePendingLinkByUid(doc.pendingLinkByUid);
  if (!prev[uid]) return;
  delete prev[uid];
  await fsSetDoc(SHRIMP_LINE_CONFIG, {
    pendingLinkByUid: prev,
    updatedAt: new Date().toISOString(),
  });
}

export async function fetchDismissedLineOaUids() {
  try {
    const doc = await fsGetDoc(SHRIMP_LINE_CONFIG);
    return normalizeDismissedLineOaSet(doc?.dismissedLineOaUids);
  } catch {
    return new Set();
  }
}

/** ซ่อน UID จากแท็บ「LINE รอผูก」(ทดสอบ / ไม่ใช่ร้านจริง) — เก็บใน config/shrimpLine */
export async function dismissLineOaPendingUid(lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!isValidLineUserId(uid)) throw new Error('LINE UID ไม่ถูกต้อง');

  const doc = (await fsGetDoc(SHRIMP_LINE_CONFIG)) || {};
  const prev = normalizeDismissedLineOaSet(doc.dismissedLineOaUids);
  prev.add(uid);

  const pendingLinkByUid = normalizePendingLinkByUid(doc.pendingLinkByUid);
  delete pendingLinkByUid[uid];

  await fsSetDoc(SHRIMP_LINE_CONFIG, {
    dismissedLineOaUids: [...prev],
    pendingLinkByUid,
    updatedAt: new Date().toISOString(),
  });
  return prev;
}

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
  const [orders, pendingLinkByUid] = await Promise.all([
    fsListCollection('lineOrders', 300),
    fetchPendingLinkByUid(),
  ]);
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

  for (const [uid, meta] of Object.entries(pendingLinkByUid)) {
    const norm = normalizeLineUserId(uid);
    if (!isValidLineUserId(norm)) continue;
    let row = byUid.get(norm);
    if (!row) {
      row = {
        lineUserId: norm,
        displayNames: new Set(),
        orderCount: 0,
        lastOrderAt: meta.requestedAt || '',
        lastDeliveryDate: '',
        fromGroup: false,
        linkRequested: true,
        linkRequestedAt: meta.requestedAt || '',
      };
      byUid.set(norm, row);
    } else {
      row.linkRequested = true;
      row.linkRequestedAt = meta.requestedAt || row.linkRequestedAt || '';
      if (!row.lastOrderAt && meta.requestedAt) row.lastOrderAt = meta.requestedAt;
    }
  }

  return [...byUid.values()]
    .map((r) => {
      const names = [...r.displayNames];
      if (r.linkRequested && names.length === 0) {
        names.push('ขอผูก LINE (รอแอดมิน)');
      }
      return {
        lineUserId: r.lineUserId,
        displayNames: names,
        orderCount: r.orderCount,
        lastOrderAt: r.lastOrderAt,
        lastDeliveryDate: r.lastDeliveryDate,
        suggestedName: names[0] || 'ลูกค้า LINE',
        fromGroup: r.fromGroup,
        linkRequested: !!r.linkRequested,
        linkRequestedAt: r.linkRequestedAt || '',
      };
    })
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
  return allCustomers.find((c) => customerHasLineUserId(c, uid)) || null;
}

export function findCustomerByExactName(allCustomers, name) {
  const n = (name || '').trim();
  if (!n) return null;
  return allCustomers.find((c) => exactCustomerNameMatch(c.name, n)) || null;
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
