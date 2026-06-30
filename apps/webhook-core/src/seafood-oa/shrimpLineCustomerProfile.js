const { normalizeLineUserId } = require('./lineUserId');
const {
  customerHasLineUserId,
  getBillingLineUserId,
  normalizeLineContacts,
} = require('./lineCustomerContacts');
const { customerMatchesName } = require('./customerNameAliases');

/** ร้านหลัก c1–c27 — ต้องผูก LINE ครบก่อนเปิดกฎถามชื่อ/เบอร์ลูกค้าใหม่ */
const MAIN_CATALOG_SHOP_IDS = new Set(
  Array.from({ length: 27 }, (_, i) => `c${i + 1}`),
);
const PROFILE_GATE_MIN_LINKED_SHOPS = 27;

function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function exactCustomerNameMatch(a, b) {
  return compact(a) === compact(b);
}

function isLinkedLineCustomer(data) {
  return normalizeLineContacts(data).length > 0;
}

function profileMissingFields(data) {
  const missing = [];
  const name = String(data?.name || '').trim();
  const phone = String(data?.phone || '').trim();
  const notes = String(data?.notes || '').trim();
  if (!name) missing.push('name');
  // ลูกค้าที่ผูก LINE ในแอปแล้ว — ไม่บังคับเบอร์/จุดส่งซ้ำทุกออเดอร์
  if (isLinkedLineCustomer(data)) {
    return missing;
  }
  if (!phone) missing.push('phone');
  if (!notes) missing.push('notes');
  return missing;
}

function isProfileComplete(data) {
  return profileMissingFields(data).length === 0;
}

async function findCustomerByLineUserId(db, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return null;
  const snap = await db.collection('customers').where('lineUserId', '==', uid).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  const all = await db.collection('customers').limit(2000).get();
  for (const doc of all.docs) {
    const data = doc.data() || {};
    if (customerHasLineUserId(data, uid)) {
      return { id: doc.id, ...data };
    }
  }
  return null;
}

async function countLinkedMainCatalogShops(db) {
  const snap = await db.collection('customers').limit(2000).get();
  let count = 0;
  for (const doc of snap.docs) {
    if (!MAIN_CATALOG_SHOP_IDS.has(doc.id)) continue;
    if (isLinkedLineCustomer(doc.data())) count += 1;
  }
  return count;
}

/** เปิดถามชื่อ/เบอร์/จุดส่งเมื่อผูกร้านหลักครบ 27 แล้วเท่านั้น */
async function isNewCustomerProfileGateActive(db) {
  const linked = await countLinkedMainCatalogShops(db);
  return linked >= PROFILE_GATE_MIN_LINKED_SHOPS;
}

async function findCustomerByName(db, customerName) {
  const want = String(customerName || '').trim();
  if (!want) return null;
  const snap = await db.collection('customers').limit(2000).get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (customerMatchesName(data, want)) {
      return { id: doc.id, ...data };
    }
  }
  return null;
}

/**
 * @returns {Promise<{ customer: object|null, missing: string[], customerName: string|null }>}
 */
async function assessLineCustomerProfile(db, { lineUserId, customerName, groupId }) {
  let customer = null;
  let resolvedName = customerName ? String(customerName).trim() : null;

  if (!groupId && lineUserId) {
    customer = await findCustomerByLineUserId(db, lineUserId);
    if (customer?.name) resolvedName = customer.name;
  }

  if (!customer && resolvedName) {
    customer = await findCustomerByName(db, resolvedName);
  }

  if (!customer && resolvedName) {
    return {
      customer: null,
      missing: ['name', 'phone', 'notes'],
      customerName: resolvedName,
    };
  }

  if (!customer) {
    return {
      customer: null,
      missing: ['name', 'phone', 'notes'],
      customerName: resolvedName,
    };
  }

  const missing = profileMissingFields(customer);
  return {
    customer,
    missing,
    customerName: customer.name || resolvedName,
  };
}

