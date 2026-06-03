import { CUSTOMERS } from '../constants';
import { normalizeLineUserId, isValidLineUserId } from '../lib/lineUserId';
import { fsDelete, fsGetDoc, fsListCollection, fsSetDoc } from '../lib/firestoreRest';
import {
  customerFieldsFromForm,
  customerMatchesLabel,
  labelsFromCustomerForm,
} from '../lib/customerAliases';
import { compactNameMatch, exactCustomerNameMatch } from '../lib/customerNameMatch';
import {
  getBillingLineUserId,
  getOrderLineUserIds,
  legacyLineUserIdFromContacts,
  lineContactsFromForm,
  normalizeLineContacts,
} from '../lib/lineCustomerContacts';

function compactName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('หมดเวลา — ลองใหม่')), ms)),
  ]);
}

/** โหลดรายชื่อลูกค้าครั้งเดียว (REST) — ไม่ฟัง real-time */
export async function refreshCustomersMap() {
  return fetchCustomersMap();
}

const customerListeners = new Set();

/** แจ้งทุกหน้าจอให้โหลด customers ใหม่ (หลังผูก LINE OA ฯลฯ) */
export function notifyCustomersChanged() {
  customerListeners.forEach((fn) => {
    try { fn(); } catch (e) { console.warn('notifyCustomersChanged', e); }
  });
}

export function onCustomersChanged(listener) {
  customerListeners.add(listener);
  return () => customerListeners.delete(listener);
}

/**
 * โหลด customers ตอน mount + ทุก ~30 วินาที + หลังบันทึก/ผูก LINE
 */
export function subscribeCustomers(onData, onError) {
  let cancelled = false;
  const pull = () => refreshCustomersMap()
    .then((map) => {
      if (!cancelled) onData(map);
    })
    .catch((err) => {
      console.warn('subscribeCustomers', err);
      if (!cancelled) onError?.(err);
    });

  pull();
  const interval = setInterval(pull, 30000);
  const offBus = onCustomersChanged(pull);

  return () => {
    cancelled = true;
    clearInterval(interval);
    offBus();
  };
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

function customerPayload({
  name,
  zone,
  phone,
  notes,
  lineUserId,
  lineOrderUserIds,
  hidden,
  aliases,
  aliasesText,
  defaultRiverSize,
}) {
  const parsed = customerFieldsFromForm({ name, aliasesText, aliases });
  const payload = {
    name: parsed.name,
    zone: String(zone || '').trim(),
    phone: String(phone || '').trim(),
    notes: String(notes || '').trim(),
  };
  payload.aliases = parsed.aliases;
  const riverDefault = String(defaultRiverSize || '').trim();
  if (riverDefault) payload.defaultRiverSize = riverDefault;
  const contacts = lineContactsFromForm({ lineUserId, lineOrderUserIds });
  payload.lineContacts = contacts;
  payload.lineUserId = legacyLineUserIdFromContacts(contacts);
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
  const savedBilling = getBillingLineUserId(doc);
  if (want.lineUserId && savedBilling !== want.lineUserId) {
    throw new Error('บันทึก LINE UID ไม่สำเร็จ — ลองอีกครั้งหรือรีเฟรชแอป');
  }
  if (want.hidden === true && doc.hidden !== true) {
    throw new Error('ซ่อนรายการไม่สำเร็จ');
  }
  return doc;
}

async function loadCustomerBase(id) {
  const builtin = CUSTOMERS.find((b) => b.id === id);
  let existing = {};
  try {
    existing = (await fsGetDoc(`customers/${id}`)) || {};
  } catch {
    existing = {};
  }
  return { ...builtin, ...existing };
}

function mergeCustomerFields(base, data) {
  const pick = (key) => (key in data ? data[key] : base[key]);
  return {
    name: pick('name'),
    aliases: pick('aliases'),
    aliasesText: pick('aliasesText'),
    defaultRiverSize: pick('defaultRiverSize'),
    zone: pick('zone'),
    phone: pick('phone'),
    notes: pick('notes'),
    lineUserId: pick('lineUserId'),
    lineOrderUserIds: pick('lineOrderUserIds'),
    hidden: 'hidden' in data ? data.hidden : base.hidden,
  };
}

/** ถอด UID สั่งออกจากร้านอื่น (billing ซ้ำข้ามร้านได้ — เจ้าของ 2 ร้าน) */
async function releaseOrderLineUidFromOthers(lineUserId, keepCustomerId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid || !keepCustomerId) return { cleared: [] };

  const map = await fetchCustomersMap();
  const cleared = [];

  for (const [otherId, doc] of Object.entries(map)) {
    if (otherId === keepCustomerId) continue;
    const contacts = normalizeLineContacts(doc);
    if (!contacts.some((c) => c.uid === uid)) continue;

    const next = contacts.filter((c) => c.uid !== uid);
    const base = await loadCustomerBase(otherId);
    const want = customerPayload(mergeCustomerFields(base, {
      lineUserId: legacyLineUserIdFromContacts(next),
      lineOrderUserIds: getOrderLineUserIds({ lineContacts: next }).join(', '),
    }));
    await withTimeout(fsSetDoc(`customers/${otherId}`, {
      ...want,
      updatedAt: new Date().toISOString(),
    }));
    cleared.push(otherId);
  }

  return { cleared };
}

