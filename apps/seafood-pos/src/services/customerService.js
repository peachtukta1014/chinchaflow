import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { CUSTOMERS } from '../constants';
import { db } from '../firebase';
import { normalizeLineUserId } from '../lib/lineUserId';
import { fsListCollection } from '../lib/firestoreRest';
import { compactNameMatch } from '../lib/customerNameMatch';

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
  return [
    ...CUSTOMERS.map((c) => ({ ...c, ...(fsCustomers[c.id] || {}) })),
    ...Object.values(fsCustomers).filter((c) => !CUSTOMERS.find((b) => b.id === c.id)),
  ];
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

export async function updateCustomer(id, data) {
  await setDoc(doc(db, 'customers', id), customerPayload(data), { merge: true });
}

export async function createCustomer(data) {
  const id = `cx_${Date.now()}`;
  await setDoc(doc(db, 'customers', id), {
    ...customerPayload(data),
    createdAt: serverTimestamp(),
  });
  return id;
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
    if (compactNameMatch(o.customerName, name)) {
      return normalizeLineUserId(o.lineUserId);
    }
    for (const item of o.items || []) {
      if (compactNameMatch(item.customerName, name)) {
        return normalizeLineUserId(o.lineUserId);
      }
    }
  }
  return null;
}
