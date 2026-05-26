import { collection, deleteDoc, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { CUSTOMERS } from '../constants';
import { db } from '../firebase';
import { normalizeLineUserId } from '../lib/lineUserId';
import { fsListCollection } from '../lib/firestoreRest';
import { exactCustomerNameMatch } from '../lib/customerNameMatch';

function compactName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
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
    ...CUSTOMERS.map((c) => ({ ...c, ...(fsCustomers[c.id] || {}), source: 'builtin' })),
    ...Object.values(fsCustomers)
      .filter((c) => !CUSTOMERS.find((b) => b.id === c.id))
      .map((c) => ({ ...c, source: 'firestore' })),
  ];
  return markDuplicateCustomers(list);
}

/** แฟลกรายการชื่อซ้ำ (compact name เดียวกัน) */
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

function customerPayload({ name, zone, phone, lineUserId }) {
  const payload = {
    name: name.trim(),
    zone: zone.trim(),
    phone: phone.trim(),
  };
  const line = normalizeLineUserId(lineUserId);
  if (line) payload.lineUserId = line;
  else payload.lineUserId = '';
  return payload;
}

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('หมดเวลา — ลองใหม่')), ms)),
  ]);
}

export async function updateCustomer(id, data) {
  if (!db) throw new Error('ยังไม่ได้เชื่อม Firebase');
  await withTimeout(setDoc(doc(db, 'customers', id), customerPayload(data), { merge: true }));
}

export async function createCustomer(data) {
  if (!db) throw new Error('ยังไม่ได้เชื่อม Firebase');
  const id = `cx_${Date.now()}`;
  await withTimeout(setDoc(doc(db, 'customers', id), {
    ...customerPayload(data),
    createdAt: serverTimestamp(),
  }));
  return id;
}

export async function deleteCustomer(id) {
  if (!db) throw new Error('ยังไม่ได้เชื่อม Firebase');
  if (!String(id).startsWith('cx_')) {
    throw new Error('ลบได้เฉพาะลูกค้าที่เพิ่มเอง (ไม่ใช่รายการเริ่มต้นในแอป)');
  }
  await deleteDoc(doc(db, 'customers', id));
}

/** หา LINE user id จากออเดอร์ LINE ล่าสุดที่ชื่อลูกค้าตรงกัน */
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
