/** ตรวจภาษาข้อความ LINE — ใช้ตอบกลับให้ตรงกับที่ผู้ใช้พิมพ์ */

function hasMyanmarScript(text) {
  return /[\u1000-\u109F]/.test(text || '');
}

function latinLetterRatio(text) {
  const s = String(text || '');
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  const thai = (s.match(/[\u0E00-\u0E7F]/g) || []).length;
  const my = (s.match(/[\u1000-\u109F]/g) || []).length;
  const total = latin + thai + my;
  if (!total) return { latin: 0, thai: 0, my: 0 };
  return { latin: latin / total, thai: thai / total, my: my / total };
}

/**
 * @returns {'th'|'my'|'en'}
 */
function detectMessageLang(text) {
  const raw = String(text || '').trim();
  if (!raw) return 'th';
  if (hasMyanmarScript(raw)) return 'my';
  const r = latinLetterRatio(raw);
  if (r.latin >= 0.45 && r.thai < 0.25) return 'en';
  return 'th';
}

/**
 * ภาษาตอบกลับ — จำใน session ตอนสั่งต่อ (เล็ก/กลาง หลัง pending)
 */
function resolveReplyLang(text, session) {
  const fromText = detectMessageLang(text);
  if (fromText !== 'th') return fromText;
  const stored = session?.replyLang;
  if (stored === 'my' || stored === 'en') return stored;
  return 'th';
}

module.exports = {
  detectMessageLang,
  resolveReplyLang,
  hasMyanmarScript,
};
