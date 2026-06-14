import { parseProductAliases } from './productAliases';

/** แยกคำออกเสียง/alias ที่ตั้งเอง (คั่นด้วย comma / | / ขึ้นบรรทัดใหม่) */
export function parseVoiceAliases(raw) {
  return parseProductAliases(raw);
}

/** รวมชื่อปกติ + voiceAliases ไม่ซ้ำ (ไม่สนตัวพิมพ์) */
export function voiceAliasNames(item, baseNames = []) {
  const seen = new Set();
  const out = [];
  const add = (n) => {
    const s = (n || '').trim();
    if (!s || seen.has(s.toLowerCase())) return;
    seen.add(s.toLowerCase());
    out.push(s);
  };
  baseNames.forEach(add);
  parseVoiceAliases(item?.aliases).forEach(add);
  parseVoiceAliases(item?.voiceAliases).forEach(add);
  return out;
}

export function escapeRegExp(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
