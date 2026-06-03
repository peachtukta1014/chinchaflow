const { LINE_UID_RE, normalizeLineUserId } = require('./lineUserId');

function isValidLineUserId(uid) {
  return LINE_UID_RE.test(String(uid || ''));
}

const LINE_CONTACT_ROLE_BILLING = 'billing';
const LINE_CONTACT_ROLE_ORDER = 'order';

function normalizeLineContacts(customer) {
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

  return [...byUid.values()];
}

function getBillingLineUserId(customer) {
  const billing = normalizeLineContacts(customer).find((c) => c.role === LINE_CONTACT_ROLE_BILLING);
  return billing?.uid || '';
}

function customerHasLineUserId(customer, uid) {
  const u = normalizeLineUserId(uid);
  if (!isValidLineUserId(u)) return false;
  return normalizeLineContacts(customer).some((c) => c.uid === u);
}

function appendLineContact(contacts, uid, role = LINE_CONTACT_ROLE_ORDER) {
  const merged = normalizeLineContacts({ lineContacts: contacts });
  const u = normalizeLineUserId(uid);
  if (!isValidLineUserId(u) || merged.some((c) => c.uid === u)) return merged;
  return [...merged, { uid: u, role, label: '' }];
}

function legacyLineUserIdFromContacts(contacts) {
  return getBillingLineUserId({ lineContacts: contacts });
}

module.exports = {
  LINE_CONTACT_ROLE_BILLING,
  LINE_CONTACT_ROLE_ORDER,
  normalizeLineContacts,
  getBillingLineUserId,
  customerHasLineUserId,
  appendLineContact,
  legacyLineUserIdFromContacts,
};
