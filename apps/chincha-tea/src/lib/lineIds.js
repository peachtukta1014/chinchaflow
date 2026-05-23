/** ตรวจรูปแบบ LINE Group / User ID — กันใส่ Channel secret หรือ Access token ผิดช่อง */

const LINE_GROUP_RE = /^C[a-zA-Z0-9]{32}$/;
const LINE_USER_RE = /^U[a-zA-Z0-9]{32}$/;

export function looksLikeLineAccessToken(value) {
  const s = (value || '').trim();
  return s.length > 50 && (/[+/=]/.test(s) || s.startsWith('UQ') || s.startsWith('eyJ'));
}

export function looksLikeChannelSecret(value) {
  const s = (value || '').trim();
  return /^[a-f0-9]{32}$/i.test(s) && !s.startsWith('C') && !s.startsWith('U');
}

export function parseNotifyUserIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean);
  return String(raw).split(/[,;\s]+/).map((id) => id.trim()).filter(Boolean);
}

/** @returns {string|null} error key for i18n */
export function validateTeaLineTargets({ notifyGroupId, notifyUserIds }) {
  const gid = (notifyGroupId || '').trim();
  if (gid) {
    if (looksLikeLineAccessToken(gid) || looksLikeChannelSecret(gid)) {
      return 'lineInvalidGroupIdSecretOrToken';
    }
    if (!LINE_GROUP_RE.test(gid)) return 'lineInvalidGroupIdFormat';
  }

  const uids = parseNotifyUserIds(notifyUserIds);
  for (const id of uids) {
    if (looksLikeLineAccessToken(id) || looksLikeChannelSecret(id)) {
      return 'lineInvalidUserIdSecretOrToken';
    }
    if (!LINE_USER_RE.test(id)) return 'lineInvalidUserIdFormat';
  }

  if (!gid && uids.length === 0) return 'lineNoNotifyTarget';

  return null;
}
