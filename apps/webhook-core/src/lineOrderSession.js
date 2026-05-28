/**
 * สถานะออเดอร์ค้างในกลุ่ม LINE (หลายข้อความต่อกัน เช่น ปุ้ย 2 แล้วตามด้วย กลาง)
 */

const SESSION_TTL_MS = 36 * 60 * 60 * 1000;

/** แยก session ต่อคนในกลุ่ม — ไม่ปน pending ระหว่างสมาชิก */
function sessionDocId(groupId, userId) {
  const g = groupId || 'dm';
  const u = userId || 'unknown';
  return `${g}__${u}`;
}

async function getLineOrderSession(db, groupId, userId) {
  const id = sessionDocId(groupId, userId);
  const snap = await db.collection('lineOrderSessions').doc(id).get();
  if (!snap.exists) {
    return { id, deliveryDate: null, pending: null, orderDraft: null, profileCollect: null };
  }
  const data = snap.data() || {};
  const updatedAt = data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : null);
  if (updatedAt && Date.now() - updatedAt.getTime() > SESSION_TTL_MS) {
    return {
      id,
      deliveryDate: null,
      pending: null,
      orderDraft: null,
      profileCollect: null,
      stale: true,
    };
  }
  return {
    id,
    deliveryDate: data.deliveryDate || null,
    pending: data.pending || null,
    orderDraft: data.orderDraft || null,
    profileCollect: data.profileCollect || null,
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
