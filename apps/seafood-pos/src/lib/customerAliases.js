import { canonicalCustomerNameKey, exactCustomerNameMatch, uidCustomerNameMatch } from './customerNameMatch.js';

const NAME_SPLIT_RE = /[,，、]/;

/** แยกชื่อหลักกับชื่อเรียกอื่นจากช่องเดียว (คั่นด้วย comma) */
export function splitCustomerNameInput(raw) {
  const parts = String(raw || '')
    .split(NAME_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return { name: '', aliases: [] };
  const [name, ...aliases] = parts;
  return { name, aliases };
}

function dedupeAliasLabels(primary, extras) {
  const seen = new Set();
  const out = [];
  const primaryTrim = String(primary || '').trim();
  if (primaryTrim) {
    const pk = canonicalCustomerNameKey(primaryTrim);
    if (pk) seen.add(pk);
    out.push(primaryTrim);
  }
  for (const label of extras) {
    const s = String(label || '').trim();
    if (!s) continue;
    const key = canonicalCustomerNameKey(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** ทุกชื่อที่ใช้จับคู่ออเดอร์ LINE / เสียง / บอท */
export function collectCustomerSearchNames(customer) {
  const split = splitCustomerNameInput(customer?.name || '');
  const primary = split.name || String(customer?.name || '').trim();
  const extras = [
    ...split.aliases,
    ...(Array.isArray(customer?.aliases) ? customer.aliases : []),
    customer?.nickname,
    customer?.shortName,
  ];
  return dedupeAliasLabels(primary, extras);
}

/** รวมชื่อหลัก + ชื่อเรียกอื่น สำหรับแสดงในช่องแก้ไข */
export function formatCustomerNameForEdit(customer) {
  const names = collectCustomerSearchNames(customer);
  return names.join(', ');
}

/** แปลงฟอร์ม → เก็บ Firestore (ชื่อหลัก + aliases[]) */
export function customerFieldsFromNameInput(rawName, existingAliases = []) {
  const { name, aliases } = splitCustomerNameInput(rawName);
  const merged = dedupeAliasLabels(name, [...aliases, ...existingAliases]);
  const primary = merged[0] || String(name || '').trim();
  const aliasOnly = merged.length > 1 ? merged.slice(1) : [];
  return {
    name: primary,
    aliases: aliasOnly.length ? aliasOnly : [],
  };
}

export function customerMatchesLabel(customer, want) {
  const target = String(want || '').trim();
  if (!target) return false;
  return collectCustomerSearchNames(customer).some(
    (label) => exactCustomerNameMatch(label, target) || uidCustomerNameMatch(label, target),
  );
}

/** ชื่อจากช่องฟอร์ม (อาจมี comma) → รายการที่ลองจับกับออเดอร์ */
export function labelsFromCustomerInput(raw) {
  return collectCustomerSearchNames({ name: raw, aliases: [] });
}
