import { burmeseToThai, hasMyanmarScript } from './burmeseToThai';
import { RESTOCK_MY_TO_TH, RESTOCK_TH_TO_EN, RESTOCK_TH_TO_MY } from './restockLexicon';

const thToMySorted = [...RESTOCK_TH_TO_MY].sort((a, b) => b[0].length - a[0].length);
const thToEnSorted = [...RESTOCK_TH_TO_EN].sort((a, b) => b[0].length - a[0].length);
const myToThSorted = [...RESTOCK_MY_TO_TH].sort((a, b) => b[0].length - a[0].length);

function applyPhraseMap(text, pairs, { regexForAscii = false } = {}) {
  if (!text) return '';
  let out = text.normalize('NFC');
  for (const [from, to] of pairs) {
    if (!from) continue;
    out = out.split(from).join(to);
    if (regexForAscii && /^[a-z0-9\s./'-]+$/i.test(from)) {
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, to);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** รวมชื่อเป็นภาษาไทยมาตรฐาน (รองรับพม่า/ผสมไทย+พม่า) */
export function restockCanonicalThai(name) {
  if (!name || typeof name !== 'string') return '';
  let s = name.normalize('NFC').trim();
  if (!hasMyanmarScript(s)) return s;

  let th = applyPhraseMap(s, myToThSorted, { regexForAscii: true });
  th = burmeseToThai(th) || th;
  if (hasMyanmarScript(th)) {
    th = applyPhraseMap(th, myToThSorted, { regexForAscii: true });
    th = burmeseToThai(th) || th;
  }
  return th.replace(/\s+/g, ' ').trim();
}

/** แปลรายการสั่งของ → ไทย (รองรับพม่า/ผสม) */
export function restockNameToThai(name) {
  if (!name || typeof name !== 'string') return '';
  if (!hasMyanmarScript(name)) return name.trim();
  return restockCanonicalThai(name);
}

/** แปลรายการสั่งของ → พม่า */
export function restockNameToMyanmar(name) {
  if (!name || typeof name !== 'string') return '';
  const th = restockCanonicalThai(name);
  const base = th || name.trim();
  return applyPhraseMap(base, thToMySorted) || base;
}

/** แปลรายการสั่งของ → อังกฤษ */
export function restockNameToEnglish(name) {
  if (!name || typeof name !== 'string') return '';
  const th = restockCanonicalThai(name);
  const base = th || name.trim();
  return applyPhraseMap(base, thToEnSorted) || base;
}

/**
 * ชื่อแสดงตามภาษา UI + บรรทัดรอง/อังกฤษ
 * @returns {{ primary: string, sub: string, en: string }}
 */
export function restockDisplayName(name, lang) {
  if (!name) return { primary: '', sub: '', en: '' };

  const nameTh = restockCanonicalThai(name) || name.trim();
  const nameMy = restockNameToMyanmar(name);
  const nameEn = restockNameToEnglish(name);
  const original = name.trim();

  const enLine = nameEn && nameEn !== nameTh ? nameEn : '';

  if (lang === 'my') {
    const primary = nameMy || original;
    const sub = enLine && enLine !== primary ? enLine : '';
    return { primary, sub, en: sub };
  }

  if (lang === 'en') {
    const primary = enLine || nameTh || original;
    const sub = nameMy && nameMy !== primary ? nameMy : '';
    return { primary, sub, en: primary };
  }

  // th (default)
  const primary = nameTh || original;
  const sub = nameMy && nameMy !== primary ? nameMy : '';
  return { primary, sub, en: enLine && enLine !== primary ? enLine : '' };
}
