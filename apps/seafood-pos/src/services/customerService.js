import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { CUSTOMERS } from '../constants';
import { db } from '../firebase';

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

export async function updateCustomer(id, { name, zone, phone }) {
  await setDoc(
    doc(db, 'customers', id),
    { name: name.trim(), zone: zone.trim(), phone: phone.trim() },
    { merge: true },
  );
}

export async function createCustomer({ name, zone, phone }) {
  const id = `cx_${Date.now()}`;
  await setDoc(doc(db, 'customers', id), {
    name: name.trim(),
    zone: zone.trim(),
    phone: phone.trim(),
    createdAt: serverTimestamp(),
  });
  return id;
}
