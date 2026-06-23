import { useState } from 'react';
import { th } from './i18n/th';
import { my } from './i18n/my';
import { en } from './i18n/en';

// คำแปลแยกไฟล์ตามภาษา (apps/chincha-tea/src/lib/i18n/) — รวมกลับเป็น T ที่เดิม
export const T = { th, my, en };

export function useLang() {
  const [lang, setLangState] = useState(() => localStorage.getItem('chincha-lang') || 'my');
  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('chincha-lang', l);
  };
  const t = (key) => T[lang]?.[key] ?? T.my?.[key] ?? T.th?.[key] ?? key;
  const tTh = (key) => T.th?.[key] ?? key;
  return { lang, setLang, t, tTh, isMy: lang === 'my' };
}
