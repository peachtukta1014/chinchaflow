import { MY_TO_TH_PHRASES } from './burmeseLexicon';

const sortedPhrases = [...MY_TO_TH_PHRASES].sort((a, b) => b[0].length - a[0].length);

/** แปลงข้อความพม่า (หรือผสม) → ไทย เพื่อค้นหาเมนู / voice parser */
export function burmeseToThai(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text.normalize('NFC');
  for (const [my, th] of sortedPhrases) {
    if (!my) continue;
    out = out.split(my).join(th);
    if (/^[a-z0-9\s.-]+$/i.test(my)) {
      const re = new RegExp(my.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, th);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** มีตัวอักษรพม่าหรือไม่ */
export function hasMyanmarScript(text) {
  return /[\u1000-\u109F]/.test(text || '');
}

/** ภาษาสำหรับ Speech Recognition */
export function speechRecognitionLang(appLang) {
  if (appLang === 'my') return 'my-MM';
  if (appLang === 'en') return 'en-US';
  return 'th-TH';
}
