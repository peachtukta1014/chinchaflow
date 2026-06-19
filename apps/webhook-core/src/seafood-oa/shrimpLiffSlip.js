const { verifyLineLiffIdToken } = require('./verifyLineLiffToken');
const { normalizeLineUserId } = require('./lineUserId');
const {
  SLIP_RECEIVED_REPLY,
  recordPaymentSlipSubmission,
} = require('./shrimpPaymentSlip');

const MAX_IMAGE_BYTES = 9 * 1024 * 1024;

function decodeImageBase64(imageBase64) {
  const raw = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (!raw) return null;
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  return buffer;
}

/**
 * LIFF ฝากสลิป — ตรวจ id_token แล้วบันทึกคิวเดียวกับส่งรูปในแชต
 */
async function handleShrimpLiffSlipRequest(db, admin, body = {}) {
  const verified = await verifyLineLiffIdToken(body.idToken);
  const lineUserId = normalizeLineUserId(verified.lineUserId);
  if (!lineUserId) {
    const err = new Error('invalid_id_token');
    err.code = 'invalid_id_token';
    throw err;
  }

  const buffer = decodeImageBase64(body.imageBase64);
  if (!buffer) {
    const err = new Error('invalid_image');
    err.code = 'invalid_image';
    throw err;
  }

  // ใช้ idempotencyKey จาก client เป็น lineMessageId สำหรับ dedup
  // กัน double-tap และ network retry สร้างสลิปซ้ำ
  const idempotencyKey = String(body.idempotencyKey || '').trim().slice(0, 64) || null;
  const result = await recordPaymentSlipSubmission(db, admin, {
    lineUserId,
    buffer,
    lineMessageId: idempotencyKey,
    source: 'liff_slip',
    billNoHint: body.billNo,
  });

  return {
    ok: true,
    message: SLIP_RECEIVED_REPLY,
    suggestedBillNo: result.suggestedBillNo || null,
    submissionId: result.submissionId || null,
  };
}

module.exports = {
  handleShrimpLiffSlipRequest,
  decodeImageBase64,
};
