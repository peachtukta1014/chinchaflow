import { collection, onSnapshot } from 'firebase/firestore';
import { CUSTOMERS } from '../constants';
import { db } from '../firebase';
import { normalizeLineUserId, isValidLineUserId } from '../lib/lineUserId';
import { fsDelete, fsGetDoc, fsListCollection, fsSetDoc } from '../lib/firestoreRest';
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
    (err) => {
      console.warn('subscribeCustomers', err);
      onError?.();
    },
  );
}

/** โหลด customers จาก REST (ใช้หลังบันทึก — ไม่รอ listener) */
export async function fetchCustomersMap() {
  const docs = await fsListCollection('customers', 500);
  const map = {};
  for (const d of docs) {
    if (d.id) map[d.id] = d;
  }
  return map;
}

/** รายชื่อหลักในแอป (27 ร้าน + ทั่วไป) — ใช้ตอน「ผูกลูกค้าเดิม」จาก LINE OA */
export function getMainCatalogCustomers(fsCustomers) {
  return CUSTOMERS.map((c) => {
    const overlay = fsCustomers[c.id] || {};
    if (overlay.hidden === true) return null;
    return { ...c, ...overlay, source: 'builtin' };
  }).filter(Boolean);
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
    name: String(name || '').trim(),
    zone: String(zone || '').trim(),
    phone: String(phone || '').trim(),
  };
  const line = normalizeLineUserId(lineUserId);
  payload.lineUserId = line || '';
  if (hidden === true) payload.hidden = true;
  if (hidden === false) payload.hidden = false;
  return payload;
}

function assertSaved(doc, want, id) {
  if (!doc) {
    throw new Error('บันทึกไม่สำเร็จ — ไม่พบข้อมูลในระบบหลังบันทึก');
  }
  if (want.name && doc.name !== want.name) {
    throw new Error(`บันทึกชื่อไม่สำเร็จ (ในระบบยังเป็น "${doc.name || '—'}")`);
  }
  if (want.lineUserId && normalizeLineUserId(doc.lineUserId) !== want.lineUserId) {
    throw new Error('บันทึก LINE UID ไม่สำเร็จ — ลองอีกครั้งหรือรีเฟรชแอป');
  }
  if (want.hidden === true && doc.hidden !== true) {
    throw new Error('ซ่อนรายการไม่สำเร็จ');
  }
  return doc;
}

export async function updateCustomer(id, data) {
  if (!id) throw new Error('ไม่พบรหัสลูกค้า');
  const want = customerPayload(data);
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...want,
    updatedAt: new Date().toISOString(),
  }));
  const doc = await withTimeout(fsGetDoc(`customers/${id}`));
  return assertSaved(doc, want, id);
}

/** บันทึก + ยืนยันจาก Firestore + คืน map ล่าสุด */
export async function saveCustomerVerified(id, data) {
  const doc = await updateCustomer(id, data);
  const map = await fetchCustomersMap();
  return { doc, map };
}

export async function createCustomer(data) {
  const id = `cx_${Date.now()}`;
  const want = customerPayload(data);
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...want,
    createdAt: new Date().toISOString(),
  }));
  const doc = await withTimeout(fsGetDoc(`customers/${id}`));
  assertSaved(doc, want, id);
  return id;
}

export async function createCustomerVerified(data) {
  const id = await createCustomer(data);
  const map = await fetchCustomersMap();
  return { id, map };
}

export async function deleteCustomer(id) {
  if (!String(id).startsWith('cx_')) {
    throw new Error('ลบได้เฉพาะลูกค้าที่เพิ่มเอง');
  }
  await withTimeout(fsDelete(`customers/${id}`));
  const still = await fsGetDoc(`customers/${id}`);
  if (still) throw new Error('ลบไม่สำเร็จ — ข้อมูลยังอยู่ในระบบ');
}

export async function deleteCustomerVerified(id) {
  await deleteCustomer(id);
  return fetchCustomersMap();
}

export async function hideCustomerFromList(id) {
  const builtin = CUSTOMERS.find((b) => b.id === id);
  const want = customerPayload({
    name: builtin?.name || id,
    zone: builtin?.zone || '',
    phone: '',
    lineUserId: '',
    hidden: true,
  });
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...want,
    hiddenAt: new Date().toISOString(),
  }));
  const doc = await fsGetDoc(`customers/${id}`);
  assertSaved(doc, want, id);
  return fetchCustomersMap();
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

export { isValidLineUserId };
