import { fsListCollection, fsPatch, fsRunQuery } from '../lib/firestoreRest';
import { isValidLineUserId, normalizeLineUserId } from '../lib/lineUserId';

/** รวม Set ของ UID ที่ไม่ต้องขึ้น「LINE รอผูก」 */
export function mergeSkipLineOaUidSets(...sets) {
  const out = new Set();
  for (const s of sets) {
    if (!(s instanceof Set)) continue;
    for (const u of s) out.add(u);
  }
  return out;
}

export function lineUserIdFromMember(doc) {
  return normalizeLineUserId(doc?.lineUserId);
}

/** UID ของสมาชิกแอป (shrimp_users.lineUserId) — ทดสอบบอทไม่ขึ้นรอผูก */
export async function fetchStaffLineUserIdSet() {
  const rows = await fsListCollection('shrimp_users', 120);
  const out = new Set();
  for (const u of rows) {
    const uid = lineUserIdFromMember(u);
    if (isValidLineUserId(uid)) out.add(uid);
  }
  return out;
}

export async function fetchShrimpMembersForLineAssign() {
  try {
    const rows = await fsRunQuery({
      from: [{ collectionId: 'shrimp_users' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
      limit: 100,
    });
    return rows;
  } catch {
    return fsListCollection('shrimp_users', 100);
  }
}

export async function saveMemberLineUserId(memberId, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!memberId) throw new Error('ไม่พบสมาชิก');
  if (!isValidLineUserId(uid)) throw new Error('LINE UID ไม่ถูกต้อง (U... 33 ตัว)');

  await fsPatch(`shrimp_users/${memberId}`, {
    lineUserId: uid,
    lineUserIdUpdatedAt: new Date().toISOString(),
  });
  return uid;
}

/** ผูก UID จากรายการรอผูก → สมาชิกแอป (ไม่ขึ้นรอผูกอีก) */
export async function assignPendingLineUidToMember(memberId, lineUserId) {
  const uid = await saveMemberLineUserId(memberId, lineUserId);
  const staffSet = await fetchStaffLineUserIdSet();
  return { uid, staffSet };
}
