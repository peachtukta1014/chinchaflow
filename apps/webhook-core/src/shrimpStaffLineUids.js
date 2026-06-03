const { normalizeLineUserId, LINE_UID_RE } = require('./lineUserId');

let cached = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

function uidFromDoc(data) {
  const u = normalizeLineUserId(data?.lineUserId);
  return LINE_UID_RE.test(u) ? u : '';
}

/** UID สมาชิกแอป — ไม่ auto-ผูกเป็นลูกค้าร้านเมื่อสั่งทดสอบ LINE OA */
async function getStaffLineUserIdSet(db) {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;

  const snap = await db.collection('shrimp_users').limit(120).get();
  const set = new Set();
  for (const doc of snap.docs) {
    const uid = uidFromDoc(doc.data());
    if (uid) set.add(uid);
  }
  cached = set;
  cachedAt = now;
  return set;
}

async function isStaffLineUserId(db, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!LINE_UID_RE.test(uid)) return false;
  const set = await getStaffLineUserIdSet(db);
  return set.has(uid);
}

function clearStaffLineUidCache() {
  cached = null;
  cachedAt = 0;
}

module.exports = {
  getStaffLineUserIdSet,
  isStaffLineUserId,
  clearStaffLineUidCache,
};
