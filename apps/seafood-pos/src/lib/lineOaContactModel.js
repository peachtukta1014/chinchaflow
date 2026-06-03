import { customerHasLineUserId } from './lineCustomerContacts.js';
import { normalizeLineUserId, isValidLineUserId } from './lineUserId.js';

export function normalizePendingLinkByUid(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    const uid = normalizeLineUserId(key);
    if (!isValidLineUserId(uid)) continue;
    out[uid] = {
      requestedAt: val?.requestedAt || '',
      source: val?.source || 'link_cmd',
    };
  }
  return out;
}

export function normalizeDismissedLineOaSet(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return new Set(
    list.map((u) => normalizeLineUserId(u)).filter((u) => isValidLineUserId(u)),
  );
}

export function findAllCustomersByLineUserId(allCustomers, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return [];
  return allCustomers.filter((c) => customerHasLineUserId(c, uid));
}

/** แยกราย LINE OA — รอผูกถ้ายังไม่ผูก หรือยังมีคำขอผูกจากบอท */
export function partitionLineOaContacts(contacts, allCustomers, dismissedUids = null) {
  const dismissed = dismissedUids instanceof Set
    ? dismissedUids
    : normalizeDismissedLineOaSet(dismissedUids);

  const pending = [];
  const linked = [];
  for (const contact of contacts) {
    if (dismissed.has(contact.lineUserId)) continue;

    const matches = findAllCustomersByLineUserId(allCustomers, contact.lineUserId);
    const wantsAdminLink = !!contact.linkRequested;

    if (matches.length > 0) {
      for (const customer of matches) {
        linked.push({ contact, customer });
      }
    }

    if (matches.length === 0 || wantsAdminLink) {
      pending.push({
        ...contact,
        linkedCustomers: matches,
      });
    }
  }
  return { pending, linked };
}