/**
 * ถ้า UID billing ถูกผูกกับลูกค้าอื่น — ถอดเฉพาะเมื่อเป็น UID เดียว (legacy)
 * billing ซ้ำข้ามร้านหลัก (c1–c27) อนุญาต · cx_* ซ้ำจะลบ
 */
export async function releaseLineUserIdFromOthers(lineUserId, keepCustomerId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid || !keepCustomerId) return { cleared: [], deleted: [] };

  const map = await fetchCustomersMap();
  const cleared = [];
  const deleted = [];

  for (const [otherId, doc] of Object.entries(map)) {
    if (otherId === keepCustomerId) continue;
    const billing = getBillingLineUserId(doc);
    if (billing !== uid && !normalizeLineContacts(doc).some((c) => c.uid === uid && c.role === 'billing')) {
      continue;
    }
    if (CUSTOMERS.some((b) => b.id === otherId) && CUSTOMERS.some((b) => b.id === keepCustomerId)) {
      continue;
    }

    if (isDeletableCustomer({ id: otherId })) {
      await withTimeout(fsDelete(`customers/${otherId}`));
      const still = await fsGetDoc(`customers/${otherId}`);
      if (still) throw new Error(`ลบลูกค้าซ้ำ ${otherId} ไม่สำเร็จ`);
      deleted.push(otherId);
      continue;
    }

    const contacts = normalizeLineContacts(doc).filter((c) => c.uid !== uid);
    const base = await loadCustomerBase(otherId);
    const want = customerPayload(mergeCustomerFields(base, {
      lineUserId: legacyLineUserIdFromContacts(contacts),
      lineOrderUserIds: getOrderLineUserIds({ lineContacts: contacts }).join(', '),
    }));
    await withTimeout(fsSetDoc(`customers/${otherId}`, {
      ...want,
      updatedAt: new Date().toISOString(),
    }));
    cleared.push(otherId);
  }

  return { cleared, deleted };
}

export async function updateCustomer(id, data, { merge = false } = {}) {
  if (!id) throw new Error('ไม่พบรหัสลูกค้า');
  const merged = merge ? mergeCustomerFields(await loadCustomerBase(id), data) : data;
  const want = customerPayload(merged);
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...want,
    updatedAt: new Date().toISOString(),
  }));
  if (want.lineUserId) {
    await releaseLineUserIdFromOthers(want.lineUserId, id);
  }
  for (const c of want.lineContacts || []) {
    if (c.role === 'order') {
      await releaseOrderLineUidFromOthers(c.uid, id);
    }
  }
  const doc = await withTimeout(fsGetDoc(`customers/${id}`));
  return assertSaved(doc, want, id);
}

