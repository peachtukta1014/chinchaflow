const { normalizeLineUserId } = require('./lineUserId');

const SHRIMP_LINE_DOC = 'shrimpLine';

function normalizePendingLinkMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    const uid = normalizeLineUserId(key);
    if (!uid) continue;
    out[uid] = {
      requestedAt: val?.requestedAt || new Date().toISOString(),
      source: val?.source || 'link_cmd',
    };
  }
  return out;
}

async function registerPendingLinkRequest(db, admin, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return;
  const ref = db.collection('config').doc(SHRIMP_LINE_DOC);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const data = snap.exists ? snap.data() : {};
    const prev = normalizePendingLinkMap(data.pendingLinkByUid);
    prev[uid] = { requestedAt: new Date().toISOString(), source: 'link_cmd' };
    t.set(
      ref,
      {
        pendingLinkByUid: prev,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

async function clearPendingLinkRequest(db, admin, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return;
  const ref = db.collection('config').doc(SHRIMP_LINE_DOC);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const prev = normalizePendingLinkMap(data.pendingLinkByUid);
    if (!prev[uid]) return;
    delete prev[uid];
    t.set(
      ref,
      {
        pendingLinkByUid: prev,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

module.exports = {
  normalizePendingLinkMap,
  registerPendingLinkRequest,
  clearPendingLinkRequest,
};
