const {
  normalizeLineUserId,
  findCustomerNameByLineUserId,
} = require('./shrimpLinePush');
const { lineReply } = require('./teaDailySummary');
const { notifyShrimpPaymentSlip } = require('./instantLineNotify');

const LINE_CONTENT_URL = 'https://api-data.line.me/v2/bot/message';

const SLIP_RECEIVED_REPLY =
  '✅ รับสลิปแล้วครับ\n'
  + 'ร้านจะตรวจยอดในแอปธนาคารแล้วยืนยันให้\n'
  + 'เมื่อชำระครบจะส่งใบส่งของ「จ่ายแล้ว · โอน」ให้อีกครั้ง';

function saleRemaining(sale) {
  return parseFloat(sale?.remainingAmount) || 0;
}

function isOpenSale(sale) {
  if (!sale) return false;
  if (saleRemaining(sale) > 0) return true;
  if (sale.paymentType === 'credit') {
    const total = parseFloat(sale.total) || 0;
    return total > 0;
  }
  return false;
}

async function downloadLineMessageContent(messageId, token) {
  if (!messageId || !token) return null;
  const url = `${LINE_CONTENT_URL}/${messageId}/content`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    console.error('downloadLineMessageContent', r.status);
    return null;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length || buf.length > 9 * 1024 * 1024) return null;
  return buf;
}

async function uploadSlipImage(admin, buffer, lineUserId) {
  const bucket = admin.storage().bucket();
  const uidTail = String(lineUserId || 'u').slice(-8);
  const path = `lineSlips/${Date.now()}_${uidTail}.jpg`;
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=86400' },
  });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${path}`;
  return { url, path };
}

async function findSaleByBillNo(db, billNo) {
  const key = String(billNo || '').trim();
  if (!key) return null;
  const snap = await db.collection('sales').where('billNo', '==', key).limit(8).get();
  for (const doc of snap.docs) {
    const data = { id: doc.id, ...doc.data() };
    if (isOpenSale(data)) return data;
  }
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

/** บิลค้างล่าสุดที่เคย push ให้ UID นี้ */
async function suggestBillForLineUser(db, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return null;

  let pushes = [];
  try {
    const snap = await db.collection('lineBillPushes')
      .where('lineUserId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(12)
      .get();
    pushes = snap.docs.map((d) => d.data());
  } catch (err) {
    console.warn('suggestBill lineBillPushes orderBy', err.message);
    const snap = await db.collection('lineBillPushes')
      .where('lineUserId', '==', uid)
      .limit(24)
      .get();
    pushes = snap.docs
      .map((d) => ({ ...d.data(), _id: d.id }))
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
  }

  for (const push of pushes) {
    const billNo = String(push.billNo || '').trim();
    if (!billNo) continue;
    const sale = await findSaleByBillNo(db, billNo);
    if (sale && isOpenSale(sale)) {
      return {
        billNo,
        saleId: sale.id,
        customerName: sale.customerName || push.customerName || null,
        remainingAmount: saleRemaining(sale) || parseFloat(sale.total) || 0,
        total: parseFloat(sale.total) || 0,
      };
    }
  }
  return null;
}

/**
 * บันทึกสลิปจาก buffer (แชตรูป / LIFF อัปโหลด)
 */
async function recordPaymentSlipSubmission(db, admin, {
  lineUserId,
  buffer,
  lineMessageId = null,
  source = 'line_chat',
  billNoHint = null,
}) {
  const userId = normalizeLineUserId(lineUserId);
  if (!userId || !buffer?.length) {
    const err = new Error('invalid_slip');
    err.code = 'invalid_slip';
    throw err;
  }

  const { url: imageUrl } = await uploadSlipImage(admin, buffer, userId);
  const customerName = await findCustomerNameByLineUserId(db, userId);
  let suggested = await suggestBillForLineUser(db, userId);
  const hintBill = String(billNoHint || '').trim();
  if (hintBill) {
    const sale = await findSaleByBillNo(db, hintBill);
    if (sale) {
      suggested = {
        billNo: hintBill,
        saleId: sale.id,
        customerName: sale.customerName || suggested?.customerName || null,
        remainingAmount: saleRemaining(sale) || parseFloat(sale.total) || 0,
        total: parseFloat(sale.total) || 0,
      };
    } else if (!suggested) {
      suggested = { billNo: hintBill, saleId: null, customerName: null };
    }
  }

  const slipPayload = {
    status: 'pending',
    lineUserId: userId,
    lineMessageId,
    imageUrl,
    source,
    customerName: customerName || suggested?.customerName || null,
    suggestedBillNo: suggested?.billNo || hintBill || null,
    suggestedSaleId: suggested?.saleId || null,
    billNo: suggested?.billNo || hintBill || null,
    saleId: suggested?.saleId || null,
    remainingAmount: suggested?.remainingAmount ?? null,
    total: suggested?.total ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const docRef = await db.collection('paymentSlipSubmissions').add(slipPayload);

  try {
    const notify = await notifyShrimpPaymentSlip(db, slipPayload, { submissionId: docRef.id });
    if (notify.skipped) console.log('recordPaymentSlip notify', notify.skipped);
  } catch (err) {
    console.warn('recordPaymentSlip notify', err.message);
  }

  return {
    ok: true,
    imageUrl,
    submissionId: docRef.id,
    suggestedBillNo: suggested?.billNo || hintBill || null,
    message: SLIP_RECEIVED_REPLY,
  };
}

/**
 * รับรูปสลิปจากลูกค้าในแชต 1:1 — เก็บคิวรอพนักงานยืนยันในแอป
 */
async function processShrimpPaymentSlipImage(db, admin, { event, token }) {
  const userId = normalizeLineUserId(event.source?.userId);
  const groupId = event.source?.groupId || event.source?.roomId || null;
  if (!userId || groupId) return { skipped: true };

  const messageId = event.message?.id;
  const buffer = await downloadLineMessageContent(messageId, token);
  if (!buffer) {
    await lineReply(
      event.replyToken,
      '⚠️ รับรูปไม่สำเร็จ — ลองส่งใหม่อีกครั้งครับ',
      token,
    );
    return { ok: false };
  }

  const result = await recordPaymentSlipSubmission(db, admin, {
    lineUserId: userId,
    buffer,
    lineMessageId: messageId || null,
    source: 'line_chat',
  });

  await lineReply(event.replyToken, SLIP_RECEIVED_REPLY, token);
  return result;
}

module.exports = {
  SLIP_RECEIVED_REPLY,
  processShrimpPaymentSlipImage,
  recordPaymentSlipSubmission,
  suggestBillForLineUser,
  isOpenSale,
  saleRemaining,
};