/** บันทึก + ยืนยันจาก Firestore + คืน map ล่าสุด */
export async function saveCustomerVerified(id, data, { merge = false } = {}) {
  const doc = await updateCustomer(id, data, { merge });
  const map = await fetchCustomersMap();
  notifyCustomersChanged();
  return { doc, map };
}

export async function createCustomer(data) {
  const id = `cx_${Date.now()}`;
  const want = customerPayload(data);
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...want,
    createdAt: new Date().toISOString(),
  }));
  if (want.lineUserId) {
    await releaseLineUserIdFromOthers(want.lineUserId, id);
  }
  for (const c of want.lineContacts || []) {
    if (c.role === 'order') {
      await releaseOrderLineUidFromOthers(c.uid, id);
    }
  }
  const doc = await withTimeout(fsGetDoc(`customers/${id}`));
  assertSaved(doc, want, id);
  return id;
}

export async function createCustomerVerified(data) {
  const id = await createCustomer(data);
  const map = await fetchCustomersMap();
  notifyCustomersChanged();
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
  const map = await fetchCustomersMap();
  notifyCustomersChanged();
  return map;
}

export async function hideCustomerFromList(id) {
  const builtin = CUSTOMERS.find((b) => b.id === id);
  const want = customerPayload({
    name: builtin?.name || id,
    zone: builtin?.zone || '',
    phone: '',
    lineUserId: '',
    lineOrderUserIds: '',
    hidden: true,
  });
  await withTimeout(fsSetDoc(`customers/${id}`, {
    ...want,
    hiddenAt: new Date().toISOString(),
  }));
  const doc = await fsGetDoc(`customers/${id}`);
  assertSaved(doc, want, id);
  const map = await fetchCustomersMap();
  notifyCustomersChanged();
  return map;
}

function orderNameMatchesCustomer(orderName, customerName) {
  if (customerMatchesLabel({ name: customerName }, orderName)) return true;
  if (exactCustomerNameMatch(orderName, customerName)) return true;
  const compact = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
  const cn = compact(customerName);
  const on = compact(orderName);
  if (!cn || !on) return false;
  if (compactNameMatch(orderName, customerName)) {
    if (cn.includes('ขียด') || cn.includes('เขียน') || on.includes('ขียด') || on.includes('เขียน')) {
      return true;
    }
  }
  return false;
}

function orderMatchesAnyLabel(order, labels) {
  const names = [
    order.customerName,
    ...(order.items || []).map((i) => i.customerName),
  ].filter(Boolean);
  return names.some((orderName) => labels.some((label) => orderNameMatchesCustomer(orderName, label)));
}

/** ดึง LINE UID จากออเดอร์แชทตรง OA (รวมที่ยกเลิกแล้ว — ใช้ตอนกดปุ่มในรายชื่อลูกค้า) */
export async function suggestLineUserIdFromOrders(customerNameOrForm) {
  const orders = await fsListCollection('lineOrders', 200);
  const labels = typeof customerNameOrForm === 'string'
    ? labelsFromCustomerForm({ name: customerNameOrForm, aliasesText: '' })
    : labelsFromCustomerForm(customerNameOrForm || {});
  if (!labels.length) return null;

  const sorted = [...orders].sort((a, b) => {
    const ta = a.createdAt || '';
    const tb = b.createdAt || '';
    return String(tb).localeCompare(String(ta));
  });

  for (const o of sorted) {
    if (!o.lineUserId) continue;
    if (o.lineGroupId) continue;
    if (orderMatchesAnyLabel(o, labels)) {
      return normalizeLineUserId(o.lineUserId);
    }
    if (labels.some((label) => orderNameMatchesCustomer(o.rawText, label))) {
      return normalizeLineUserId(o.lineUserId);
    }
  }
  return null;
}

export { isValidLineUserId };
