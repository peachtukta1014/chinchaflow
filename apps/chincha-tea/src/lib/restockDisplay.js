import { burmeseToThai, hasMyanmarScript } from './burmeseToThai';
import { RESTOCK_MY_TO_TH, RESTOCK_TH_TO_MY } from './restockLexicon';

const thToMySorted = [...RESTOCK_TH_TO_MY].sort((a, b) => b[0].length - a[0].length);
const myToThSorted = [...RESTOCK_MY_TO_TH].sort((a, b) => b[0].length - a[0].length);

function applyPhraseMap(text, pairs, { regexForAscii = false } = {}) {
  if (!text) return '';
  let out = text.normalize('NFC');
  for (const [from, to] of pairs) {
    if (!from) continue;
    out = out.split(from).join(to);
    if (regexForAscii && /^[a-z0-9\s./-]+$/i.test(from)) {
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, to);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** แปลรายการสั่งของ → ไทย (รองรับพม่า/ผสม) */
export function restockNameToThai(name) {
  if (!name || typeof name !== 'string') return '';
  if (!hasMyanmarScript(name)) return name.trim();
  const viaRestock = applyPhraseMap(name, myToThSorted, { regexForAscii: true });
  return burmeseToThai(viaRestock) || viaRestock;
}

/** แปลรายการสั่งของ → พม่า */
export function restockNameToMyanmar(name) {
  if (!name || typeof name !== 'string') return '';
  if (hasMyanmarScript(name)) return name.trim();
  const th = restockNameToThai(name);
  return applyPhraseMap(th, thToMySorted) || th;
}

/**
 * ชื่อแสดงตามภาษา UI + บรรทัดรองเป็นภาษาต้นฉบับ/คู่แปล
 * @returns {{ primary: string, sub: string }}
 */
export function restockDisplayName(name, lang) {
  if (!name) return { primary: '', sub: '' };

  const nameTh = restockNameToThai(name);
  const nameMy = restockNameToMyanmar(name);
  const original = name.trim();

  if (lang === 'my') {
    const primary = nameMy || original;
    const sub = nameTh && nameTh !== primary ? nameTh : (hasMyanmarScript(original) ? '' : original !== primary ? original : '');
    return { primary, sub: sub && sub !== primary ? sub : '' };
  }

  if (lang === 'en') {
    const primary = nameTh || original;
    const sub = hasMyanmarScript(original) ? original : (nameMy && nameMy !== primary ? nameMy : '');
    return { primary, sub: sub && sub !== primary ? sub : '' };
  }

  // th (default)
  const primary = nameTh || original;
  const sub = hasMyanmarScript(original)
    ? original
    : (nameMy && nameMy !== primary ? nameMy : '');
  return { primary, sub: sub && sub !== primary ? sub : '' };
}
