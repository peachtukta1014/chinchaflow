const { SEAFOOD_MY_TO_TH, SEAFOOD_EN_TO_TH } = require('./seafoodLexicon');
const { hasMyanmarScript } = require('./orderMessageLang');

const mySorted = [...SEAFOOD_MY_TO_TH].sort((a, b) => b[0].length - a[0].length);
const enSorted = [...SEAFOOD_EN_TO_TH].sort((a, b) => b[0].length - a[0].length);

function applyPhraseMap(text, pairs) {
  let out = text.normalize('NFC');
  for (const [from, to] of pairs) {
    if (!from) continue;
    out = out.split(from).join(to);
    if (/^[a-z0-9\s./-]+$/i.test(from)) {
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, to);
    }
  }
  return out;
}

/** 2,5 → 2.5 · 2 . 5 → 2.5 */
function normalizeQuantityText(text) {
  let t = String(text || '');
  t = t.replace(/(\d)\s*,\s*(\d)/g, '$1.$2');
  t = t.replace(/(\d)\s+\.\s+(\d)/g, '$1.$2');
  t = t.replace(/(\d)\s*จุด\s*(\d)/gi, '$1.$2');
  return t;
}

/**
 * แปลข้อความสั่งของ → ไทย ก่อน parse (ข้อมูลใน Firestore ยังเป็นไทย)
 */
function translateOrderTextToThai(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  let out = normalizeQuantityText(raw);
  const hasMy = hasMyanmarScript(out);
  const hasLatin = /[A-Za-z]/.test(out);
  const littleThai = (out.match(/[\u0E00-\u0E7F]/g) || []).length < 8;

  if (hasMy || (hasLatin && littleThai)) {
    out = applyPhraseMap(out, mySorted);
  }
  if (hasLatin) {
    out = applyPhraseMap(out, enSorted);
  }

  return out.replace(/\s+/g, ' ').trim();
}

module.exports = {
  translateOrderTextToThai,
  normalizeQuantityText,
};
