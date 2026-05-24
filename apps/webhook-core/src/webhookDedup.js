/** กันประมวลผล LINE event ซ้ำ (retry / ส่งซ้ำ) */
async function claimLineEvent(db, event) {
  const eventId = event?.webhookEventId || event?.message?.id;
  if (!eventId) return true;

  const ref = db.collection('lineWebhookEvents').doc(eventId);
  try {
    await ref.create({
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

module.exports = { claimLineEvent };
