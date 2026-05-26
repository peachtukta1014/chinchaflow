const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function exactCustomerNameMatch(a, b) {
  return compact(a) === compact(b);
}

const LINE_UID_RE = /^U[a-fA-F0-9]{32}$/;

function normalizeLineUserId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (LINE_UID_RE.test(s)) return s;
  const m = s.match(/U[a-fA-F0-9]{32}/);
  return m ? m[0] : '';
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

/** ผูก LINE UID กับลูกค้าใน Firestore เมื่อชื่อตรงจากออเดอร์ LINE */
async function linkLineUserToCustomers(db, admin, { lineUserId, customerNames }) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return;
  const names = [...new Set((customerNames || []).map((n) => String(n || '').trim()).filter(Boolean))];
  if (!names.length) return;

  const snap = await db.collection('customers').get();
  const batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const name = data.name || '';
    const matched = names.some((n) => exactCustomerNameMatch(name, n));
    if (!matched) continue;
    if (data.lineUserId === uid) continue;
    batch.set(doc.ref, { lineUserId: uid, lineUserIdLinkedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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

async function pushShrimpBillToCustomer(db, admin, {
  lineUserId,
  imageBase64,
  billNo,
  customerName,
  paymentType,
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
  const caption = [
    '📋 ใบส่งของ — โกอ้วน คลังซีฟู้ด',
    billNo ? `เลขที่ ${billNo}` : null,
    customerName ? `ลูกค้า ${customerName}` : null,
    paidNote ? `✅ ${paidNote}` : null,
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
  linkLineUserToCustomers,
  pushShrimpBillToCustomer,
};
