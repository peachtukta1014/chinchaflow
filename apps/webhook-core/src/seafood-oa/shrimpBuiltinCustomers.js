/**
 * ร้านหลัก c1–c27 — ต้อง sync กับ apps/seafood-pos/src/constants/customers.js
 * (LIFF / Cloud Functions ไม่ import จากแอปโดยตรง)
 */
const BUILTIN_CUSTOMERS = [
  { id: 'general', name: 'ลูกค้าทั่วไปและตลาดนัด', zone: 'ทั่วไป' },
  {
    id: 'c1',
    name: 'จ๊ะขียด',
    zone: 'ป่าตอง',
    aliases: ['จ๊ะเขียด', 'จะเขียด', 'เจ๊เขียด', 'เจ๊ขียด'],
  },
  { id: 'c2', name: 'ตาจุ้ยหนึ่ง', zone: 'ป่าตอง' },
  { id: 'c3', name: 'ตาจุ้ยสอง', zone: 'ป่าตอง' },
  { id: 'c4', name: 'น้องเล็กหนึ่ง', zone: 'ป่าตอง' },
  { id: 'c5', name: 'ปุ้ย', zone: 'ป่าตอง' },
  { id: 'c6', name: 'พี่แหวว,ป้าแหวว', zone: 'ป่าตอง' },
  {
    id: 'c7',
    name: 'ร้านเฟิร์ส',
    zone: 'ป่าตอง',
    aliases: ['Firstseafood', 'เฟิร์ส', 'พี่ต้อม', 'First seafood'],
  },
  { id: 'c8', name: 'ร้านสองพี่น้องหนึ่ง', zone: 'ป่าตอง' },
  { id: 'c9', name: 'ร้านสองพี่น้องสอง', zone: 'ป่าตอง' },
  { id: 'c10', name: 'ร้านแสนสบาย', zone: 'ป่าตอง' },
  { id: 'c11', name: 'น้องเล็กสอง', zone: 'กะทู้' },
  { id: 'c12', name: 'อีสานรสเด็ด', zone: 'กะทู้' },
  { id: 'c13', name: 'โบ๊ทซีฟู้ด', zone: 'ภูเก็ต' },
  { id: 'c14', name: 'ร้านคุณเชษฐ์', zone: 'ภูเก็ต' },
  { id: 'c15', name: 'ร้าน มุขมณี', zone: 'ราไวย์' },
  { id: 'c16', name: 'ร้าน ฟาง', zone: 'ราไวย์' },
  { id: 'c17', name: 'ร้าน ป้าก้อย', zone: 'ราไวย์' },
  { id: 'c18', name: 'ร้าน มด', zone: 'ราไวย์' },
  { id: 'c19', name: 'ร้าน อ้อม', zone: 'ราไวย์' },
  { id: 'c20', name: 'ร้าน ป้าแมว', zone: 'ราไวย์' },
  { id: 'c21', name: 'ร้าน เฮง 777', zone: 'ราไวย์' },
  { id: 'c22', name: 'ร้าน โอเล่', zone: 'ราไวย์' },
  { id: 'c23', name: 'ร้าน โกห้า', zone: 'ราไวย์' },
  { id: 'c24', name: 'ร้าน วิทยาซีฟู้ด', zone: 'ราไวย์' },
  { id: 'c25', name: 'ร้าน ฟลุ๊ค', zone: 'ราไวย์' },
  { id: 'c26', name: 'ร้าน มุกอันดา', zone: 'ราไวย์' },
  { id: 'c27', name: 'ร้าน สตูล', zone: 'ราไวย์' },
];

const BUILTIN_BY_ID = Object.fromEntries(BUILTIN_CUSTOMERS.map((c) => [c.id, c]));

function catalogEntry(id, data = {}, builtin = null) {
  const name = String(data.name || builtin?.name || '').trim();
  if (!name) return null;
  const zone = String(data.zone || builtin?.zone || '').trim();
  const aliases = Array.isArray(data.aliases) && data.aliases.length
    ? data.aliases
    : (builtin?.aliases || []);
  return { id, name, zone, aliases };
}

function compareThaiName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'th');
}

/** รายชื่อสำหรับ LIFF เลือกร้าน — merge ร้านหลัก + ลูกค้า Firestore (รวมจาก OA) */
async function buildLiffCustomerCatalog(db) {
  const snap = await db.collection('customers').get();
  const fsMap = {};
  for (const doc of snap.docs) {
    fsMap[doc.id] = { id: doc.id, ...(doc.data() || {}) };
  }

  const list = [];
  for (const builtin of BUILTIN_CUSTOMERS) {
    if (builtin.id === 'general') continue;
    const overlay = fsMap[builtin.id];
    if (overlay?.hidden === true) {
      delete fsMap[builtin.id];
      continue;
    }
    const row = catalogEntry(builtin.id, overlay || {}, builtin);
    if (row) list.push(row);
    delete fsMap[builtin.id];
  }

  for (const extra of Object.values(fsMap)) {
    if (extra.hidden === true) continue;
    const row = catalogEntry(extra.id, extra);
    if (row) list.push(row);
  }

  return list.sort(compareThaiName);
}

/** โหลดลูกค้าตาม id — Firestore ก่อน แล้ว fallback ร้านหลัก */
async function loadCustomerById(db, customerId) {
  const id = String(customerId || '').trim();
  if (!id) return null;

  const snap = await db.collection('customers').doc(id).get();
  if (snap.exists) {
    const data = snap.data() || {};
    if (data.hidden === true) return null;
    const row = catalogEntry(snap.id, data, BUILTIN_BY_ID[id]);
    if (row) return { ...row, ...data, id: snap.id };
  }

  const builtin = BUILTIN_BY_ID[id];
  if (builtin && id !== 'general') {
    return { id: builtin.id, name: builtin.name, zone: builtin.zone || '' };
  }

  return null;
}

module.exports = {
  BUILTIN_CUSTOMERS,
  BUILTIN_BY_ID,
  buildLiffCustomerCatalog,
  loadCustomerById,
};
