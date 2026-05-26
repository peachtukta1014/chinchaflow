import { collection, onSnapshot } from 'firebase/firestore';
import { CUSTOMERS } from '../constants';
import { db } from '../firebase';
import { normalizeLineUserId } from '../lib/lineUserId';
import { fsDelete, fsListCollection, fsSetDoc } from '../lib/firestoreRest';
import { exactCustomerNameMatch } from '../lib/customerNameMatch';

function compactName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('หมดเวลา — ลองใหม่')), ms)),
  ]);
}

/** subscribe รายชื่อลูกค้า Firestore */
export function subscribeCustomers(onData, onError) {
  if (!db) {
    onError?.();
    return () => {};
  }
  return onSnapshot(
    collection(db, 'customers'),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
      onData(map);
    },
    () => onError?.(),
  );
}

export function mergeCustomerLists(fsCustomers) {
  const list = [
    ...CUSTOMERS.map((c) => {
      const overlay = fsCustomers[c.id] || {};
      if (overlay.hidden === true) return null;
      return { ...c, ...overlay, source: 'builtin' };
    }).filter(Boolean),
    ...Object.values(fsCustomers)
      .filter((c) => !CUSTOMERS.find((b) => b.id === c.id))
      .filter((c) => c.hidden !== true)
      .map((c) => ({ ...c, source: 'firestore' })),
  ];
  return markDuplicateCustomers(list);
}

export function markDuplicateCustomers(list) {
  const counts = new Map();
  for (const c of list) {
    const key = compactName(c.name);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return list.map((c) => {
    const key = compactName(c.name);
    const duplicate = key && (counts.get(key) || 0) > 1;
    return { ...c, duplicate };
  });
}

export function isDeletableCustomer(c) {
  return String(c.id || '').startsWith('cx_');
}

export function isBuiltinCustomer(c) {
  return c.source === 'builtin' || CUSTOMERS.some((b) => b.id === c.id);
}

function customerPayload({ name, zone, phone, lineUserId, hidden }) {
  const payload = {
    name: name.trim(),
    zone: (zone || '').trim(),
    phone: (phone || '').trim(),
  };
  const line = normalizeLineUserId(lineUserId);
  payload.lineUserId = line || '';
  if (hidden === true) payload.hidden = true;
  if (hidden === false) payload.hidden = false;
  return payload;
}

export async function updateCustomer(id, data) {
  if (!id) throw new Error('ไม่พบรหัสลูกค้า');
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...customerPayload(data),
    updatedAt: new Date().toISOString(),
  }));
}

export async function createCustomer(data) {
  const id = `cx_${Date.now()}`;
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...customerPayload(data),
    createdAt: new Date().toISOString(),
  }));
  return id;
}

export async function deleteCustomer(id) {
  if (!String(id).startsWith('cx_')) {
    throw new Error('ลบได้เฉพาะลูกค้าที่เพิ่มเอง');
  }
  await withTimeout(fsDelete(`customers/${id}`));
}

/** ซ่อนรายการในแอป (รายชื่อเริ่มต้นในแอป — ลบไฟล์จริงไม่ได้) */
export async function hideCustomerFromList(id) {
  const builtin = CUSTOMERS.find((b) => b.id === id);
  await withTimeout(fsSetDoc(`customers/${id}`, {
    name: builtin?.name || id,
    zone: builtin?.zone || '',
    phone: '',
    lineUserId: '',
    hidden: true,
    hiddenAt: new Date().toISOString(),
  }));
}

export async function suggestLineUserIdFromOrders(customerName) {
  const orders = await fsListCollection('lineOrders', 200);
  const name = (customerName || '').trim();
  if (!name) return null;

  const sorted = [...orders].sort((a, b) => {
    const ta = a.createdAt || '';
    const tb = b.createdAt || '';
    return String(tb).localeCompare(String(ta));
  });

  for (const o of sorted) {
    if (!o.lineUserId) continue;
    if (o.lineGroupId) continue;
    if (exactCustomerNameMatch(o.customerName, name)) {
      return normalizeLineUserId(o.lineUserId);
    }
    for (const item of o.items || []) {
      if (exactCustomerNameMatch(item.customerName, name)) {
        return normalizeLineUserId(o.lineUserId);
      }
    }
  }
  return null;
}
