const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const { customerMatchesName } = require('./customerNameAliases');
const { LINE_UID_RE, normalizeLineUserId } = require('./lineUserId');
const {
  LINE_CONTACT_ROLE_BILLING,
  LINE_CONTACT_ROLE_ORDER,
  appendLineContact,
  customerHasLineUserId,
  legacyLineUserIdFromContacts,
  normalizeLineContacts,
} = require('./lineCustomerContacts');

function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function exactCustomerNameMatch(a, b) {
  return compact(a) === compact(b);
}

async function verifyShrimpStaff(db, uid) {
  const snap = await db.collection('shrimp_users').doc(uid).get();
  const user = snap.data();
  if (!snap.exists || user?.approved !== true) {
    const err = new Error('forbidden');
    err.code = 'forbidden';
    throw err;
  }
  return user;
}

async function uploadBillJpeg(admin, buffer, billNo) {
  const bucket = admin.storage().bucket();
  const safe = String(billNo || 'bill').replace(/[^\w.-]+/g, '_').slice(0, 48);
  const path = `lineBills/${Date.now()}_${safe}.jpg`;
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=3600' },
  });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${path}`;
  return { url, path };
}

async function linePushImage(to, imageUrl, token, caption) {
  if (!token || !to || !imageUrl) return { ok: false, status: 0 };
  const messages = [];
  if (caption) messages.push({ type: 'text', text: caption });
  messages.push({
    type: 'image',
    originalContentUrl: imageUrl,
    previewImageUrl: imageUrl,
  });
  const r = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    console.error('linePushImage', r.status, body);
  }
  return { ok: r.ok, status: r.status };
}

/** ชื่อลูกค้าจากรายชื่อที่ผูก lineUserId แล้ว */
async function findCustomerNameByLineUserId(db, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return null;
  try {
    const snap = await db.collection('customers').where('lineUserId', '==', uid).limit(1).get();
    if (!snap.empty) {
      const name = snap.docs[0].data()?.name;
      return name ? String(name).trim() : null;
    }
    const all = await db.collection('customers').get();
    for (const doc of all.docs) {
      const data = doc.data() || {};
      if (customerHasLineUserId(data, uid)) {
        const name = data.name;
        return name ? String(name).trim() : null;
      }
    }
  } catch (err) {
    console.warn('findCustomerNameByLineUserId', err.message);
  }
  return null;
}

/** map LINE UID → ชื่อลูกค้า (สำหรับสรุปออเดอร์หลายรายการ) */
async function buildCustomerNameByLineUidMap(db) {
  const map = new Map();
  const snap = await db.collection('customers').get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const name = String(data.name || '').trim();
    if (!name) continue;
    for (const row of normalizeLineContacts(data)) {
      map.set(row.uid, name);
    }
  }
  return map;
}

function linkedCustomerNameForOrder(order, uidMap) {
  const uid = normalizeLineUserId(order?.lineUserId);
  if (uid && uidMap?.get(uid)) return uidMap.get(uid);
  return order?.customerName || null;
}

/** ผูก LINE UID กับลูกค้าเมื่อชื่อตรง — มี billing แล้วเพิ่มเป็น「สั่งใน LINE」 */
async function linkLineUserToCustomers(db, admin, { lineUserId, customerNames }) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return;
  const names = [...new Set((customerNames || []).map((n) => String(n || '').trim()).filter(Boolean))];
  if (!names.length) return;

  const snap = await db.collection('customers').get();
  const batch = db.batch();
  let count = 0;
  const ts = admin.firestore.FieldValue.serverTimestamp();

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const name = data.name || '';
    const matched = names.some((n) => customerMatchesName({ name, aliases: data.aliases }, n));
    if (!matched) continue;
    if (customerHasLineUserId(data, uid)) continue;

    const contacts = normalizeLineContacts(data);
    const hasBilling = contacts.some((c) => c.role === LINE_CONTACT_ROLE_BILLING);
    let next;
    if (hasBilling) {
      next = appendLineContact(contacts, uid, LINE_CONTACT_ROLE_ORDER);
    } else {
      next = appendLineContact([], uid, LINE_CONTACT_ROLE_BILLING);
    }
    batch.set(
      doc.ref,
      {
        lineContacts: next,
        lineUserId: legacyLineUserIdFromContacts(next),
        lineUserIdLinkedAt: ts,
      },
      { merge: true },
    );
    count += 1;
    if (count >= 20) break;
  }
  if (count > 0) await batch.commit();
}

function lineBillPaymentNote(paymentType) {
  if (paymentType === 'cash') return 'จ่ายแล้ว · เงินสด';
  if (paymentType === 'transfer') return 'จ่ายแล้ว · โอน';
  return '';
}

/**
 * เลขบัญชีในแชท LINE — จัดเป็นบรรทัด (สอดคล้อง billTemplateConfig กุ้ง)
 * ไม่ใช้ <tel:…> เพื่อไม่ให้ข้อความกระจุก/อ่านยาก
 */
function buildLineBillTransferAccountsText() {
  return [
    'คุณลูกค้าสามารถโอนมาได้ที่',
    '',
    'บัญชีแม่',
    '538 203 8136',
    '',
    'บัญชีพีช',
    '033 3318 237',
    '',
    'พร้อมเพย์',
    '094 940 8665',
  ].join('\n');
}

const LINE_BILL_TRANSFER_ACCOUNTS_TEXT = buildLineBillTransferAccountsText();

function lineBillUnpaidHint(paymentType, remainingAmount, total) {
  const remain = parseFloat(remainingAmount);
  const unpaid = Number.isFinite(remain) && remain > 0
    ? remain
    : (paymentType === 'credit' ? parseFloat(total) || 0 : 0);
  if (unpaid <= 0) return '';
  return [
    `ค้างชำระ ฿${unpaid.toLocaleString('th-TH')}`,
    buildLineBillTransferAccountsText(),
  ].join('\n');
}

/** ขอบคุณในแชท LINE — ตรง BILL_PAID_THANK_YOU_MESSAGE ใน apps/seafood-pos/src/lib/billPaymentDisplay.js */
const LINE_BILL_PAID_THANK_YOU =
  'ขอบคุณที่ไว้วางใจและอุดหนุน โกอ้วน คลังซีฟู้ด — ยินดีให้บริการท่านเสมอ';

function lineBillPaidThankYouCaption(paymentType, remainingAmount, total) {
  if (!lineBillPaymentNote(paymentType)) return '';
  if (lineBillUnpaidHint(paymentType, remainingAmount, total)) return '';
  return LINE_BILL_PAID_THANK_YOU;
}

async function pushShrimpBillToCustomer(db, admin, {
  lineUserId,
  imageBase64,
  billNo,
  customerName,
  paymentType,
  remainingAmount,
  total,
}) {
  const to = normalizeLineUserId(lineUserId);
  if (!LINE_UID_RE.test(to)) {
    const err = new Error('invalid_line_user_id');
    err.code = 'invalid_line_user_id';
    throw err;
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    const err = new Error('line_token_missing');
    err.code = 'line_token_missing';
    throw err;
  }

  const raw = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length || buffer.length > 9 * 1024 * 1024) {
    const err = new Error('invalid_image');
    err.code = 'invalid_image';
    throw err;
  }

  const { url } = await uploadBillJpeg(admin, buffer, billNo);
  const paidNote = lineBillPaymentNote(paymentType);
  const creditHint = lineBillUnpaidHint(paymentType, remainingAmount, total);
  const thankYou = lineBillPaidThankYouCaption(paymentType, remainingAmount, total);
  const caption = [
    '📋 ใบส่งของ — โกอ้วน คลังซีฟู้ด',
    billNo ? `เลขที่ ${billNo}` : null,
    customerName ? `ลูกค้า ${customerName}` : null,
    paidNote ? `✅ ${paidNote}` : null,
    thankYou || null,
    creditHint || null,
  ]
    .filter(Boolean)
    .join('\n');

  const push = await linePushImage(to, url, token, caption);
  if (!push.ok) {
    const err = new Error('line_push_failed');
    err.code = 'line_push_failed';
    err.status = push.status;
    throw err;
  }

  await db.collection('lineBillPushes').add({
    lineUserId: to,
    billNo: billNo || null,
    customerName: customerName || null,
    imageUrl: url,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, lineUserId: to, imageUrl: url };
}

module.exports = {
  normalizeLineUserId,
  verifyShrimpStaff,
  findCustomerNameByLineUserId,
  buildCustomerNameByLineUidMap,
  linkedCustomerNameForOrder,
  linkLineUserToCustomers,
  lineBillUnpaidHint,
  lineBillPaidThankYouCaption,
  LINE_BILL_PAID_THANK_YOU,
  LINE_BILL_TRANSFER_ACCOUNTS_TEXT,
  buildLineBillTransferAccountsText,
  pushShrimpBillToCustomer,
};