function parseProfileFields(text) {
  const raw = String(text || '').trim();
  const out = {};

  const phoneLabeled = raw.match(/(?:เบอร์|โทร|tel|phone)\s*[:：]?\s*(0[\d\s-]{8,14})/i);
  const phoneBare = raw.match(/\b(0\d[\d\s-]{7,12})\b/);
  const phoneSrc = phoneLabeled?.[1] || phoneBare?.[1];
  if (phoneSrc) out.phone = phoneSrc.replace(/\s|-/g, '');

  const nameLabeled = raw.match(/(?:ชื่อ|name)\s*[:：]?\s*([^\n,]{2,48})/i);
  if (nameLabeled) out.name = nameLabeled[1].trim();

  const notesLabeled = raw.match(/(?:เพิ่มเติม|หมายเหตุ|note|ที่อยู่|จุดส่ง)\s*[:：]?\s*([\s\S]+)/i);
  if (notesLabeled) out.notes = notesLabeled[1].trim();

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!out.name && lines.length >= 2 && !/^(เบอร์|โทร|เพิ่มเติม|ชื่อ)/i.test(lines[0])) {
    const first = lines[0];
    if (first.length >= 2 && !/^0\d/.test(first.replace(/\s|-/g, ''))) {
      out.name = first;
    }
  }

  if (!out.notes && lines.length >= 2) {
    const last = lines[lines.length - 1];
    if (last !== out.name && !/^0\d/.test(last.replace(/\s|-/g, '')) && !/^(เบอร์|โทร|ชื่อ)/i.test(last)) {
      if (!out.notes && (lines.length >= 3 || /ส่ง|ซอย|หมู่|ต.|อ.|จ./i.test(last))) {
        out.notes = last;
      }
    }
  }

  if (!out.phone && /^0\d{8,9}$/.test(raw.replace(/\s|-/g, ''))) {
    out.phone = raw.replace(/\s|-/g, '');
  }

  if (!out.notes && !out.phone && !out.name && raw.length >= 4 && !/กุ้ง/.test(raw)) {
    out.notes = raw;
  }

  return out;
}

function formatMissingProfilePrompt(missing, { itemsSummary, deliveryDateLabel }) {
  const needName = missing.includes('name');
  const needPhone = missing.includes('phone');
  const needNotes = missing.includes('notes');

  const lines = [
    '📋 ก่อนยืนยันรับออเดอร์ ขอข้อมูลลูกค้าให้ครบครับ',
    deliveryDateLabel ? `📅 ส่ง ${deliveryDateLabel}` : null,
    itemsSummary ? `\n${itemsSummary}` : null,
    '',
    'กรุณาแจ้ง:',
    needName ? '• ชื่อลูกค้า / ร้าน' : null,
    needPhone ? '• เบอร์ติดต่อ' : null,
    needNotes ? '• เพิ่มเติม (จุดส่ง / หมายเหตุ)' : null,
    '',
    'ตัวอย่าง:\nชื่อ ร้าน ABC\nเบอร์ 0812345678\nเพิ่มเติม ส่งประตูหลัง',
  ].filter((x) => x !== null);

  return lines.join('\n');
}

async function upsertCustomerProfile(db, admin, { customer, lineUserId, customerName, fields }) {
  const uid = normalizeLineUserId(lineUserId);
  const patch = {
    name: String(fields.name || customer?.name || customerName || '').trim(),
    phone: String(fields.phone || customer?.phone || '').trim(),
    notes: String(fields.notes || customer?.notes || '').trim(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (uid) patch.lineUserId = uid;

  if (customer?.id) {
    await db.collection('customers').doc(customer.id).set(patch, { merge: true });
    const snap = await db.collection('customers').doc(customer.id).get();
    return { id: customer.id, ...snap.data() };
  }

  const id = `cx_${Date.now()}`;
  await db.collection('customers').doc(id).set({
    ...patch,
    zone: String(customer?.zone || '').trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const snap = await db.collection('customers').doc(id).get();
  return { id, ...snap.data() };
}

module.exports = {
  MAIN_CATALOG_SHOP_IDS,
  PROFILE_GATE_MIN_LINKED_SHOPS,
  profileMissingFields,
  isProfileComplete,
  countLinkedMainCatalogShops,
  isNewCustomerProfileGateActive,
  assessLineCustomerProfile,
  parseProfileFields,
  formatMissingProfilePrompt,
  upsertCustomerProfile,
  findCustomerByLineUserId,
  findCustomerByName,
};
