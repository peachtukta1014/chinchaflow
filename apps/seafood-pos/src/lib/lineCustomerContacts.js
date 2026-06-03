import { isValidLineUserId, normalizeLineUserId } from './lineUserId.js';

/** โอน/รับบิล · สลิป */
export const LINE_CONTACT_ROLE_BILLING = 'billing';
/** สั่งใน LINE (เพิ่มอัตโนมัติเมื่อสั่งในร้านเดิม) */
export const LINE_CONTACT_ROLE_ORDER = 'order';

const ROLE_LABELS = {
  [LINE_CONTACT_ROLE_BILLING]: 'เจ้าของ/โอน',
  [LINE_CONTACT_ROLE_ORDER]: 'สั่งใน LINE',
};

export function lineContactRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

/**
 * @param {object|null|undefined} customer
 * @returns {{ uid: string, role: string, label: string }[]}
 */
export function normalizeLineContacts(customer) {
  const out = [];
  const byUid = new Map();

  const add = (rawUid, role, label = '') => {
    const uid = normalizeLineUserId(rawUid);
    if (!isValidLineUserId(uid)) return;
    const r = role === LINE_CONTACT_ROLE_BILLING ? LINE_CONTACT_ROLE_BILLING : LINE_CONTACT_ROLE_ORDER;
    const prev = byUid.get(uid);
    if (!prev || (prev.role !== LINE_CONTACT_ROLE_BILLING && r === LINE_CONTACT_ROLE_BILLING)) {
      byUid.set(uid, { uid, role: r, label: String(label || '').trim() });
    }
  };

  for (const row of customer?.lineContacts || []) {
    add(row?.uid || row?.lineUserId, row?.role, row?.label);
  }
  const legacy = normalizeLineUserId(customer?.lineUserId);
  if (legacy && !byUid.has(legacy)) {
    add(legacy, LINE_CONTACT_ROLE_BILLING, '');
  }

  for (const row of byUid.values()) out.push(row);
  return out;
}

export function getBillingLineUserId(customer) {
  const contacts = normalizeLineContacts(customer);
  const billing = contacts.find((c) => c.role === LINE_CONTACT_ROLE_BILLING);
  return billing?.uid || '';
}

export function getOrderLineUserIds(customer) {
  return normalizeLineContacts(customer)
    .filter((c) => c.role === LINE_CONTACT_ROLE_ORDER)
    .map((c) => c.uid);
}

export function customerHasLineUserId(customer, uid) {
  const u = normalizeLineUserId(uid);
  if (!isValidLineUserId(u)) return false;
  return normalizeLineContacts(customer).some((c) => c.uid === u);
}

export function findCustomerByAnyLineUid(customers, uid) {
  const u = normalizeLineUserId(uid);
  if (!isValidLineUserId(u)) return null;
  const list = Array.isArray(customers) ? customers : Object.values(customers || {});
  for (const c of list) {
    if (c && customerHasLineUserId(c, u)) return c;
  }
  return null;
}

/** แยก UID สั่ง (คั่นด้วย comma / ขึ้นบรรทัด) */
export function parseOrderLineUserIdsText(raw) {
  const text = String(raw || '');
  const parts = text.split(/[,，;\s]+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    const uid = normalizeLineUserId(p);
    if (!isValidLineUserId(uid) || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}

export function formatOrderLineUserIdsForEdit(customer) {
  return getOrderLineUserIds(customer).join(', ');
}

/**
 * จากฟอร์มแอป → lineContacts + lineUserId (billing สำหรับ query เก่า)
 */
export function lineContactsFromForm({ lineUserId, lineOrderUserIds }) {
  const billing = normalizeLineUserId(lineUserId);
  const orders = parseOrderLineUserIdsText(lineOrderUserIds);
  const contacts = [];
  if (isValidLineUserId(billing)) {
    contacts.push({ uid: billing, role: LINE_CONTACT_ROLE_BILLING, label: '' });
  }
  for (const uid of orders) {
    if (uid === billing) continue;
    contacts.push({ uid, role: LINE_CONTACT_ROLE_ORDER, label: '' });
  }
  return contacts;
}

export function legacyLineUserIdFromContacts(contacts) {
  const billing = contacts.find((c) => c.role === LINE_CONTACT_ROLE_BILLING);
  return billing?.uid || '';
}

export function appendLineContact(contacts, uid, role = LINE_CONTACT_ROLE_ORDER) {
  const u = normalizeLineUserId(uid);
  if (!isValidLineUserId(u)) return contacts;
  const merged = normalizeLineContacts({ lineContacts: contacts });
  if (merged.some((c) => c.uid === u)) return merged;
  return [...merged, { uid: u, role, label: '' }];
}

export function formatLineContactsSummary(customer) {
  const contacts = normalizeLineContacts(customer);
  if (!contacts.length) return '';
  return contacts
    .map((c) => {
      const tail = c.uid.slice(-6);
      return `${lineContactRoleLabel(c.role)} …${tail}`;
    })
    .join(' · ');
}
