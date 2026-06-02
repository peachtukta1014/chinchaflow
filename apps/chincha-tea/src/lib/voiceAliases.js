/** แยกคำออกเสียงที่ตั้งเอง (คั่นด้วย comma / |) */
export function parseVoiceAliases(raw) {
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,，、|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
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
  parseVoiceAliases(item?.voiceAliases).forEach(add);
  return out;
}

export function escapeRegExp(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
