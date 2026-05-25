/** LINE Messaging API user id — ขึ้นต้น U (ไม่ใช่ @ไลน์) */
export function normalizeLineUserId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^U[a-fA-F0-9]{32}$/.test(s)) return s;
  const m = s.match(/U[a-fA-F0-9]{32}/);
  return m ? m[0] : s;
}

export function isValidLineUserId(id) {
  return /^U[a-fA-F0-9]{32}$/.test(id || '');
}
