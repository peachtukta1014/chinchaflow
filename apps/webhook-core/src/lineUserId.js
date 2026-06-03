const LINE_UID_RE = /^U[a-fA-F0-9]{32}$/;

function normalizeLineUserId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (LINE_UID_RE.test(s)) return s;
  const m = s.match(/U[a-fA-F0-9]{32}/);
  return m ? m[0] : '';
}

module.exports = {
  LINE_UID_RE,
  normalizeLineUserId,
};
