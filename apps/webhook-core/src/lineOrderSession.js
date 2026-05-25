/**
 * สถานะออเดอร์ค้างในกลุ่ม LINE (หลายข้อความต่อกัน เช่น ปุ้ย 2 แล้วตามด้วย กลาง)
 */

const SESSION_TTL_MS = 36 * 60 * 60 * 1000;

function sessionDocId(groupId, userId) {
  return groupId || `user:${userId || 'unknown'}`;
}

async function getLineOrderSession(db, groupId, userId) {
  const id = sessionDocId(groupId, userId);
  const snap = await db.collection('lineOrderSessions').doc(id).get();
  if (!snap.exists) return { id, deliveryDate: null, pending: null };
  const data = snap.data() || {};
  const updatedAt = data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : null);
  if (updatedAt && Date.now() - updatedAt.getTime() > SESSION_TTL_MS) {
    return { id, deliveryDate: null, pending: null, stale: true };
  }
  return {
    id,
    deliveryDate: data.deliveryDate || null,
    pending: data.pending || null,
  };
}

async function setLineOrderSession(db, sessionId, patch, serverTimestamp) {
  const ref = db.collection('lineOrderSessions').doc(sessionId);
  await ref.set(
    {
      ...patch,
      updatedAt: serverTimestamp,
    },
    { merge: true },
  );
}

async function clearPending(db, sessionId, serverTimestamp) {
  await setLineOrderSession(db, sessionId, { pending: null }, serverTimestamp);
}

module.exports = {
  sessionDocId,
  getLineOrderSession,
  setLineOrderSession,
  clearPending,
  SESSION_TTL_MS,
};
