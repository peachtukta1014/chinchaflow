/** ตรวจรูปแบบ LINE Group / User ID */

const LINE_GROUP_RE = /^C[a-zA-Z0-9]{32}$/;
const LINE_USER_RE = /^U[a-zA-Z0-9]{32}$/;

export function parseNotifyUserIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean);
  return String(raw).split(/[,;\s]+/).map((id) => id.trim()).filter(Boolean);
}

export function isValidLineGroupId(id) {
  return LINE_GROUP_RE.test((id || '').trim());
}

export function isValidLineUserId(id) {
  return LINE_USER_RE.test((id || '').trim());
}

export function mergeNotifyUserIds(existing, newId) {
  const id = (newId || '').trim();
  if (!id) return String(existing || '').trim();
  const ids = parseNotifyUserIds(existing);
  if (ids.includes(id)) return ids.join(', ');
  return [...ids, id].join(', ');
}

/** เลือก Group / User ID ล่าสุดจาก log webhook (`line_messages`) */
export function pickLatestLineIds(messages = []) {
  const sorted = [...messages].sort((a, b) => {
    const ta = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt || '');
    const tb = typeof b.createdAt === 'string' ? b.createdAt : (b.createdAt || '');
    return tb.localeCompare(ta);
  });

  let groupId = null;
  let userIdDm = null;
  let userIdAny = null;

  for (const m of sorted) {
    const gid = (m.groupId || '').trim();
    const uid = (m.userId || '').trim();
    if (!groupId && isValidLineGroupId(gid)) groupId = gid;
    if (!userIdDm && !gid && isValidLineUserId(uid)) userIdDm = uid;
    if (!userIdAny && isValidLineUserId(uid)) userIdAny = uid;
    if (groupId && userIdDm) break;
  }

  return { groupId, userId: userIdDm || userIdAny };
}
