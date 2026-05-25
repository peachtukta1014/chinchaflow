/** กันประมวลผล LINE event ซ้ำ (retry / ส่งซ้ำ) — ถ้าล้มเหลวจะปล่อยให้ LINE retry ได้ */
function eventDocId(event) {
  return event?.webhookEventId || event?.message?.id || null;
}

async function claimLineEvent(db, event) {
  const eventId = eventDocId(event);
  if (!eventId) return true;

  const ref = db.collection('lineWebhookEvents').doc(eventId);
  try {
    await ref.create({
      status: 'processing',
      createdAt: new Date().toISOString(),
      type: event.type,
      source: event.source?.groupId || event.source?.userId || null,
    });
    return true;
  } catch (e) {
    if (e.code === 6 || e.code === 'already-exists') return false;
    throw e;
  }
}

async function completeLineEvent(db, event) {
  const eventId = eventDocId(event);
  if (!eventId) return;
  const ref = db.collection('lineWebhookEvents').doc(eventId);
  await ref.set(
    {
      status: 'done',
      completedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function releaseLineEvent(db, event) {
  const eventId = eventDocId(event);
  if (!eventId) return;
  try {
    await db.collection('lineWebhookEvents').doc(eventId).delete();
  } catch {
    /* ignore */
  }
}

module.exports = { claimLineEvent, completeLineEvent, releaseLineEvent };
